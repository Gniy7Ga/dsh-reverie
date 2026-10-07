/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * YouTube: channel link resolution (@handle, /channel/, /c/, video links),
 * the public per-channel Atom feed, and caption tracks for full transcripts.
 */
import { attrOf, childrenOf, find, findAll, parseXml, textOf } from '../../shared/xml.js';
import { excerpt, textToHtml } from '../../shared/text.js';
import { fetchJson, fetchText, hashKey } from '../net.js';
import { cuesToParagraphs, parseSrv3 } from '../transcript.js';

const CHANNEL_ID = /^UC[\w-]{22}$/;

export function feedUrlOf(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/** Extract an 11-character video id from a URL, or undefined. */
export function videoIdOf(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www|m)\./, '');
    let id;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1];
    }
    return /^[\w-]{11}$/.test(id ?? '') ? id : undefined;
  } catch { return undefined; }
}

/** Resolve a channel link, @handle, or video link to `{ channelId, name }`. */
export async function resolveChannel(input) {
  let raw = String(input ?? '').trim();
  if (!raw) throw new Error('请输入 YouTube 频道链接');
  if (CHANNEL_ID.test(raw)) return { channelId: raw };
  if (/^@[\w.-]+$/.test(raw)) raw = `https://www.youtube.com/${raw}`;
  let url;
  try { url = new URL(raw.startsWith('http') ? raw : `https://${raw}`); } catch { throw new Error('无法识别这个 YouTube 链接'); }
  const direct = /^\/channel\/(UC[\w-]{22})/.exec(url.pathname)?.[1];
  if (direct) return { channelId: direct };
  const feedId = url.searchParams.get('channel_id');
  if (feedId && CHANNEL_ID.test(feedId)) return { channelId: feedId };
  const html = await fetchText(url.href, { headers: { cookie: 'CONSENT=YES+1' } });
  const videoId = videoIdOf(url.href);
  const patterns = videoId
    ? [/"videoDetails":\{[^}]*?"channelId":"(UC[\w-]{22})"/, /"channelId":"(UC[\w-]{22})"/]
    : [/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/, /"externalId":"(UC[\w-]{22})"/, /"browseId":"(UC[\w-]{22})"/, /"channelId":"(UC[\w-]{22})"/];
  for (const pattern of patterns) {
    const match = pattern.exec(html)?.[1];
    if (match) {
      const name = /<meta property="og:title" content="([^"]+)"/.exec(html)?.[1];
      return { channelId: match, name: videoId ? undefined : name };
    }
  }
  throw new Error('没能从这个链接找到 YouTube 频道');
}

/** Fetch and parse a channel's Atom feed (latest ~15 videos). */
export async function fetchChannel(source) {
  const xml = await fetchText(feedUrlOf(source.channelId), { timeoutMs: 20_000 });
  return parseChannelFeed(xml, source.channelId);
}

export function parseChannelFeed(xml, channelId) {
  const root = parseXml(xml);
  const feed = find(root, 'feed');
  if (!feed) throw new Error('YouTube 频道 feed 无效');
  const author = find(feed, 'author');
  const meta = { name: textOf(childrenOf(feed, 'title')[0]).trim() || textOf(find(author, 'name')).trim(), author: textOf(find(author, 'name')).trim() || undefined };
  const entries = [];
  for (const entry of findAll(feed, 'entry')) {
    const videoId = textOf(find(entry, 'videoId')).trim();
    if (!videoId) continue;
    const group = find(entry, 'group');
    const description = textOf(find(group, 'description')).trim();
    const link = childrenOf(entry, 'link').map((node) => attrOf(node, 'href')).find(Boolean) ?? `https://www.youtube.com/watch?v=${videoId}`;
    entries.push({
      key: `yt:${videoId}`,
      kind: 'youtube',
      videoId,
      title: textOf(childrenOf(entry, 'title')[0]).trim() || textOf(find(group, 'title')).trim(),
      publishedAt: textOf(childrenOf(entry, 'published')[0]).trim() || undefined,
      url: link,
      isShort: link.includes('/shorts/'),
      image: attrOf(find(group, 'thumbnail'), 'url') ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      summary: excerpt(description, 200),
      html: textToHtml(description),
      views: Number(attrOf(find(entry, 'statistics'), 'views')) || undefined,
    });
  }
  return { meta: { ...meta, channelId }, entries };
}

// The Android client's player response exposes caption track URLs without a
// signed-in session or PO token for public videos.
const PLAYER_CLIENTS = [
  { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip' },
  { clientName: 'WEB', clientVersion: '2.20250101.00.00' },
];

async function captionTracks(videoId) {
  let lastError;
  for (const client of PLAYER_CLIENTS) {
    try {
      const { userAgent, ...context } = client;
      const data = await fetchJson('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(userAgent ? { 'user-agent': userAgent } : {}) },
        body: JSON.stringify({ context: { client: { ...context, hl: 'zh-CN' } }, videoId }),
      });
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      const details = data?.videoDetails;
      if (tracks.length || details) return { tracks, details };
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
  return { tracks: [], details: undefined };
}

/** Prefer human captions in Chinese, then English, then the video's original language. */
function chooseTrack(tracks) {
  const score = (track) => {
    const lang = String(track.languageCode ?? '').toLowerCase();
    let value = track.kind === 'asr' ? 0 : 10;
    if (lang.startsWith('zh')) value += 5;
    else if (lang.startsWith('en')) value += 3;
    if (track.kind === 'asr') value += 2; // auto captions are in the spoken language
    return value;
  };
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

/** Download the best caption track as paragraphs, plus the full description. */
export async function fetchVideoTranscript(videoId) {
  const { tracks, details } = await captionTracks(videoId);
  const description = details?.shortDescription;
  const track = chooseTrack(tracks);
  if (!track) return { description, transcript: undefined };
  const url = new URL(track.baseUrl);
  url.searchParams.set('fmt', 'srv3');
  const xml = await fetchText(url.href, { timeoutMs: 30_000 });
  const paragraphs = cuesToParagraphs(parseSrv3(xml));
  return {
    description,
    transcript: paragraphs.length
      ? { paragraphs, source: track.kind === 'asr' ? 'youtube-auto' : 'youtube', language: track.languageCode, label: track.name?.simpleText ?? track.name?.runs?.[0]?.text }
      : undefined,
  };
}

export function sourceIdFor(channelId) {
  return `yt:${hashKey(channelId)}`;
}
