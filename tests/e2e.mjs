/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// End-to-end host test through a real Cordis Context with a fake model.
// Hits the network and runs local Whisper (needs Metal → run outside the sandbox).
import assert from 'node:assert';
import { Context } from '@deepseek-ai/cordis';
process.env.DSH_HOME ||= '/tmp/mr-e2e-home';
const { default: ReaderService } = await import('../lib/index.js');
const tools = [];
const ctx = new Context();
ctx.reflect.provide('tools', { register: (t) => tools.push(t) });
ctx.reflect.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'fake', model: 'fake' }) });
ctx.reflect.provide('systemPrompt', { context() {} });
ctx.reflect.provide('llm', {
  async *stream({ messages }) {
    const input = messages[1].content[0].text;
    const out = [...input.matchAll(/⟦(\d+)⟧\s*([\s\S]*?)(?=⟦\d+⟧|$)/g)].map((m) => `⟦${m[1]}⟧ 译:${m[2].trim().slice(0, 20)}`).join('\n\n');
    yield { type: 'text-delta', text: out }; yield { type: 'finish', reason: { kind: 'stop' } };
  },
});
const svc = new ReaderService(ctx, {});
await svc.ready;
console.log('tools:', tools.map((t) => t.name).join(','));
const ov = await svc.overview({});
console.log('toolchain:', JSON.stringify(ov.toolchain));

const waitFor = async (id, limitMs = 600_000) => {
  const end = Date.now() + limitMs;
  let last = '';
  while (Date.now() < end) {
    const item = svc.store.item(id);
    const tr = (await svc.store.body(id))?.translation;
    const line = `${item.status} ${item.stage ?? ''} ${Math.round((item.progress ?? 0) * 100)}%`;
    if (line !== last) { console.log('  ', line); last = line; }
    if (item.status === 'error') return item;
    if (item.status === 'done' && (!tr || tr.status !== 'running')) return item;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('timeout');
};

const memo = await svc.submit({ text: '读书笔记：注意力是新的石油 #想法 #AI/agent' });
assert.equal(memo.type, 'memo');
const web = await svc.submit({ text: 'https://www.anthropic.com/news/claude-opus-4-5' });
console.log('web submitted', web);
let item = await waitFor(web.id);
let detail = await svc.getItem({ id: web.id });
console.log('web:', item.status, item.title, '| blocks', detail.blocks.length, '| zh title', detail.translation?.title, '| tr0', detail.translation?.texts?.[0]);
assert.equal(item.status, 'done');

const media = await svc.submit({ text: 'https://www.bilibili.com/video/BV1GJ411x7h7' });
item = await waitFor(media.id);
detail = await svc.getItem({ id: media.id });
console.log('media:', item.status, item.error ?? '', item.title, '| lang', item.language, '| paragraphs', detail.blocks.length, '| first', detail.blocks[0]?.text?.slice(0, 100), '| start', detail.blocks[1]?.start, '| src', detail.transcriptSource);

const quote = await svc.saveMemo({ text: '这段很好 #摘录', quote: { itemId: web.id, text: detail.blocks[0]?.text ?? 'x', blockIndex: 0 } }).catch((e) => ({ error: e.message }));
console.log('quote memo', quote.id ?? quote.error);
const both = await svc.submit({ text: '看看这个 https://www.ruanyifeng.com/blog/2024/01/weekly-issue-285.html #周刊' });
console.log('memo with link', both);
const tl = await svc.timeline({});
console.log('timeline', tl.total, tl.entries.map((e) => `${e.type}:${(e.title ?? e.text).slice(0, 30)}`));
console.log('tags', JSON.stringify((await svc.overview({})).tags));
console.log('tag filter', (await svc.timeline({ tag: 'AI' })).total);
await svc.setReadingContext({ sessionId: 's1', key: web.id, version: 'bilingual', selection: '' });
console.log('ctx len', svc.store.data.companionContexts.s1.text.length);
const out = await tools.find((t) => t.name === 'reader_search').execute({ query: '' });
console.log(out.split('\n').slice(0, 4).join('\n'));
await svc.store.flush();
await svc.videoPlayer.dispose();
process.exit(0);
