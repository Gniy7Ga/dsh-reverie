/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/index.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Partly adapted: the Remote descriptor/codec stub and slot registration pattern; methods, panel and slots are Reverie-specific.
 * See NOTICE.md for details.
 */
/**
 * reverie client: mounts the `reverie` Remote namespace and registers the
 * reading panel (sidebar icon + `main` page) and the embedded chat slot.
 */
import { NativeConversation } from './NativeConversation.jsx';
import { nativeChatBridge } from './native-chat.js';
import { ReaderPanel, ReaderIcon } from './App.jsx';

const PLUGIN_ID = 'dsh-reverie';
export const PANEL_ID = 'reverie';

const METHODS = [
  'overview', 'timeline', 'submit', 'getItem', 'translateItem', 'retryItem', 'deleteItem',
  'listItems', 'markItemRead', 'listMemos', 'getMemo',
  'saveMemo', 'deleteMemo', 'pinMemo', 'setReadingContext', 'setNotesContext', 'saveSettings',
  'reviewOverview', 'getReview', 'generateReview', 'markReviewed', 'chatWorkspace',
];

/** Duck-typed codec stub: the client forwards JSON without parsing. */
const codec = () => ({
  mode: 'strict',
  typeSymbol: `${PLUGIN_ID}#json`,
  create: () => ({ parse: (value) => value, safeParse: (value) => ({ success: true, data: value }) }),
});

const TYPERT_REMOTE = {
  package: PLUGIN_ID,
  descriptors: METHODS.map((method) => ({
    id: `${PLUGIN_ID}#reverie/${method}`,
    service: 'reverie',
    namespace: 'reverie',
    method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec() }],
    result: { mode: 'src-json' },
    cancellation: { parameter: 'signal' },
  })),
};

export const inject = ['slots', 'layout', 'remote'];

export async function apply(ctx) {
  try {
    await ctx.remote.$mount(TYPERT_REMOTE);
  } catch (error) {
    ctx.logger?.error?.('reverie: failed to mount the reverie Remote namespace: %o', error);
    throw error;
  }
  ctx.inject(['remote.reverie'], (child) => register(child));
}

function register(ctx) {
  const call = async (name, params = {}) => {
    const namespace = ctx.remote.reverie;
    if (!namespace || typeof namespace[name] !== 'function') throw new Error('Reverie 服务还没准备好，请稍后重试');
    const result = await namespace[name](params);
    if (result.ok) return result.value;
    throw result.error instanceof Error ? result.error : new Error(result.error?.message ?? String(result.error));
  };
  const api = { ...nativeChatBridge(ctx), ...Object.fromEntries(METHODS.map((name) => [name, (params) => call(name, params)])) };

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    children: { 'reverie.chat': { kind: 'single', scope: 'session' } },
    inject: () => ({ api }),
  }, ReaderPanel));
  ctx.slots.inject('reverie.chat', () => ctx.slots.register({ name: 'reverie.chat' }, NativeConversation));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 14,
    label: 'Reverie',
  }, ReaderIcon));
}
