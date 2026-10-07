/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Reverie — reading shell (layout modelled on Qiaomu RSS) with three parts on the left:
 *   输入  links → transcripts / articles, bilingual reading, AI 伴读
 *   输出  diary / flomo-style notes, AI conversation
 *   回顾  today / this week / theme / to-read
 */
import { Component, useEffect, useState } from 'react';
import { useStable } from './ui.jsx';
import { Icon } from './icons.jsx';
import { Companion } from './Companion.jsx';
import { InputSide, InputCenter } from './InputPart.jsx';
import { OutputSide, OutputCenter } from './OutputPart.jsx';
import { ReviewSide, ReviewCenter } from './ReviewPart.jsx';
import STYLES from './styles.css';

export function ReaderIcon({ size = 18, active = false }) {
  return <span style={{ color: active ? 'var(--dsw-alias-brand-primary)' : 'inherit', display: 'inline-flex', alignItems: 'center' }}><Icon name="layers" size={size} /></span>;
}

class Boundary extends Component {
  state = { error: null, attempt: 0 };
  static getDerivedStateFromError(error) { return { error: error instanceof Error ? error.message : String(error) }; }
  render() {
    if (this.state.error) {
      return <div role="alert" style={{ padding: 24, color: 'var(--dsw-alias-label-primary)' }}>
        <h2>Reverie 出错了</h2><p style={{ whiteSpace: 'pre-wrap' }}>{this.state.error}</p>
        <button type="button" onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}>重新打开</button>
      </div>;
    }
    return <ReaderApp key={this.state.attempt} {...this.props} />;
  }
}
export function ReaderPanel(props) { return <Boundary {...props} />; }


const MODE_LABEL = { bilingual: '中英对照', translation: '译文', original: '原文' };

const PROMPTS = {
  item: [
    { title: '解读这段 / 这篇', body: '帮我解读一下：它在讲什么、背后的背景是什么、为什么重要。如果我选中了一段，就只解读那一段。' },
    { title: '三点概括核心观点', body: '请用三点概括核心观点，并区分事实和作者的判断。' },
    { title: '这个概念是什么意思', body: '里面有哪些我可能不熟悉的概念或术语？挑最关键的几个，用通俗的中文解释。' },
    { title: '和我之前的想法有什么关系', body: '结合我在 Reverie 里写过的想法，这条内容和我之前的哪些想法有关？是支持、补充还是反驳？' },
  ],
  memo: [
    { title: '帮我追问 3 个问题', body: '针对我这条想法，帮我追问 3 个问题，让我想得更深。' },
    { title: '和我读过的什么有关', body: '这条想法和我之前写过的哪些想法、读过的哪些内容有关？' },
    { title: '展开成一段', body: '帮我把这条想法展开成一段完整的文字，保持我的语气。' },
  ],
  review: [
    { title: '这周我在想什么', body: '这周我主要在想什么？有哪些反复出现的主题？' },
    { title: '哪里自相矛盾', body: '我的这些想法里，有哪些地方自相矛盾或者还没想清楚？' },
    { title: '接下来读什么', body: '根据这些内容，我接下来最值得读/听什么？为什么？' },
  ],
};

function ReaderApp({ api, SessionProvider, renderSlot }) {
  const [part, setPartState] = useState(() => localStorage.getItem('reverie.part') || localStorage.getItem('my-reader.part') || 'in');
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState({ items: 0, memos: 0 });
  const [toast, setToast] = useState('');
  const [inSel, setInSel] = useState(null); // { id, focus? }
  const [outSel, setOutSel] = useState(null); // { id } | { draft: { quote? } }
  const [reviewSel, setReviewSel] = useState({ kind: 'week', offset: 0 });
  const [subject, setSubject] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [selection, setSelection] = useState('');
  const [autoAsk, setAutoAsk] = useState(null);
  const [version, setVersion] = useState(0);

  const setPart = (next) => { setPartState(next); localStorage.setItem('reverie.part', next); setSelection(''); setAutoAsk(null); };
  const showToast = useStable((message) => { setToast(message); setTimeout(() => setToast((current) => (current === message ? '' : current)), 3200); });
  const refresh = useStable(() => setVersion((v) => v + 1));
  const loadCounts = useStable(async () => {
    try { const ov = await api.overview({}); setCounts(ov.counts); } catch { /* shown elsewhere */ }
  });
  useEffect(() => { void loadCounts(); }, [version]);

  const nav = {
    openItem: (id, focus) => { setPart('in'); setInSel({ id, focus, nonce: Date.now() }); },
    openMemo: (id) => { setPart('out'); setOutSel({ id }); },
    newMemo: (draft = {}) => { setPart('out'); setOutSel({ draft, nonce: Date.now() }); },
    openReview: (sel) => { setPart('review'); setReviewSel(sel); },
    askAI: (text) => { setSelection(text ?? ''); setAiOpen(true); setAutoAsk(text ? { id: Date.now(), body: '帮我解读我选中的这一段：它在讲什么、背后的背景是什么、为什么重要。' } : null); },
    openAI: () => { setAiOpen((open) => !open); setAutoAsk(null); },
    setSelection,
    showToast,
    refresh,
    toggleSide: () => setCollapsed((v) => !v),
  };

  const companionContext = subject && buildContext(api, subject, selection, autoAsk);

  return <div className={`mr-root${aiOpen ? ' has-ai' : ''}${collapsed ? ' is-collapsed' : ''}`}>
    <style>{STYLES}</style>
    <div className="mr-workarea">
      <aside className="mr-side">
        <div className="mr-side-top">
          <div className="mr-side-title"><Icon name="layers" size={20} />Reverie</div>
        </div>
        <div className="mr-parts" role="tablist">
          {[['in', '输入', counts.items], ['out', '输出', counts.memos], ['review', '回顾']].map(([key, label, count]) => <button type="button" role="tab" key={key} aria-selected={part === key} className={`mr-part${part === key ? ' is-on' : ''}`} onClick={() => setPart(key)}>
            {label}{count !== undefined && <em>{count}</em>}
          </button>)}
        </div>
        {part === 'in' && <InputSide api={api} selected={inSel?.id} version={version} onSelect={(id) => setInSel({ id })} nav={nav} onCounts={loadCounts} />}
        {part === 'out' && <OutputSide api={api} selected={outSel?.id} version={version} onSelect={(id) => setOutSel({ id })} nav={nav} />}
        {part === 'review' && <ReviewSide api={api} selected={reviewSel} version={version} onSelect={setReviewSel} />}
      </aside>
      <main className="mr-center">
        {part === 'in' && <InputCenter api={api} selection={inSel} nav={nav} aiOpen={aiOpen} onSubject={setSubject} onSelectId={(id) => setInSel({ id })} version={version} />}
        {part === 'out' && <OutputCenter api={api} selection={outSel} nav={nav} aiOpen={aiOpen} onSubject={setSubject} onSelect={setOutSel} version={version} />}
        {part === 'review' && <ReviewCenter api={api} selection={reviewSel} nav={nav} aiOpen={aiOpen} onSubject={setSubject} onSelect={setReviewSel} version={version} />}
      </main>
      {aiOpen && companionContext && <Companion api={api} context={companionContext} SessionProvider={SessionProvider} renderSlot={renderSlot}
        onClose={() => setAiOpen(false)} onClearSelection={() => { window.getSelection()?.removeAllRanges(); setSelection(''); setAutoAsk(null); }} />}
    </div>
    {toast && <div className="mr-toast" role="status">{toast}</div>}
  </div>;
}

function buildContext(api, subject, selection, autoAsk) {
  if (subject.type === 'item') {
    return {
      key: `item:${subject.id}`, version: subject.mode, selection,
      title: subject.title, subtitle: `${MODE_LABEL[subject.mode] ?? '原文'} · 当前素材`,
      bind: (sessionId) => api.setReadingContext({ sessionId, id: subject.id, mode: subject.mode, selection: selection ?? '' }),
      prompts: PROMPTS.item, autoAsk,
    };
  }
  if (subject.type === 'memo') {
    return {
      key: `memo:${subject.id}`, title: subject.title, subtitle: '当前这一页 · AI 也能看到你其他的输出',
      bind: (sessionId) => api.setNotesContext({ sessionId, scope: 'memo', id: subject.id }),
      prompts: PROMPTS.memo, openingTitle: '想一想，写下来', openingText: '让 AI 帮你追问、补全，或者把几条想法连起来。',
    };
  }
  return {
    key: `review:${subject.kind}:${subject.offset ?? ''}:${subject.tag ?? ''}`, title: subject.title, subtitle: '这次回顾涉及的输入和输出',
    bind: (sessionId) => api.setNotesContext({ sessionId, scope: 'review', kind: subject.kind, offset: subject.offset, tag: subject.tag }),
    prompts: PROMPTS.review, openingTitle: '一起回头看看', openingText: '问问这段时间的自己在想什么。',
  };
}
