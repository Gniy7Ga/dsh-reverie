/*!
 * Reverie (dsh-reverie) — https://github.com/Gniy7Ga/dsh-reverie
 * Copyright (C) 2026 Ag (https://github.com/Gniy7Ga). SPDX-License-Identifier: GPL-3.0-only
 * Contains code adapted from qiaomu-rss-dsh by 向阳乔木 (joeseesun), GPL-3.0-only,
 * https://github.com/joeseesun/qiaomu-rss-dsh, and third-party components listed in
 * NOTICE.md and THIRD_PARTY_LICENSES.md. Source: the src/ directory of the repository above.
 */
window.__ModuleLoader__.load({
	id: "dsh-reverie",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  PANEL_ID: () => PANEL_ID,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/NativeConversation.jsx
function ChatView({ renderSlot }) {
  return renderSlot("conversation.session", { view: "chat" });
}
function NativeConversation({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((s) => s);
  const conversation = useConversation((s) => s);
  const blank = useSessions((s) => s.byId[sessionId]?.blank);
  const active = conversation.activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running;
  const settling = !active && session.openState === "loading" && blank !== true;
  const hero = !active && (session.openState === "open" || blank === true);
  return renderFactorySlot("conversation.content", { variant: "embedded", phase: settling ? "settling" : hero ? "hero" : "active", hero }, { slots: { views: ChatView } });
}

// src/client/native-chat.js
var samePath = (a, b) => String(a ?? "").normalize("NFC").replace(/\/+$/, "") === String(b ?? "").normalize("NFC").replace(/\/+$/, "");
function nativeChatBridge(ctx) {
  let scope;
  let workspaceService;
  const watchers = /* @__PURE__ */ new Set();
  const listItems = () => scope?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];
  const waitFor = (test, ms, message) => new Promise((resolve, reject) => {
    let unsubscribe = () => {
    };
    const check = () => {
      const value = test();
      if (!value) return false;
      clearTimeout(timer);
      watchers.delete(onScope);
      unsubscribe();
      resolve(value);
      return true;
    };
    const onScope = () => {
      unsubscribe();
      unsubscribe = scope?.uiWorkspace.workspaces.list.subscribe(check) ?? (() => {
      });
      check();
    };
    const timer = setTimeout(() => {
      watchers.delete(onScope);
      unsubscribe();
      reject(new Error(message));
    }, ms);
    watchers.add(onScope);
    onScope();
  });
  ctx.inject(["workspaces"], (child) => {
    workspaceService = child.workspaces;
    for (const notify of watchers) notify();
    return () => {
      workspaceService = void 0;
    };
  });
  ctx.inject(["sessions", "uiSession", "uiWorkspace"], (child) => {
    scope = child;
    for (const notify of watchers) notify();
    return () => {
      scope = void 0;
      for (const notify of watchers) notify();
    };
  });
  return {
    /** Find — or register — the workspace for `path` (the 「Reverie」 folder) and give it `title`. */
    async ensureChatWorkspace({ path, title }) {
      await waitFor(() => scope && workspaceService, 15e3, "Harness \u5DE5\u4F5C\u533A\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA");
      let found = listItems().find((w) => samePath(w.path, path));
      if (!found) {
        const created = await workspaceService.create({ path });
        found = await waitFor(() => listItems().find((w) => w.workspaceId === created.workspaceId || samePath(w.path, path)), 1e4, "\u300CReverie\u300D\u5DE5\u4F5C\u533A\u5DF2\u521B\u5EFA\uFF0C\u4F46\u5217\u8868\u8FD8\u6CA1\u5237\u65B0\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      }
      if (title && found.title !== title) await workspaceService.rename(found.workspaceId, title).catch(() => {
      });
      return found.workspaceId;
    },
    defaultChatWorkspace() {
      const items = scope?.uiWorkspace.workspaces.list.getSnapshot().items ?? [];
      const preferred = items.find((w) => w.title === "default-workspace" || /(?:^|\/)default-workspace$/.test(w.path || ""));
      return (preferred ?? items[0])?.workspaceId;
    },
    watchChatWorkspaces(listener) {
      watchers.add(listener);
      const unsubscribe = scope?.uiWorkspace.workspaces.list.subscribe(listener) ?? (() => {
      });
      return () => {
        watchers.delete(listener);
        unsubscribe();
      };
    },
    chatWorkspaces() {
      return scope?.uiWorkspace.workspaces.list.getSnapshot().items.map((w) => ({ id: w.workspaceId, name: w.title || w.name || w.path, path: w.path })) ?? [];
    },
    async openChat({ workspaceId, sessionId }) {
      if (!scope) throw new Error("Harness \u5BF9\u8BDD\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA");
      const active = scope;
      if (!active.uiWorkspace.workspaces.list.getSnapshot().items.some((w) => w.workspaceId === workspaceId)) throw new Error("\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A");
      const id = sessionId || await active.sessions.create({ workspaceId });
      const reference = active.sessions.retain(id, { source: "reverie" });
      try {
        const source = active.uiSession.bindingSource(reference);
        if (typeof source.value.props.inputActions?.setDraft !== "function") throw new Error("\u5F53\u524D Harness \u7248\u672C\u4E0D\u652F\u6301\u539F\u751F\u4F34\u8BFB");
        return {
          sessionId: id,
          reference,
          release: () => reference.release(),
          async sendPrompt(prompt) {
            const { input } = source.value.hooks ?? {};
            const actions = source.value.props.inputActions;
            if (typeof actions.submit !== "function" || typeof input?.getSnapshot !== "function" || typeof input?.subscribe !== "function") throw new Error("\u5F53\u524D Harness \u7248\u672C\u4E0D\u652F\u6301\u5FEB\u6377\u53D1\u9001");
            const state = input.getSnapshot();
            if (state.phase !== "plain") throw new Error("\u5F53\u524D\u8F93\u5165\u6846\u6B63\u5728\u5904\u7406\u6D88\u606F\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
            if (state.attachmentIds?.length) throw new Error("\u8F93\u5165\u6846\u6709\u5F85\u53D1\u9001\u9644\u4EF6\uFF0C\u8BF7\u5148\u5904\u7406\u9644\u4EF6");
            if (state.draft.trim()) throw new Error("\u8F93\u5165\u6846\u5DF2\u6709\u8349\u7A3F\uFF0C\u8BF7\u5148\u53D1\u9001\u6216\u6E05\u7A7A\u8349\u7A3F");
            actions.setDraft(prompt);
            if (input.getSnapshot().draft !== prompt) await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                unsubscribe();
                reject(new Error("\u63D0\u793A\u8BCD\u5DF2\u653E\u5165\u8F93\u5165\u6846\uFF0C\u8BF7\u624B\u52A8\u53D1\u9001"));
              }, 1200);
              const unsubscribe = input.subscribe(() => {
                if (input.getSnapshot().draft === prompt) {
                  clearTimeout(timeout);
                  unsubscribe();
                  resolve();
                }
              });
              if (input.getSnapshot().draft === prompt) {
                clearTimeout(timeout);
                unsubscribe();
                resolve();
              }
            });
            if (input.getSnapshot().phase !== "plain") throw new Error("\u8F93\u5165\u6846\u6B63\u5728\u5904\u7406\u6D88\u606F\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
            actions.submit();
          }
        };
      } catch (error) {
        reference.release();
        throw error;
      }
    }
  };
}

// src/client/App.jsx
var import_react7 = require("react");

// src/client/ui.jsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function useStable(fn) {
  const ref = (0, import_react.useRef)(fn);
  ref.current = fn;
  return (0, import_react.useCallback)((...args) => ref.current(...args), []);
}

// src/client/icons.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PATHS = {
  brief: "M4 5h12a2 2 0 0 1 2 2v12a2 2 0 0 0 2-2V8M4 5v13a2 2 0 0 0 2 2h14M8 9h6M8 13h6M8 17h3",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  youtube: "M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17M10 15l5-3-5-3z",
  x: "M18 6 6 18M6 6l12 12",
  twitter: "M4 4l11.7 16H20L8.3 4zM4 20l6.8-6.8M13.2 10.8 20 4",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  rss: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  refresh: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  sparkles: "M9.94 14.06 4.5 19.5M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  check: "M20 6 9 17l-5-5",
  checks: "M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16",
  back: "M19 12H5M12 19l-7-7 7-7",
  translate: "M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  play: "M6 3l14 9-14 9V3z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  alert: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01",
  layers: "m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5",
  sidebar: "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4v16",
  up: "m18 15-6-6-6 6",
  down: "m6 9 6 6 6-6",
  bookmark: "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  circleCheck: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12l2.5 2.5 4.5-5",
  wand: "m15 4-1-1M15 9v1M20 9h-1M20 4l-1 1M3 21l11-11M17 7l-1 1M11 2.5v1M21.5 13h-1",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  pin: "M12 17v5M9 3h6l-1 7 4 3H6l4-3z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  hash: "M4 9h16M4 15h16M10 3 8 21M16 3l-2 18",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"
};
function Icon({ name, size = 16, strokeWidth = 1.8, fill = "none", style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill,
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      style: { flex: "0 0 auto", ...style },
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: PATHS[name] ?? PATHS.rss })
    }
  );
}

// src/client/Companion.jsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function Companion({ api, context, onClose, onClearSelection, SessionProvider, renderSlot }) {
  const [workspaceId, setWorkspaceId] = (0, import_react2.useState)(null);
  const [chat, setChat] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)("");
  const [notice, setNotice] = (0, import_react2.useState)("");
  const [attached, setAttached] = (0, import_react2.useState)("");
  const [sending, setSending] = (0, import_react2.useState)(false);
  const [empty, setEmpty] = (0, import_react2.useState)(true);
  const owned = (0, import_react2.useRef)(null);
  const generation = (0, import_react2.useRef)(0);
  const queue = (0, import_react2.useRef)(Promise.resolve());
  const asked = (0, import_react2.useRef)(/* @__PURE__ */ new Set());
  const chatRoot = (0, import_react2.useRef)(null);
  const contextRef = (0, import_react2.useRef)(context);
  contextRef.current = context;
  const bindKey = `${context.key}|${context.selection ?? ""}|${context.version ?? ""}`;
  const bind = (sessionId) => {
    const pending = queue.current.catch(() => {
    }).then(() => contextRef.current.bind(sessionId));
    queue.current = pending;
    return pending;
  };
  const connect = async () => {
    setError("");
    try {
      const target = await api.chatWorkspace({});
      setWorkspaceId(await api.ensureChatWorkspace(target));
    } catch (cause) {
      setError(`\u6CA1\u80FD\u6253\u5F00\u300CReverie\u300D\u5DE5\u4F5C\u533A\uFF1A${cause?.message ?? cause}`);
    }
  };
  (0, import_react2.useEffect)(() => {
    if (!workspaceId) void connect();
  }, [api]);
  (0, import_react2.useEffect)(() => () => {
    generation.current += 1;
    owned.current?.release();
  }, []);
  async function start(fresh = false) {
    if (!workspaceId) return;
    const current = ++generation.current;
    setError("");
    let acquired;
    const storageKey = `reverie.chat.${workspaceId}.${contextRef.current.key}`;
    try {
      const saved = fresh ? null : localStorage.getItem(storageKey);
      try {
        acquired = await api.openChat({ workspaceId, sessionId: saved || void 0 });
      } catch (cause) {
        if (!saved) throw cause;
        localStorage.removeItem(storageKey);
        acquired = await api.openChat({ workspaceId });
      }
      if (current !== generation.current) {
        acquired.release();
        return;
      }
      await bind(acquired.sessionId);
      if (current !== generation.current) {
        acquired.release();
        return;
      }
      owned.current?.release();
      owned.current = acquired;
      setChat(acquired);
      setAttached(`${contextRef.current.key}|${contextRef.current.selection ?? ""}|${contextRef.current.version ?? ""}`);
      localStorage.setItem(storageKey, acquired.sessionId);
      acquired = null;
    } catch (cause) {
      acquired?.release();
      setError(cause?.message ?? String(cause));
    }
  }
  (0, import_react2.useEffect)(() => {
    if (workspaceId) void start();
  }, [workspaceId, context.key]);
  (0, import_react2.useEffect)(() => {
    if (!chat || attached === bindKey) return void 0;
    let stale = false;
    bind(chat.sessionId).then(() => {
      if (!stale) setAttached(bindKey);
    }).catch((cause) => {
      if (!stale) setError(cause?.message ?? String(cause));
    });
    return () => {
      stale = true;
    };
  }, [chat, bindKey]);
  (0, import_react2.useEffect)(() => {
    const root = chatRoot.current;
    if (!chat || !root) return void 0;
    const check = () => setEmpty(root.querySelector("[data-content-phase]")?.getAttribute("data-content-phase") === "hero");
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-content-phase"] });
    check();
    return () => observer.disconnect();
  }, [chat]);
  async function send(body) {
    if (sending || !chat || attached !== bindKey) return false;
    setSending(true);
    setNotice("");
    try {
      await chat.sendPrompt(body);
      return true;
    } catch (cause) {
      setNotice(cause?.message?.includes("\u8349\u7A3F") ? "\u8F93\u5165\u6846\u91CC\u5DF2\u6709\u6587\u5B57\uFF0C\u5148\u53D1\u9001\u6216\u6E05\u7A7A\u540E\u518D\u70B9\u5FEB\u6377\u95EE\u9898\u3002" : `\u53D1\u9001\u5931\u8D25\uFF1A${cause?.message ?? cause}`);
      return false;
    } finally {
      setSending(false);
    }
  }
  (0, import_react2.useEffect)(() => {
    const ask = context.autoAsk;
    if (!ask || asked.current.has(ask.id) || !chat || attached !== bindKey) return;
    asked.current.add(ask.id);
    void send(ask.body);
  }, [context.autoAsk?.id, chat, attached, bindKey]);
  const ready = chat && attached === bindKey;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("aside", { className: "mr-companion", "aria-label": "AI \u4F34\u8BFB", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "mr-companion-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "AI \u4F34\u8BFB" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u65B0\u5BF9\u8BDD", onClick: () => void start(true), disabled: !workspaceId, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "plus", size: 18 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u5173\u95ED", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "x", size: 18 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-companion-context", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: context.title }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
        context.subtitle,
        ready ? "" : " \xB7 \u540C\u6B65\u4E2D\u2026"
      ] })
    ] }),
    context.selection && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-companion-quote", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u9009\u4E2D\u7684\u4E00\u6BB5" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-icon-button is-small", title: "\u53D6\u6D88\u5F15\u7528", onClick: onClearSelection, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "x", size: 13 }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("blockquote", { children: context.selection.length > 200 ? `${context.selection.slice(0, 200)}\u2026` : context.selection })
    ] }),
    error && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-companion-error", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-button", onClick: () => void (workspaceId ? start() : connect()), children: "\u91CD\u65B0\u8FDE\u63A5" })
    ] }),
    notice && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-companion-notice", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-icon-button is-small", onClick: () => setNotice(""), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "x", size: 13 }) })
    ] }),
    !chat && !error && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mr-companion-loading", children: workspaceId ? "\u6B63\u5728\u6253\u5F00\u5BF9\u8BDD\u2026" : "\u6B63\u5728\u8FDE\u63A5\u300CReverie\u300D\u5DE5\u4F5C\u533A\u2026" }),
    chat && SessionProvider && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-native-chat", ref: chatRoot, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SessionProvider, { session: chat.reference, children: renderSlot("reverie.chat", {}) }),
      empty && ready && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "mr-companion-opening", "aria-hidden": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "76", height: "60", viewBox: "0 0 112 88", fill: "none", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M56 72c-10-7-21-10-37-9V19c16-1 27 2 37 9 10-7 21-10 37-9v44c-16-1-27 2-37 9Z" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M56 28v44" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: context.openingTitle ?? "\u597D\u5947\uFF0C\u4ECE\u8FD9\u4E00\u9875\u5F00\u59CB" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: context.openingText ?? "\u4E00\u4E2A\u7EC6\u8282\uFF0C\u4E00\u5904\u7591\u95EE\uFF0C\u6216\u4E00\u53E5\u4E0D\u540C\u610F\u7684\u8BDD\u3002" })
      ] })
    ] }),
    chat && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "mr-quick-prompts", children: (context.prompts ?? []).map((prompt) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "mr-chip", disabled: !ready || sending, title: prompt.body, onClick: () => void send(prompt.body), children: prompt.title }, prompt.title)) })
  ] });
}

// src/client/InputPart.jsx
var import_react4 = require("react");

// src/shared/sanitize.js
var VOID_TAGS = /* @__PURE__ */ new Set([
  "br",
  "hr",
  "img",
  "wbr",
  "input",
  "col",
  "source"
]);
var ALLOWED_TAGS = /* @__PURE__ */ new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "em",
  "i",
  "strong",
  "b",
  "u",
  "s",
  "del",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "sup",
  "sub",
  "small",
  "mark",
  "details",
  "summary",
  "span",
  "div",
  "abbr",
  "time",
  "kbd",
  "samp"
]);
var DROP_CONTENT_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "form",
  "textarea",
  "select",
  "button",
  "svg",
  "math",
  "template",
  "title",
  "head",
  "link",
  "meta",
  "base"
]);
var SAFE_URL_ATTRS = /* @__PURE__ */ new Set(["href", "src", "cite", "poster"]);
function decodeHtmlEntities(text) {
  if (!text.includes("&")) return text;
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    mdash: "\u2014",
    ndash: "\u2013",
    hellip: "\u2026",
    laquo: "\xAB",
    raquo: "\xBB",
    ldquo: "\u201C",
    rdquo: "\u201D",
    lsquo: "\u2018",
    rsquo: "\u2019",
    copy: "\xA9",
    reg: "\xAE",
    trade: "\u2122",
    middot: "\xB7",
    bull: "\u2022",
    times: "\xD7",
    deg: "\xB0"
  };
  return text.replace(/&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,30});/g, (raw, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 32 || code > 1114111 || code >= 55296 && code <= 57343) return raw;
      try {
        return String.fromCodePoint(code);
      } catch {
        return raw;
      }
    }
    return named[body.toLowerCase()] ?? raw;
  });
}
function escapeText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
function isSafeUrl(raw) {
  const value = raw.trim();
  if (value === "" || value.startsWith("#")) return true;
  if (/^(?:https?:|mailto:)/i.test(value)) return true;
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return true;
  return false;
}
function safeUrl(raw, baseUrl) {
  const value = raw.trim();
  if (!isSafeUrl(value)) return void 0;
  if (baseUrl) {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return void 0;
    }
  }
  return value;
}
function sanitizeHtml(html, options = {}) {
  const { baseUrl, maxLength = 4e5 } = options;
  let out = "";
  const stack = [];
  let i = 0;
  const n = html.length;
  let droppedDepth = 0;
  while (i < n && out.length < maxLength) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      if (droppedDepth === 0) out += escapeText(decodeHtmlEntities(html.slice(i)));
      break;
    }
    if (lt > i && droppedDepth === 0) out += escapeText(decodeHtmlEntities(html.slice(i, lt)));
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const gt = findTagEnd(html, lt);
    if (gt === -1) break;
    const source = html.slice(lt + 1, gt);
    i = gt + 1;
    if (source.startsWith("/")) {
      const name = source.slice(1).trim().toLowerCase();
      const openIdx = stack.lastIndexOf(name);
      if (openIdx !== -1) {
        while (stack.length > openIdx) {
          const closing = stack.pop();
          if (droppedDepth > 0) {
            if (closing === "__drop__") droppedDepth -= 1;
            else out += `</${closing}>`;
          } else {
            out += `</${closing}>`;
          }
        }
      }
      continue;
    }
    const selfClosing = source.endsWith("/");
    const header = selfClosing ? source.slice(0, -1) : source;
    const nameMatch = /^[^\s/>]+/.exec(header);
    if (!nameMatch) continue;
    const tag = nameMatch[0].toLowerCase();
    if (DROP_CONTENT_TAGS.has(tag)) {
      if (!selfClosing && !VOID_TAGS.has(tag)) droppedDepth += 1;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;
    const attrs = parseAttrs(header.slice(nameMatch[0].length));
    const rendered = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("on") || key === "style" || key === "class" && false) continue;
      if (!SAFE_URL_ATTRS.has(key)) {
        if (key === "alt" || key === "title" || key === "colspan" || key === "rowspan" || key === "datetime") {
          rendered.push(`${key}="${escapeAttr(value.slice(0, 300))}"`);
        }
        continue;
      }
      const url = safeUrl(decodeHtmlEntities(value), baseUrl);
      if (url !== void 0) rendered.push(`${key}="${escapeAttr(url)}"`);
    }
    const attrText = rendered.length > 0 ? ` ${rendered.join(" ")}` : "";
    if (tag === "img") {
      out += `<img${attrText} loading="lazy">`;
      continue;
    }
    if (VOID_TAGS.has(tag)) {
      out += `<${tag}>`;
      continue;
    }
    out += `<${tag}${attrText}>`;
    if (!selfClosing) stack.push(tag);
  }
  while (stack.length > 0) out += `</${stack.pop()}>`;
  return out.slice(0, maxLength);
}
function findTagEnd(source, from) {
  let quote = "";
  for (let i = from + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (quote !== "") {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}
var ATTR = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')?/g;
function parseAttrs(header) {
  const attrs = {};
  ATTR.lastIndex = 0;
  let match;
  while ((match = ATTR.exec(header)) !== null) {
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

// src/shared/text.js
function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function linkify(escaped) {
  return escaped.replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
}
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// src/client/VideoPlayer.jsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function VideoPlayer({ videoId, playerUrl }) {
  const bridge = typeof window !== "undefined" ? window.dshDesktop?.browser : void 0;
  const [lease, setLease] = (0, import_react3.useState)(null);
  const [error, setError] = (0, import_react3.useState)("");
  const view = (0, import_react3.useRef)(null);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.replace(/\sElectron\/\S+/g, "").replace(/\sDeepSeek[\w-]*\/\S+/g, "") : void 0;
  (0, import_react3.useEffect)(() => {
    if (!bridge || !playerUrl) return void 0;
    let cancelled = false;
    let acquired;
    let unsubscribe;
    void bridge.acquire("reverie:youtube").then((value) => {
      acquired = value;
      if (cancelled) {
        void bridge.release(value.lease);
        return;
      }
      unsubscribe = bridge.onOpenRequested(value.lease, () => window.open(watchUrl, "_blank", "noopener,noreferrer"));
      setLease(value);
    }).catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      unsubscribe?.();
      if (acquired) void bridge.release(acquired.lease);
      setLease(null);
    };
  }, [bridge, playerUrl]);
  (0, import_react3.useEffect)(() => {
    const element = view.current;
    if (!element || !lease) return void 0;
    let loaded = false;
    const ready = () => {
      if (loaded) return;
      loaded = true;
      element.setUserAgent?.(userAgent);
      void element.loadURL(playerUrl, { userAgent }).catch((e) => setError(e.message));
    };
    element.addEventListener("dom-ready", ready);
    return () => element.removeEventListener("dom-ready", ready);
  }, [lease, playerUrl]);
  const external = /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("a", { className: "mr-link-button", href: watchUrl, target: "_blank", rel: "noopener noreferrer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "external", size: 14 }),
    "\u5728 YouTube \u6253\u5F00"
  ] });
  if (!bridge || !playerUrl || error) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mr-video", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "iframe",
        {
          className: "mr-video-frame",
          src: playerUrl || `https://www.youtube-nocookie.com/embed/${videoId}`,
          title: "YouTube \u89C6\u9891\u64AD\u653E\u5668",
          loading: "lazy",
          sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
          allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
          allowFullScreen: true,
          referrerPolicy: "strict-origin-when-cross-origin"
        }
      ),
      external
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "mr-video", children: [
    lease ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("webview", { ref: view, className: "mr-video-frame", src: `about:blank#${lease.lease}`, partition: lease.partition, allowpopups: "true", useragent: userAgent, title: "YouTube \u89C6\u9891\u64AD\u653E\u5668" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "mr-video-frame mr-video-loading", children: "\u6B63\u5728\u52A0\u8F7D\u64AD\u653E\u5668\u2026" }),
    external
  ] });
}

// src/client/InputPart.jsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var STATUS = { queued: "\u6392\u961F\u4E2D", resolving: "\u89E3\u6790\u4E2D", downloading: "\u4E0B\u8F7D\u97F3\u9891", transcribing: "\u8F6C\u5F55\u4E2D", translating: "\u7FFB\u8BD1\u4E2D", done: "\u5B8C\u6210", error: "\u5931\u8D25" };
var PLATFORM = { youtube: "YouTube", bilibili: "B \u7AD9", xiaoyuzhou: "\u5C0F\u5B87\u5B99", apple: "\u64AD\u5BA2", file: "\u97F3\u89C6\u9891", other: "\u89C6\u9891", web: "\u7F51\u9875", xiaohongshu: "\u5C0F\u7EA2\u4E66", wechat: "\u516C\u4F17\u53F7", twitter: "\u63A8\u7279" };
var FILTERS = [["all", "\u5168\u90E8"], ["media", "\u97F3\u89C6\u9891"], ["web", "\u7F51\u9875"], ["xiaohongshu", "\u5C0F\u7EA2\u4E66"], ["wechat", "\u516C\u4F17\u53F7"], ["twitter", "\u63A8\u7279"]];
var SOCIAL = /* @__PURE__ */ new Set(["xiaohongshu", "wechat", "twitter"]);
var MODES = { bilingual: "\u4E2D\u82F1\u5BF9\u7167", translation: "\u4E2D\u6587", original: "\u539F\u6587" };
function shortDate(time) {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
var running = (item) => !["done", "error"].includes(item.status);
function InputSide({ api, selected, onSelect, nav, version, onCounts }) {
  const [items, setItems] = (0, import_react4.useState)([]);
  const [filter, setFilter] = (0, import_react4.useState)("all");
  const [unread, setUnread] = (0, import_react4.useState)(false);
  const [link, setLink] = (0, import_react4.useState)("");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)("");
  const load = useStable(async () => {
    try {
      const page = await api.listItems({ filter, unread });
      setItems(page.items);
      setError("");
    } catch (cause) {
      setError(cause.message ?? String(cause));
    }
  });
  (0, import_react4.useEffect)(() => {
    void load();
  }, [filter, unread, version, selected]);
  const active = items.some(running);
  (0, import_react4.useEffect)(() => {
    if (!active) return void 0;
    const timer = setInterval(() => void load(), 1500);
    return () => clearInterval(timer);
  }, [active]);
  const valid = /^https?:\/\/\S+$/i.test(link.trim());
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const result = await api.submit({ text: link.trim() });
      if (result.type !== "item") throw new Error("\u8FD9\u4E0D\u662F\u4E00\u4E2A\u94FE\u63A5");
      if (result.existing) nav.showToast("\u8FD9\u4E2A\u94FE\u63A5\u4E4B\u524D\u5DF2\u7ECF\u6536\u8FC7\u4E86");
      setLink("");
      onSelect(result.id);
      onCounts();
      await load();
    } catch (cause) {
      nav.showToast(cause.message ?? String(cause));
    }
    setBusy(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-drop", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "link", size: 16 }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { value: link, placeholder: "\u7C98\u8D34 YouTube / B\u7AD9 / \u5C0F\u5B87\u5B99 / \u5C0F\u7EA2\u4E66 / \u516C\u4F17\u53F7 / \u63A8\u7279 / \u7F51\u9875\u94FE\u63A5", onChange: (event) => setLink(event.target.value), onKeyDown: (event) => {
        if (event.key === "Enter") void submit();
      }, disabled: busy }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `mr-drop-go${valid ? " is-ready" : ""}`, disabled: !valid || busy, onClick: () => void submit(), children: busy ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "mr-spinner" }) : "\u6536\u8FDB\u6765" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-pills", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-pill-scroll", onWheel: (event) => {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
      }, children: FILTERS.map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `mr-pill${filter === key ? " is-on" : ""}`, onClick: (event) => {
        setFilter(key);
        event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }, children: label }, key)) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `mr-pill${unread ? " is-on" : ""}`, onClick: () => setUnread((v) => !v), children: "\u672A\u8BFB" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-list", children: [
      error && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-list-empty mr-error-text", children: [
        "\u8BFB\u53D6\u5931\u8D25\uFF1A",
        error
      ] }),
      !items.length && !error && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-list-empty", children: unread ? "\u6CA1\u6709\u672A\u8BFB\u7684\u5185\u5BB9" : filter !== "all" ? `\u8FD8\u6CA1\u6709${FILTERS.find(([key]) => key === filter)?.[1] ?? ""}\u5185\u5BB9` : "\u8FD8\u6CA1\u6709\u5185\u5BB9\u3002\u5728\u4E0A\u9762\u7C98\u8D34\u4E00\u4E2A\u94FE\u63A5\uFF1A\u97F3\u89C6\u9891\u4F1A\u5728\u672C\u673A\u8F6C\u5F55\uFF0C\u5916\u6587\u81EA\u52A8\u7FFB\u6210\u4E2D\u82F1\u5BF9\u7167\uFF1B\u7F51\u9875\u3001\u5C0F\u7EA2\u4E66\u3001\u516C\u4F17\u53F7\u3001\u63A8\u7279\u4F1A\u6293\u53D6\u6B63\u6587\u548C\u56FE\u7247\u3002" }),
      items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: `mr-row${selected === item.id ? " is-on" : ""}${!item.read && item.status === "done" ? " is-unread" : ""}`, onClick: () => onSelect(item.id), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-row-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-row-meta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: item.source || PLATFORM[item.platform] || "" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: shortDate(item.createdAt) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-row-title", children: item.titleZh || item.title }),
          running(item) ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-prog", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              item.stage || STATUS[item.status],
              item.progress ? ` ${Math.round(item.progress * 100)}%` : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-bar", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { style: { width: `${Math.max(3, Math.round((item.progress || 0) * 100))}%` } }) })
          ] }) : item.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-row-summary mr-error-text", children: item.error }) : item.preview && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-row-summary", children: item.preview })
        ] }),
        item.image && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { className: `mr-row-thumb${item.platform === "youtube" || item.platform === "bilibili" ? " is-wide" : ""}`, src: item.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer", onError: (event) => {
          event.currentTarget.style.visibility = "hidden";
        } })
      ] }, item.id))
    ] })
  ] });
}
function InputCenter({ api, selection, nav, aiOpen, onSubject, onSelectId, version }) {
  const itemId = selection?.id;
  const [raw, setData] = (0, import_react4.useState)(null);
  const data = raw?.item?.id === itemId ? raw : null;
  const [error, setError] = (0, import_react4.useState)("");
  const [mode, setMode] = (0, import_react4.useState)("bilingual");
  const [menu, setMenu] = (0, import_react4.useState)("");
  const [pop, setPop] = (0, import_react4.useState)(null);
  const [quoteDraft, setQuoteDraft] = (0, import_react4.useState)(null);
  const [videoStart, setVideoStart] = (0, import_react4.useState)(0);
  const [order, setOrder] = (0, import_react4.useState)([]);
  const media = (0, import_react4.useRef)(null);
  const body = (0, import_react4.useRef)(null);
  const scroller = (0, import_react4.useRef)(null);
  const focused = (0, import_react4.useRef)("");
  const load = useStable(async () => {
    if (!itemId) return void 0;
    try {
      const next = await api.getItem({ id: itemId });
      setData(next);
      setError("");
      return next;
    } catch (cause) {
      setError(cause.message);
      return void 0;
    }
  });
  (0, import_react4.useEffect)(() => {
    setData(null);
    setError("");
    setPop(null);
    setVideoStart(0);
    setMenu("");
    if (!itemId) return;
    void load().then((next) => {
      if (next && next.item.status === "done" && !next.item.read) void api.markItemRead({ id: itemId }).then(() => nav.refresh());
    });
    void api.listItems({}).then((page) => setOrder(page.items.map((item2) => item2.id))).catch(() => {
    });
  }, [itemId, selection?.nonce]);
  (0, import_react4.useEffect)(() => {
    if (itemId && version) void load();
  }, [version]);
  const busy = data && (running(data.item) || data.translation?.status === "running");
  (0, import_react4.useEffect)(() => {
    if (!busy) return void 0;
    const timer = setInterval(() => void load(), 2e3);
    return () => clearInterval(timer);
  }, [busy]);
  const hasTranslation = Boolean(data?.translation?.texts?.some(Boolean));
  const effective = hasTranslation ? mode : "original";
  (0, import_react4.useEffect)(() => {
    if (data) onSubject({ type: "item", id: itemId, title: data.item.titleZh || data.item.title, mode: effective });
    else if (!itemId) onSubject(null);
  }, [itemId, data?.item?.titleZh, data?.item?.title, effective]);
  (0, import_react4.useEffect)(() => {
    const focus = selection?.focus;
    const token = `${itemId}|${selection?.nonce}`;
    if (!data || focus?.blockIndex === void 0 || focused.current === token) return;
    focused.current = token;
    requestAnimationFrame(() => {
      const el = body.current?.querySelector(`[data-block="${focus.blockIndex}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.classList.add("is-flash");
      setTimeout(() => el?.classList.remove("is-flash"), 1800);
    });
  }, [data, selection?.nonce]);
  const onMouseUp = () => {
    const sel = window.getSelection?.();
    const text = String(sel?.toString() ?? "").trim();
    if (!text || !body.current?.contains(sel.anchorNode)) {
      setPop(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = scroller.current.getBoundingClientRect();
    const blockEl = (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest?.("[data-block]");
    const blockIndex = blockEl ? Number(blockEl.getAttribute("data-block")) : void 0;
    setPop({ text: text.slice(0, 4e3), blockIndex, start: blockIndex !== void 0 ? data.blocks[blockIndex]?.start : void 0, x: rect.left - host.left + rect.width / 2, y: rect.top - host.top + scroller.current.scrollTop });
    if (aiOpen) nav.setSelection(text.slice(0, 6e3));
  };
  const seek = (seconds) => {
    if (media.current) {
      media.current.currentTime = seconds;
      void media.current.play().catch(() => {
      });
      return;
    }
    setVideoStart(Math.max(1, Math.floor(seconds)));
  };
  const translate = async (target) => {
    setMenu("");
    try {
      await api.translateItem({ id: itemId, target });
      await load();
    } catch (cause) {
      nav.showToast(cause.message);
    }
  };
  const step = (delta) => {
    const index = order.indexOf(itemId);
    const next = order[index + delta];
    if (next) onSelectId(next);
  };
  if (!itemId) return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-empty-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "link", size: 30, strokeWidth: 1.4 }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: "\u628A\u94FE\u63A5\u6254\u8FDB\u6765" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "YouTube\u3001B \u7AD9\u3001\u5C0F\u5B87\u5B99\u5355\u96C6\u3001\u82F9\u679C\u64AD\u5BA2\u5355\u96C6\u3001\u97F3\u89C6\u9891\u76F4\u94FE\u4F1A\u5728\u672C\u673A\u8F6C\u5F55\uFF0C\u5916\u6587\u81EA\u52A8\u7FFB\u6210\u4E2D\u82F1\u5BF9\u7167\uFF1B\u7F51\u9875\u3001\u5C0F\u7EA2\u4E66\u7B14\u8BB0\u3001\u516C\u4F17\u53F7\u6587\u7AE0\u3001\u63A8\u6587\u4F1A\u81EA\u52A8\u6293\u53D6\u6B63\u6587\u548C\u56FE\u7247\uFF0C\u5E26\u89C6\u9891\u7684\u5E16\u5B50\u4E5F\u4F1A\u8F6C\u5F55\u3002" })
  ] });
  if (error) return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-empty-center mr-error-text", children: error });
  if (!data) return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-skeleton", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", {}),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", {}),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", {})
  ] });
  const { item, blocks, translation } = data;
  const playback = item.playback ?? {};
  const isZh = String(item.language ?? "").startsWith("zh");
  const quoted = new Set((data.quotes ?? []).map((memo) => memo.quote?.blockIndex).filter((index) => index !== void 0));
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-reader", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-topbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u6536\u8D77 / \u5C55\u5F00\u5217\u8868", onClick: nav.toggleSide, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "sidebar", size: 19 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "mr-select", title: "\u9605\u8BFB\u7248\u672C", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "\u7248\u672C" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { value: effective, disabled: !hasTranslation, onChange: (event) => setMode(event.target.value), children: (hasTranslation ? Object.keys(MODES) : ["original"]).map((key) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: key, children: key === "translation" && translation?.target === "en" ? "English" : MODES[key] }, key)) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "down", size: 14 })
      ] }),
      translation?.status === "running" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "mr-progress-text", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "mr-spinner" }),
        "\u7FFB\u8BD1\u4E2D ",
        translation.total > 1 ? `${translation.done}/${translation.total}` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u4E0A\u4E00\u7BC7", onClick: () => step(-1), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "up", size: 19 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u4E0B\u4E00\u7BC7", onClick: () => step(1), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "down", size: 19 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "mr-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-icon-button", title: item.read ? "\u6807\u4E3A\u672A\u8BFB" : "\u6807\u4E3A\u5DF2\u8BFB", onClick: async () => {
        await api.markItemRead({ id: itemId, read: !item.read });
        await load();
        nav.refresh();
      }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "circleCheck", size: 19 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: `mr-icon-button${aiOpen ? " is-on" : ""}`, title: "AI \u4F34\u8BFB", onClick: nav.openAI, disabled: !blocks.length, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "wand", size: 19 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-menu-wrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u66F4\u591A", onClick: () => setMenu((m) => m ? "" : "more"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "more", size: 19, strokeWidth: 3 }) }),
        menu === "more" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-menu", onMouseLeave: () => setMenu(""), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", onClick: () => setMenu(""), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "external", size: 14 }),
            "\u6253\u5F00\u539F\u94FE\u63A5"
          ] }),
          item.status === "done" && blocks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", onClick: () => void translate(isZh ? "en" : "zh"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "translate", size: 14 }),
            hasTranslation ? "\u91CD\u65B0\u7FFB\u8BD1" : isZh ? "\u7FFB\u8BD1\u6210\u82F1\u6587" : "\u7FFB\u8BD1\u6210\u4E2D\u6587"
          ] }),
          item.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", onClick: async () => {
            setMenu("");
            await api.retryItem({ id: itemId });
            await load();
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "refresh", size: 14 }),
            "\u91CD\u8BD5"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "is-danger", onClick: async () => {
            setMenu("");
            if (!window.confirm("\u5220\u9664\u8FD9\u6761\u8F93\u5165\uFF1F\uFF08\u8BB0\u8FC7\u7684\u7B14\u8BB0\u4F1A\u4FDD\u7559\uFF09")) return;
            await api.deleteItem({ id: itemId });
            nav.refresh();
            onSelectId(null);
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "trash", size: 14 }),
            "\u5220\u9664"
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-scroll", ref: scroller, onMouseUp, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "mr-article", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-article-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: item.source || PLATFORM[item.platform] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: new Date(item.publishedAt || item.createdAt).toLocaleDateString("zh-CN") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "mr-badge", children: MODES[effective] }),
          item.duration ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: formatDuration(item.duration) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { className: "mr-article-title", children: effective !== "original" && translation?.title ? translation.title : item.title }),
        effective === "bilingual" && translation?.title && translation.title !== item.title ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "mr-article-sub", children: item.title }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { height: 14 } }),
        playback.kind === "youtube" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(VideoPlayer, { videoId: playback.videoId, playerUrl: data.videoPlayerUrl ? `${data.videoPlayerUrl}${videoStart ? `?t=${videoStart}` : ""}` : void 0 }, videoStart),
        playback.kind === "bilibili" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-video", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("iframe", { className: "mr-video-frame", src: `https://player.bilibili.com/player.html?isOutside=true&bvid=${playback.bvid}&autoplay=${videoStart ? 1 : 0}&danmaku=0${videoStart ? `&t=${videoStart}` : ""}`, title: "B \u7AD9\u64AD\u653E\u5668", sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups", allowFullScreen: true, referrerPolicy: "strict-origin-when-cross-origin" }, videoStart) }),
        playback.kind === "audio" && item.audioUrl && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-audio", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("audio", { ref: media, controls: true, preload: "none", src: item.audioUrl }) }),
        playback.kind === "video-file" && item.audioUrl && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-video", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("video", { ref: media, className: "mr-video-frame", controls: true, preload: "metadata", src: item.audioUrl }) }),
        running(item) && item.status !== "translating" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-state", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-steps", children: ["resolving", "downloading", "transcribing", "translating"].map((key, index, all) => {
            const at = all.indexOf(item.status);
            return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: index < at ? "is-done" : index === at ? "is-now" : "", children: [
              index < at ? "\u2713 " : "",
              { resolving: item.kind === "web" ? `\u6293\u53D6${SOCIAL.has(item.platform) ? PLATFORM[item.platform] : "\u7F51\u9875"}` : "\u89E3\u6790\u94FE\u63A5", downloading: "\u4E0B\u8F7D\u97F3\u9891", transcribing: "\u672C\u673A\u8F6C\u5F55", translating: "\u7FFB\u8BD1" }[key]
            ] }, key);
          }).filter((_, index) => item.kind !== "web" || item.playback?.kind === "video-file" || index === 0 || index === 3) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-prog", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              item.stage || STATUS[item.status],
              item.progress ? ` ${Math.round(item.progress * 100)}%` : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-bar", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { style: { width: `${Math.max(3, Math.round((item.progress || 0) * 100))}%` } }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "\u53EF\u4EE5\u5148\u53BB\u770B\u522B\u7684\uFF0C\u5B8C\u6210\u540E\u8FD9\u91CC\u4F1A\u81EA\u52A8\u51FA\u73B0\u5168\u6587\u3002" })
        ] }),
        item.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-state mr-error-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "alert", size: 14 }),
            " ",
            item.error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-button", onClick: async () => {
            await api.retryItem({ id: itemId });
            await load();
          }, children: "\u91CD\u8BD5" })
        ] }),
        translation?.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-state mr-error-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "\u7FFB\u8BD1\u5931\u8D25\uFF1A",
            translation.error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-button", onClick: () => void translate(translation.target), children: "\u91CD\u8BD5\u7FFB\u8BD1" })
        ] }),
        data.descriptionHtml && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("details", { className: "mr-notes", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("summary", { children: item.kind === "web" ? "\u6458\u8981" : "\u8282\u76EE / \u89C6\u9891\u7B80\u4ECB" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-prose", dangerouslySetInnerHTML: { __html: sanitizeHtml(data.descriptionHtml) } })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: `mr-body mr-mode-${effective}`, ref: body, onClick: (event) => {
          const ts = event.target.closest?.("[data-seek]");
          if (ts) seek(Number(ts.getAttribute("data-seek")));
        }, children: blocks.map((block, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Block, { index, block, other: translation?.texts?.[index], mode: effective, quoted: quoted.has(index) }, index)) })
      ] }),
      pop && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-pop", style: { left: pop.x, top: pop.y }, onMouseUp: (event) => event.stopPropagation(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", onClick: () => {
          setQuoteDraft(pop);
          setPop(null);
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "pen", size: 13 }),
          "\u8BB0\u5230\u8F93\u51FA"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", onClick: () => {
          nav.askAI(pop.text);
          setPop(null);
        }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "sparkles", size: 13 }),
          "AI \u89E3\u8BFB"
        ] })
      ] })
    ] }),
    quoteDraft && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(QuoteDialog, { api, itemId, draft: quoteDraft, onClose: () => setQuoteDraft(null), onSaved: () => {
      setQuoteDraft(null);
      window.getSelection()?.removeAllRanges();
      nav.showToast("\u5DF2\u8BB0\u5230\u300C\u8F93\u51FA\u300D");
      void load();
      nav.refresh();
    }, showToast: nav.showToast })
  ] });
}
function Block({ block, other, mode, index, quoted }) {
  if (block.type === "img") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("figure", { className: "mr-block-img", "data-block": index, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: block.src, alt: block.alt ?? "", loading: "lazy", referrerPolicy: "no-referrer" }) });
  if (block.type === "code") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "mr-block-code", "data-block": index, children: block.text });
  const Tag = block.type === "h" ? "h3" : block.type === "quote" ? "blockquote" : "p";
  const showOriginal = mode !== "translation" || !other;
  const showOther = mode !== "original" && other;
  const prefix = block.type === "li" ? "\u2022 " : "";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `mr-block mr-block-${block.type}${quoted ? " is-quoted" : ""}`, "data-block": index, children: [
    block.start !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-ts", "data-seek": Math.floor(block.start), children: formatDuration(block.start) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-block-text", children: [
      showOriginal && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Tag, { className: "mr-block-original", children: [
        prefix,
        block.text
      ] }),
      showOther && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Tag, { className: mode === "bilingual" ? "mr-block-translation" : "mr-block-original", children: [
        prefix,
        other
      ] })
    ] })
  ] });
}
function QuoteDialog({ api, itemId, draft, onClose, onSaved, showToast }) {
  const [text, setText] = (0, import_react4.useState)("");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.saveMemo({ text, quote: { itemId, text: draft.text, start: draft.start, blockIndex: draft.blockIndex } });
      onSaved();
    } catch (error) {
      showToast(error.message);
    }
    setBusy(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "mr-dialog-backdrop", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-dialog", role: "dialog", "aria-label": "\u8BB0\u5230\u8F93\u51FA", onClick: (event) => event.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "\u8BB0\u5230\u8F93\u51FA" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("blockquote", { children: draft.text.length > 400 ? `${draft.text.slice(0, 400)}\u2026` : draft.text }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "textarea",
      {
        autoFocus: true,
        rows: 4,
        value: text,
        placeholder: "\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5\uFF08\u53EF\u4EE5\u7559\u7A7A\uFF09  #\u6807\u7B7E",
        onChange: (event) => setText(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save();
          if (event.key === "Escape") onClose();
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "mr-dialog-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-button", onClick: onClose, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "mr-button is-dark", disabled: busy, onClick: () => void save(), children: "\u8BB0\u4E0B \u2318\u21A9" })
    ] })
  ] }) });
}

// src/client/OutputPart.jsx
var import_react5 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function dayLabel(time) {
  const startOfToday = /* @__PURE__ */ new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diff = Math.floor((startOfToday.getTime() + 864e5 - time) / 864e5);
  if (diff === 0) return "\u4ECA\u5929";
  if (diff === 1) return "\u6628\u5929";
  const date = new Date(time);
  const sameYear = date.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear();
  return date.toLocaleDateString("zh-CN", { ...sameYear ? {} : { year: "numeric" }, month: "long", day: "numeric", weekday: "short" });
}
function memoBodyHtml(text) {
  return linkify(escapeHtml(text)).replace(/(^|[\s(（])#([^\s#，。,!?！？；;：:、()（）[\]【】"'“”<]+)/g, '$1<span class="mr-tag">#$2</span>');
}
var withoutTrailingTags = (text) => String(text ?? "").replace(/(\s*#[^\s#]+)+\s*$/u, "").trim();
var firstLine = (text) => String(text ?? "").replace(/(^|\s)#[^\s#]+/g, " ").trim().split("\n")[0] || "\uFF08\u7A7A\u767D\u9875\uFF09";
function OutputSide({ api, selected, onSelect, nav, version }) {
  const [memos, setMemos] = (0, import_react5.useState)([]);
  const [tags, setTags] = (0, import_react5.useState)([]);
  const [tag, setTag] = (0, import_react5.useState)("");
  const [text, setText] = (0, import_react5.useState)("");
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const area = (0, import_react5.useRef)(null);
  const load = useStable(async () => {
    try {
      const page = await api.listMemos({ tag });
      setMemos(page.memos);
      setTags(page.tags);
    } catch (cause) {
      nav.showToast(cause.message);
    }
  });
  (0, import_react5.useEffect)(() => {
    void load();
  }, [tag, version, selected]);
  (0, import_react5.useEffect)(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(180, Math.max(62, el.scrollHeight))}px`;
  }, [text]);
  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const memo = await api.saveMemo({ text: value });
      setText("");
      onSelect(memo.id);
      nav.refresh();
    } catch (cause) {
      nav.showToast(cause.message);
    }
    setBusy(false);
  };
  let lastDay = "";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-write", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          ref: area,
          value: text,
          placeholder: "\u6B64\u523B\u5728\u60F3\u4EC0\u4E48\uFF1F  #\u6807\u7B7E",
          disabled: busy,
          onChange: (event) => setText(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-write-bar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u2318\u21A9 \u8BB0\u4E0B \xB7 \u4F1A\u51FA\u73B0\u5728\u4ECA\u5929" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "mr-button is-dark is-small", disabled: !text.trim() || busy, onClick: () => void submit(), children: "\u8BB0\u4E0B" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-pills", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: `mr-pill${!tag ? " is-on" : ""}`, onClick: () => setTag(""), children: "\u5168\u90E8" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "mr-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: "mr-tag-select", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { value: tag, onChange: (event) => setTag(event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "", children: "#\u6807\u7B7E" }),
          tags.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("option", { value: item.name, children: [
            "#",
            item.name,
            "\uFF08",
            item.count,
            "\uFF09"
          ] }, item.name))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "down", size: 13 })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-list", children: [
      !memos.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-list-empty", children: tag ? "\u8FD9\u4E2A\u6807\u7B7E\u4E0B\u8FD8\u6CA1\u6709\u7B14\u8BB0" : "\u8FD8\u6CA1\u6709\u7B14\u8BB0\u3002\u5728\u4E0A\u9762\u968F\u624B\u5199\u4E00\u53E5\uFF0C\u6216\u8005\u5728\u300C\u8F93\u5165\u300D\u91CC\u9009\u4E2D\u4E00\u6BB5\u300C\u8BB0\u5230\u8F93\u51FA\u300D\u3002" }),
      memos.map((memo) => {
        const day = memo.pinned ? "\u7F6E\u9876" : dayLabel(memo.createdAt);
        const header = day !== lastDay ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-day", children: day }, `d-${memo.id}`) : null;
        lastDay = day;
        return [header, /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: `mr-row mr-memo-row${selected === memo.id ? " is-on" : ""}`, onClick: () => onSelect(memo.id), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-row-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-row-meta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: new Date(memo.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }),
            memo.quote && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u6458\u5F55" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-memo-text", children: withoutTrailingTags(memo.text) || (memo.quote ? "\uFF08\u6458\u5F55\uFF09" : "\uFF08\u7A7A\u767D\u9875\uFF09") }),
          memo.quote && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-memo-quote", children: memo.quote.text }),
          memo.tags?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-memo-tags", children: memo.tags.map((name) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "mr-tag", children: [
            "#",
            name
          ] }, name)) })
        ] }) }, memo.id)];
      })
    ] })
  ] });
}
function OutputCenter({ api, selection, nav, aiOpen, onSubject, onSelect, version }) {
  const memoId = selection?.id;
  const draft = selection?.draft;
  const [rawMemo, setMemo] = (0, import_react5.useState)(null);
  const memo = rawMemo?.id === memoId ? rawMemo : null;
  const [related, setRelated] = (0, import_react5.useState)([]);
  const [text, setText] = (0, import_react5.useState)("");
  const [saving, setSaving] = (0, import_react5.useState)("");
  const area = (0, import_react5.useRef)(null);
  const page = (0, import_react5.useRef)(null);
  const save = useStable(async (target, value) => {
    if (target.id) {
      if (value === target.saved) return;
      await api.saveMemo({ id: target.id, text: value });
      target.saved = value;
      return;
    }
    if (!target.draft || !value.trim() && !target.draft.quote) return;
    if (target.creating) {
      target.queued = value;
      return;
    }
    target.creating = true;
    try {
      const created = await api.saveMemo({ text: value, quote: target.draft.quote });
      target.id = created.id;
      target.saved = value;
      target.loaded = true;
    } finally {
      target.creating = false;
    }
    if (target.queued !== void 0) {
      const queued = target.queued;
      target.queued = void 0;
      await save(target, queued);
    }
    if (page.current === target) onSelect({ id: target.id });
  });
  const flush = useStable(async (target = page.current) => {
    if (!target) return;
    clearTimeout(target.timer);
    if (target.pending === void 0) return;
    const value = target.pending;
    target.pending = void 0;
    try {
      await save(target, value);
      if (page.current === target && target.pending === void 0) setSaving("\u5DF2\u4FDD\u5B58");
      nav.refresh();
    } catch (cause) {
      if (page.current === target) setSaving("");
      nav.showToast(`\u6CA1\u4FDD\u5B58\u4E0A\uFF1A${cause.message}`);
    }
  });
  const load = useStable(async () => {
    const target = page.current;
    if (!target?.id) return;
    try {
      const result = await api.getMemo({ id: target.id });
      if (page.current !== target) return;
      setMemo(result.memo);
      setRelated(result.related);
      if (!target.loaded) {
        target.loaded = true;
        target.saved = result.memo.text;
        setText(result.memo.text);
      }
    } catch (cause) {
      nav.showToast(cause.message);
    }
  });
  (0, import_react5.useEffect)(() => {
    if (memoId && page.current?.id === memoId) {
      void load();
      return;
    }
    const previous = page.current;
    if (previous) void flush(previous);
    page.current = { id: memoId, draft: memoId ? void 0 : draft, saved: void 0, loaded: false };
    setMemo(null);
    setRelated([]);
    setSaving("");
    if (memoId) {
      setText("");
      void load();
    } else {
      setText("");
      if (draft) setTimeout(() => area.current?.focus(), 30);
    }
  }, [memoId, selection?.nonce]);
  (0, import_react5.useEffect)(() => {
    if (memoId && version) void load();
  }, [version]);
  (0, import_react5.useEffect)(() => {
    if (memo) onSubject({ type: "memo", id: memo.id, title: firstLine(memo.text).slice(0, 40) });
    else onSubject(null);
  }, [memo?.id, memo?.text]);
  (0, import_react5.useEffect)(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(240, el.scrollHeight)}px`;
  }, [text, memo?.id]);
  const onChange = (value) => {
    const target = page.current;
    setText(value);
    setSaving("\u6B63\u5728\u4FDD\u5B58\u2026");
    target.pending = value;
    clearTimeout(target.timer);
    target.timer = setTimeout(() => void flush(target), target.id ? 700 : 1200);
  };
  (0, import_react5.useEffect)(() => () => {
    void flush();
  }, []);
  const topbar = /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-topbar", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u6536\u8D77 / \u5C55\u5F00\u5217\u8868", onClick: nav.toggleSide, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "sidebar", size: 19 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "mr-button", onClick: () => nav.newMemo({}), children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "plus", size: 14 }),
      "\u65B0\u7684\u4E00\u9875"
    ] }),
    saving && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "mr-progress-text", children: saving }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "mr-spacer" }),
    memo && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: `mr-icon-button${memo.pinned ? " is-on" : ""}`, title: memo.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876", onClick: async () => {
      await api.pinMemo({ id: memo.id, pinned: !memo.pinned });
      await load();
      nav.refresh();
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "pin", size: 19 }) }),
    memo && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u5220\u9664", onClick: async () => {
      if (!window.confirm("\u5220\u9664\u8FD9\u4E00\u9875\uFF1F")) return;
      clearTimeout(page.current?.timer);
      if (page.current) page.current.pending = void 0;
      await api.deleteMemo({ id: memo.id });
      onSelect(null);
      nav.refresh();
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "trash", size: 19 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: `mr-icon-button${aiOpen ? " is-on" : ""}`, title: "AI \u5BF9\u8BDD", disabled: !memo, onClick: nav.openAI, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "wand", size: 19 }) })
  ] });
  if (!memoId && !draft) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-reader", children: [
      topbar,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-empty-center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "pen", size: 30, strokeWidth: 1.4 }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: "\u5199\u4E0B\u6B64\u523B\u7684\u60F3\u6CD5" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5728\u5DE6\u8FB9\u968F\u624B\u8BB0\u4E00\u53E5\uFF0C\u6216\u8005\u70B9\u300C\u65B0\u7684\u4E00\u9875\u300D\u5199\u957F\u4E00\u70B9\u3002\u8BFB\u7684\u65F6\u5019\u9009\u4E2D\u4E00\u6BB5\uFF0C\u53EF\u4EE5\u76F4\u63A5\u300C\u8BB0\u5230\u8F93\u51FA\u300D\u3002" })
      ] })
    ] });
  }
  const when = new Date(memo?.createdAt ?? Date.now());
  const quote = memo?.quote ?? draft?.quote;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-reader", children: [
    topbar,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "mr-editor-date", children: when.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-editor-sub", children: [
        when.toLocaleDateString("zh-CN", { weekday: "long" }),
        " \xB7 ",
        when.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        memo?.tags?.length ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          " \xB7 ",
          memo.tags.map((name) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "mr-tag", children: [
            " #",
            name
          ] }, name))
        ] }) : null
      ] }),
      quote && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "mr-editor-quote", onClick: () => quote.itemId ? nav.openItem(quote.itemId, { blockIndex: quote.blockIndex }) : quote.memoId && nav.openMemo(quote.memoId), children: [
        quote.text,
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: quote.itemId ? `\u6458\u81EA\u300C${quote.title}\u300D\xB7 \u70B9\u51FB\u56DE\u5230\u539F\u6587` : `${quote.title ?? "\u4E4B\u524D\u5199\u7684"} \xB7 \u70B9\u51FB\u6253\u5F00` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          ref: area,
          className: "mr-editor-body",
          value: text,
          placeholder: quote ? "\u63A5\u7740\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5\u2026\u2026  #\u6807\u7B7E" : "\u5199\u70B9\u4EC0\u4E48\u2026\u2026  #\u6807\u7B7E",
          onChange: (event) => onChange(event.target.value),
          onBlur: () => void flush()
        }
      ),
      related.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "mr-related", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("h4", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Icon, { name: "sparkles", size: 13 }),
          " \u4F60\u4E4B\u524D\u4E5F\u5199\u8FC7"
        ] }),
        related.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { type: "button", className: "mr-related-card", onClick: () => onSelect({ id: item.id }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { dangerouslySetInnerHTML: { __html: memoBodyHtml(firstLine(item.text)) } }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: dayLabel(item.createdAt) })
        ] }, item.id))
      ] })
    ] }) })
  ] });
}

// src/client/ReviewPart.jsx
var import_react6 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function weekLabel(start) {
  const a = new Date(start);
  const b = new Date(start + 6 * 864e5);
  return `${a.getMonth() + 1}\u6708${a.getDate()}\u65E5\u2013${b.getMonth() === a.getMonth() ? "" : `${b.getMonth() + 1}\u6708`}${b.getDate()}\u65E5`;
}
function ReviewSide({ api, selected, onSelect, version }) {
  const [ov, setOv] = (0, import_react6.useState)(null);
  (0, import_react6.useEffect)(() => {
    void api.reviewOverview({}).then(setOv).catch(() => {
    });
  }, [version, selected?.kind]);
  const rows = [
    { kind: "today", icon: "sun", title: "\u4ECA\u65E5\u56DE\u987E", meta: "\u6BCF\u5929", sub: ov ? ov.today.count ? `\u7FFB\u51FA ${ov.today.count} \u6761\u65E7\u60F3\u6CD5\uFF0C\u518D\u60F3\u4E00\u60F3` : "\u5199\u6EE1\u4E00\u5929\u4E4B\u540E\uFF0C\u8FD9\u91CC\u4F1A\u7FFB\u51FA\u65E7\u60F3\u6CD5" : "" },
    { kind: "week", icon: "calendar", title: "\u672C\u5468\u56DE\u987E", meta: "\u5468\u65E5\u751F\u6210", sub: ov ? ov.week.headline || `${weekLabel(ov.week.start)} \xB7 \u6536\u4E86 ${ov.week.items} \u4EFD\uFF0C\u5199\u4E86 ${ov.week.memos} \u6761` : "" },
    { kind: "theme", icon: "hash", title: ov?.theme ? `\u4E3B\u9898 \xB7 #${ov.theme.tag}` : "\u4E3B\u9898", meta: "AI \u53D1\u73B0", sub: ov ? ov.theme ? `${ov.theme.memos} \u6761\u60F3\u6CD5${ov.theme.items ? `\u3001${ov.theme.items} \u4EFD\u7D20\u6750` : ""}\uFF0C\u770B\u770B\u89C2\u70B9\u600E\u4E48\u53D8\u5316` : "\u7ED9\u7B14\u8BB0\u52A0\u4E0A #\u6807\u7B7E \u540E\uFF0C\u8FD9\u91CC\u4F1A\u6309\u4E3B\u9898\u6574\u7406" : "" },
    { kind: "unread", icon: "inbox", title: "\u5F85\u8BFB", meta: "", sub: ov ? ov.unread ? `${ov.unread} \u4EFD\u7D20\u6750\u6536\u4E86\u8FD8\u6CA1\u8BFB` : "\u90FD\u8BFB\u5B8C\u4E86" : "" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-list", children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: `mr-row mr-review-row${selected?.kind === row.kind ? " is-on" : ""}`, onClick: () => onSelect({ kind: row.kind, offset: 0 }), children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-review-icon", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: row.icon, size: 18 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-row-text", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-row-meta is-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-row-title", children: row.title }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: row.meta })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-row-summary", children: row.sub })
    ] })
  ] }, row.kind)) });
}
function AiText({ text, refs = {}, onMemo, onItem }) {
  const parts = String(text ?? "").split(/(\[\[[mi]:[\w-]+\]\])/g);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-review-text", children: parts.map((part, index) => {
    const match = /^\[\[([mi]):([\w-]+)\]\]$/.exec(part);
    if (!match) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react6.Fragment, { children: part.split("\n").map((line, i, all) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react6.Fragment, { children: [
      line,
      i < all.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("br", {})
    ] }, i)) }, index);
    const ref = refs[match[2]];
    if (!ref) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-cite", title: ref.text, onClick: () => match[1] === "m" ? onMemo(match[2]) : onItem(match[2]), children: ref.label }, index);
  }) });
}
function ReviewCenter({ api, selection, nav, aiOpen, onSubject, onSelect, version }) {
  const [raw, setData] = (0, import_react6.useState)(null);
  const [error, setError] = (0, import_react6.useState)("");
  const kind = selection?.kind ?? "week";
  const data = raw?.kind === kind ? raw : null;
  const seq = (0, import_react6.useRef)(0);
  const load = useStable(async () => {
    const ticket = ++seq.current;
    try {
      const next = await api.getReview({ kind, offset: selection?.offset ?? 0, tag: selection?.tag });
      if (ticket === seq.current) {
        setData(next);
        setError("");
      }
    } catch (cause) {
      if (ticket === seq.current) setError(cause.message);
    }
  });
  (0, import_react6.useEffect)(() => {
    setData(null);
    void load();
  }, [kind, selection?.offset, selection?.tag, version]);
  (0, import_react6.useEffect)(() => {
    if (!data?.generating) return void 0;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [data?.generating]);
  (0, import_react6.useEffect)(() => {
    const title = kind === "today" ? "\u4ECA\u65E5\u56DE\u987E" : kind === "unread" ? "\u5F85\u8BFB" : kind === "theme" ? `\u4E3B\u9898 \xB7 #${data?.tag ?? ""}` : `\u672C\u5468\u56DE\u987E \xB7 ${data?.start ? weekLabel(data.start) : ""}`;
    onSubject({ type: "review", kind, offset: selection?.offset ?? 0, tag: data?.tag, title });
  }, [kind, selection?.offset, data?.tag, data?.start]);
  const regenerate = async () => {
    try {
      await api.generateReview({ kind, offset: selection?.offset ?? 0, tag: data?.tag });
      await load();
    } catch (cause) {
      nav.showToast(cause.message);
    }
  };
  const rethink = (memo) => nav.newMemo({ quote: { memoId: memo.id, text: memo.text, title: `\u6211\u5728 ${dayLabel(memo.createdAt)} \u5199\u7684` } });
  const cite = { onMemo: nav.openMemo, onItem: (id) => nav.openItem(id) };
  const topbar = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-topbar", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-icon-button", title: "\u6536\u8D77 / \u5C55\u5F00\u5217\u8868", onClick: nav.toggleSide, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "sidebar", size: 19 }) }),
    kind === "week" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button", disabled: !data?.hasEarlier, onClick: () => onSelect({ kind: "week", offset: (selection?.offset ?? 0) + 1 }), children: "\u2039 \u4E0A\u4E00\u5468" }),
      (selection?.offset ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button", onClick: () => onSelect({ kind: "week", offset: (selection?.offset ?? 0) - 1 }), children: "\u4E0B\u4E00\u5468 \u203A" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-spacer" }),
    (kind === "week" || kind === "theme") && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button", disabled: data?.generating, onClick: () => void regenerate(), children: data?.generating ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-spinner" }),
      "\u751F\u6210\u4E2D"
    ] }) : "\u21BB \u91CD\u65B0\u751F\u6210" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: `mr-icon-button${aiOpen ? " is-on" : ""}`, title: "AI \u5BF9\u8BDD", onClick: nav.openAI, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "wand", size: 19 }) })
  ] });
  if (error) return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-reader", children: [
    topbar,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-empty-center mr-error-text", children: error })
  ] });
  if (!data) return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-reader", children: [
    topbar,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-skeleton", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", {}),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", {}),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", {})
    ] })
  ] });
  let content;
  if (kind === "today") {
    content = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-review-kicker", children: [
        "\u4ECA\u65E5\u56DE\u987E \xB7 ",
        (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { className: "mr-review-title", children: data.memos.length ? `\u518D\u770B\u4E00\u773C\u8FD9 ${data.memos.length} \u6761` : "\u4ECA\u5929\u8FD8\u6CA1\u6709\u53EF\u4EE5\u56DE\u987E\u7684" }),
      !data.memos.length && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mr-muted", children: "\u8F93\u51FA\u91CC\u5199\u6EE1\u4E00\u5929\u4EE5\u4E0A\u7684\u60F3\u6CD5\uFF0C\u4F1A\u5728\u8FD9\u91CC\u6BCF\u5929\u88AB\u7FFB\u51FA\u6765\u51E0\u6761\u3002" }),
      data.memos.map((memo) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ResurfaceCard, { memo, onRethink: () => {
        void api.markReviewed({ id: memo.id });
        rethink(memo);
      }, onOpen: () => nav.openMemo(memo.id), onSkip: async () => {
        await api.markReviewed({ id: memo.id });
        await load();
      } }, memo.id)),
      data.memos.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mr-muted mr-small", children: "\u6311\u9009\u89C4\u5219\uFF1A\u5F88\u4E45\u6CA1\u770B\u8FC7\u7684\u3001\u548C\u6700\u8FD1\u5728\u60F3\u7684\u6807\u7B7E\u76F8\u5173\u7684\u3001\u6765\u81EA\u6458\u5F55\u7684\uFF0C\u4F1A\u4F18\u5148\u88AB\u7FFB\u51FA\u6765\u3002" })
    ] });
  } else if (kind === "unread") {
    content = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-review-kicker", children: "\u5F85\u8BFB" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { className: "mr-review-title", children: data.items.length ? `${data.items.length} \u4EFD\u7D20\u6750\u5728\u7B49\u4F60` : "\u90FD\u8BFB\u5B8C\u4E86" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ItemList, { items: data.items, onOpen: (id) => nav.openItem(id) })
    ] });
  } else if (kind === "theme") {
    content = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-review-kicker", children: "AI \u53D1\u73B0\u7684\u4E3B\u9898" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { className: "mr-review-title", children: data.tag ? `#${data.tag}` : "\u8FD8\u6CA1\u6709\u4E3B\u9898" }),
      data.tags?.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-chips", children: data.tags.slice(0, 12).map((tag) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: `mr-chip${tag.name === data.tag ? " is-on" : ""}`, onClick: () => onSelect({ kind: "theme", tag: tag.name }), children: [
        "#",
        tag.name,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("em", { children: tag.count })
      ] }, tag.name)) }),
      !data.tag && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mr-muted", children: "\u7ED9\u8F93\u51FA\u91CC\u7684\u7B14\u8BB0\u52A0\u4E0A #\u6807\u7B7E\uFF0C\u8FD9\u91CC\u4F1A\u6309\u4E3B\u9898\u628A\u5B83\u4EEC\u4E32\u8D77\u6765\uFF0C\u5E76\u8BA9 AI \u770B\u770B\u4F60\u7684\u89C2\u70B9\u600E\u4E48\u53D8\u5316\u3002" }),
      data.tag && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AiBlock, { ai: data.ai, refs: data.refs, generating: data.generating, empty: data.memos.length < 2 ? "\u8FD9\u4E2A\u4E3B\u9898\u518D\u591A\u5199\u51E0\u6761\uFF0CAI \u5C31\u80FD\u5E2E\u4F60\u770B\u51FA\u53D8\u5316\u3002" : "", cite }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h2", { className: "mr-review-sec", children: "\u65F6\u95F4\u7EBF" }),
        data.memos.map((memo) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: "mr-resurface is-clickable", onClick: () => nav.openMemo(memo.id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-resurface-when", children: dayLabel(memo.createdAt) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-resurface-text", dangerouslySetInnerHTML: { __html: memoBodyHtml(memo.text) } })
        ] }, memo.id)),
        data.items?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h2", { className: "mr-review-sec", children: "\u76F8\u5173\u7D20\u6750" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ItemList, { items: data.items, onOpen: (id) => nav.openItem(id) })
        ] })
      ] })
    ] });
  } else {
    const s = data.stats;
    content = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-review-kicker", children: [
        "\u672C\u5468\u56DE\u987E \xB7 ",
        weekLabel(data.start),
        data.ai?.generatedAt ? ` \xB7 ${new Date(data.ai.generatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} \u751F\u6210` : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h1", { className: "mr-review-title", children: data.ai?.headline || (s.items || s.memos ? "\u8FD9\u4E00\u5468" : "\u8FD9\u4E00\u5468\u8FD8\u662F\u7A7A\u7684") }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-stats", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: s.items }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u4EFD\u8F93\u5165" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: s.mediaSeconds ? formatHours(s.mediaSeconds) : "0" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u97F3\u89C6\u9891" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: s.memos }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u6761\u8F93\u51FA" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("b", { children: s.quoted }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u6761\u6765\u81EA\u6458\u5F55" })
        ] })
      ] }),
      (s.items > 0 || s.memos > 0) && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h2", { className: "mr-review-sec", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "sparkles", size: 15 }),
          " AI \u770B\u5230\u7684"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AiBlock, { ai: data.ai, refs: data.refs, generating: data.generating, cite })
      ] }),
      data.flows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h2", { className: "mr-review-sec", children: [
          "\u8F93\u5165 \u2192 \u8F93\u51FA ",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("small", { children: "\u54EA\u4E9B\u8BFB\u8FC7\u7684\u4E1C\u897F\u53D8\u6210\u4E86\u4F60\u7684\u60F3\u6CD5" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-flows", children: data.flows.map(({ memo, item }) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-flow", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", onClick: () => nav.openItem(memo.quote.itemId, { blockIndex: memo.quote.blockIndex }), children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("small", { children: item?.source || item?.titleZh || item?.title || "\u539F\u6587" }),
            memo.quote.text
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-flow-arrow", children: "\u2192" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", onClick: () => nav.openMemo(memo.id), children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("small", { children: dayLabel(memo.createdAt) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { dangerouslySetInnerHTML: { __html: memoBodyHtml(String(memo.text).split("\n")[0] || "\uFF08\u6458\u5F55\uFF09") } })
          ] })
        ] }, memo.id)) })
      ] }),
      data.resurface.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h2", { className: "mr-review-sec", children: "\u503C\u5F97\u518D\u60F3\u4E00\u60F3" }),
        data.resurface.map((memo) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ResurfaceCard, { memo, onRethink: () => {
          void api.markReviewed({ id: memo.id });
          rethink(memo);
        }, onOpen: () => nav.openMemo(memo.id) }, memo.id))
      ] }),
      data.unread.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h2", { className: "mr-review-sec", children: [
          "\u5F85\u8BFB ",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("small", { children: "\u4E0B\u5468\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ItemList, { items: data.unread, onOpen: (id) => nav.openItem(id) })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-reader", children: [
    topbar,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-review", children: content }) })
  ] });
}
function formatHours(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round(seconds % 3600 / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
function AiBlock({ ai, refs, generating, empty, cite }) {
  if (empty && !ai?.text) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mr-muted", children: empty });
  if (generating && !ai?.text) return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "mr-muted", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "mr-spinner" }),
    " AI \u6B63\u5728\u8BFB\u4F60\u8FD9\u6BB5\u65F6\u95F4\u7684\u8F93\u5165\u548C\u8F93\u51FA\u2026"
  ] });
  if (ai?.error && !ai?.text) return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "mr-error-text", children: [
    "\u6CA1\u6709\u751F\u6210\u6210\u529F\uFF1A",
    ai.error,
    "\uFF08\u70B9\u53F3\u4E0A\u89D2\u300C\u91CD\u65B0\u751F\u6210\u300D\u518D\u8BD5\uFF09"
  ] });
  if (!ai?.text) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "mr-muted", children: "\u70B9\u53F3\u4E0A\u89D2\u300C\u91CD\u65B0\u751F\u6210\u300D\uFF0C\u8BA9 AI \u770B\u770B\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AiText, { text: ai.text, refs, ...cite });
}
function ResurfaceCard({ memo, onRethink, onOpen, onSkip }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-resurface", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-resurface-when", children: [
      dayLabel(memo.createdAt),
      memo.reviewed ? " \xB7 \u4ECA\u5929\u5DF2\u770B\u8FC7" : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-resurface-text", dangerouslySetInnerHTML: { __html: memoBodyHtml(memo.text) } }),
    memo.quote?.text && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-resurface-quote", children: memo.quote.text }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-resurface-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button is-dark", onClick: onRethink, children: "\u63A5\u7740\u5199\u4E00\u6761" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button", onClick: onOpen, children: "\u6253\u5F00" }),
      onSkip && !memo.reviewed && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "mr-button", onClick: onSkip, children: "\u770B\u8FC7\u4E86" })
    ] })
  ] });
}
function ItemList({ items, onOpen }) {
  if (!items?.length) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-item-list", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: "mr-row", onClick: () => onOpen(item.id), children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-row-text", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "mr-row-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: item.source || "" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: item.duration ? formatDuration(item.duration) : "" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-row-title", children: item.titleZh || item.title }),
      item.preview && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "mr-row-summary", dangerouslySetInnerHTML: { __html: escapeHtml(item.preview) } })
    ] }),
    item.image && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("img", { className: "mr-row-thumb is-wide", src: item.image, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })
  ] }, item.id)) });
}

// src/client/styles.css
var styles_default = '/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) \u2014 Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */\n.mr-root{--mr-bg:var(--dsw-alias-bg-base,#fff);--mr-bg-2:var(--dsw-alias-bg-layer-1,#f7f7f7);--mr-fg:var(--dsw-alias-label-primary,#1f1f1f);--mr-muted:var(--dsw-alias-label-secondary,#8a8a8a);--mr-border:var(--dsw-alias-border-l1,#ececec);--mr-border-strong:var(--dsw-alias-border-l2,#dedede);--mr-hover:color-mix(in srgb,var(--mr-fg) 6%,transparent);--mr-accent:var(--dsw-alias-brand-primary,#4d6bfe);--mr-error:var(--dsw-alias-state-error-primary,#d33);--mr-quote:#f5c842;display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;overflow:hidden;color:var(--mr-fg);background:var(--mr-bg);font-size:14px;line-height:1.5;container-type:inline-size;position:relative}\n.mr-root *{box-sizing:border-box}\n.mr-root button,.mr-root input,.mr-root select,.mr-root a,.mr-root textarea{-webkit-app-region:no-drag;font:inherit;color:inherit}\n.mr-root button{cursor:pointer;background:none;border:0;padding:0;text-align:left}\n.mr-root button:disabled{cursor:default;opacity:.45}\n.mr-root :focus-visible{outline:1px solid var(--mr-accent);outline-offset:2px}\n.mr-root textarea:focus-visible,.mr-root input:focus-visible{outline:0}\n.mr-muted{color:var(--mr-muted)}\n.mr-small{font-size:12.5px}\n.mr-error-text{color:var(--mr-error)}\n.mr-spacer{flex:1}\n.mr-workarea{display:flex;flex:1;min-height:0;min-width:0}\n\n/* ---------- left column ---------- */\n.mr-side{width:min(340px,34cqw);min-width:270px;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--mr-border)}\n.mr-root.is-collapsed .mr-side{display:none}\n.mr-side-top{display:flex;align-items:center;height:50px;flex-shrink:0;padding:0 14px 0 18px}\n.mr-side-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600}\n.mr-parts{display:flex;gap:4px;padding:0 14px 10px;flex-shrink:0}\n.mr-root .mr-part{flex:1;height:34px;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:8px;color:var(--mr-muted);font-weight:500;text-align:center}\n.mr-root .mr-part:hover{background:var(--mr-hover);color:var(--mr-fg)}\n.mr-root .mr-part.is-on{background:var(--mr-hover);color:var(--mr-fg);font-weight:600}\n.mr-part em{font-style:normal;font-size:11px;color:var(--mr-muted);font-weight:400}\n.mr-drop{display:flex;align-items:center;gap:8px;height:40px;margin:2px 14px 10px;padding:0 5px 0 12px;border:1px solid var(--mr-border-strong);border-radius:10px;flex-shrink:0;color:var(--mr-muted)}\n.mr-drop:focus-within{border-color:var(--mr-accent)}\n.mr-drop input{flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px;color:var(--mr-fg)}\n.mr-root .mr-drop-go{height:28px;padding:0 10px;border-radius:7px;background:var(--mr-fg);color:var(--mr-bg);font-size:12px;opacity:.35;white-space:nowrap}\n.mr-root .mr-drop-go.is-ready{opacity:1}\n.mr-root .mr-drop-go:disabled{opacity:.35}\n.mr-root .mr-drop-go.is-ready:disabled{opacity:.7}\n.mr-write{margin:2px 14px 10px;border:1px solid var(--mr-border-strong);border-radius:10px;flex-shrink:0}\n.mr-write:focus-within{border-color:var(--mr-accent)}\n.mr-write textarea{display:block;width:100%;min-height:62px;max-height:180px;padding:10px 12px 2px;border:0;outline:0;resize:none;background:transparent;font-size:13.5px;line-height:1.65}\n.mr-write-bar{display:flex;align-items:center;gap:8px;padding:4px 6px 6px 12px;font-size:11.5px;color:var(--mr-muted)}\n.mr-write-bar span{flex:1}\n.mr-pills{display:flex;align-items:center;gap:4px;padding:0 14px 8px;flex-shrink:0}\n.mr-pill-scroll{display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 16px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 16px),transparent);padding-right:12px}\n.mr-pill-scroll::-webkit-scrollbar{display:none}\n.mr-root .mr-pill{height:26px;padding:0 10px;border-radius:6px;font-size:12px;color:var(--mr-muted);flex-shrink:0;white-space:nowrap}\n.mr-root .mr-pill.is-on{background:var(--mr-hover);color:var(--mr-fg)}\n.mr-tag-select{display:inline-flex;align-items:center;gap:2px;color:var(--mr-muted);font-size:12px;position:relative}\n.mr-tag-select select{appearance:none;border:0;background:transparent;font-size:12px;color:var(--mr-muted);padding-right:2px;max-width:140px;cursor:pointer;outline:0}\n.mr-list{flex:1;min-height:0;overflow:auto;padding-bottom:30px}\n.mr-list-empty{padding:30px 22px;color:var(--mr-muted);font-size:13px;line-height:1.8}\n.mr-root .mr-row{position:relative;display:flex;gap:12px;width:100%;padding:14px 16px 14px 18px}\n.mr-row+.mr-row::before{content:"";position:absolute;top:0;left:18px;right:16px;border-top:1px solid var(--mr-border)}\n.mr-root .mr-row:hover{background:var(--mr-bg-2)}\n.mr-root .mr-row.is-on{background:var(--mr-hover);box-shadow:inset 3px 0 0 var(--mr-muted)}\n.mr-row.is-on::before,.mr-row.is-on+.mr-row::before{display:none}\n.mr-row-text{flex:1;min-width:0;display:flex;flex-direction:column}\n.mr-row-meta{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--mr-muted);margin-bottom:4px}\n.mr-row-meta>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.mr-row-meta.is-title{align-items:baseline;color:var(--mr-muted)}\n.mr-row-title{font-size:16px;line-height:1.45;font-weight:500;color:var(--mr-fg);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}\n.mr-row-summary{margin-top:4px;font-size:13px;line-height:1.55;color:var(--mr-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.mr-row.is-unread .mr-row-title::before{content:"";display:inline-block;width:6px;height:6px;margin:0 7px 3px -13px;border-radius:50%;background:var(--mr-fg)}\n.mr-row-thumb{flex:0 0 84px;width:84px;height:84px;margin-top:22px;border-radius:8px;object-fit:cover;background:var(--mr-bg-2)}\n.mr-row-thumb.is-wide{height:54px}\n.mr-prog{display:flex;flex-direction:column;gap:5px;margin-top:8px;font-size:12px;color:var(--mr-accent)}\n.mr-bar{height:3px;border-radius:2px;background:var(--mr-hover);overflow:hidden}\n.mr-bar i{display:block;height:100%;background:var(--mr-accent);border-radius:2px;transition:width .4s}\n.mr-day{padding:16px 18px 2px;font-size:12px;font-weight:600;color:var(--mr-muted)}\n.mr-memo-row{padding-top:10px}\n.mr-memo-text{font-size:14.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}\n.mr-memo-quote{margin-top:6px;padding-left:9px;border-left:2px solid var(--mr-quote);font-size:12.5px;color:var(--mr-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.mr-memo-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:12px}\n.mr-tag{color:var(--mr-accent)}\n.mr-review-row{align-items:flex-start}\n.mr-review-icon{width:36px;height:36px;flex:0 0 36px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:var(--mr-bg-2);color:var(--mr-fg)}\n\n/* ---------- controls ---------- */\n.mr-root .mr-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--mr-border-strong);border-radius:8px;background:var(--mr-bg);color:var(--mr-fg);font-size:12.5px;white-space:nowrap}\n.mr-root .mr-button:hover:not(:disabled){background:var(--mr-hover)}\n.mr-root .mr-button.is-dark{background:var(--mr-fg);border-color:var(--mr-fg);color:var(--mr-bg)}\n.mr-root .mr-button.is-small{height:26px;padding:0 10px;font-size:12px}\n.mr-root .mr-icon-button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:var(--mr-muted);text-decoration:none}\n.mr-root .mr-icon-button.is-small{width:24px;height:24px;border-radius:5px}\n.mr-root .mr-icon-button:hover:not(:disabled){background:var(--mr-hover);color:var(--mr-fg)}\n.mr-root .mr-icon-button.is-on{color:var(--mr-accent)}\n.mr-root .mr-chip{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;height:28px;padding:0 11px;border:1px solid var(--mr-border-strong);border-radius:14px;font-size:12.5px;white-space:nowrap;color:var(--mr-fg)}\n.mr-chip em{font-style:normal;color:var(--mr-muted);font-size:11px;margin-left:2px}\n.mr-root .mr-chip:hover:not(:disabled),.mr-root .mr-chip.is-on{border-color:var(--mr-fg)}\n.mr-chips{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 22px}\n.mr-spinner{display:inline-block;width:12px;height:12px;flex:0 0 auto;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:mr-spin .8s linear infinite;vertical-align:-2px;opacity:.7}\n@keyframes mr-spin{to{transform:rotate(360deg)}}\n.mr-progress-text{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mr-muted);margin-left:4px}\n.mr-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(560px,90%);padding:10px 16px;border-radius:10px;background:var(--mr-fg);color:var(--mr-bg);font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:40}\n\n/* ---------- center ---------- */\n.mr-center{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}\n.mr-reader{flex:1;min-height:0;display:flex;flex-direction:column}\n.mr-topbar{display:flex;align-items:center;gap:6px;height:50px;flex-shrink:0;padding:0 14px}\n.mr-select{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px 0 12px;border:1px solid var(--mr-border-strong);border-radius:9px;font-size:13px;color:var(--mr-muted);margin-right:4px}\n.mr-select select{appearance:none;border:0;background:transparent;font-size:13px;font-weight:500;color:var(--mr-fg);cursor:pointer;outline:0;padding-right:2px}\n.mr-select select:disabled{cursor:default}\n.mr-menu-wrap{position:relative}\n.mr-menu{position:absolute;right:0;top:36px;min-width:160px;padding:4px;border:1px solid var(--mr-border-strong);border-radius:10px;background:var(--mr-bg);box-shadow:0 10px 30px rgba(0,0,0,.14);z-index:20;display:flex;flex-direction:column}\n.mr-root .mr-menu>*{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:13px;text-decoration:none;color:var(--mr-fg)}\n.mr-root .mr-menu>*:hover{background:var(--mr-hover)}\n.mr-root .mr-menu .is-danger{color:var(--mr-error)}\n.mr-scroll{flex:1;min-height:0;overflow:auto;position:relative}\n.mr-empty-center{margin:auto;max-width:420px;padding:24px;text-align:center;color:var(--mr-muted);line-height:1.8}\n.mr-empty-center h3{margin:12px 0 6px;color:var(--mr-fg);font-size:17px}\n.mr-empty-center p{margin:0;font-size:13.5px}\n.mr-skeleton{padding:60px 44px;display:flex;flex-direction:column;gap:16px;max-width:800px;width:100%;margin:0 auto}\n.mr-skeleton div{height:18px;border-radius:6px;background:var(--mr-hover);animation:mr-pulse 1.2s ease-in-out infinite}\n.mr-skeleton div:first-child{height:36px;width:70%}\n@keyframes mr-pulse{50%{opacity:.5}}\n.mr-article{max-width:800px;margin:0 auto;padding:18px 44px 140px}\n.mr-article-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;font-size:14px;color:var(--mr-muted)}\n.mr-badge{display:inline-flex;align-items:center;height:24px;padding:0 9px;border:1px solid var(--mr-border-strong);border-radius:6px;font-size:12.5px}\n.mr-article-title{margin:0 0 6px;font-size:36px;line-height:1.3;font-weight:700;letter-spacing:-.01em;word-break:break-word}\n.mr-article-sub{margin:0 0 22px;font-size:16px;color:var(--mr-muted)}\n.mr-audio{position:sticky;top:0;z-index:5;margin:4px 0 24px;padding:8px 0;background:var(--mr-bg)}\n.mr-audio audio{width:100%}\n.mr-video{margin:4px 0 24px}\n.mr-video-frame{display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#000}\n.mr-video-loading{display:flex;align-items:center;justify-content:center;color:#aaa}\n.mr-link-button{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:12.5px;color:var(--mr-muted);text-decoration:none}\n.mr-link-button:hover{color:var(--mr-fg)}\n.mr-state{display:flex;flex-direction:column;gap:10px;margin-bottom:24px;padding:20px;border:1px dashed var(--mr-border-strong);border-radius:12px;color:var(--mr-muted);font-size:13px}\n.mr-state>span{display:flex;align-items:center;gap:6px}\n.mr-state .mr-button{align-self:flex-start}\n.mr-steps{display:flex;flex-wrap:wrap;gap:18px}\n.mr-steps .is-done{color:#1f9d55}\n.mr-steps .is-now{color:var(--mr-accent);font-weight:600}\n.mr-notes{margin-bottom:24px;padding:12px 16px;border-radius:12px;background:var(--mr-bg-2);font-size:14px;line-height:1.75}\n.mr-notes summary{cursor:pointer;color:var(--mr-muted);font-size:13px}\n.mr-prose{margin-top:8px;overflow-wrap:anywhere}\n.mr-prose p{margin:0 0 .7em}\n.mr-prose a{color:var(--mr-accent);text-decoration:none}\n.mr-prose img{max-width:100%;border-radius:8px}\n.mr-body{font-size:19px;line-height:1.9;overflow-wrap:anywhere}\n.mr-block{display:flex;gap:14px;margin:0 0 24px;border-radius:8px;transition:background .4s}\n.mr-block-text{flex:1;min-width:0}\n.mr-block p,.mr-block h3,.mr-block blockquote{margin:0}\n.mr-block-h h3{margin-top:12px;font-size:1.2em;line-height:1.45}\n.mr-block-quote blockquote{padding-left:14px;border-left:3px solid var(--mr-border-strong);color:var(--mr-muted)}\n.mr-block-translation{margin-top:6px !important;color:var(--mr-muted);font-size:.93em;line-height:1.85}\n.mr-mode-bilingual .mr-block-h .mr-block-translation{font-size:1em}\n.mr-block.is-quoted .mr-block-text{box-shadow:inset 0 -2px 0 var(--mr-quote)}\n.mr-block.is-flash{background:rgba(245,200,66,.22)}\n.mr-block-img{margin:0 0 24px}\n.mr-block-img img{display:block;max-width:100%;margin:0 auto;border-radius:10px}\n.mr-block-code{margin:0 0 24px;padding:12px 14px;overflow:auto;border-radius:10px;background:var(--mr-bg-2);font-size:13px;line-height:1.6;white-space:pre}\n.mr-root .mr-ts{flex:0 0 auto;height:22px;margin-top:8px;padding:0 7px;border-radius:5px;background:var(--mr-bg-2);color:var(--mr-muted);font-size:12px;font-variant-numeric:tabular-nums;line-height:22px}\n.mr-root .mr-ts:hover{background:var(--mr-fg);color:var(--mr-bg)}\n.mr-pop{position:absolute;z-index:30;display:flex;gap:2px;padding:3px;transform:translate(-50%,calc(-100% - 8px));border-radius:9px;background:#1f1f1f;box-shadow:0 8px 20px rgba(0,0,0,.25)}\n.mr-root .mr-pop button{display:flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:7px;color:#fff;font-size:12.5px;white-space:nowrap}\n.mr-root .mr-pop button:hover{background:#3a3a3a}\n.mr-dialog-backdrop{position:absolute;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2)}\n.mr-dialog{width:min(500px,92%);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:14px;background:var(--mr-bg);box-shadow:0 20px 50px rgba(0,0,0,.22)}\n.mr-dialog blockquote{margin:0;max-height:160px;overflow:auto;padding:10px 14px;border-left:3px solid var(--mr-quote);border-radius:0 8px 8px 0;background:rgba(245,200,66,.1);font-size:14px;line-height:1.75;color:var(--mr-muted)}\n.mr-dialog textarea{width:100%;min-height:90px;padding:10px 12px;border:1px solid var(--mr-border-strong);border-radius:10px;outline:0;resize:vertical;background:var(--mr-bg);font-size:14px;line-height:1.7}\n.mr-dialog-actions{display:flex;justify-content:flex-end;gap:8px}\n\n/* output editor */\n.mr-editor{max-width:760px;margin:0 auto;padding:22px 44px 140px}\n.mr-editor-date{font-size:30px;font-weight:700}\n.mr-editor-sub{margin:4px 0 22px;font-size:14px;color:var(--mr-muted)}\n.mr-root .mr-editor-quote{display:block;width:100%;margin:0 0 20px;padding:14px 16px;border-left:3px solid var(--mr-quote);border-radius:0 10px 10px 0;background:rgba(245,200,66,.1);font-size:15.5px;line-height:1.8;color:var(--mr-fg);white-space:pre-wrap}\n.mr-editor-quote small{display:block;margin-top:6px;font-size:12.5px;color:var(--mr-muted)}\n.mr-root .mr-editor-body{display:block;width:100%;min-height:240px;padding:0;border:0;outline:0;resize:none;overflow:hidden;background:transparent;font-size:18px;line-height:1.95}\n.mr-related{margin-top:34px;padding-top:16px;border-top:1px solid var(--mr-border)}\n.mr-related h4{display:flex;align-items:center;gap:6px;margin:0 0 10px;font-size:13px;font-weight:600;color:var(--mr-muted)}\n.mr-root .mr-related-card{display:block;width:100%;margin-bottom:8px;padding:10px 12px;border-radius:10px;background:var(--mr-bg-2);font-size:14px;line-height:1.7}\n.mr-root .mr-related-card:hover{background:var(--mr-hover)}\n.mr-related-card small{display:block;color:var(--mr-muted)}\n\n/* review */\n.mr-review{max-width:780px;margin:0 auto;padding:22px 44px 140px}\n.mr-review-kicker{font-size:14px;color:var(--mr-muted)}\n.mr-review-title{margin:4px 0 20px;font-size:32px;line-height:1.3;font-weight:700}\n.mr-review-sec{display:flex;align-items:center;gap:8px;margin:32px 0 12px;font-size:19px;font-weight:700}\n.mr-review-sec small{font-size:12.5px;font-weight:400;color:var(--mr-muted)}\n.mr-review-text{font-size:17px;line-height:1.95}\n.mr-root .mr-cite{display:inline-flex;align-items:center;height:20px;margin:0 2px;padding:0 7px;border-radius:10px;background:var(--mr-hover);color:var(--mr-accent);font-size:12px;vertical-align:2px}\n.mr-root .mr-cite:hover{background:var(--mr-accent);color:#fff}\n.mr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}\n.mr-stats>div{padding:14px;border-radius:12px;background:var(--mr-bg-2)}\n.mr-stats b{display:block;font-size:24px}\n.mr-stats span{font-size:12.5px;color:var(--mr-muted)}\n.mr-flows{display:flex;flex-direction:column;gap:10px}\n.mr-flow{display:grid;grid-template-columns:1fr 22px 1fr;gap:8px;align-items:center}\n.mr-root .mr-flow>button{padding:10px 12px;border-radius:10px;background:var(--mr-bg-2);font-size:13.5px;line-height:1.6;align-self:stretch}\n.mr-root .mr-flow>button:hover{background:var(--mr-hover)}\n.mr-flow small{display:block;font-size:11.5px;color:var(--mr-muted)}\n.mr-flow-arrow{text-align:center;color:var(--mr-muted)}\n.mr-root .mr-resurface{display:block;width:100%;margin-bottom:12px;padding:16px 18px;border:1px solid var(--mr-border);border-radius:12px}\n.mr-root .mr-resurface.is-clickable:hover{background:var(--mr-bg-2)}\n.mr-resurface-when{margin-bottom:6px;font-size:12.5px;color:var(--mr-muted)}\n.mr-resurface-text{font-size:16.5px;line-height:1.8;white-space:pre-wrap;word-break:break-word}\n.mr-resurface-quote{margin-top:8px;padding-left:10px;border-left:2px solid var(--mr-quote);font-size:14px;color:var(--mr-muted)}\n.mr-resurface-actions{display:flex;gap:8px;margin-top:12px}\n.mr-item-list .mr-row{padding-left:0;padding-right:0}\n.mr-item-list .mr-row::before{left:0;right:0}\n.mr-item-list .mr-row-thumb{margin-top:20px}\n\n/* ---------- AI \u4F34\u8BFB ---------- */\n.mr-companion{width:min(420px,38cqw);min-width:320px;flex:0 0 auto;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--mr-border);background:var(--mr-bg)}\n.mr-companion-header{display:flex;align-items:center;gap:4px;height:50px;flex-shrink:0;padding:0 10px 0 20px}\n.mr-companion-header strong{flex:1;font-size:16px}\n.mr-companion-context{display:flex;flex-direction:column;gap:2px;padding:6px 20px 12px;border-bottom:1px solid var(--mr-border)}\n.mr-companion-context strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}\n.mr-companion-context small{font-size:12.5px;color:var(--mr-muted)}\n.mr-companion-quote{margin:10px 14px 0;padding:8px 12px;border-left:3px solid var(--mr-quote);border-radius:0 8px 8px 0;background:rgba(245,200,66,.1);font-size:12.5px}\n.mr-companion-quote>div{display:flex;align-items:center;justify-content:space-between}\n.mr-companion-quote blockquote{margin:4px 0 0;color:var(--mr-muted);line-height:1.6;white-space:pre-wrap}\n.mr-companion-error,.mr-companion-loading{padding:16px 20px;font-size:13px;color:var(--mr-muted)}\n.mr-companion-error p{color:var(--mr-error)}\n.mr-companion-notice{display:flex;align-items:center;gap:6px;margin:10px 14px 0;padding:6px 10px;border-radius:8px;background:var(--mr-hover);font-size:12.5px}\n.mr-companion-notice span{flex:1}\n.mr-native-chat{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\n.mr-native-chat>[data-conversation-content]{flex:1;min-height:0}\n.mr-companion-opening{position:absolute;left:0;right:0;top:22%;display:flex;flex-direction:column;align-items:center;padding:0 24px;text-align:center;color:var(--mr-muted);pointer-events:none}\n.mr-companion-opening svg{stroke:currentColor;stroke-width:2;opacity:.6}\n.mr-companion-opening h3{margin:12px 0 4px;color:var(--mr-fg);font-size:17px}\n.mr-companion-opening p{margin:0;font-size:13px}\n.mr-quick-prompts{display:flex;gap:6px;padding:8px 14px 10px;overflow-x:auto;flex-shrink:0;border-top:1px solid var(--mr-border)}\n\n@container (max-width:980px){\n  .mr-root.has-ai .mr-side{display:none}\n}\n@container (max-width:720px){\n  .mr-side{width:100%;border-right:0}\n  .mr-companion{position:absolute;inset:0;z-index:20;width:auto;min-width:0}\n}\n';

// src/client/App.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function ReaderIcon({ size = 18, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: active ? "var(--dsw-alias-brand-primary)" : "inherit", display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "layers", size }) });
}
var Boundary = class extends import_react7.Component {
  state = { error: null, attempt: 0 };
  static getDerivedStateFromError(error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { role: "alert", style: { padding: 24, color: "var(--dsw-alias-label-primary)" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { children: "Reverie \u51FA\u9519\u4E86" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { style: { whiteSpace: "pre-wrap" }, children: this.state.error }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("button", { type: "button", onClick: () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 })), children: "\u91CD\u65B0\u6253\u5F00" })
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ReaderApp, { ...this.props }, this.state.attempt);
  }
};
function ReaderPanel(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Boundary, { ...props });
}
var MODE_LABEL = { bilingual: "\u4E2D\u82F1\u5BF9\u7167", translation: "\u8BD1\u6587", original: "\u539F\u6587" };
var PROMPTS = {
  item: [
    { title: "\u89E3\u8BFB\u8FD9\u6BB5 / \u8FD9\u7BC7", body: "\u5E2E\u6211\u89E3\u8BFB\u4E00\u4E0B\uFF1A\u5B83\u5728\u8BB2\u4EC0\u4E48\u3001\u80CC\u540E\u7684\u80CC\u666F\u662F\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u91CD\u8981\u3002\u5982\u679C\u6211\u9009\u4E2D\u4E86\u4E00\u6BB5\uFF0C\u5C31\u53EA\u89E3\u8BFB\u90A3\u4E00\u6BB5\u3002" },
    { title: "\u4E09\u70B9\u6982\u62EC\u6838\u5FC3\u89C2\u70B9", body: "\u8BF7\u7528\u4E09\u70B9\u6982\u62EC\u6838\u5FC3\u89C2\u70B9\uFF0C\u5E76\u533A\u5206\u4E8B\u5B9E\u548C\u4F5C\u8005\u7684\u5224\u65AD\u3002" },
    { title: "\u8FD9\u4E2A\u6982\u5FF5\u662F\u4EC0\u4E48\u610F\u601D", body: "\u91CC\u9762\u6709\u54EA\u4E9B\u6211\u53EF\u80FD\u4E0D\u719F\u6089\u7684\u6982\u5FF5\u6216\u672F\u8BED\uFF1F\u6311\u6700\u5173\u952E\u7684\u51E0\u4E2A\uFF0C\u7528\u901A\u4FD7\u7684\u4E2D\u6587\u89E3\u91CA\u3002" },
    { title: "\u548C\u6211\u4E4B\u524D\u7684\u60F3\u6CD5\u6709\u4EC0\u4E48\u5173\u7CFB", body: "\u7ED3\u5408\u6211\u5728 Reverie \u91CC\u5199\u8FC7\u7684\u60F3\u6CD5\uFF0C\u8FD9\u6761\u5185\u5BB9\u548C\u6211\u4E4B\u524D\u7684\u54EA\u4E9B\u60F3\u6CD5\u6709\u5173\uFF1F\u662F\u652F\u6301\u3001\u8865\u5145\u8FD8\u662F\u53CD\u9A73\uFF1F" }
  ],
  memo: [
    { title: "\u5E2E\u6211\u8FFD\u95EE 3 \u4E2A\u95EE\u9898", body: "\u9488\u5BF9\u6211\u8FD9\u6761\u60F3\u6CD5\uFF0C\u5E2E\u6211\u8FFD\u95EE 3 \u4E2A\u95EE\u9898\uFF0C\u8BA9\u6211\u60F3\u5F97\u66F4\u6DF1\u3002" },
    { title: "\u548C\u6211\u8BFB\u8FC7\u7684\u4EC0\u4E48\u6709\u5173", body: "\u8FD9\u6761\u60F3\u6CD5\u548C\u6211\u4E4B\u524D\u5199\u8FC7\u7684\u54EA\u4E9B\u60F3\u6CD5\u3001\u8BFB\u8FC7\u7684\u54EA\u4E9B\u5185\u5BB9\u6709\u5173\uFF1F" },
    { title: "\u5C55\u5F00\u6210\u4E00\u6BB5", body: "\u5E2E\u6211\u628A\u8FD9\u6761\u60F3\u6CD5\u5C55\u5F00\u6210\u4E00\u6BB5\u5B8C\u6574\u7684\u6587\u5B57\uFF0C\u4FDD\u6301\u6211\u7684\u8BED\u6C14\u3002" }
  ],
  review: [
    { title: "\u8FD9\u5468\u6211\u5728\u60F3\u4EC0\u4E48", body: "\u8FD9\u5468\u6211\u4E3B\u8981\u5728\u60F3\u4EC0\u4E48\uFF1F\u6709\u54EA\u4E9B\u53CD\u590D\u51FA\u73B0\u7684\u4E3B\u9898\uFF1F" },
    { title: "\u54EA\u91CC\u81EA\u76F8\u77DB\u76FE", body: "\u6211\u7684\u8FD9\u4E9B\u60F3\u6CD5\u91CC\uFF0C\u6709\u54EA\u4E9B\u5730\u65B9\u81EA\u76F8\u77DB\u76FE\u6216\u8005\u8FD8\u6CA1\u60F3\u6E05\u695A\uFF1F" },
    { title: "\u63A5\u4E0B\u6765\u8BFB\u4EC0\u4E48", body: "\u6839\u636E\u8FD9\u4E9B\u5185\u5BB9\uFF0C\u6211\u63A5\u4E0B\u6765\u6700\u503C\u5F97\u8BFB/\u542C\u4EC0\u4E48\uFF1F\u4E3A\u4EC0\u4E48\uFF1F" }
  ]
};
function ReaderApp({ api, SessionProvider, renderSlot }) {
  const [part, setPartState] = (0, import_react7.useState)(() => localStorage.getItem("reverie.part") || localStorage.getItem("my-reader.part") || "in");
  const [collapsed, setCollapsed] = (0, import_react7.useState)(false);
  const [counts, setCounts] = (0, import_react7.useState)({ items: 0, memos: 0 });
  const [toast, setToast] = (0, import_react7.useState)("");
  const [inSel, setInSel] = (0, import_react7.useState)(null);
  const [outSel, setOutSel] = (0, import_react7.useState)(null);
  const [reviewSel, setReviewSel] = (0, import_react7.useState)({ kind: "week", offset: 0 });
  const [subject, setSubject] = (0, import_react7.useState)(null);
  const [aiOpen, setAiOpen] = (0, import_react7.useState)(false);
  const [selection, setSelection] = (0, import_react7.useState)("");
  const [autoAsk, setAutoAsk] = (0, import_react7.useState)(null);
  const [version, setVersion] = (0, import_react7.useState)(0);
  const setPart = (next) => {
    setPartState(next);
    localStorage.setItem("reverie.part", next);
    setSelection("");
    setAutoAsk(null);
  };
  const showToast = useStable((message) => {
    setToast(message);
    setTimeout(() => setToast((current) => current === message ? "" : current), 3200);
  });
  const refresh = useStable(() => setVersion((v) => v + 1));
  const loadCounts = useStable(async () => {
    try {
      const ov = await api.overview({});
      setCounts(ov.counts);
    } catch {
    }
  });
  (0, import_react7.useEffect)(() => {
    void loadCounts();
  }, [version]);
  const nav = {
    openItem: (id, focus) => {
      setPart("in");
      setInSel({ id, focus, nonce: Date.now() });
    },
    openMemo: (id) => {
      setPart("out");
      setOutSel({ id });
    },
    newMemo: (draft = {}) => {
      setPart("out");
      setOutSel({ draft, nonce: Date.now() });
    },
    openReview: (sel) => {
      setPart("review");
      setReviewSel(sel);
    },
    askAI: (text) => {
      setSelection(text ?? "");
      setAiOpen(true);
      setAutoAsk(text ? { id: Date.now(), body: "\u5E2E\u6211\u89E3\u8BFB\u6211\u9009\u4E2D\u7684\u8FD9\u4E00\u6BB5\uFF1A\u5B83\u5728\u8BB2\u4EC0\u4E48\u3001\u80CC\u540E\u7684\u80CC\u666F\u662F\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u91CD\u8981\u3002" } : null);
    },
    openAI: () => {
      setAiOpen((open) => !open);
      setAutoAsk(null);
    },
    setSelection,
    showToast,
    refresh,
    toggleSide: () => setCollapsed((v) => !v)
  };
  const companionContext = subject && buildContext(api, subject, selection, autoAsk);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: `mr-root${aiOpen ? " has-ai" : ""}${collapsed ? " is-collapsed" : ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "mr-workarea", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("aside", { className: "mr-side", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "mr-side-top", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "mr-side-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "layers", size: 20 }),
          "Reverie"
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "mr-parts", role: "tablist", children: [["in", "\u8F93\u5165", counts.items], ["out", "\u8F93\u51FA", counts.memos], ["review", "\u56DE\u987E"]].map(([key, label, count]) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", role: "tab", "aria-selected": part === key, className: `mr-part${part === key ? " is-on" : ""}`, onClick: () => setPart(key), children: [
          label,
          count !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("em", { children: count })
        ] }, key)) }),
        part === "in" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(InputSide, { api, selected: inSel?.id, version, onSelect: (id) => setInSel({ id }), nav, onCounts: loadCounts }),
        part === "out" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(OutputSide, { api, selected: outSel?.id, version, onSelect: (id) => setOutSel({ id }), nav }),
        part === "review" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ReviewSide, { api, selected: reviewSel, version, onSelect: setReviewSel })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("main", { className: "mr-center", children: [
        part === "in" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(InputCenter, { api, selection: inSel, nav, aiOpen, onSubject: setSubject, onSelectId: (id) => setInSel({ id }), version }),
        part === "out" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(OutputCenter, { api, selection: outSel, nav, aiOpen, onSubject: setSubject, onSelect: setOutSel, version }),
        part === "review" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ReviewCenter, { api, selection: reviewSel, nav, aiOpen, onSubject: setSubject, onSelect: setReviewSel, version })
      ] }),
      aiOpen && companionContext && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        Companion,
        {
          api,
          context: companionContext,
          SessionProvider,
          renderSlot,
          onClose: () => setAiOpen(false),
          onClearSelection: () => {
            window.getSelection()?.removeAllRanges();
            setSelection("");
            setAutoAsk(null);
          }
        }
      )
    ] }),
    toast && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "mr-toast", role: "status", children: toast })
  ] });
}
function buildContext(api, subject, selection, autoAsk) {
  if (subject.type === "item") {
    return {
      key: `item:${subject.id}`,
      version: subject.mode,
      selection,
      title: subject.title,
      subtitle: `${MODE_LABEL[subject.mode] ?? "\u539F\u6587"} \xB7 \u5F53\u524D\u7D20\u6750`,
      bind: (sessionId) => api.setReadingContext({ sessionId, id: subject.id, mode: subject.mode, selection: selection ?? "" }),
      prompts: PROMPTS.item,
      autoAsk
    };
  }
  if (subject.type === "memo") {
    return {
      key: `memo:${subject.id}`,
      title: subject.title,
      subtitle: "\u5F53\u524D\u8FD9\u4E00\u9875 \xB7 AI \u4E5F\u80FD\u770B\u5230\u4F60\u5176\u4ED6\u7684\u8F93\u51FA",
      bind: (sessionId) => api.setNotesContext({ sessionId, scope: "memo", id: subject.id }),
      prompts: PROMPTS.memo,
      openingTitle: "\u60F3\u4E00\u60F3\uFF0C\u5199\u4E0B\u6765",
      openingText: "\u8BA9 AI \u5E2E\u4F60\u8FFD\u95EE\u3001\u8865\u5168\uFF0C\u6216\u8005\u628A\u51E0\u6761\u60F3\u6CD5\u8FDE\u8D77\u6765\u3002"
    };
  }
  return {
    key: `review:${subject.kind}:${subject.offset ?? ""}:${subject.tag ?? ""}`,
    title: subject.title,
    subtitle: "\u8FD9\u6B21\u56DE\u987E\u6D89\u53CA\u7684\u8F93\u5165\u548C\u8F93\u51FA",
    bind: (sessionId) => api.setNotesContext({ sessionId, scope: "review", kind: subject.kind, offset: subject.offset, tag: subject.tag }),
    prompts: PROMPTS.review,
    openingTitle: "\u4E00\u8D77\u56DE\u5934\u770B\u770B",
    openingText: "\u95EE\u95EE\u8FD9\u6BB5\u65F6\u95F4\u7684\u81EA\u5DF1\u5728\u60F3\u4EC0\u4E48\u3002"
  };
}

// src/client/index.jsx
var PLUGIN_ID = "dsh-reverie";
var PANEL_ID = "reverie";
var METHODS = [
  "overview",
  "timeline",
  "submit",
  "getItem",
  "translateItem",
  "retryItem",
  "deleteItem",
  "listItems",
  "markItemRead",
  "listMemos",
  "getMemo",
  "saveMemo",
  "deleteMemo",
  "pinMemo",
  "setReadingContext",
  "setNotesContext",
  "saveSettings",
  "reviewOverview",
  "getReview",
  "generateReview",
  "markReviewed",
  "chatWorkspace"
];
var codec = () => ({
  mode: "strict",
  typeSymbol: `${PLUGIN_ID}#json`,
  create: () => ({ parse: (value) => value, safeParse: (value) => ({ success: true, data: value }) })
});
var TYPERT_REMOTE = {
  package: PLUGIN_ID,
  descriptors: METHODS.map((method) => ({
    id: `${PLUGIN_ID}#reverie/${method}`,
    service: "reverie",
    namespace: "reverie",
    method,
    invocation: { kind: "direct" },
    parameters: [{ name: "request", wire: "request", source: "json", codec: codec() }],
    result: { mode: "src-json" },
    cancellation: { parameter: "signal" }
  }))
};
var inject = ["slots", "layout", "remote"];
async function apply(ctx) {
  try {
    await ctx.remote.$mount(TYPERT_REMOTE);
  } catch (error) {
    ctx.logger?.error?.("reverie: failed to mount the reverie Remote namespace: %o", error);
    throw error;
  }
  ctx.inject(["remote.reverie"], (child) => register(child));
}
function register(ctx) {
  const call = async (name, params = {}) => {
    const namespace = ctx.remote.reverie;
    if (!namespace || typeof namespace[name] !== "function") throw new Error("Reverie \u670D\u52A1\u8FD8\u6CA1\u51C6\u5907\u597D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    const result = await namespace[name](params);
    if (result.ok) return result.value;
    throw result.error instanceof Error ? result.error : new Error(result.error?.message ?? String(result.error));
  };
  const api = { ...nativeChatBridge(ctx), ...Object.fromEntries(METHODS.map((name) => [name, (params) => call(name, params)])) };
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    children: { "reverie.chat": { kind: "single", scope: "session" } },
    inject: () => ({ api })
  }, ReaderPanel));
  ctx.slots.inject("reverie.chat", () => ctx.slots.register({ name: "reverie.chat" }, NativeConversation));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 14,
    label: "Reverie"
  }, ReaderIcon));
}
/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/NativeConversation.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Copied verbatim.
 * See NOTICE.md for details.
 */
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
/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/*!
 * SPDX-License-Identifier: GPL-3.0-only AND ISC AND MIT
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * Most SVG path data below comes from Lucide <https://lucide.dev>,
 * Copyright (c) Lucide Icons and Contributors, ISC License; icons Lucide derives
 * from Feather are Copyright (c) 2013-present Cole Bemis, MIT License.
 * Full texts: licenses/lucide-LICENSE.txt. See NOTICE.md.
 */
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
/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/host/sanitize.js
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Copied verbatim; moved to src/shared/ so the host and client share one copy.
 * See NOTICE.md for details.
 */
/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/VideoPlayer.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Adapted: YouTube only (Bilibili player removed), takes a video id instead of an embed URL, plugin-specific classes.
 * See NOTICE.md for details.
 */
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

		return module.exports;
	}
});

