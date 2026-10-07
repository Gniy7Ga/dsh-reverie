/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/AskArticle.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Partly adapted: the side-by-side native conversation and session binding follow AskArticle; prompts, context handling and layout were rewritten for Reverie.
 * See NOTICE.md for details.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

/**
 * 「AI 伴读」: Harness's own conversation on the right, bound to whatever the
 * user is looking at. `context` = {
 *   key, title, subtitle,              // identity + header
 *   bind(sessionId) → Promise,         // pushes the reading context to the host
 *   prompts: [{ title, body }],        // quick prompts
 *   selection?, autoAsk?: { id, body } // auto-send once attached (e.g. AI 解读)
 * }
 */
export function Companion({ api, context, onClose, onClearSelection, SessionProvider, renderSlot }) {
  const [workspaceId, setWorkspaceId] = useState(null);
  const [chat, setChat] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attached, setAttached] = useState('');
  const [sending, setSending] = useState(false);
  const [empty, setEmpty] = useState(true);
  const owned = useRef(null);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const asked = useRef(new Set());
  const chatRoot = useRef(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const bindKey = `${context.key}|${context.selection ?? ''}|${context.version ?? ''}`;
  const bind = (sessionId) => {
    const pending = queue.current.catch(() => {}).then(() => contextRef.current.bind(sessionId));
    queue.current = pending;
    return pending;
  };

  // Every conversation opened from the plugin goes into the dedicated 「Reverie」 workspace.
  const connect = async () => {
    setError('');
    try {
      const target = await api.chatWorkspace({});
      setWorkspaceId(await api.ensureChatWorkspace(target));
    } catch (cause) { setError(`没能打开「Reverie」工作区：${cause?.message ?? cause}`); }
  };
  useEffect(() => { if (!workspaceId) void connect(); }, [api]);
  useEffect(() => () => { generation.current += 1; owned.current?.release(); }, []);

  async function start(fresh = false) {
    if (!workspaceId) return;
    const current = ++generation.current;
    setError('');
    let acquired;
    const storageKey = `reverie.chat.${workspaceId}.${contextRef.current.key}`;
    try {
      const saved = fresh ? null : localStorage.getItem(storageKey);
      try { acquired = await api.openChat({ workspaceId, sessionId: saved || undefined }); }
      catch (cause) { if (!saved) throw cause; localStorage.removeItem(storageKey); acquired = await api.openChat({ workspaceId }); }
      if (current !== generation.current) { acquired.release(); return; }
      await bind(acquired.sessionId);
      if (current !== generation.current) { acquired.release(); return; }
      owned.current?.release();
      owned.current = acquired;
      setChat(acquired);
      setAttached(`${contextRef.current.key}|${contextRef.current.selection ?? ''}|${contextRef.current.version ?? ''}`);
      localStorage.setItem(storageKey, acquired.sessionId);
      acquired = null;
    } catch (cause) {
      acquired?.release();
      setError(cause?.message ?? String(cause));
    }
  }

  // A new subject (another item / memo / review) gets its own conversation.
  useEffect(() => { if (workspaceId) void start(); }, [workspaceId, context.key]);

  useEffect(() => {
    if (!chat || attached === bindKey) return undefined;
    let stale = false;
    bind(chat.sessionId).then(() => { if (!stale) setAttached(bindKey); }).catch((cause) => { if (!stale) setError(cause?.message ?? String(cause)); });
    return () => { stale = true; };
  }, [chat, bindKey]);

  // Watch whether the conversation is still empty (for the opening illustration).
  useEffect(() => {
    const root = chatRoot.current;
    if (!chat || !root) return undefined;
    const check = () => setEmpty(root.querySelector('[data-content-phase]')?.getAttribute('data-content-phase') === 'hero');
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-content-phase'] });
    check();
    return () => observer.disconnect();
  }, [chat]);

  async function send(body) {
    if (sending || !chat || attached !== bindKey) return false;
    setSending(true);
    setNotice('');
    try { await chat.sendPrompt(body); return true; }
    catch (cause) { setNotice(cause?.message?.includes('草稿') ? '输入框里已有文字，先发送或清空后再点快捷问题。' : `发送失败：${cause?.message ?? cause}`); return false; }
    finally { setSending(false); }
  }

  useEffect(() => {
    const ask = context.autoAsk;
    if (!ask || asked.current.has(ask.id) || !chat || attached !== bindKey) return;
    asked.current.add(ask.id);
    void send(ask.body);
  }, [context.autoAsk?.id, chat, attached, bindKey]);

  const ready = chat && attached === bindKey;
  return <aside className="mr-companion" aria-label="AI 伴读">
    <header className="mr-companion-header">
      <strong>AI 伴读</strong>
      <button type="button" className="mr-icon-button" title="新对话" onClick={() => void start(true)} disabled={!workspaceId}><Icon name="plus" size={18} /></button>
      <button type="button" className="mr-icon-button" title="关闭" onClick={onClose}><Icon name="x" size={18} /></button>
    </header>
    <div className="mr-companion-context">
      <strong>{context.title}</strong>
      <small>{context.subtitle}{ready ? '' : ' · 同步中…'}</small>
    </div>
    {context.selection && <div className="mr-companion-quote">
      <div><strong>选中的一段</strong><button type="button" className="mr-icon-button is-small" title="取消引用" onClick={onClearSelection}><Icon name="x" size={13} /></button></div>
      <blockquote>{context.selection.length > 200 ? `${context.selection.slice(0, 200)}…` : context.selection}</blockquote>
    </div>}
    {error && <div className="mr-companion-error" role="alert"><p>{error}</p><button type="button" className="mr-button" onClick={() => void (workspaceId ? start() : connect())}>重新连接</button></div>}
    {notice && <div className="mr-companion-notice" role="status"><span>{notice}</span><button type="button" className="mr-icon-button is-small" onClick={() => setNotice('')}><Icon name="x" size={13} /></button></div>}
    {!chat && !error && <div className="mr-companion-loading">{workspaceId ? '正在打开对话…' : '正在连接「Reverie」工作区…'}</div>}
    {chat && SessionProvider && <div className="mr-native-chat" ref={chatRoot}>
      <SessionProvider session={chat.reference}>{renderSlot('reverie.chat', {})}</SessionProvider>
      {empty && ready && <div className="mr-companion-opening" aria-hidden="true">
        <svg width="76" height="60" viewBox="0 0 112 88" fill="none"><path d="M56 72c-10-7-21-10-37-9V19c16-1 27 2 37 9 10-7 21-10 37-9v44c-16-1-27 2-37 9Z" /><path d="M56 28v44" /></svg>
        <h3>{context.openingTitle ?? '好奇，从这一页开始'}</h3>
        <p>{context.openingText ?? '一个细节，一处疑问，或一句不同意的话。'}</p>
      </div>}
    </div>}
    {chat && <div className="mr-quick-prompts">{(context.prompts ?? []).map((prompt) => <button type="button" key={prompt.title} className="mr-chip" disabled={!ready || sending} title={prompt.body} onClick={() => void send(prompt.body)}>{prompt.title}</button>)}</div>}
  </aside>;
}
