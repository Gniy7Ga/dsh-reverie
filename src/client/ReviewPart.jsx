/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** 回顾: 今日回顾 / 本周回顾 / 主题 / 待读. */
import { Fragment, useEffect, useRef, useState } from 'react';
import { escapeHtml, formatDuration } from '../shared/text.js';
import { Icon } from './icons.jsx';
import { useStable } from './ui.jsx';
import { dayLabel, memoBodyHtml } from './OutputPart.jsx';

function weekLabel(start) {
  const a = new Date(start);
  const b = new Date(start + 6 * 86400_000);
  return `${a.getMonth() + 1}月${a.getDate()}日–${b.getMonth() === a.getMonth() ? '' : `${b.getMonth() + 1}月`}${b.getDate()}日`;
}

export function ReviewSide({ api, selected, onSelect, version }) {
  const [ov, setOv] = useState(null);
  useEffect(() => { void api.reviewOverview({}).then(setOv).catch(() => {}); }, [version, selected?.kind]);
  const rows = [
    { kind: 'today', icon: 'sun', title: '今日回顾', meta: '每天', sub: ov ? (ov.today.count ? `翻出 ${ov.today.count} 条旧想法，再想一想` : '写满一天之后，这里会翻出旧想法') : '' },
    { kind: 'week', icon: 'calendar', title: '本周回顾', meta: '周日生成', sub: ov ? (ov.week.headline || `${weekLabel(ov.week.start)} · 收了 ${ov.week.items} 份，写了 ${ov.week.memos} 条`) : '' },
    { kind: 'theme', icon: 'hash', title: ov?.theme ? `主题 · #${ov.theme.tag}` : '主题', meta: 'AI 发现', sub: ov ? (ov.theme ? `${ov.theme.memos} 条想法${ov.theme.items ? `、${ov.theme.items} 份素材` : ''}，看看观点怎么变化` : '给笔记加上 #标签 后，这里会按主题整理') : '' },
    { kind: 'unread', icon: 'inbox', title: '待读', meta: '', sub: ov ? (ov.unread ? `${ov.unread} 份素材收了还没读` : '都读完了') : '' },
  ];
  return <div className="mr-list">
    {rows.map((row) => <button type="button" key={row.kind} className={`mr-row mr-review-row${selected?.kind === row.kind ? ' is-on' : ''}`} onClick={() => onSelect({ kind: row.kind, offset: 0 })}>
      <span className="mr-review-icon"><Icon name={row.icon} size={18} /></span>
      <div className="mr-row-text">
        <div className="mr-row-meta is-title"><span className="mr-row-title">{row.title}</span><span>{row.meta}</span></div>
        <div className="mr-row-summary">{row.sub}</div>
      </div>
    </button>)}
  </div>;
}

/** AI text with [[m:id]] / [[i:id]] references → clickable chips. */
function AiText({ text, refs = {}, onMemo, onItem }) {
  const parts = String(text ?? '').split(/(\[\[[mi]:[\w-]+\]\])/g);
  return <div className="mr-review-text">{parts.map((part, index) => {
    const match = /^\[\[([mi]):([\w-]+)\]\]$/.exec(part);
    if (!match) return <Fragment key={index}>{part.split('\n').map((line, i, all) => <Fragment key={i}>{line}{i < all.length - 1 && <br />}</Fragment>)}</Fragment>;
    const ref = refs[match[2]];
    if (!ref) return null; // the model cited something that no longer exists (or never did)
    return <button type="button" key={index} className="mr-cite" title={ref.text} onClick={() => (match[1] === 'm' ? onMemo(match[2]) : onItem(match[2]))}>{ref.label}</button>;
  })}</div>;
}

export function ReviewCenter({ api, selection, nav, aiOpen, onSubject, onSelect, version }) {
  const [raw, setData] = useState(null);
  const [error, setError] = useState('');
  const kind = selection?.kind ?? 'week';
  // Ignore a response that belongs to the previously selected review (different shape).
  const data = raw?.kind === kind ? raw : null;
  const seq = useRef(0);
  const load = useStable(async () => {
    const ticket = ++seq.current;
    try {
      const next = await api.getReview({ kind, offset: selection?.offset ?? 0, tag: selection?.tag });
      if (ticket === seq.current) { setData(next); setError(''); }
    } catch (cause) { if (ticket === seq.current) setError(cause.message); }
  });
  useEffect(() => { setData(null); void load(); }, [kind, selection?.offset, selection?.tag, version]);
  useEffect(() => {
    if (!data?.generating) return undefined;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [data?.generating]);
  useEffect(() => {
    const title = kind === 'today' ? '今日回顾' : kind === 'unread' ? '待读' : kind === 'theme' ? `主题 · #${data?.tag ?? ''}` : `本周回顾 · ${data?.start ? weekLabel(data.start) : ''}`;
    onSubject({ type: 'review', kind, offset: selection?.offset ?? 0, tag: data?.tag, title });
  }, [kind, selection?.offset, data?.tag, data?.start]);

  const regenerate = async () => {
    try { await api.generateReview({ kind, offset: selection?.offset ?? 0, tag: data?.tag }); await load(); } catch (cause) { nav.showToast(cause.message); }
  };
  const rethink = (memo) => nav.newMemo({ quote: { memoId: memo.id, text: memo.text, title: `我在 ${dayLabel(memo.createdAt)} 写的` } });
  const cite = { onMemo: nav.openMemo, onItem: (id) => nav.openItem(id) };

  const topbar = <div className="mr-topbar">
    <button type="button" className="mr-icon-button" title="收起 / 展开列表" onClick={nav.toggleSide}><Icon name="sidebar" size={19} /></button>
    {kind === 'week' && <>
      <button type="button" className="mr-button" disabled={!data?.hasEarlier} onClick={() => onSelect({ kind: 'week', offset: (selection?.offset ?? 0) + 1 })}>‹ 上一周</button>
      {(selection?.offset ?? 0) > 0 && <button type="button" className="mr-button" onClick={() => onSelect({ kind: 'week', offset: (selection?.offset ?? 0) - 1 })}>下一周 ›</button>}
    </>}
    <span className="mr-spacer" />
    {(kind === 'week' || kind === 'theme') && <button type="button" className="mr-button" disabled={data?.generating} onClick={() => void regenerate()}>{data?.generating ? <><span className="mr-spinner" />生成中</> : '↻ 重新生成'}</button>}
    <button type="button" className={`mr-icon-button${aiOpen ? ' is-on' : ''}`} title="AI 对话" onClick={nav.openAI}><Icon name="wand" size={19} /></button>
  </div>;

  if (error) return <div className="mr-reader">{topbar}<div className="mr-empty-center mr-error-text">{error}</div></div>;
  if (!data) return <div className="mr-reader">{topbar}<div className="mr-skeleton"><div /><div /><div /></div></div>;

  let content;
  if (kind === 'today') {
    content = <>
      <div className="mr-review-kicker">今日回顾 · {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
      <h1 className="mr-review-title">{data.memos.length ? `再看一眼这 ${data.memos.length} 条` : '今天还没有可以回顾的'}</h1>
      {!data.memos.length && <p className="mr-muted">输出里写满一天以上的想法，会在这里每天被翻出来几条。</p>}
      {data.memos.map((memo) => <ResurfaceCard key={memo.id} memo={memo} onRethink={() => { void api.markReviewed({ id: memo.id }); rethink(memo); }} onOpen={() => nav.openMemo(memo.id)} onSkip={async () => { await api.markReviewed({ id: memo.id }); await load(); }} />)}
      {data.memos.length > 0 && <p className="mr-muted mr-small">挑选规则：很久没看过的、和最近在想的标签相关的、来自摘录的，会优先被翻出来。</p>}
    </>;
  } else if (kind === 'unread') {
    content = <>
      <div className="mr-review-kicker">待读</div>
      <h1 className="mr-review-title">{data.items.length ? `${data.items.length} 份素材在等你` : '都读完了'}</h1>
      <ItemList items={data.items} onOpen={(id) => nav.openItem(id)} />
    </>;
  } else if (kind === 'theme') {
    content = <>
      <div className="mr-review-kicker">AI 发现的主题</div>
      <h1 className="mr-review-title">{data.tag ? `#${data.tag}` : '还没有主题'}</h1>
      {data.tags?.length > 1 && <div className="mr-chips">{data.tags.slice(0, 12).map((tag) => <button type="button" key={tag.name} className={`mr-chip${tag.name === data.tag ? ' is-on' : ''}`} onClick={() => onSelect({ kind: 'theme', tag: tag.name })}>#{tag.name}<em>{tag.count}</em></button>)}</div>}
      {!data.tag && <p className="mr-muted">给输出里的笔记加上 #标签，这里会按主题把它们串起来，并让 AI 看看你的观点怎么变化。</p>}
      {data.tag && <>
        <AiBlock ai={data.ai} refs={data.refs} generating={data.generating} empty={data.memos.length < 2 ? '这个主题再多写几条，AI 就能帮你看出变化。' : ''} cite={cite} />
        <h2 className="mr-review-sec">时间线</h2>
        {data.memos.map((memo) => <button type="button" key={memo.id} className="mr-resurface is-clickable" onClick={() => nav.openMemo(memo.id)}>
          <div className="mr-resurface-when">{dayLabel(memo.createdAt)}</div>
          <div className="mr-resurface-text" dangerouslySetInnerHTML={{ __html: memoBodyHtml(memo.text) }} />
        </button>)}
        {data.items?.length > 0 && <><h2 className="mr-review-sec">相关素材</h2><ItemList items={data.items} onOpen={(id) => nav.openItem(id)} /></>}
      </>}
    </>;
  } else {
    const s = data.stats;
    content = <>
      <div className="mr-review-kicker">本周回顾 · {weekLabel(data.start)}{data.ai?.generatedAt ? ` · ${new Date(data.ai.generatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 生成` : ''}</div>
      <h1 className="mr-review-title">{data.ai?.headline || (s.items || s.memos ? '这一周' : '这一周还是空的')}</h1>
      <div className="mr-stats">
        <div><b>{s.items}</b><span>份输入</span></div>
        <div><b>{s.mediaSeconds ? formatHours(s.mediaSeconds) : '0'}</b><span>音视频</span></div>
        <div><b>{s.memos}</b><span>条输出</span></div>
        <div><b>{s.quoted}</b><span>条来自摘录</span></div>
      </div>
      {(s.items > 0 || s.memos > 0) && <><h2 className="mr-review-sec"><Icon name="sparkles" size={15} /> AI 看到的</h2><AiBlock ai={data.ai} refs={data.refs} generating={data.generating} cite={cite} /></>}
      {data.flows.length > 0 && <>
        <h2 className="mr-review-sec">输入 → 输出 <small>哪些读过的东西变成了你的想法</small></h2>
        <div className="mr-flows">{data.flows.map(({ memo, item }) => <div className="mr-flow" key={memo.id}>
          <button type="button" onClick={() => nav.openItem(memo.quote.itemId, { blockIndex: memo.quote.blockIndex })}><small>{item?.source || item?.titleZh || item?.title || '原文'}</small>{memo.quote.text}</button>
          <span className="mr-flow-arrow">→</span>
          <button type="button" onClick={() => nav.openMemo(memo.id)}><small>{dayLabel(memo.createdAt)}</small><span dangerouslySetInnerHTML={{ __html: memoBodyHtml(String(memo.text).split('\n')[0] || '（摘录）') }} /></button>
        </div>)}</div>
      </>}
      {data.resurface.length > 0 && <>
        <h2 className="mr-review-sec">值得再想一想</h2>
        {data.resurface.map((memo) => <ResurfaceCard key={memo.id} memo={memo} onRethink={() => { void api.markReviewed({ id: memo.id }); rethink(memo); }} onOpen={() => nav.openMemo(memo.id)} />)}
      </>}
      {data.unread.length > 0 && <><h2 className="mr-review-sec">待读 <small>下周可以从这里开始</small></h2><ItemList items={data.unread} onOpen={(id) => nav.openItem(id)} /></>}
    </>;
  }
  return <div className="mr-reader">{topbar}<div className="mr-scroll"><div className="mr-review">{content}</div></div></div>;
}

function formatHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function AiBlock({ ai, refs, generating, empty, cite }) {
  if (empty && !ai?.text) return <p className="mr-muted">{empty}</p>;
  if (generating && !ai?.text) return <p className="mr-muted"><span className="mr-spinner" /> AI 正在读你这段时间的输入和输出…</p>;
  if (ai?.error && !ai?.text) return <p className="mr-error-text">没有生成成功：{ai.error}（点右上角「重新生成」再试）</p>;
  if (!ai?.text) return <p className="mr-muted">点右上角「重新生成」，让 AI 看看。</p>;
  return <AiText text={ai.text} refs={refs} {...cite} />;
}

function ResurfaceCard({ memo, onRethink, onOpen, onSkip }) {
  return <div className="mr-resurface">
    <div className="mr-resurface-when">{dayLabel(memo.createdAt)}{memo.reviewed ? ' · 今天已看过' : ''}</div>
    <div className="mr-resurface-text" dangerouslySetInnerHTML={{ __html: memoBodyHtml(memo.text) }} />
    {memo.quote?.text && <div className="mr-resurface-quote">{memo.quote.text}</div>}
    <div className="mr-resurface-actions">
      <button type="button" className="mr-button is-dark" onClick={onRethink}>接着写一条</button>
      <button type="button" className="mr-button" onClick={onOpen}>打开</button>
      {onSkip && !memo.reviewed && <button type="button" className="mr-button" onClick={onSkip}>看过了</button>}
    </div>
  </div>;
}

function ItemList({ items, onOpen }) {
  if (!items?.length) return null;
  return <div className="mr-item-list">{items.map((item) => <button type="button" key={item.id} className="mr-row" onClick={() => onOpen(item.id)}>
    <div className="mr-row-text">
      <div className="mr-row-meta"><span>{item.source || ''}</span><span>{item.duration ? formatDuration(item.duration) : ''}</span></div>
      <div className="mr-row-title">{item.titleZh || item.title}</div>
      {item.preview && <div className="mr-row-summary" dangerouslySetInnerHTML={{ __html: escapeHtml(item.preview) }} />}
    </div>
    {item.image && <img className="mr-row-thumb is-wide" src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
  </button>)}</div>;
}
