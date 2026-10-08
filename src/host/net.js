/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** HTTP helpers with timeouts and size caps. */
import { createHash } from 'node:crypto';

export const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024;

export function hashKey(...parts) {
  return createHash('sha256').update(parts.join('\u0000'), 'utf8').digest('hex').slice(0, 24);
}

export class HttpError extends Error {
  constructor(status, url, body = '') {
    super(`HTTP ${status}: ${shortUrl(url)}`);
    this.status = status;
    this.body = body;
  }
}

function shortUrl(url) {
  try { const parsed = new URL(url); return `${parsed.host}${parsed.pathname}`.slice(0, 120); } catch { return String(url).slice(0, 120); }
}

export async function fetchText(url, { timeoutMs = 20_000, headers = {}, method = 'GET', body, signal, maxBytes = MAX_BYTES } = {}) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    method,
    body,
    redirect: 'follow',
    headers: { 'user-agent': BROWSER_UA, 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8', ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }).catch((error) => { throw networkError(error, url, signal, timeout); });
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error(`响应超过 ${Math.round(maxBytes / 1048576)} MB：${shortUrl(url)}`);
  const charset = /charset=([\w-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1];
  let text;
  try { text = new TextDecoder(charset ?? 'utf-8', { fatal: false }).decode(buffer); } catch { text = new TextDecoder('utf-8').decode(buffer); }
  if (!response.ok) throw new HttpError(response.status, url, text.slice(0, 2000));
  return text;
}

/** Node's bare `fetch failed` says nothing; name the host and the low-level cause instead. */
function networkError(error, url, signal, timeout) {
  if (signal?.aborted) return error;
  let host = String(url);
  try { host = new URL(url).host; } catch { /* keep raw */ }
  if (timeout.aborted) return Object.assign(new Error(`连接 ${host} 超时`), { cause: error, code: 'ETIMEDOUT' });
  const code = error?.cause?.code ?? error?.code;
  const reason = code === 'ENOTFOUND' ? '找不到这个域名' : code === 'ECONNRESET' ? '连接被重置' : code === 'ECONNREFUSED' ? '连接被拒绝' : /ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(code ?? '') ? '连接超时' : (code ?? error?.message ?? '网络错误');
  return Object.assign(new Error(`连不上 ${host}（${reason}）`), { cause: error, code });
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, { ...options, headers: { accept: 'application/json', ...(options.headers ?? {}) } });
  try { return JSON.parse(text); } catch { throw new Error(`返回内容不是 JSON：${shortUrl(url)}`); }
}

/** Extract Next.js page data from an HTML document. */
export function nextData(html) {
  const match = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) return undefined;
  try { return JSON.parse(match[1]); } catch { return undefined; }
}

/** Run `worker` over items with bounded concurrency; never rejects. */
export async function forEachLimited(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      try { await worker(current); } catch { /* worker reports its own errors */ }
    }
  });
  await Promise.all(runners);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
