/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Spotify podcast episodes.
 *
 * Spotify serves episode audio encrypted (MP4 CBCS), so it cannot be downloaded
 * and transcribed directly. Most podcasts are also published through a public
 * RSS feed, so we:
 *   1. read the episode metadata from the public embed page (title, show, date, duration);
 *   2. use the passthrough (original RSS) audio URL when Spotify exposes one;
 *   3. otherwise look the same episode up in the Apple Podcasts directory
 *      (episode search, then the show's RSS feed) and use that public audio file.
 * Spotify-exclusive episodes have no public copy and fail with a clear message.
 */
import { sanitizeHtml } from '../../shared/sanitize.js';
import { textToHtml } from '../../shared/text.js';
import { childrenOf, findAll, attrOf, parseXml, textOf } from '../../shared/xml.js';
import { fetchJson, fetchResponse, fetchText, nextData, sleep } from '../net.js';

/** `open.spotify.com/(intl-xx/)episode/<id>` → id. */
export function spotifyEpisodeId(url) {
  return /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?episode\/([0-9A-Za-z]{22})(?:\/|$)/.exec(url.pathname)?.[1];
}

/** Classify a Spotify URL; undefined when it is not one. */
export function classifySpotify(url, host) {
  if (host !== 'open.spotify.com' && host !== 'spotify.link' && host !== 'spotify.app.link') return undefined;
  if (host !== 'open.spotify.com') return { type: 'media', platform: 'spotify', url: url.href };
  const id = spotifyEpisodeId(url);
  if (id) return { type: 'media', platform: 'spotify', episodeId: id, url: `https://open.spotify.com/episode/${id}` };
  if (/^\/(?:intl-[a-z-]+\/)?show\//.test(url.pathname)) return { type: 'error', message: '这是 Spotify 节目主页，请粘贴某一期（单集）的链接' };
  if (/^\/(?:intl-[a-z-]+\/)?(?:track|album|playlist|artist)\//.test(url.pathname)) return { type: 'error', message: '暂不支持 Spotify 音乐，只支持播客单集（open.spotify.com/episode/…）' };
  return { type: 'error', message: '只支持 Spotify 播客单集链接（open.spotify.com/episode/…）' };
}

function networkHint(error) {
  const code = error?.cause?.code ?? error?.code ?? '';
  return `连不上 Spotify（open.spotify.com${code ? `，${code}` : ''}，IPv6 和 IPv4 都试过了）。请检查网络或代理；也可以换成同一期在小宇宙 / Apple Podcasts / YouTube 的链接。`;
}

async function withRetry(task, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try { return await task(); } catch (error) {
      lastError = error;
      if (error?.status && error.status < 500 && error.status !== 429) break;
      if (i < attempts - 1) await sleep(600 * (i + 1));
    }
  }
  throw lastError;
}

/** Short links (spotify.link) redirect to open.spotify.com; follow them to get the episode id. */
async function resolveShortLink(url, signal) {
  const response = await fetchResponse(url, { signal, timeoutMs: 15_000, headers: { accept: 'text/html' } });
  const final = new URL(response.url);
  const id = final.hostname === 'open.spotify.com' ? spotifyEpisodeId(final) : undefined;
  if (id) return id;
  return /open\.spotify\.com\/episode\/([0-9A-Za-z]{22})/.exec(response.buffer.toString('utf8'))?.[1];
}

/** Episode metadata from the embed page (more reliable than the full web player page). */
export async function spotifyEpisodeMeta(link, signal) {
  let id = link.episodeId;
  if (!id) {
    id = await resolveShortLink(link.url, signal).catch((error) => { throw new Error(networkHint(error)); });
    if (!id) throw new Error('这个 Spotify 短链接没有指向播客单集');
  }
  let html;
  try {
    html = await withRetry(() => fetchText(`https://open.spotify.com/embed/episode/${id}`, { signal }));
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error?.status === 404) throw new Error('Spotify 上找不到这一期（链接可能失效了）');
    throw new Error(networkHint(error));
  }
  const data = nextData(html)?.props?.pageProps?.state?.data;
  const entity = data?.entity;
  if (!entity?.title && !entity?.name) throw new Error('没能读到这期 Spotify 节目的信息（页面结构可能变了）');
  const audio = data?.defaultAudioFileObject;
  const images = [...(entity.relatedEntityCoverArt ?? entity.visualIdentity?.image ?? [])].sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0));
  return {
    id,
    title: entity.title ?? entity.name,
    show: entity.subtitle,
    publishedAt: entity.releaseDate?.isoString,
    duration: entity.duration ? Math.round(entity.duration / 1000) : undefined,
    image: images[0]?.url,
    passthroughUrl: audio?.passthrough && audio.passthrough !== 'NONE' && /^https?:/.test(audio.passthroughUrl ?? '') ? audio.passthroughUrl : undefined,
    isAudiobook: entity.isAudiobook === true,
    isPlayable: entity.isPlayable !== false,
  };
}

/** Lower-case, width-folded, punctuation- and space-free form of a title for matching. */
export function normalizeTitle(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function sameShow(a, b) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x))));
}

/** Score how well a candidate { title, publishedAt, duration } matches the Spotify episode (0 = no match). */
export function matchScore(meta, candidate) {
  const want = normalizeTitle(meta.title);
  const got = normalizeTitle(candidate.title);
  if (!want || !got) return 0;
  let score = 0;
  if (want === got) score = 100;
  else if (Math.min(want.length, got.length) >= 8 && (want.includes(got) || got.includes(want))) score = 70;
  else return 0;
  const days = meta.publishedAt && candidate.publishedAt ? Math.abs(Date.parse(meta.publishedAt) - Date.parse(candidate.publishedAt)) / 86_400_000 : NaN;
  if (Number.isFinite(days)) score += days <= 2 ? 20 : days <= 10 ? 5 : -30;
  if (meta.duration && candidate.duration) {
    const ratio = Math.abs(meta.duration - candidate.duration) / meta.duration;
    score += ratio <= 0.05 ? 10 : ratio > 0.3 ? -20 : 0;
  }
  return score;
}

function pickBest(meta, candidates) {
  let best;
  for (const candidate of candidates) {
    if (!candidate.audioUrl) continue;
    const score = matchScore(meta, candidate);
    if (score >= 70 && (!best || score > best.score)) best = { ...candidate, score };
  }
  return best;
}

const STORES = ['US', 'CN'];

async function itunesSearch(params, signal) {
  const query = new URLSearchParams({ media: 'podcast', limit: '25', ...params });
  return (await fetchJson(`https://itunes.apple.com/search?${query}`, { signal, timeoutMs: 15_000 }))?.results ?? [];
}

/** Apple Podcasts episode search: one request, returns direct audio URLs. */
async function viaEpisodeSearch(meta, signal) {
  for (const country of STORES) {
    const results = await itunesSearch({ term: `${meta.show ?? ''} ${meta.title}`.trim().slice(0, 200), entity: 'podcastEpisode', country }, signal).catch(() => []);
    const best = pickBest(meta, results
      .filter((r) => !meta.show || sameShow(meta.show, r.collectionName))
      .map((r) => ({ title: r.trackName, publishedAt: r.releaseDate, duration: r.trackTimeMillis ? r.trackTimeMillis / 1000 : undefined, audioUrl: r.episodeUrl, description: r.description, feedUrl: r.feedUrl, show: r.collectionName })));
    if (best) return best;
  }
  return undefined;
}

function parseDuration(text) {
  const value = String(text ?? '').trim();
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** Episodes of an RSS feed as match candidates. */
export function feedEpisodes(xml) {
  const doc = parseXml(xml);
  return findAll(doc, 'item').map((item) => {
    const enclosure = childrenOf(item, 'enclosure')[0];
    const pub = textOf(childrenOf(item, 'pubDate')[0]).trim();
    return {
      title: textOf(childrenOf(item, 'title')[0]).trim(),
      publishedAt: pub && !Number.isNaN(Date.parse(pub)) ? new Date(pub).toISOString() : undefined,
      duration: parseDuration(textOf(childrenOf(item, 'duration')[0])),
      audioUrl: attrOf(enclosure, 'url'),
      description: textOf(childrenOf(item, 'description')[0]).trim() || textOf(childrenOf(item, 'summary')[0]).trim(),
    };
  });
}

/** Show search → RSS feed → episode. Slower, but covers episodes the episode search misses. */
async function viaFeed(meta, signal) {
  if (!meta.show) return undefined;
  const feeds = new Set();
  for (const country of STORES) {
    const shows = await itunesSearch({ term: meta.show.slice(0, 200), entity: 'podcast', country, limit: '10' }, signal).catch(() => []);
    for (const show of shows) if (show.feedUrl && sameShow(meta.show, show.collectionName)) feeds.add(show.feedUrl);
    if (feeds.size) break;
  }
  for (const feed of [...feeds].slice(0, 3)) {
    try {
      const xml = await fetchText(feed, { signal, timeoutMs: 30_000, maxBytes: 40 * 1024 * 1024 });
      const best = pickBest(meta, feedEpisodes(xml));
      if (best) return { ...best, feedUrl: feed };
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  return undefined;
}

/** Resolve a Spotify episode link to downloadable public audio + metadata. */
export async function spotifyEpisode(link, signal) {
  const meta = await spotifyEpisodeMeta(link, signal);
  if (meta.isAudiobook) throw new Error('这是 Spotify 有声书，有版权保护，没法转录');
  const found = meta.passthroughUrl ? { audioUrl: meta.passthroughUrl } : (await viaEpisodeSearch(meta, signal)) ?? (await viaFeed(meta, signal));
  if (signal?.aborted) throw new Error('已取消');
  if (!found?.audioUrl) {
    throw new Error(`Spotify 的音频是加密的，没法直接下载；也没在公开的播客目录里找到「${meta.title}」${meta.show ? `（${meta.show}）` : ''}，可能是 Spotify 独家节目。可以换成同一期在小宇宙 / Apple Podcasts / YouTube 的链接再试。`);
  }
  const notes = found.description ?? '';
  return {
    title: meta.title,
    source: meta.show ?? found.show,
    image: meta.image,
    duration: meta.duration ?? found.duration,
    publishedAt: meta.publishedAt ?? found.publishedAt,
    descriptionHtml: notes ? (/<[a-z][\s\S]*>/i.test(notes) ? sanitizeHtml(notes) : textToHtml(notes)) : undefined,
    audioUrl: found.audioUrl,
  };
}
