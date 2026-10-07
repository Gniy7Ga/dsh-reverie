/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/host/ai.js
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Partly adapted: the default-model selection and ctx.llm streaming loop; prompts and aligned bilingual translation are new.
 * See NOTICE.md for details.
 */
/**
 * Model calls through the harness's own default model selection
 * (`ctx.llm` + `agentDefaultModel`): translation and the daily brief.
 */
import { createSystemMessage, createUserMessage } from '@deepseek-ai/dsh-llm';

function defaultSelection(ctx) {
  const service = ctx.get('agentDefaultModel');
  if (!service) throw new Error('当前 Harness 没有可用的默认模型服务');
  const selection = service.currentSelection();
  if (!selection?.provider || !selection?.model) throw new Error('还没有选择默认模型，请先在 Harness 设置里选一个模型');
  return selection;
}

/** One non-streaming-style completion; returns the full text. */
export async function complete(ctx, systemPrompt, userText, signal) {
  const { provider, model } = defaultSelection(ctx);
  const messages = [
    createSystemMessage(systemPrompt),
    createUserMessage({ content: [{ type: 'text', text: userText }], source: { kind: 'user' } }),
  ];
  const stream = ctx.llm.stream({ provider, model, messages, ...(signal ? { signal } : {}) });
  let text = '';
  let finished = false;
  for await (const chunk of stream) {
    if (signal?.aborted) throw new Error('已取消');
    if (chunk.type === 'text-delta') text += chunk.text;
    else if (chunk.type === 'block-end' && chunk.block?.type === 'text' && text === '') text = chunk.block.text;
    else if (chunk.type === 'finish') {
      finished = true;
      if (chunk.reason?.kind === 'error') throw new Error(`模型调用失败：${chunk.reason.failure?.message ?? '未知错误'}`);
      if (chunk.reason?.kind === 'aborted') throw new Error('已取消');
      break;
    }
  }
  if (!finished && text === '') throw new Error('模型没有返回内容');
  const cleaned = text.replace(/^```(?:markdown|md)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  if (cleaned === '') throw new Error('模型返回了空结果');
  return cleaned;
}

const PROMPTS = {
  zh: `你是专业译者。把用户给出的每一段翻译成自然流畅的简体中文。
规则：
- 输入每段以 ⟦数字⟧ 开头。输出必须逐段对应：每段译文同样以相同的 ⟦数字⟧ 开头，数量和顺序完全一致，不合并、不拆分、不遗漏
- 只翻译，不总结、不解释；人名、产品名、公司名保留原文
- 口语转录稿可以顺手去掉「嗯、呃、you know」之类的口头禅，让中文读起来通顺
- 只输出译文`,
  en: `You are a professional translator. Translate every paragraph into natural, fluent English.
Rules:
- Each input paragraph starts with ⟦number⟧. The output must correspond one to one: each translation starts with the same ⟦number⟧, same count and order; never merge, split, or skip
- Translate only; no summaries or explanations; keep names of people, products and companies
- For spoken transcripts you may drop filler words so the English reads smoothly
- Output only the translations`,
};

/** Split indexed texts into chunks of roughly `size` characters. */
export function chunkIndexed(items, size = 4500) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const item of items) {
    if (length + item.text.length > size && current.length) { chunks.push(current); current = []; length = 0; }
    current.push(item);
    length += item.text.length + 8;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Parse "⟦n⟧ text" output back into a map n → text. */
export function parseIndexed(text) {
  const out = new Map();
  const pattern = /⟦(\d+)⟧\s*([\s\S]*?)(?=⟦\d+⟧|$)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = match[2].trim();
    if (value) out.set(Number(match[1]), value);
  }
  return out;
}

/**
 * Translate texts paragraph-by-paragraph so the result aligns with the source.
 * @param {string[]} texts - source paragraphs ('' entries are skipped and stay '').
 * @param {'zh'|'en'} target
 * @param {{ title?: string, onChunk?: (partial: string[], done: number, total: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<{ title?: string, texts: string[] }>}
 */
export async function translateAligned(ctx, texts, target, { title, onChunk, signal } = {}) {
  const prompt = PROMPTS[target] ?? PROMPTS.zh;
  const result = texts.map(() => '');
  const items = texts.map((text, index) => ({ index, text: String(text ?? '').trim() })).filter((item) => item.text);
  if (title) items.unshift({ index: -1, text: title });
  const chunks = chunkIndexed(items);
  let translatedTitle;
  let done = 0;
  let next = 0;
  const translateChunk = async (chunk) => {
    const input = chunk.map((item, i) => `⟦${i + 1}⟧ ${item.text}`).join('\n\n');
    let parsed = parseIndexed(await complete(ctx, prompt, input, signal));
    if (parsed.size < chunk.length * 0.8 && chunk.length > 1) {
      // Model drifted from the numbering: retry once.
      parsed = parseIndexed(await complete(ctx, prompt, input, signal));
    }
    chunk.forEach((item, i) => {
      const value = parsed.get(i + 1) ?? '';
      if (item.index === -1) translatedTitle = value || undefined;
      else result[item.index] = value;
    });
  };
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      await translateChunk(chunk);
      done += 1;
      onChunk?.(result, done, chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, worker));
  return { title: translatedTitle, texts: result };
}
