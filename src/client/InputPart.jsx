/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** 输入: drop a link → transcript / article → bilingual reading. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '../shared/sanitize.js';
import { formatDuration } from '../shared/text.js';
import { Icon } from './icons.jsx';
import { VideoPlayer } from './VideoPlayer.jsx';
import { useStable } from './ui.jsx';

const STATUS = { queued: '排队中', resolving: '解析中', downloading: '下载音频', transcribing: '转录中', translating: '翻译中', done: '完成', error: '失败' };
const PLATFORM = { youtube: 'YouTube', bilibili: 'B 站', xiaoyuzhou: '小宇宙', spotify: 'Spotify', apple: '播客', file: '音视频', other: '视频', web: '网页', xiaohongshu: '小红书', wechat: '公众号', twitter: '推特' };
const FILTERS = [['all', '全部'], ['media', '音视频'], ['web', '网页'], ['xiaohongshu', '小红书'], ['wechat', '公众号'], ['twitter', '推特']];
const SOCIAL = new Set(['xiaohongshu', 'wechat', 'twitter']);
const MODES = { bilingual: '中英对照', translation: '中文', original: '原文' };

function shortDate(time) {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
const running = (item) => !['done', 'error'].includes(item.status);

export function InputSide({ api, selected, onSelect, nav, version, onCounts }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [unread, setUnread] = useState(false);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useStable(async () => {
    try { const page = await api.listItems({ filter, unread }); setItems(page.items); setError(''); } catch (cause) { setError(cause.message ?? String(cause)); }
  });
  useEffect(() => { void load(); }, [filter, unread, version, selected]);
  const active = items.some(running);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [active]);
  const valid = /^https?:\/\/\S+$/i.test(link.trim());
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const result = await api.submit({ text: link.trim() });
      if (result.type !== 'item') throw new Error('这不是一个链接');
      if (result.existing) nav.showToast('这个链接之前已经收过了');
      setLink('');
      onSelect(result.id);
      onCounts();
      await load();
    } catch (cause) { nav.showToast(cause.message ?? String(cause)); }
    setBusy(false);
  };
  return <>
    <div className="mr-drop">
      <Icon name="link" size={16} />
      <input value={link} placeholder="粘贴 YouTube / B站 / 小宇宙 / Spotify / 小红书 / 公众号 / 推特 / 网页链接" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} disabled={busy} />
      <button type="button" className={`mr-drop-go${valid ? ' is-ready' : ''}`} disabled={!valid || busy} onClick={() => void submit()}>{busy ? <span className="mr-spinner" /> : '收进来'}</button>
    </div>
    <div className="mr-pills">
      <div className="mr-pill-scroll" onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY; }}>
        {FILTERS.map(([key, label]) => <button type="button" key={key} className={`mr-pill${filter === key ? ' is-on' : ''}`} onClick={(event) => { setFilter(key); event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }}>{label}</button>)}
      </div>
      <button type="button" className={`mr-pill${unread ? ' is-on' : ''}`} onClick={() => setUnread((v) => !v)}>未读</button>
    </div>
    <div className="mr-list">
      {error && <div className="mr-list-empty mr-error-text">读取失败：{error}</div>}
      {!items.length && !error && <div className="mr-list-empty">{unread ? '没有未读的内容' : filter !== 'all' ? `还没有${FILTERS.find(([key]) => key === filter)?.[1] ?? ''}内容` : '还没有内容。在上面粘贴一个链接：音视频会在本机转录，外文自动翻成中英对照；网页、小红书、公众号、推特会抓取正文和图片。'}</div>}
      {items.map((item) => <button type="button" key={item.id} className={`mr-row${selected === item.id ? ' is-on' : ''}${!item.read && item.status === 'done' ? ' is-unread' : ''}`} onClick={() => onSelect(item.id)}>
        <div className="mr-row-text">
          <div className="mr-row-meta"><span>{item.source || PLATFORM[item.platform] || ''}</span><span>{shortDate(item.createdAt)}</span></div>
          <div className="mr-row-title">{item.titleZh || item.title}</div>
          {running(item)
            ? <div className="mr-prog"><span>{item.stage || STATUS[item.status]}{item.progress ? ` ${Math.round(item.progress * 100)}%` : ''}</span><div className="mr-bar"><i style={{ width: `${Math.max(3, Math.round((item.progress || 0) * 100))}%` }} /></div></div>
            : item.status === 'error' ? <div className="mr-row-summary mr-error-text">{item.error}</div>
              : item.preview && <div className="mr-row-summary">{item.preview}</div>}
        </div>
        {item.image && <img className={`mr-row-thumb${item.platform === 'youtube' || item.platform === 'bilibili' ? ' is-wide' : ''}`} src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}
      </button>)}
    </div>
  </>;
}

// ---------------------------------------------------------------------------

export function InputCenter({ api, selection, nav, aiOpen, onSubject, onSelectId, version }) {
  const itemId = selection?.id;
  const [raw, setData] = useState(null);
  const data = raw?.item?.id === itemId ? raw : null; // never render another item's late response
  const [error, setError] = useState('');
  const [mode, setMode] = useState('bilingual');
  const [menu, setMenu] = useState('');
  const [pop, setPop] = useState(null);
  const [quoteDraft, setQuoteDraft] = useState(null);
  const [videoStart, setVideoStart] = useState(0);
  const [order, setOrder] = useState([]);
  const media = useRef(null);
  const body = useRef(null);
  const scroller = useRef(null);
  const focused = useRef('');

  const load = useStable(async () => {
    if (!itemId) return undefined;
    try { const next = await api.getItem({ id: itemId }); setData(next); setError(''); return next; } catch (cause) { setError(cause.message); return undefined; }
  });
  useEffect(() => {
    setData(null); setError(''); setPop(null); setVideoStart(0); setMenu('');
    if (!itemId) return;
    void load().then((next) => { if (next && next.item.status === 'done' && !next.item.read) void api.markItemRead({ id: itemId }).then(() => nav.refresh()); });
    void api.listItems({}).then((page) => setOrder(page.items.map((item) => item.id))).catch(() => {});
  }, [itemId, selection?.nonce]);
  useEffect(() => { if (itemId && version) void load(); }, [version]);
  const busy = data && (running(data.item) || data.translation?.status === 'running');
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [busy]);

  const hasTranslation = Boolean(data?.translation?.texts?.some(Boolean));
  const effective = hasTranslation ? mode : 'original';
  useEffect(() => {
    if (data) onSubject({ type: 'item', id: itemId, title: data.item.titleZh || data.item.title, mode: effective });
    else if (!itemId) onSubject(null);
  }, [itemId, data?.item?.titleZh, data?.item?.title, effective]);

  // Jump to a quoted paragraph.
  useEffect(() => {
    const focus = selection?.focus;
    const token = `${itemId}|${selection?.nonce}`;
    if (!data || focus?.blockIndex === undefined || focused.current === token) return;
    focused.current = token;
    requestAnimationFrame(() => {
      const el = body.current?.querySelector(`[data-block="${focus.blockIndex}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.classList.add('is-flash');
      setTimeout(() => el?.classList.remove('is-flash'), 1800);
    });
  }, [data, selection?.nonce]);

  const onMouseUp = () => {
    const sel = window.getSelection?.();
    const text = String(sel?.toString() ?? '').trim();
    if (!text || !body.current?.contains(sel.anchorNode)) { setPop(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = scroller.current.getBoundingClientRect();
    const blockEl = (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest?.('[data-block]');
    const blockIndex = blockEl ? Number(blockEl.getAttribute('data-block')) : undefined;
    setPop({ text: text.slice(0, 4000), blockIndex, start: blockIndex !== undefined ? data.blocks[blockIndex]?.start : undefined, x: rect.left - host.left + rect.width / 2, y: rect.top - host.top + scroller.current.scrollTop });
    if (aiOpen) nav.setSelection(text.slice(0, 6000));
  };

  const seek = (seconds) => {
    if (media.current) { media.current.currentTime = seconds; void media.current.play().catch(() => {}); return; }
    setVideoStart(Math.max(1, Math.floor(seconds)));
  };
  const translate = async (target) => {
    setMenu('');
    try { await api.translateItem({ id: itemId, target }); await load(); } catch (cause) { nav.showToast(cause.message); }
  };
  const step = (delta) => {
    const index = order.indexOf(itemId);
    const next = order[index + delta];
    if (next) onSelectId(next);
  };

  if (!itemId) return <div className="mr-empty-center"><Icon name="link" size={30} strokeWidth={1.4} /><h3>把链接扔进来</h3><p>YouTube、B 站、小宇宙单集、Spotify 和苹果播客单集、音视频直链会在本机转录，外文自动翻成中英对照；网页、小红书笔记、公众号文章、推文会自动抓取正文和图片，带视频的帖子也会转录。</p></div>;
  if (error) return <div className="mr-empty-center mr-error-text">{error}</div>;
  if (!data) return <div className="mr-skeleton"><div /><div /><div /></div>;
  const { item, blocks, translation } = data;
  const playback = item.playback ?? {};
  const isZh = String(item.language ?? '').startsWith('zh');
  const quoted = new Set((data.quotes ?? []).map((memo) => memo.quote?.blockIndex).filter((index) => index !== undefined));

  return <div className="mr-reader">
    <div className="mr-topbar">
      <button type="button" className="mr-icon-button" title="收起 / 展开列表" onClick={nav.toggleSide}><Icon name="sidebar" size={19} /></button>
      <label className="mr-select" title="阅读版本">
        <span>版本</span>
        <select value={effective} disabled={!hasTranslation} onChange={(event) => setMode(event.target.value)}>
          {(hasTranslation ? Object.keys(MODES) : ['original']).map((key) => <option key={key} value={key}>{key === 'translation' && translation?.target === 'en' ? 'English' : MODES[key]}</option>)}
        </select>
        <Icon name="down" size={14} />
      </label>
      {translation?.status === 'running' && <span className="mr-progress-text"><span className="mr-spinner" />翻译中 {translation.total > 1 ? `${translation.done}/${translation.total}` : ''}</span>}
      <button type="button" className="mr-icon-button" title="上一篇" onClick={() => step(-1)}><Icon name="up" size={19} /></button>
      <button type="button" className="mr-icon-button" title="下一篇" onClick={() => step(1)}><Icon name="down" size={19} /></button>
      <span className="mr-spacer" />
      <button type="button" className="mr-icon-button" title={item.read ? '标为未读' : '标为已读'} onClick={async () => { await api.markItemRead({ id: itemId, read: !item.read }); await load(); nav.refresh(); }}><Icon name="circleCheck" size={19} /></button>
      <button type="button" className={`mr-icon-button${aiOpen ? ' is-on' : ''}`} title="AI 伴读" onClick={nav.openAI} disabled={!blocks.length}><Icon name="wand" size={19} /></button>
      <div className="mr-menu-wrap">
        <button type="button" className="mr-icon-button" title="更多" onClick={() => setMenu((m) => (m ? '' : 'more'))}><Icon name="more" size={19} strokeWidth={3} /></button>
        {menu === 'more' && <div className="mr-menu" onMouseLeave={() => setMenu('')}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setMenu('')}><Icon name="external" size={14} />打开原链接</a>
          {item.status === 'done' && blocks.length > 0 && <button type="button" onClick={() => void translate(isZh ? 'en' : 'zh')}><Icon name="translate" size={14} />{hasTranslation ? '重新翻译' : isZh ? '翻译成英文' : '翻译成中文'}</button>}
          {item.status === 'error' && <button type="button" onClick={async () => { setMenu(''); await api.retryItem({ id: itemId }); await load(); }}><Icon name="refresh" size={14} />重试</button>}
          <button type="button" className="is-danger" onClick={async () => { setMenu(''); if (!window.confirm('删除这条输入？（记过的笔记会保留）')) return; await api.deleteItem({ id: itemId }); nav.refresh(); onSelectId(null); }}><Icon name="trash" size={14} />删除</button>
        </div>}
      </div>
    </div>

    <div className="mr-scroll" ref={scroller} onMouseUp={onMouseUp}>
      <article className="mr-article">
        <div className="mr-article-meta">
          <span>{item.source || PLATFORM[item.platform]}</span>
          <span>{new Date(item.publishedAt || item.createdAt).toLocaleDateString('zh-CN')}</span>
          <span className="mr-badge">{MODES[effective]}</span>
          {item.duration ? <span>{formatDuration(item.duration)}</span> : null}
        </div>
        <h1 className="mr-article-title">{effective !== 'original' && translation?.title ? translation.title : item.title}</h1>
        {effective === 'bilingual' && translation?.title && translation.title !== item.title ? <p className="mr-article-sub">{item.title}</p> : <div style={{ height: 14 }} />}

        {playback.kind === 'youtube' && <VideoPlayer key={videoStart} videoId={playback.videoId} playerUrl={data.videoPlayerUrl ? `${data.videoPlayerUrl}${videoStart ? `?t=${videoStart}` : ''}` : undefined} />}
        {playback.kind === 'bilibili' && <div className="mr-video"><iframe className="mr-video-frame" key={videoStart} src={`https://player.bilibili.com/player.html?isOutside=true&bvid=${playback.bvid}&autoplay=${videoStart ? 1 : 0}&danmaku=0${videoStart ? `&t=${videoStart}` : ''}`} title="B 站播放器" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
        {playback.kind === 'audio' && item.audioUrl && <div className="mr-audio"><audio ref={media} controls preload="none" src={item.audioUrl} /></div>}
        {playback.kind === 'video-file' && item.audioUrl && <div className="mr-video"><video ref={media} className="mr-video-frame" controls preload="metadata" src={item.audioUrl} /></div>}

        {running(item) && item.status !== 'translating' && <div className="mr-state">
          <div className="mr-steps">{['resolving', 'downloading', 'transcribing', 'translating'].map((key, index, all) => {
            const at = all.indexOf(item.status);
            return <span key={key} className={index < at ? 'is-done' : index === at ? 'is-now' : ''}>{index < at ? '✓ ' : ''}{({ resolving: item.kind === 'web' ? `抓取${SOCIAL.has(item.platform) ? PLATFORM[item.platform] : '网页'}` : '解析链接', downloading: '下载音频', transcribing: '本机转录', translating: '翻译' })[key]}</span>;
          }).filter((_, index) => item.kind !== 'web' || item.playback?.kind === 'video-file' || index === 0 || index === 3)}</div>
          <div className="mr-prog"><span>{item.stage || STATUS[item.status]}{item.progress ? ` ${Math.round(item.progress * 100)}%` : ''}</span><div className="mr-bar"><i style={{ width: `${Math.max(3, Math.round((item.progress || 0) * 100))}%` }} /></div></div>
          <small>可以先去看别的，完成后这里会自动出现全文。</small>
        </div>}
        {item.status === 'error' && <div className="mr-state mr-error-text"><span><Icon name="alert" size={14} /> {item.error}</span><button type="button" className="mr-button" onClick={async () => { await api.retryItem({ id: itemId }); await load(); }}>重试</button></div>}
        {translation?.status === 'error' && <div className="mr-state mr-error-text"><span>翻译失败：{translation.error}</span><button type="button" className="mr-button" onClick={() => void translate(translation.target)}>重试翻译</button></div>}

        {data.descriptionHtml && <details className="mr-notes"><summary>{item.kind === 'web' ? '摘要' : '节目 / 视频简介'}</summary><div className="mr-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.descriptionHtml) }} /></details>}

        <div className={`mr-body mr-mode-${effective}`} ref={body} onClick={(event) => { const ts = event.target.closest?.('[data-seek]'); if (ts) seek(Number(ts.getAttribute('data-seek'))); }}>
          {blocks.map((block, index) => <Block key={index} index={index} block={block} other={translation?.texts?.[index]} mode={effective} quoted={quoted.has(index)} />)}
        </div>
      </article>
      {pop && <div className="mr-pop" style={{ left: pop.x, top: pop.y }} onMouseUp={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { setQuoteDraft(pop); setPop(null); }}><Icon name="pen" size={13} />记到输出</button>
        <button type="button" onClick={() => { nav.askAI(pop.text); setPop(null); }}><Icon name="sparkles" size={13} />AI 解读</button>
      </div>}
    </div>
    {quoteDraft && <QuoteDialog api={api} itemId={itemId} draft={quoteDraft} onClose={() => setQuoteDraft(null)} onSaved={() => { setQuoteDraft(null); window.getSelection()?.removeAllRanges(); nav.showToast('已记到「输出」'); void load(); nav.refresh(); }} showToast={nav.showToast} />}
  </div>;
}

function Block({ block, other, mode, index, quoted }) {
  if (block.type === 'img') return <figure className="mr-block-img" data-block={index}><img src={block.src} alt={block.alt ?? ''} loading="lazy" referrerPolicy="no-referrer" /></figure>;
  if (block.type === 'code') return <pre className="mr-block-code" data-block={index}>{block.text}</pre>;
  const Tag = block.type === 'h' ? 'h3' : block.type === 'quote' ? 'blockquote' : 'p';
  const showOriginal = mode !== 'translation' || !other;
  const showOther = mode !== 'original' && other;
  const prefix = block.type === 'li' ? '• ' : '';
  return <div className={`mr-block mr-block-${block.type}${quoted ? ' is-quoted' : ''}`} data-block={index}>
    {block.start !== undefined && <button type="button" className="mr-ts" data-seek={Math.floor(block.start)}>{formatDuration(block.start)}</button>}
    <div className="mr-block-text">
      {showOriginal && <Tag className="mr-block-original">{prefix}{block.text}</Tag>}
      {showOther && <Tag className={mode === 'bilingual' ? 'mr-block-translation' : 'mr-block-original'}>{prefix}{other}</Tag>}
    </div>
  </div>;
}

function QuoteDialog({ api, itemId, draft, onClose, onSaved, showToast }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.saveMemo({ text, quote: { itemId, text: draft.text, start: draft.start, blockIndex: draft.blockIndex } }); onSaved(); } catch (error) { showToast(error.message); }
    setBusy(false);
  };
  return <div className="mr-dialog-backdrop" onClick={onClose}>
    <div className="mr-dialog" role="dialog" aria-label="记到输出" onClick={(event) => event.stopPropagation()}>
      <strong>记到输出</strong>
      <blockquote>{draft.text.length > 400 ? `${draft.text.slice(0, 400)}…` : draft.text}</blockquote>
      <textarea autoFocus rows={4} value={text} placeholder="写下你的想法（可以留空）  #标签" onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save(); if (event.key === 'Escape') onClose(); }} />
      <div className="mr-dialog-actions"><button type="button" className="mr-button" onClick={onClose}>取消</button><button type="button" className="mr-button is-dark" disabled={busy} onClick={() => void save()}>记下 ⌘↩</button></div>
    </div>
  </div>;
}
