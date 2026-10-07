/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// Offline host test of the 输入 / 输出 / 回顾 APIs through a real Cordis Context with a fake model.
// No network: items are seeded directly into the store.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'mr-unit-'));
const { default: ReaderService } = await import('../lib/index.js');

const tools = [];
const prompts = [];
const ctx = new Context();
ctx.reflect.provide('tools', { register: (tool) => tools.push(tool) });
ctx.reflect.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'fake', model: 'fake' }) });
ctx.reflect.provide('systemPrompt', { context() {} });
ctx.reflect.provide('llm', {
  async *stream({ messages }) {
    const system = messages[0].content[0].text;
    const input = messages[1].content[0].text;
    prompts.push(system);
    let out;
    if (input.includes('⟦')) out = [...input.matchAll(/⟦(\d+)⟧\s*([\s\S]*?)(?=⟦\d+⟧|$)/g)].map((m) => `⟦${m[1]}⟧ 译:${m[2].trim().slice(0, 20)}`).join('\n\n');
    else {
      const ref = /\[\[[mi]:[\w-]+\]\]/.exec(input)?.[0] ?? '';
      out = system.includes('回顾这一周') ? `这周，你在想「注意力」\n\n你反复写到注意力${ref}。还有什么没想清楚？` : `你对这个主题的看法在变化${ref}。`;
    }
    yield { type: 'text-delta', text: out };
    yield { type: 'finish', reason: { kind: 'stop' } };
  },
});

const svc = new ReaderService(ctx, {});
await svc.ready;
assert.deepEqual(tools.map((tool) => tool.name).sort(), ['reader_add_memo', 'reader_ingest', 'reader_read_item', 'reader_search']);

// --- 输入: seed one finished English web item ---------------------------------
const DAY = 86400_000;
const item = svc.store.addItem({ id: 'it_web1', kind: 'web', platform: 'web', url: 'https://example.com/a', title: 'Attention is all you need', source: 'example.com', createdAt: Date.now() - 2 * 3600_000, status: 'done', progress: 1, language: 'en', preview: 'Attention…' });
await svc.store.saveBody(item.id, { blocks: [{ type: 'h', text: 'Intro' }, { type: 'p', text: 'Attention is the new oil.' }, { type: 'img', src: 'https://example.com/x.png' }], transcriptSource: 'web' });
let list = await svc.listItems({});
assert.equal(list.items.length, 1);
assert.equal(list.unread, 1);
assert.equal((await svc.listItems({ filter: 'media' })).items.length, 0);
assert.equal((await svc.listItems({ unread: true })).items.length, 1);

// Platform filters: a legacy 公众号 item saved as `platform: 'web'` is still recognised by its URL.
svc.store.addItem({ id: 'it_wx', kind: 'web', platform: 'web', url: 'https://mp.weixin.qq.com/s/abcdefghij', title: '公众号', createdAt: Date.now() - 4 * 3600_000, status: 'done', progress: 1, language: 'zh' });
svc.store.addItem({ id: 'it_tw', kind: 'web', platform: 'twitter', url: 'https://x.com/jack/status/20', title: 'tweet', createdAt: Date.now() - 5 * 3600_000, status: 'done', progress: 1, language: 'en' });
assert.deepEqual((await svc.listItems({ filter: 'web' })).items.map((entry) => entry.id), ['it_web1']);
assert.deepEqual((await svc.listItems({ filter: 'wechat' })).items.map((entry) => entry.id), ['it_wx']);
assert.equal((await svc.listItems({ filter: 'wechat' })).items[0].platform, 'wechat');
assert.deepEqual((await svc.listItems({ filter: 'twitter' })).items.map((entry) => entry.id), ['it_tw']);
assert.equal((await svc.listItems({ filter: 'xiaohongshu' })).items.length, 0);
assert.equal((await svc.listItems({})).items.length, 3);
await svc.deleteItem({ id: 'it_wx' });
await svc.deleteItem({ id: 'it_tw' });
assert.equal((await svc.listItems({})).items.length, 1);

await svc.translateItem({ id: item.id, target: 'zh', wait: true });
let detail = await svc.getItem({ id: item.id });
assert.equal(detail.translation.status, "done");
assert.equal(detail.translation.texts[1], '译:Attention is the new');
assert.equal(detail.translation.texts[2], '', 'images are not translated');

await svc.markItemRead({ id: item.id });
assert.equal((await svc.listItems({ unread: true })).items.length, 0);
await svc.markItemRead({ id: item.id, read: false });
assert.equal((await svc.listItems({ unread: true })).items.length, 1);

// Invalid links are rejected up front (no network involved).
await assert.rejects(svc.submit({ text: '' }));
await assert.rejects(svc.ingest('not a url'));

// --- 输出: memos, quotes, tags, related -----------------------------------------
const plain = await svc.saveMemo({ text: '注意力是新的石油 #注意力 #AI/agent' });
assert.deepEqual(plain.tags, ['注意力', 'AI/agent']);
const quoted = await svc.saveMemo({ text: '这段说得对 #注意力', quote: { itemId: item.id, text: 'Attention is the new oil.', blockIndex: 1 } });
assert.equal(quoted.quote.itemId, item.id);
assert.equal(quoted.quote.blockIndex, 1);
assert.equal(quoted.quote.title, '译:Attention is all you', 'quote title prefers the Chinese title');
const viaSubmit = await svc.submit({ text: '随手一记 #生活' });
assert.equal(viaSubmit.type, 'memo');
await assert.rejects(svc.saveMemo({ text: '   ' }));

let memos = await svc.listMemos({});
assert.equal(memos.memos.length, 3);
assert.equal(memos.tags[0].name, '注意力');
assert.equal((await svc.listMemos({ tag: 'AI' })).memos.length, 1, 'parent tag matches child tag');
const memo = await svc.getMemo({ id: plain.id });
assert.deepEqual(memo.related.map((m) => m.id), [quoted.id]);
detail = await svc.getItem({ id: item.id });
assert.equal(detail.quotes.length, 1);
assert.equal(detail.item.quoteCount, 1);

const edited = await svc.saveMemo({ id: plain.id, text: '注意力是新的石油，也是新的货币 #注意力' });
assert.deepEqual(edited.tags, ['注意力']);
await svc.pinMemo({ id: viaSubmit.id });
assert.equal((await svc.listMemos({})).memos[0].id, viaSubmit.id, 'pinned first');

// Quote of an earlier memo ("接着写一条").
const rethink = await svc.saveMemo({ text: '再想一下', quote: { memoId: plain.id } });
assert.equal(rethink.quote.memoId, plain.id);
assert.match(rethink.quote.text, /石油/);

// --- 回顾 -------------------------------------------------------------------
// An old memo so 今日回顾 has a candidate.
svc.store.data.memos.push({ id: 'mm_old', text: '一年前的想法 #注意力', tags: ['注意力'], createdAt: Date.now() - 40 * DAY, updatedAt: Date.now() - 40 * DAY });
let ov = await svc.reviewOverview({});
assert.equal(ov.today.count, 1);
assert.ok(ov.week.memos >= 4);
assert.equal(ov.theme.tag, '注意力');
assert.equal(ov.unread, 1);

const today = await svc.getReview({ kind: 'today' });
assert.deepEqual(today.memos.map((m) => m.id), ['mm_old']);
await svc.markReviewed({ id: 'mm_old' });
assert.equal((await svc.getReview({ kind: 'today' })).memos[0].reviewed, true);

await svc.generateReview({ kind: 'week', wait: true });
const week = await svc.getReview({ kind: 'week' });
assert.equal(week.ai.headline, '这周，你在想「注意力」');
assert.match(week.ai.text, /\[\[[mi]:/);
assert.ok(Object.values(week.refs).every((ref) => /^(输入|输出) · /.test(ref.label)) && Object.keys(week.refs).length === 1, 'citations resolve to labels');
assert.equal(week.stats.items, 1);
assert.equal(week.stats.quoted, 1);
assert.equal(week.flows.length, 1);
assert.equal(week.flows[0].item.id, item.id);
assert.equal(week.resurface[0].id, 'mm_old');
assert.equal(week.hasEarlier, true);
const lastWeek = await svc.getReview({ kind: 'week', offset: 1 });
assert.equal(lastWeek.stats.memos, 0);
ov = await svc.reviewOverview({});
assert.equal(ov.week.headline, '这周，你在想「注意力」');

await svc.generateReview({ kind: 'theme', tag: '注意力', wait: true });
const theme = await svc.getReview({ kind: 'theme', tag: '注意力' });
assert.equal(theme.tag, '注意力');
assert.equal(theme.memos[0].id, 'mm_old', 'theme timeline is oldest first');
assert.equal(theme.items[0].id, item.id);
assert.match(theme.ai.text, /变化/);

assert.equal(theme.generating, false, 'fresh theme review is not regenerated');
await svc.saveMemo({ text: '新的一条 #注意力' });
const staleTheme = await svc.getReview({ kind: 'theme', tag: '注意力' });
assert.equal(staleTheme.generating, true, 'a new memo under the tag refreshes the theme review');
assert.equal((await svc.getReview({ kind: 'week' })).generating, false, 'fresh week review is not regenerated right away');
while (svc.controllers.size) await new Promise((resolve) => setTimeout(resolve, 10));

const unread = await svc.getReview({ kind: 'unread' });
assert.deepEqual(unread.items.map((i) => i.id), [item.id]);

// --- AI companion contexts ---------------------------------------------------
await svc.setReadingContext({ sessionId: 's-item', id: item.id, mode: 'bilingual', selection: 'Attention is the new oil.' });
const readingCtx = svc.store.data.companionContexts['s-item'].text;
assert.match(readingCtx, /selectedPassage/);
assert.match(readingCtx, /译:Attention/);
assert.match(readingCtx, /userNotesOnThis/);
await svc.setNotesContext({ sessionId: 's-memo', scope: 'memo', id: plain.id });
assert.match(svc.store.data.companionContexts['s-memo'].text, /当前笔记/);
await svc.setNotesContext({ sessionId: 's-week', scope: 'review', kind: 'week', offset: 0 });
assert.match(svc.store.data.companionContexts['s-week'].text, /AI 已写的周回顾/);
await svc.setNotesContext({ sessionId: 's-theme', scope: 'review', kind: 'theme', tag: '注意力' });
assert.match(svc.store.data.companionContexts['s-theme'].text, /#注意力/);
await assert.rejects(svc.setReadingContext({ sessionId: '', id: item.id }));

// --- Agent tools ---------------------------------------------------------------
const search = await tools.find((tool) => tool.name === 'reader_search').execute({ query: '石油' });
assert.match(search, /共 2 条/);
const read = await tools.find((tool) => tool.name === 'reader_read_item').execute({ id: item.id });
assert.match(read, /Attention is the new oil/);

// --- Delete ------------------------------------------------------------------------
await svc.deleteMemo({ id: rethink.id });
await svc.deleteItem({ id: item.id });
assert.equal((await svc.listItems({})).items.length, 0);
assert.ok((await svc.listMemos({})).memos.some((m) => m.id === quoted.id), 'quotes survive item deletion');

// Persistence round trip.
await svc.store.flush();
const again = new svc.store.constructor(undefined, svc.store.dir);
await again.load();
assert.equal(again.data.memos.length, svc.store.data.memos.length);
assert.equal(again.data.reviews[`week:${svc.weekRange(0).key}`].headline, '这周，你在想「注意力」');

await svc.videoPlayer.dispose();
console.log('ok: unit tests passed');
process.exit(0);
