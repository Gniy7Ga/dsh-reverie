/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** Agent-facing tools: the main Harness chat can drop links and thoughts into the reader and read them back. */
import { defineTool } from '@deepseek-ai/dsh-tools';

const text = (value) => [{ type: 'text', text: value }];
const output = { schema: { type: 'string' }, render: (_args, value) => text(value) };
const KIND = { twitter: '推特', wechat: '公众号', xiaohongshu: '小红书' };
const STATUS = { queued: '排队中', resolving: '解析中', downloading: '下载中', transcribing: '转录中', translating: '翻译中', done: '完成', error: '失败' };

function line(entry) {
  if (entry.type === 'memo') return `- ${entry.id} | 笔记 | ${entry.text.replace(/\s+/g, ' ').slice(0, 120)}${entry.tags?.length ? ` | ${entry.tags.map((tag) => `#${tag}`).join(' ')}` : ''}`;
  return `- ${entry.id} | ${KIND[entry.platform] ?? (entry.kind === 'web' ? '网页' : '音视频')} | ${entry.titleZh || entry.title} | ${STATUS[entry.status] ?? entry.status}${entry.error ? `：${entry.error}` : ''}`;
}

export function createToolDefinitions(service) {
  return [
    defineTool({
      name: 'reader_ingest',
      description: 'Send a link to the "Reverie" reader: audio/video links (YouTube, Bilibili, 小宇宙, Spotify and Apple Podcasts episodes, media files) are transcribed locally with Whisper and translated (Chinese/English); X/Twitter posts, WeChat 公众号 articles, 小红书 notes and other web pages are extracted to clean text (video posts are transcribed too) and translated. Returns the item id; processing continues in the background unless wait=true.',
      parameters: {
        url: { type: 'string', description: 'The link.', required: true },
        wait: { type: 'boolean', description: 'Wait until transcription/extraction (not translation) finishes. Long media can take minutes.' },
      },
      output,
      execute: async (args) => {
        const item = await service.ingest(args.url);
        if (args.wait) {
          const deadline = Date.now() + 30 * 60_000;
          while (Date.now() < deadline) {
            const current = service.store.item(item.id);
            if (!current || ['done', 'error', 'translating'].includes(current.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        const current = service.store.item(item.id) ?? item;
        return `${item.existing ? '已存在' : '已加入'}：${current.id}｜${current.title}｜${STATUS[current.status] ?? current.status}${current.error ? `：${current.error}` : ''}。用 reader_read_item 读取全文。`;
      },
    }),
    defineTool({
      name: 'reader_add_memo',
      description: 'Save a flomo-style memo (a thought / insight) into the reader. #tags in the text are recognized.',
      parameters: { text: { type: 'string', description: 'Memo text, may include #tags.', required: true } },
      output,
      execute: async (args) => {
        const memo = await service.saveMemo({ text: args.text });
        return `已记下（${memo.id}）${memo.tags?.length ? `，标签：${memo.tags.map((tag) => `#${tag}`).join(' ')}` : ''}`;
      },
    }),
    defineTool({
      name: 'reader_search',
      description: 'Search the reader timeline (memos and ingested links). filter: all | items | memos; tag filters memos by #tag.',
      parameters: {
        query: { type: 'string', description: 'Text to search; empty lists the latest.' },
        filter: { type: 'string', description: 'all | items | memos' },
        tag: { type: 'string', description: 'Tag name without #.' },
        limit: { type: 'number', description: 'Default 20, max 100.' },
      },
      output,
      execute: async (args) => {
        const page = await service.timeline({ search: args.query ?? '', filter: args.filter ?? 'all', tag: args.tag ?? '', limit: Math.min(args.limit ?? 20, 100) });
        if (!page.entries.length) return '没有匹配的内容。';
        return [`共 ${page.total} 条：`, ...page.entries.map(line)].join('\n');
      },
    }),
    defineTool({
      name: 'reader_read_item',
      description: 'Read one ingested item in full (transcript or article). mode: bilingual (default) | original | translation.',
      parameters: {
        id: { type: 'string', description: 'Item id from reader_search / reader_ingest.', required: true },
        mode: { type: 'string', description: 'bilingual | original | translation' },
      },
      output,
      execute: async (args) => {
        const { item, text: body, truncated } = await service.readingText(args.id, args.mode ?? 'bilingual', 80_000);
        return [`# ${item.titleZh || item.title}`, `${item.source ?? ''} · ${item.url}`, `状态：${STATUS[item.status] ?? item.status}`, '', body || '（还没有正文）', truncated ? '\n（已截断）' : ''].join('\n');
      },
    }),
  ];
}
