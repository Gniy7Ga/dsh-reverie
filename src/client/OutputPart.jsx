/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** 输出: a diary / flomo-style notebook. */
import { useEffect, useRef, useState } from 'react';
import { escapeHtml, linkify } from '../shared/text.js';
import { Icon } from './icons.jsx';
import { useStable } from './ui.jsx';

export function dayLabel(time) {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const diff = Math.floor((startOfToday.getTime() + 86400_000 - time) / 86400_000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  const date = new Date(time);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('zh-CN', { ...(sameYear ? {} : { year: 'numeric' }), month: 'long', day: 'numeric', weekday: 'short' });
}

export function memoBodyHtml(text) {
  return linkify(escapeHtml(text)).replace(/(^|[\s(（])#([^\s#，。,!?！？；;：:、()（）[\]【】"'“”<]+)/g, '$1<span class="mr-tag">#$2</span>');
}

/** Tags at the very end are shown as chips below, so drop them from the preview text. */
const withoutTrailingTags = (text) => String(text ?? '').replace(/(\s*#[^\s#]+)+\s*$/u, '').trim();

const firstLine = (text) => String(text ?? '').replace(/(^|\s)#[^\s#]+/g, ' ').trim().split('\n')[0] || '（空白页）';

export function OutputSide({ api, selected, onSelect, nav, version }) {
  const [memos, setMemos] = useState([]);
  const [tags, setTags] = useState([]);
  const [tag, setTag] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const area = useRef(null);
  const load = useStable(async () => {
    try { const page = await api.listMemos({ tag }); setMemos(page.memos); setTags(page.tags); } catch (cause) { nav.showToast(cause.message); }
  });
  useEffect(() => { void load(); }, [tag, version, selected]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(180, Math.max(62, el.scrollHeight))}px`;
  }, [text]);
  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try { const memo = await api.saveMemo({ text: value }); setText(''); onSelect(memo.id); nav.refresh(); } catch (cause) { nav.showToast(cause.message); }
    setBusy(false);
  };
  let lastDay = '';
  return <>
    <div className="mr-write">
      <textarea ref={area} value={text} placeholder="此刻在想什么？  #标签" disabled={busy} onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }} />
      <div className="mr-write-bar"><span>⌘↩ 记下 · 会出现在今天</span><button type="button" className="mr-button is-dark is-small" disabled={!text.trim() || busy} onClick={() => void submit()}>记下</button></div>
    </div>
    <div className="mr-pills">
      <button type="button" className={`mr-pill${!tag ? ' is-on' : ''}`} onClick={() => setTag('')}>全部</button>
      <span className="mr-spacer" />
      <label className="mr-tag-select">
        <select value={tag} onChange={(event) => setTag(event.target.value)}>
          <option value="">#标签</option>
          {tags.map((item) => <option key={item.name} value={item.name}>#{item.name}（{item.count}）</option>)}
        </select>
        <Icon name="down" size={13} />
      </label>
    </div>
    <div className="mr-list">
      {!memos.length && <div className="mr-list-empty">{tag ? '这个标签下还没有笔记' : '还没有笔记。在上面随手写一句，或者在「输入」里选中一段「记到输出」。'}</div>}
      {memos.map((memo) => {
        const day = memo.pinned ? '置顶' : dayLabel(memo.createdAt);
        const header = day !== lastDay ? <div className="mr-day" key={`d-${memo.id}`}>{day}</div> : null;
        lastDay = day;
        return [header, <button type="button" key={memo.id} className={`mr-row mr-memo-row${selected === memo.id ? ' is-on' : ''}`} onClick={() => onSelect(memo.id)}>
          <div className="mr-row-text">
            <div className="mr-row-meta"><span>{new Date(memo.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>{memo.quote && <span>摘录</span>}</div>
            <div className="mr-memo-text">{withoutTrailingTags(memo.text) || (memo.quote ? '（摘录）' : '（空白页）')}</div>
            {memo.quote && <div className="mr-memo-quote">{memo.quote.text}</div>}
            {memo.tags?.length > 0 && <div className="mr-memo-tags">{memo.tags.map((name) => <span key={name} className="mr-tag">#{name}</span>)}</div>}
          </div>
        </button>];
      })}
    </div>
  </>;
}

// ---------------------------------------------------------------------------

export function OutputCenter({ api, selection, nav, aiOpen, onSubject, onSelect, version }) {
  const memoId = selection?.id;
  const draft = selection?.draft;
  const [rawMemo, setMemo] = useState(null);
  const memo = rawMemo?.id === memoId ? rawMemo : null;
  const [related, setRelated] = useState([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState('');
  const area = useRef(null);
  // One mutable record per open page: { id?, draft?, saved, pending?, timer?, creating?, loaded }.
  // Edits are saved against the page they were typed on, even after switching pages.
  const page = useRef(null);

  const save = useStable(async (target, value) => {
    if (target.id) {
      if (value === target.saved) return;
      await api.saveMemo({ id: target.id, text: value });
      target.saved = value;
      return;
    }
    if (!target.draft || (!value.trim() && !target.draft.quote)) return;
    if (target.creating) { target.queued = value; return; }
    target.creating = true;
    try {
      const created = await api.saveMemo({ text: value, quote: target.draft.quote });
      target.id = created.id;
      target.saved = value;
      target.loaded = true;
    } finally { target.creating = false; }
    if (target.queued !== undefined) { const queued = target.queued; target.queued = undefined; await save(target, queued); }
    if (page.current === target) onSelect({ id: target.id });
  });
  const flush = useStable(async (target = page.current) => {
    if (!target) return;
    clearTimeout(target.timer);
    if (target.pending === undefined) return;
    const value = target.pending;
    target.pending = undefined;
    try {
      await save(target, value);
      if (page.current === target && target.pending === undefined) setSaving('已保存');
      nav.refresh();
    } catch (cause) { if (page.current === target) setSaving(''); nav.showToast(`没保存上：${cause.message}`); }
  });

  const load = useStable(async () => {
    const target = page.current;
    if (!target?.id) return;
    try {
      const result = await api.getMemo({ id: target.id });
      if (page.current !== target) return; // the user already moved to another page
      setMemo(result.memo); setRelated(result.related);
      if (!target.loaded) { target.loaded = true; target.saved = result.memo.text; setText(result.memo.text); }
    } catch (cause) { nav.showToast(cause.message); }
  });
  useEffect(() => {
    // Selecting the memo a draft just turned into keeps the same page (and its caret).
    if (memoId && page.current?.id === memoId) { void load(); return; }
    const previous = page.current;
    if (previous) void flush(previous);
    page.current = { id: memoId, draft: memoId ? undefined : draft, saved: undefined, loaded: false };
    setMemo(null); setRelated([]); setSaving('');
    if (memoId) { setText(''); void load(); }
    else { setText(''); if (draft) setTimeout(() => area.current?.focus(), 30); }
  }, [memoId, selection?.nonce]);
  useEffect(() => { if (memoId && version) void load(); }, [version]);
  useEffect(() => {
    if (memo) onSubject({ type: 'memo', id: memo.id, title: firstLine(memo.text).slice(0, 40) });
    else onSubject(null);
  }, [memo?.id, memo?.text]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(240, el.scrollHeight)}px`;
  }, [text, memo?.id]);

  const onChange = (value) => {
    const target = page.current;
    setText(value);
    setSaving('正在保存…');
    target.pending = value;
    clearTimeout(target.timer);
    target.timer = setTimeout(() => void flush(target), target.id ? 700 : 1200);
  };
  useEffect(() => () => { void flush(); }, []);

  const topbar = <div className="mr-topbar">
    <button type="button" className="mr-icon-button" title="收起 / 展开列表" onClick={nav.toggleSide}><Icon name="sidebar" size={19} /></button>
    <button type="button" className="mr-button" onClick={() => nav.newMemo({})}><Icon name="plus" size={14} />新的一页</button>
    {saving && <span className="mr-progress-text">{saving}</span>}
    <span className="mr-spacer" />
    {memo && <button type="button" className={`mr-icon-button${memo.pinned ? ' is-on' : ''}`} title={memo.pinned ? '取消置顶' : '置顶'} onClick={async () => { await api.pinMemo({ id: memo.id, pinned: !memo.pinned }); await load(); nav.refresh(); }}><Icon name="pin" size={19} /></button>}
    {memo && <button type="button" className="mr-icon-button" title="删除" onClick={async () => { if (!window.confirm('删除这一页？')) return; clearTimeout(page.current?.timer); if (page.current) page.current.pending = undefined; await api.deleteMemo({ id: memo.id }); onSelect(null); nav.refresh(); }}><Icon name="trash" size={19} /></button>}
    <button type="button" className={`mr-icon-button${aiOpen ? ' is-on' : ''}`} title="AI 对话" disabled={!memo} onClick={nav.openAI}><Icon name="wand" size={19} /></button>
  </div>;

  if (!memoId && !draft) {
    return <div className="mr-reader">{topbar}<div className="mr-empty-center"><Icon name="pen" size={30} strokeWidth={1.4} /><h3>写下此刻的想法</h3><p>在左边随手记一句，或者点「新的一页」写长一点。读的时候选中一段，可以直接「记到输出」。</p></div></div>;
  }
  const when = new Date(memo?.createdAt ?? Date.now());
  const quote = memo?.quote ?? draft?.quote;
  return <div className="mr-reader">
    {topbar}
    <div className="mr-scroll">
      <div className="mr-editor">
        <div className="mr-editor-date">{when.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</div>
        <div className="mr-editor-sub">{when.toLocaleDateString('zh-CN', { weekday: 'long' })} · {when.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          {memo?.tags?.length ? <> · {memo.tags.map((name) => <span key={name} className="mr-tag"> #{name}</span>)}</> : null}</div>
        {quote && <button type="button" className="mr-editor-quote" onClick={() => (quote.itemId ? nav.openItem(quote.itemId, { blockIndex: quote.blockIndex }) : quote.memoId && nav.openMemo(quote.memoId))}>
          {quote.text}<small>{quote.itemId ? `摘自「${quote.title}」· 点击回到原文` : `${quote.title ?? '之前写的'} · 点击打开`}</small>
        </button>}
        <textarea ref={area} className="mr-editor-body" value={text} placeholder={quote ? '接着写下你的想法……  #标签' : '写点什么……  #标签'} onChange={(event) => onChange(event.target.value)}
          onBlur={() => void flush()} />
        {related.length > 0 && <div className="mr-related">
          <h4><Icon name="sparkles" size={13} /> 你之前也写过</h4>
          {related.map((item) => <button type="button" key={item.id} className="mr-related-card" onClick={() => onSelect({ id: item.id })}>
            <span dangerouslySetInnerHTML={{ __html: memoBodyHtml(firstLine(item.text)) }} /><small>{dayLabel(item.createdAt)}</small>
          </button>)}
        </div>}
      </div>
    </div>
  </div>;
}
