/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Local media toolchain: yt-dlp (download), ffmpeg (decode), and a Whisper
 * engine (MLX on Apple GPU preferred, faster-whisper on CPU as fallback).
 * Paths are auto-detected from common install locations and from an
 * AI-Video-Transcriber setup under ~/Documents/Codex; the plugin row's
 * `config.toolchain` (ytDlp, ffmpeg, mlxPython + mlxModel,
 * fasterWhisperPython + fasterWhisperHfHome) overrides detection.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', join(homedir(), '.local/bin'), '/usr/bin'];

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path));
}

function safeList(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

/** Codex workspaces that contain an AI-Video-Transcriber checkout. */
function transcriberWorkspaces() {
  const root = join(homedir(), 'Documents', 'Codex');
  const out = [];
  for (const day of safeList(root)) {
    for (const name of safeList(join(root, day))) {
      const ws = join(root, day, name);
      if (existsSync(join(ws, 'AI-Video-Transcriber'))) out.push(ws);
    }
  }
  return out.sort().reverse();
}

function mlxModelIn(ws) {
  const pointer = join(ws, 'work', 'mlx-model-path.txt');
  try {
    const path = readFileSync(pointer, 'utf8').trim();
    if (existsSync(join(path, 'weights.npz')) || existsSync(join(path, 'weights.safetensors'))) return path;
  } catch { /* fall through */ }
  const snapshots = join(ws, 'work', 'mlx-model-cache', 'snapshots');
  for (const snap of safeList(snapshots)) {
    const path = join(snapshots, snap);
    if (existsSync(join(path, 'weights.npz')) || existsSync(join(path, 'weights.safetensors'))) return path;
  }
  return undefined;
}

let cached;

/** Detect the toolchain once (re-detect with force). */
export function detectToolchain(overrides = {}, force = false) {
  if (cached && !force) return cached;
  const workspaces = transcriberWorkspaces();
  const repos = workspaces.map((ws) => join(ws, 'AI-Video-Transcriber'));
  const ytDlp = firstExisting([overrides.ytDlp, ...repos.map((repo) => join(repo, 'venv/bin/yt-dlp')), ...BIN_DIRS.map((dir) => join(dir, 'yt-dlp'))]);
  const ffmpeg = firstExisting([overrides.ffmpeg, ...BIN_DIRS.map((dir) => join(dir, 'ffmpeg'))]);
  const deno = firstExisting(BIN_DIRS.map((dir) => join(dir, 'deno')));
  let mlx;
  for (const ws of workspaces) {
    const python = join(ws, 'work', 'mlx-runtime', 'bin', 'python');
    const model = mlxModelIn(ws);
    if (existsSync(python) && model) { mlx = { python, model, cacheDir: join(ws, 'work') }; break; }
  }
  if (overrides.mlxPython && overrides.mlxModel) mlx = { python: overrides.mlxPython, model: overrides.mlxModel, cacheDir: dirname(overrides.mlxModel) };
  let fasterWhisper;
  if (overrides.fasterWhisperPython && existsSync(overrides.fasterWhisperPython)) {
    fasterWhisper = { python: overrides.fasterWhisperPython, hfHome: overrides.fasterWhisperHfHome, model: overrides.fasterWhisperModel || 'large-v3' };
  }
  for (const repo of fasterWhisper ? [] : repos) {
    const python = join(repo, 'venv/bin/python');
    if (existsSync(python) && existsSync(join(repo, '.cache/huggingface/hub/models--Systran--faster-whisper-large-v3'))) {
      fasterWhisper = { python, hfHome: join(repo, '.cache/huggingface'), model: 'large-v3' };
      break;
    }
  }
  const worker = join(dirname(fileURLToPath(import.meta.url)), 'asr_worker.py');
  cached = { ytDlp, ffmpeg, deno, mlx, fasterWhisper, worker: existsSync(worker) ? worker : undefined, detectedAt: Date.now() };
  return cached;
}

export function toolchainEnv(extra = {}) {
  const path = [...new Set([...BIN_DIRS, ...(process.env.PATH ?? '').split(':')])].filter(Boolean).join(':');
  return { ...process.env, PATH: path, PYTHONUNBUFFERED: '1', ...extra };
}

/** Human-readable summary for the UI. */
export function describeToolchain(chain) {
  return {
    download: chain.ytDlp ? { ok: true, path: chain.ytDlp } : { ok: false, hint: '没有找到 yt-dlp' },
    ffmpeg: chain.ffmpeg ? { ok: true, path: chain.ffmpeg } : { ok: false, hint: '没有找到 ffmpeg' },
    asr: chain.mlx
      ? { ok: true, engine: 'MLX Whisper large-v3（GPU）', path: chain.mlx.python }
      : chain.fasterWhisper ? { ok: true, engine: 'faster-whisper large-v3（CPU，较慢）', path: chain.fasterWhisper.python } : { ok: false, hint: '没有找到 Whisper 转录环境' },
  };
}

export function fileSize(path) {
  try { return statSync(path).size; } catch { return 0; }
}
