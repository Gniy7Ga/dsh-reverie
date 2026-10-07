/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Transcript helpers: subtitle formats (WebVTT, SRT, YouTube srv3, podcast
 * JSON) become timed cues, then readable paragraphs.
 */
import { decodeHtmlEntities } from '../shared/sanitize.js';

/** @typedef {{start: number, text: string, speaker?: string}} Cue */

function clockToSeconds(value) {
  const match = /(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?/.exec(value);
  if (!match) return 0;
  return (Number(match[1] ?? 0) * 3600) + (Number(match[2]) * 60) + Number(match[3]) + Number(`0.${match[4] ?? 0}`);
}

function cleanCueText(text) {
  return decodeHtmlEntities(String(text).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** WebVTT or SRT → cues. */
export function parseSubtitles(text) {
  const cues = [];
  const blocks = String(text).replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;
    const start = clockToSeconds(lines[timingIndex].split('-->')[0]);
    let body = lines.slice(timingIndex + 1).join(' ');
    let speaker;
    const voice = /^<v\s+([^>]+)>/.exec(body);
    if (voice) speaker = voice[1].trim();
    body = cleanCueText(body);
    if (body) cues.push({ start, text: body, ...(speaker ? { speaker } : {}) });
  }
  return dedupeRolling(cues);
}

/** YouTube timedtext format 3 (srv3) → cues. */
export function parseSrv3(xml) {
  const cues = [];
  const pattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const start = Number(/\bt="(\d+)"/.exec(match[1])?.[1] ?? 0) / 1000;
    const text = cleanCueText(match[2]);
    if (text) cues.push({ start, text });
  }
  if (cues.length) return cues;
  // Legacy format 1: <text start="1.2" dur="3">...</text>
  const legacy = /<text\b[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = legacy.exec(xml)) !== null) {
    const text = cleanCueText(decodeHtmlEntities(match[2]));
    if (text) cues.push({ start: Number(match[1]), text });
  }
  return cues;
}

/** Podcasting 2.0 JSON transcript → cues. */
export function parseJsonTranscript(json) {
  const segments = Array.isArray(json?.segments) ? json.segments : [];
  return segments
    .map((segment) => ({ start: Number(segment.startTime) || 0, text: cleanCueText(segment.body ?? ''), ...(segment.speaker ? { speaker: String(segment.speaker) } : {}) }))
    .filter((cue) => cue.text);
}

/** Auto-captions often repeat the previous line; drop exact repeats. */
function dedupeRolling(cues) {
  const out = [];
  for (const cue of cues) {
    const last = out[out.length - 1];
    if (last && last.text === cue.text) continue;
    out.push(cue);
  }
  return out;
}

const SENTENCE_END = /[.!?。！？…"”]$/;

/**
 * Group cues into paragraphs of a comfortable reading size.
 * @param {Cue[]} cues
 * @returns {{start: number, text: string, speaker?: string}[]}
 */
export function cuesToParagraphs(cues, { target = 420, hardLimit = 900 } = {}) {
  const paragraphs = [];
  let current;
  const flush = () => { if (current?.text.trim()) paragraphs.push({ ...current, text: current.text.trim() }); current = undefined; };
  for (const cue of cues) {
    if (current && cue.speaker && cue.speaker !== current.speaker) flush();
    if (!current) current = { start: cue.start, text: '', ...(cue.speaker ? { speaker: cue.speaker } : {}) };
    const joiner = current.text && !/[\u4e00-\u9fff]$/.test(current.text) ? ' ' : '';
    current.text += joiner + cue.text;
    const length = current.text.length;
    if ((length >= target && SENTENCE_END.test(cue.text)) || length >= hardLimit) flush();
  }
  flush();
  return paragraphs;
}

export function paragraphsToText(paragraphs) {
  return paragraphs.map((paragraph) => `${paragraph.speaker ? `${paragraph.speaker}：` : ''}${paragraph.text}`).join('\n\n');
}
