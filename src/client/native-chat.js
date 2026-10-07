/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/native-chat.js
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Adapted: added a dedicated Reverie workspace (find or register by path) and renamed the session source.
 * See NOTICE.md for details.
 */
/** Retain Harness sessions for an embedded conversation without changing navigation. */
const samePath = (a, b) => String(a ?? '').normalize('NFC').replace(/\/+$/, '') === String(b ?? '').normalize('NFC').replace(/\/+$/, '');

export function nativeChatBridge(ctx) {
  let scope;
  let workspaceService;
  const watchers = new Set();
  const listItems = () => scope?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];
  /** Resolve once `test()` is truthy, re-checking whenever the workspace list or scope changes. */
  const waitFor = (test, ms, message) => new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const check = () => {
      const value = test();
      if (!value) return false;
      clearTimeout(timer); watchers.delete(onScope); unsubscribe(); resolve(value); return true;
    };
    const onScope = () => { unsubscribe(); unsubscribe = scope?.uiWorkspace.workspaces.list.subscribe(check) ?? (() => {}); check(); };
    const timer = setTimeout(() => { watchers.delete(onScope); unsubscribe(); reject(new Error(message)); }, ms);
    watchers.add(onScope);
    onScope();
  });
  ctx.inject(['workspaces'], child => {
    workspaceService = child.workspaces;
    for (const notify of watchers) notify();
    return () => { workspaceService = undefined; };
  });
  ctx.inject(['sessions', 'uiSession', 'uiWorkspace'], child => {
    scope = child;
    for (const notify of watchers) notify();
    return () => { scope = undefined; for (const notify of watchers) notify(); };
  });
  return {
    /** Find — or register — the workspace for `path` (the 「Reverie」 folder) and give it `title`. */
    async ensureChatWorkspace({ path, title }) {
      await waitFor(() => scope && workspaceService, 15_000, 'Harness 工作区服务尚未就绪');
      let found = listItems().find(w => samePath(w.path, path));
      if (!found) {
        const created = await workspaceService.create({ path });
        found = await waitFor(() => listItems().find(w => w.workspaceId === created.workspaceId || samePath(w.path, path)), 10_000, '「Reverie」工作区已创建，但列表还没刷新，请稍后重试');
      }
      if (title && found.title !== title) await workspaceService.rename(found.workspaceId, title).catch(() => {});
      return found.workspaceId;
    },
    defaultChatWorkspace() {
      const items = scope?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];
      const preferred = items.find(w => w.title === 'default-workspace' || /(?:^|\/)default-workspace$/.test(w.path || ''));
      return (preferred ?? items[0])?.workspaceId;
    },
    watchChatWorkspaces(listener) {
      watchers.add(listener);
      const unsubscribe = scope?.uiWorkspace.workspaces.list.subscribe(listener) ?? (() => {});
      return () => { watchers.delete(listener); unsubscribe(); };
    },
    chatWorkspaces() {
      return scope?.uiWorkspace.workspaces.list.getSnapshot().items.map(w => ({ id:w.workspaceId, name:w.title || w.name || w.path, path:w.path })) ?? [];
    },
    async openChat({ workspaceId, sessionId }) {
      if (!scope) throw new Error('Harness 对话服务尚未就绪');
      const active=scope;
      if (!active.uiWorkspace.workspaces.list.getSnapshot().items.some(w=>w.workspaceId===workspaceId)) throw new Error('请选择工作区');
      const id=sessionId || await active.sessions.create({workspaceId});
      const reference=active.sessions.retain(id,{source:'reverie'});
      try {
        const source=active.uiSession.bindingSource(reference);
        if(typeof source.value.props.inputActions?.setDraft!=='function') throw new Error('当前 Harness 版本不支持原生伴读');
        return {sessionId:id,reference,release:()=>reference.release(),
          async sendPrompt(prompt) {
            const { input } = source.value.hooks ?? {};
            const actions = source.value.props.inputActions;
            if(typeof actions.submit !== 'function' || typeof input?.getSnapshot !== 'function' || typeof input?.subscribe !== 'function') throw new Error('当前 Harness 版本不支持快捷发送');
            const state = input.getSnapshot();
            if(state.phase !== 'plain') throw new Error('当前输入框正在处理消息，请稍后重试');
            if(state.attachmentIds?.length) throw new Error('输入框有待发送附件，请先处理附件');
            if(state.draft.trim()) throw new Error('输入框已有草稿，请先发送或清空草稿');
            actions.setDraft(prompt);
            if(input.getSnapshot().draft !== prompt) await new Promise((resolve,reject) => {
              const timeout = setTimeout(() => { unsubscribe(); reject(new Error('提示词已放入输入框，请手动发送')); }, 1200);
              const unsubscribe = input.subscribe(() => {
                if(input.getSnapshot().draft === prompt) { clearTimeout(timeout); unsubscribe(); resolve(); }
              });
              if(input.getSnapshot().draft === prompt) { clearTimeout(timeout); unsubscribe(); resolve(); }
            });
            if(input.getSnapshot().phase !== 'plain') throw new Error('输入框正在处理消息，请稍后重试');
            actions.submit();
          }};
      } catch(error){reference.release();throw error;}
    },
  };
}
