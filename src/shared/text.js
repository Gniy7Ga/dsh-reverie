/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/** Small text helpers shared by host and client. */
import { decodeHtmlEntities, htmlToText } from './sanitize.js';

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sanitized HTML → readable plain text with entities decoded. */
export function plainText(html, maxLength = 200_000) {
  return decodeHtmlEntities(htmlToText(String(html ?? ''), maxLength));
}

/** One-line excerpt for list rows. */
export function excerpt(text, limit = 160) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat;
}

/** Plain text → minimal HTML paragraphs with clickable URLs. */
export function textToHtml(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${linkify(escapeHtml(block)).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function linkify(escaped) {
  return escaped.replace(/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g, (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
}

/** Seconds → h:mm:ss / m:ss. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "01:02:03" / "62:03" / "3723" → seconds. */
export function parseDuration(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = String(value).trim().split(':').map(Number);
  if (parts.some((part) => Number.isNaN(part))) return undefined;
  return parts.reduce((sum, part) => sum * 60 + part, 0);
}

/** Rough check whether a text is mostly Chinese (skip translation then). */
export function isMostlyChinese(text) {
  const sample = String(text ?? '').slice(0, 4000);
  const han = (sample.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  return han > 0 && han * 2 >= latin;
}
