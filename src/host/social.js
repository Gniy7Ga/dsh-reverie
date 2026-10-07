/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Social / platform posts that a generic article extractor cannot read well:
 *   推特 (X / Twitter)  → vxtwitter JSON API, falling back to the official syndication endpoint
 *   公众号 (WeChat MP)  → server-rendered #js_content, walked with section-aware block rules
 *   小红书 (Xiaohongshu) → window.__INITIAL_STATE__ embedded in the note page
 * Each extractor returns { title, siteName, byline, excerpt, image, publishedAt, blocks, video? }.
 * `video` ({ url, duration }) is set for video posts so the caller can transcribe them.
 */
import { parseHTML } from 'linkedom';
import { fetchJson, fetchText, BROWSER_UA } from './net.js';
import { htmlToBlocks } from './web.js';

export const SOCIAL_PLATFORMS = ['xiaohongshu', 'wechat', 'twitter'];

const TWITTER_HOSTS = /^(twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com|fixvx\.com|twittpr\.com)$/i;

/** Recognise a platform link. Returns a `{ type: 'web', platform, … }` link, an error, or undefined. */
export function classifySocial(url) {
  const host = url.hostname.replace(/^(www|m)\./, '').toLowerCase();
  if (TWITTER_HOSTS.test(host)) {
    const match = /^\/(?:([A-Za-z0-9_]{1,30})|i(?:\/web)?)\/status(?:es)?\/(\d{1,25})/.exec(url.pathname);
    if (match) return { type: 'web', platform: 'twitter', tweetId: match[2], user: match[1], url: `https://x.com/${match[1] ?? 'i'}/status/${match[2]}` };
    if (/^\/i\/article\//.test(url.pathname)) return { type: 'error', message: '推特长文请粘贴它所在的那条推文链接（x.com/用户名/status/…）' };
    return { type: 'error', message: '请粘贴某一条推文的链接（x.com/用户名/status/…）' };
  }
  if (host === 'mp.weixin.qq.com') {
    if (!/^\/s/.test(url.pathname)) return { type: 'error', message: '请粘贴公众号某一篇文章的链接（mp.weixin.qq.com/s/…）' };
    return { type: 'web', platform: 'wechat', url: wechatUrl(url) };
  }
  if (host === 'xhslink.com') return { type: 'web', platform: 'xiaohongshu', url: url.href };
  if (host === 'xiaohongshu.com') {
    const id = xhsNoteId(url);
    if (!id) return { type: 'error', message: '请粘贴小红书某一篇笔记的分享链接' };
    return { type: 'web', platform: 'xiaohongshu', noteId: id, url: url.href };
  }
  return undefined;
}

/** Drop WeChat tracking params; keep the ones that identify the article. */
function wechatUrl(url) {
  if (url.pathname !== '/s') return `https://mp.weixin.qq.com${url.pathname}`;
  const keep = new URLSearchParams();
  for (const key of ['__biz', 'mid', 'idx', 'sn']) if (url.searchParams.get(key)) keep.set(key, url.searchParams.get(key));
  return `https://mp.weixin.qq.com/s?${keep}`;
}

function xhsNoteId(url) {
  return /^\/(?:explore|discovery\/item|user\/profile\/[0-9a-f]+)\/([0-9a-f]{24})/.exec(url.pathname)?.[1];
}

export function extractSocial(link, signal) {
  if (link.platform === 'twitter') return extractTweet(link, signal);
  if (link.platform === 'wechat') return extractWechat(link.url, signal);
  if (link.platform === 'xiaohongshu') return extractXhs(link.url, signal);
  throw new Error(`不支持的平台：${link.platform}`);
}

// ---------------------------------------------------------------------------
// shared helpers

const clean = (text) => String(text ?? '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').trim();

/** Plain post text → paragraph blocks (one per non-empty line). */
export function textBlocks(text) {
  return String(text ?? '').split(/\n+/).map(clean).filter(Boolean).map((line) => ({ type: 'p', text: line }));
}

function headline(text, max = 60) {
  const first = String(text ?? '').split('\n').map(clean).find(Boolean) ?? '';
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

function decodeEntities(text) {
  return String(text ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// 推特

/**
 * The official embed endpoint wants a token derived from the id. The formula
 * follows vercel/react-tweet (MIT, Copyright (c) 2023 Luis Alvarez),
 * https://github.com/vercel/react-tweet — see NOTICE.md.
 */
function syndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

const stripTco = (text) => String(text ?? '').replace(/\s*https:\/\/t\.co\/\w+\s*$/g, '').trim();

function tweetFromVx(data) {
  const media = (data.media_extended ?? []).map((m) => ({ type: m.type === 'image' ? 'image' : 'video', url: m.url, thumb: m.thumbnail_url, duration: m.duration_millis ? m.duration_millis / 1000 : undefined }));
  const article = data.article ? {
    title: data.article.title,
    image: data.article.image ?? data.article.cover_media?.media_info?.original_img_url,
    text: data.article.content?.blocks ? data.article.content.blocks.map((block) => block.text).join('\n') : data.article.preview_text,
  } : undefined;
  return {
    text: data.text, name: data.user_name, screen: data.user_screen_name, time: data.date_epoch ? data.date_epoch * 1000 : undefined,
    lang: data.lang, media, article,
    quote: data.qrt ? { name: data.qrt.user_name, screen: data.qrt.user_screen_name, text: data.qrt.text } : undefined,
  };
}

function tweetFromSyndication(data) {
  const media = (data.mediaDetails ?? []).map((m) => {
    if (m.type === 'photo') return { type: 'image', url: m.media_url_https };
    const variant = (m.video_info?.variants ?? []).filter((v) => v.content_type === 'video/mp4').sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    return { type: 'video', url: variant?.url, thumb: m.media_url_https, duration: m.video_info?.duration_millis ? m.video_info.duration_millis / 1000 : undefined };
  });
  return {
    text: data.note_tweet?.note_tweet_results?.result?.text ?? data.text, name: data.user?.name, screen: data.user?.screen_name,
    time: data.created_at ? Date.parse(data.created_at) : undefined, lang: data.lang, media,
    article: data.article ? { title: data.article.title, text: data.article.preview_text, image: data.article.cover_media?.media_info?.original_img_url } : undefined,
    quote: data.quoted_tweet ? { name: data.quoted_tweet.user?.name, screen: data.quoted_tweet.user?.screen_name, text: data.quoted_tweet.text } : undefined,
  };
}

/** Normalised tweet → reader page. Exported for tests. */
export function tweetToPage(tweet) {
  const text = stripTco(decodeEntities(tweet.text));
  const blocks = [];
  if (tweet.article?.title) blocks.push({ type: 'h', text: clean(tweet.article.title) });
  if (tweet.article?.image) blocks.push({ type: 'img', src: tweet.article.image, alt: '' });
  if (tweet.article?.text) blocks.push(...textBlocks(tweet.article.text));
  if (text && !(tweet.article && /^https:\/\/t\.co\/\w+$/.test(text))) blocks.push(...textBlocks(text));
  for (const m of tweet.media ?? []) {
    if (m.type === 'image' && m.url) blocks.push({ type: 'img', src: m.url, alt: '' });
    else if (m.thumb) blocks.push({ type: 'img', src: m.thumb, alt: '视频封面' });
  }
  if (tweet.quote?.text) blocks.push({ type: 'quote', text: `${tweet.quote.name ?? ''}${tweet.quote.screen ? ` @${tweet.quote.screen}` : ''}：${stripTco(decodeEntities(tweet.quote.text))}` });
  if (!blocks.some((block) => block.text)) throw new Error('这条推文没有文字内容');
  const video = (tweet.media ?? []).find((m) => m.type === 'video' && m.url);
  return {
    title: clean(tweet.article?.title) || headline(text) || `@${tweet.screen} 的推文`,
    siteName: tweet.name ? `${tweet.name}${tweet.screen ? ` @${tweet.screen}` : ''}` : '推特',
    byline: tweet.screen ? `@${tweet.screen}` : undefined,
    excerpt: undefined,
    image: tweet.article?.image ?? (tweet.media ?? []).map((m) => (m.type === 'image' ? m.url : m.thumb)).find(Boolean),
    publishedAt: tweet.time ? new Date(tweet.time).toISOString() : undefined,
    language: tweet.lang && tweet.lang !== 'und' && tweet.lang !== 'zxx' ? tweet.lang : undefined,
    blocks,
    video: video ? { url: video.url, duration: video.duration } : undefined,
  };
}

async function extractTweet(link, signal) {
  let tweet;
  const errors = [];
  try {
    const data = await fetchJson(`https://api.vxtwitter.com/${link.user ?? 'i'}/status/${link.tweetId}`, { signal, timeoutMs: 20_000 });
    if (data?.text !== undefined || data?.article) tweet = tweetFromVx(data);
    else errors.push(data?.error ?? 'vxtwitter 没有返回内容');
  } catch (error) { errors.push(error.message); }
  if (!tweet) {
    try {
      const data = await fetchJson(`https://cdn.syndication.twimg.com/tweet-result?id=${link.tweetId}&lang=zh&token=${syndicationToken(link.tweetId)}`, { signal, timeoutMs: 20_000 });
      if (data?.text !== undefined) tweet = tweetFromSyndication(data);
    } catch (error) { errors.push(error.message); }
  }
  if (!tweet) throw new Error(`没能读取这条推文（可能已删除、设为私密或需要登录）${errors.length ? `：${errors[0]}` : ''}`);
  return tweetToPage(tweet);
}

// ---------------------------------------------------------------------------
// 公众号

/** WeChat article HTML → reader page. Exported for tests. */
export function wechatToPage(html, url) {
  if (/环境异常|完成验证后即可继续访问/.test(html) && !/id="js_content"/.test(html)) throw new Error('公众号要求验证（访问太频繁），稍后再试');
  if (/该内容已被发布者删除|此内容因违规无法查看|该公众号已迁移/.test(html) && !/id="js_content"/.test(html)) throw new Error('这篇公众号文章已被删除或无法查看');
  const { document } = parseHTML(html);
  const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') ?? undefined;
  const jsVar = (name) => {
    const match = new RegExp(`var ${name}\\s*=\\s*(?:htmlDecode\\()?\\s*(["'])([\\s\\S]*?)\\1`).exec(html);
    return match ? clean(decodeEntities(match[2].replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))))) : undefined;
  };
  const content = document.querySelector('#js_content');
  let blocks = content ? htmlToBlocks(content.innerHTML, url, { loose: true }) : [];
  if (!blocks.some((block) => block.text)) {
    // 图片消息 / 小绿书: the text lives in a JS string, the pictures in og/cdn urls.
    const text = jsVar('content_noencode') ?? meta('og:description');
    blocks = [...textBlocks(text?.replace(/\\n/g, '\n'))];
    for (const src of new Set([...html.matchAll(/cdn_url\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))) blocks.push({ type: 'img', src, alt: '' });
  }
  const textLength = blocks.reduce((sum, block) => sum + (block.text?.length ?? 0), 0);
  if (textLength < 10) throw new Error('这篇公众号文章没抓到正文（可能需要在微信里打开）');
  const created = Number(/var create_time\s*=\s*["']?(\d{9,11})/.exec(html)?.[1] ?? /var ct\s*=\s*["'](\d{9,11})["']/.exec(html)?.[1]);
  return {
    title: jsVar('msg_title') || clean(document.querySelector('#activity-name')?.textContent) || clean(meta('og:title')) || '公众号文章',
    siteName: jsVar('nickname') || clean(document.querySelector('#js_name')?.textContent) || '公众号',
    byline: clean(meta('author')) || undefined,
    excerpt: clean(meta('og:description')) || undefined,
    image: jsVar('msg_cdn_url') || meta('og:image'),
    publishedAt: created ? new Date(created * 1000).toISOString() : undefined,
    blocks,
  };
}

async function extractWechat(url, signal) {
  const html = await fetchText(url, { signal, timeoutMs: 30_000, headers: { accept: 'text/html,application/xhtml+xml' } });
  return wechatToPage(html, url);
}

// ---------------------------------------------------------------------------
// 小红书

/** `window.__INITIAL_STATE__ = {...}` is JS (bare `undefined`), not JSON. */
export function parseInitialState(html) {
  const start = html.indexOf('window.__INITIAL_STATE__');
  if (start < 0) return undefined;
  const open = html.indexOf('{', start);
  const end = html.indexOf('</script>', open);
  if (open < 0 || end < 0) return undefined;
  const source = html.slice(open, end).trim().replace(/;\s*$/, '').replace(/([:\[,])\s*undefined(?=\s*[,}\]])/g, '$1null');
  try { return JSON.parse(source); } catch { return undefined; }
}

const httpsUrl = (src) => (src ? String(src).replace(/^http:\/\//, 'https://').replace(/^\/\//, 'https://') : undefined);

/** Note page HTML → reader page. Exported for tests. */
export function xhsToPage(html, noteId) {
  const state = parseInitialState(html);
  const map = state?.note?.noteDetailMap ?? {};
  const note = (noteId && map[noteId]?.note) || Object.values(map).map((entry) => entry?.note).find((n) => n?.noteId || n?.title || n?.desc);
  if (!note || (!note.title && !note.desc && !note.imageList?.length)) {
    throw new Error('小红书没有返回笔记内容。请从 App 里点「分享 → 复制链接」，粘贴带 xsec_token 的新链接（旧链接会过期）');
  }
  const desc = clean(String(note.desc ?? '').replace(/#([^#\[\]\n]+?)\[话题\]#/g, '#$1 ').replace(/\[[^\]\s]{1,8}R\]/g, '').replace(/[ \t]{2,}/g, ' '));
  const blocks = [];
  if (note.title) blocks.push({ type: 'h', text: clean(note.title) });
  blocks.push(...textBlocks(desc));
  const images = (note.imageList ?? []).map((img) => httpsUrl(img.urlDefault ?? img.url ?? img.infoList?.find((info) => info.imageScene === 'WB_DFT')?.url ?? img.infoList?.[0]?.url)).filter(Boolean);
  for (const src of images) blocks.push({ type: 'img', src, alt: '' });
  const streams = Object.values(note.video?.media?.stream ?? {}).flat().filter(Boolean);
  const videoUrl = httpsUrl(streams.map((s) => s.masterUrl ?? s.backupUrls?.[0]).find(Boolean)) ?? (note.video?.consumer?.originVideoKey ? `https://sns-video-bd.xhscdn.com/${note.video.consumer.originVideoKey}` : undefined);
  const duration = Number(note.video?.capa?.duration) || (Number(streams[0]?.duration) ? Number(streams[0].duration) / 1000 : undefined);
  return {
    title: clean(note.title) || headline(desc) || '小红书笔记',
    siteName: clean(note.user?.nickname ?? note.user?.nickName) || '小红书',
    byline: undefined,
    excerpt: undefined,
    image: images[0],
    publishedAt: Number(note.time) ? new Date(Number(note.time)).toISOString() : undefined,
    blocks,
    video: note.type === 'video' && videoUrl ? { url: videoUrl, duration } : undefined,
  };
}

async function extractXhs(url, signal) {
  const response = await fetch(url, { redirect: 'follow', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000), headers: { 'user-agent': BROWSER_UA, 'accept-language': 'zh-CN,zh;q=0.9', accept: 'text/html,application/xhtml+xml' } });
  const html = await response.text();
  const finalUrl = new URL(response.url || url);
  if (/\/(404|login)/.test(finalUrl.pathname)) {
    const reason = finalUrl.searchParams.get('error_msg');
    throw new Error(`小红书打不开这篇笔记${reason ? `（${reason}）` : ''}。请从 App 里点「分享 → 复制链接」，粘贴新的分享链接（旧链接的 xsec_token 会过期）`);
  }
  return xhsToPage(html, xhsNoteId(finalUrl));
}
