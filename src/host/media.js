/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Audio / video links → transcript paragraphs.
 *   1. resolve metadata (yt-dlp -J, the 小宇宙 episode page, or Spotify → public RSS audio)
 *   2. YouTube human-made captions are used directly when present
 *   3. otherwise download audio (yt-dlp / ffmpeg) and run the local Whisper worker
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { sanitizeHtml } from '../shared/sanitize.js';
import { textToHtml } from '../shared/text.js';
import { fetchText, nextData } from './net.js';
import { toolchainEnv } from './toolchain.js';
import { cuesToParagraphs } from './transcript.js';
import { fetchVideoTranscript, videoIdOf } from './sources/youtube.js';
import { classifySocial } from './social.js';
import { classifySpotify, spotifyEpisode } from './sources/spotify.js';

const MEDIA_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus|mp4|m4v|mov|webm|mkv)(?:$|\?)/i;
const VIDEO_HOSTS = /(^|\.)(vimeo\.com|tiktok\.com|douyin\.com|ixigua\.com|twitch\.tv|dailymotion\.com|ted\.com|soundcloud\.com|music\.163\.com|ximalaya\.com)$/i;

/** Decide what a link is. Returns { type: 'media', platform, … } or { type: 'web', platform? }. */
export function classifyLink(raw) {
  let url;
  try { url = new URL(raw); } catch { return { type: 'invalid' }; }
  if (!/^https?:$/.test(url.protocol)) return { type: 'invalid' };
  const host = url.hostname.replace(/^(www|m)\./, '').toLowerCase();
  const videoId = videoIdOf(url.href);
  if (videoId) return { type: 'media', platform: 'youtube', videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  if (host === 'bilibili.com' || host === 'b23.tv') {
    const bvid = /\/video\/(BV[0-9A-Za-z]{10})/.exec(url.pathname)?.[1];
    return { type: 'media', platform: 'bilibili', bvid, url: url.href };
  }
  if (host === 'xiaoyuzhoufm.com') {
    const eid = /^\/episode\/([0-9a-f]{24})/.exec(url.pathname)?.[1];
    if (eid) return { type: 'media', platform: 'xiaoyuzhou', eid, url: `https://www.xiaoyuzhoufm.com/episode/${eid}` };
    return { type: 'error', message: '这是小宇宙节目主页，请粘贴某一期（单集）的链接' };
  }
  const spotify = classifySpotify(url, host);
  if (spotify) return spotify;
  const social = classifySocial(url);
  if (social) return social;
  if (host === 'podcasts.apple.com' && url.searchParams.get('i')) return { type: 'media', platform: 'apple', url: url.href };
  if (MEDIA_EXT.test(url.pathname)) return { type: 'media', platform: 'file', url: url.href };
  if (VIDEO_HOSTS.test(host)) return { type: 'media', platform: 'other', url: url.href };
  return { type: 'web', url: url.href };
}

/** Spawn a process, stream its stdout/stderr lines, resolve with collected stdout. */
export function run(command, args, { env, signal, onLine, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: env ?? toolchainEnv(), cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let pending = '';
    const abort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', abort, { once: true });
    const feed = (chunk, isErr) => {
      const text = chunk.toString('utf8');
      if (isErr) stderr = (stderr + text).slice(-8000); else stdout += text;
      pending += text;
      const lines = pending.split(/\r|\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) onLine?.(line, isErr);
    };
    child.stdout.on('data', (chunk) => feed(chunk, false));
    child.stderr.on('data', (chunk) => feed(chunk, true));
    child.on('error', (error) => { signal?.removeEventListener('abort', abort); reject(error); });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(new Error('已取消'));
      if (code === 0) return resolve(stdout);
      const last = stderr.trim().split('\n').filter((line) => /error|错误|ERROR/i.test(line)).pop() ?? stderr.trim().split('\n').pop() ?? '';
      reject(new Error(`${command.split('/').pop()} 失败（${code}）：${last.slice(0, 400)}`));
    });
  });
}

/** Metadata via yt-dlp -J. */
async function probe(chain, url, signal) {
  if (!chain.ytDlp) throw new Error('没有找到 yt-dlp，无法解析这个链接');
  const out = await run(chain.ytDlp, ['-J', '--no-playlist', '--skip-download', '--no-warnings', url], { signal });
  const info = JSON.parse(out);
  const upload = /^(\d{4})(\d{2})(\d{2})$/.exec(info.upload_date ?? '');
  return {
    title: info.title,
    source: info.channel ?? info.uploader ?? info.extractor_key,
    image: info.thumbnail,
    duration: info.duration,
    description: info.description,
    publishedAt: upload ? `${upload[1]}-${upload[2]}-${upload[3]}T00:00:00Z` : undefined,
    language: info.language,
    webpageUrl: info.webpage_url ?? url,
  };
}

async function xiaoyuzhouEpisode(url) {
  const html = await fetchText(url);
  const episode = nextData(html)?.props?.pageProps?.episode;
  const audio = episode?.enclosure?.url ?? episode?.media?.source?.url ?? /<meta property="og:audio(?::secure_url)?" content="([^"]+)"/.exec(html)?.[1];
  if (!audio) throw new Error('没能从小宇宙页面找到音频（可能是付费或私密节目）');
  const notes = episode?.shownotes || episode?.description || '';
  return {
    title: episode?.title ?? /<meta property="og:title" content="([^"]+)"/.exec(html)?.[1],
    source: episode?.podcast?.title,
    image: episode?.image?.picUrl ?? episode?.podcast?.image?.picUrl,
    duration: Number(episode?.duration) || undefined,
    descriptionHtml: /<[a-z][\s\S]*>/i.test(notes) ? sanitizeHtml(notes) : textToHtml(notes),
    publishedAt: episode?.pubDate,
    audioUrl: audio,
  };
}

/** Resolve metadata for any media link. */
export async function resolveMedia(chain, link, signal) {
  if (link.platform === 'xiaoyuzhou') return { ...await xiaoyuzhouEpisode(link.url), playback: { kind: 'audio' } };
  if (link.platform === 'spotify') return { ...await spotifyEpisode(link, signal), playback: { kind: 'audio' } };
  if (link.platform === 'file') {
    const name = decodeURIComponent(new URL(link.url).pathname.split('/').pop() || '音频');
    const video = /\.(mp4|m4v|mov|webm|mkv)(?:$|\?)/i.test(link.url);
    return { title: name, source: new URL(link.url).hostname, audioUrl: link.url, playback: { kind: video ? 'video-file' : 'audio' } };
  }
  const meta = await probe(chain, link.url, signal);
  const playback = link.platform === 'youtube' ? { kind: 'youtube', videoId: link.videoId }
    : link.platform === 'bilibili' && link.bvid ? { kind: 'bilibili', bvid: link.bvid } : { kind: 'link' };
  return { ...meta, descriptionHtml: meta.description ? textToHtml(meta.description) : undefined, playback };
}

/** YouTube captions: human captions are good enough to skip ASR. */
export async function youtubeCaptions(videoId) {
  try {
    const result = await fetchVideoTranscript(videoId);
    return result.transcript;
  } catch { return undefined; }
}

/** Download audio as 16 kHz mono m4a into `dir`; returns the file path. */
export async function downloadAudio(chain, link, meta, dir, { signal, onProgress } = {}) {
  await mkdir(dir, { recursive: true });
  const target = join(dir, 'audio.m4a');
  if (meta.audioUrl) {
    if (!chain.ffmpeg) throw new Error('没有找到 ffmpeg');
    const duration = Number(meta.duration) || 0;
    await run(chain.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-user_agent', 'Mozilla/5.0', ...(meta.referer ? ['-referer', meta.referer] : []), '-i', meta.audioUrl, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '64k', target], {
      signal,
      onLine: (line) => {
        const us = /^out_time_us=(\d+)/.exec(line)?.[1];
        if (us && duration) onProgress?.(Math.min(0.99, Number(us) / 1e6 / duration));
      },
    });
    return target;
  }
  if (!chain.ytDlp) throw new Error('没有找到 yt-dlp');
  const args = ['--no-playlist', '--newline', '--no-warnings', '-f', 'bestaudio/best', '-x', '--audio-format', 'm4a',
    '--postprocessor-args', 'ExtractAudio:-ac 1 -ar 16000', '-o', join(dir, 'audio.%(ext)s')];
  if (chain.ffmpeg) args.push('--ffmpeg-location', chain.ffmpeg);
  await run(chain.ytDlp, [...args, link.url], {
    signal,
    onLine: (line) => {
      const percent = /\[download\]\s+([\d.]+)%/.exec(line)?.[1];
      if (percent) onProgress?.(Math.min(0.99, Number(percent) / 100));
    },
  });
  const file = (await readdir(dir)).find((name) => name.startsWith('audio.') && !name.endsWith('.part'));
  if (!file) throw new Error('音频下载完成但没有找到文件');
  return join(dir, file);
}

/** Run the Whisper worker; returns { language, segments, engine }. */
export async function transcribe(chain, audioPath, dir, { signal, onProgress, language } = {}) {
  if (!chain.worker) throw new Error('插件缺少转录脚本 asr_worker.py');
  const output = join(dir, 'asr.json');
  const attempts = [];
  if (chain.mlx) attempts.push({ python: chain.mlx.python, opts: { engine: 'mlx', model: chain.mlx.model }, env: { XDG_CACHE_HOME: join(dir, 'cache'), NUMBA_CACHE_DIR: join(dir, 'cache', 'numba') } });
  if (chain.fasterWhisper) attempts.push({ python: chain.fasterWhisper.python, opts: { engine: 'faster-whisper', model: chain.fasterWhisper.model }, env: { HF_HOME: chain.fasterWhisper.hfHome } });
  if (!attempts.length) throw new Error('没有找到 Whisper 转录环境（MLX 或 faster-whisper）');
  let lastError;
  for (const attempt of attempts) {
    try {
      let workerError;
      await run(attempt.python, [chain.worker, JSON.stringify({ ...attempt.opts, audio: audioPath, output, language, chunk_seconds: 300 })], {
        env: toolchainEnv(attempt.env),
        signal,
        onLine: (line) => {
          const match = /^(PROGRESS|ERROR|DONE) (.*)$/.exec(line);
          if (!match) return;
          const payload = JSON.parse(match[2]);
          if (match[1] === 'PROGRESS' && payload.total) onProgress?.(payload.done / payload.total, attempt.opts.engine);
          if (match[1] === 'ERROR') workerError = payload.message;
        },
      }).catch((error) => { throw new Error(workerError ?? error.message); });
      const { readFile } = await import('node:fs/promises');
      return JSON.parse(await readFile(output, 'utf8'));
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export function segmentsToParagraphs(segments, language) {
  const zh = String(language ?? '').startsWith('zh');
  return cuesToParagraphs(segments.map((segment) => ({ start: segment.start, text: segment.text })), zh ? { target: 220, hardLimit: 500 } : undefined);
}

export async function cleanup(dir) {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
