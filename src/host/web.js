/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Web page ingestion: fetch the HTML, extract the main article with Mozilla
 * Readability (on a linkedom DOM), and turn it into translatable blocks.
 */
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { fetchText } from './net.js';

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'FIGCAPTION', 'TD', 'DT', 'DD']);

function absolute(src, base) {
  try { return new URL(src, base).href; } catch { return undefined; }
}

function clean(text) {
  return String(text ?? '').replace(/[\u00a0]/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME', 'MPVOICE', 'MPPROFILE']);
const LOOSE_CONTAINERS = new Set(['SECTION', 'DIV', 'ARTICLE', 'FIGURE', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TR', 'DL', 'HEADER', 'MAIN', 'CENTER']);
const BLOCKISH = 'p,li,pre,h1,h2,h3,h4,h5,h6,blockquote,section,div,figure,table,ul,ol,img';

/**
 * Walk the article DOM into ordered blocks: headings, paragraphs, list items, quotes, code, images.
 * `loose: true` also turns bare text inside <section>/<div> into paragraphs — WeChat articles are
 * built from nested sections and spans with hardly any <p>.
 */
export function htmlToBlocks(html, baseUrl, { loose = false } = {}) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const blocks = [];
  const seenImages = new Set();
  if (loose) {
    const pushImage = (img) => {
      const src = absolute(img.getAttribute('data-src') || img.getAttribute('src'), baseUrl);
      if (src && /^https?:/.test(src) && !seenImages.has(src)) { seenImages.add(src); blocks.push({ type: 'img', src, alt: clean(img.getAttribute('alt')) }); }
    };
    const walk = (node) => {
      let buffer = '';
      const flush = () => { const text = clean(buffer); buffer = ''; if (text) blocks.push({ type: 'p', text }); };
      for (const child of node.childNodes ?? []) {
        if (child.nodeType === 3) { buffer += child.textContent; continue; }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName;
        if (SKIP_TAGS.has(tag)) continue;
        if (tag === 'BR') { buffer += '\n'; continue; }
        if (tag === 'IMG') { flush(); pushImage(child); continue; }
        if (BLOCK_TAGS.has(tag) && !child.querySelector?.('section,div,figure,table')) {
          flush();
          for (const img of child.querySelectorAll?.('img') ?? []) pushImage(img);
          const text = tag === 'PRE' ? String(child.textContent ?? '').replace(/\s+$/, '') : clean(child.textContent);
          if (!text) continue;
          const type = tag === 'PRE' ? 'code' : tag === 'LI' ? 'li' : tag === 'BLOCKQUOTE' ? 'quote' : /^H[1-6]$/.test(tag) ? 'h' : 'p';
          if ((type === 'quote' || type === 'li') && child.querySelector?.('p,li,pre,h1,h2,h3,h4')) { walk(child); continue; }
          blocks.push({ type, text });
          continue;
        }
        if (BLOCK_TAGS.has(tag) || LOOSE_CONTAINERS.has(tag) || child.querySelector?.(BLOCKISH)) { flush(); walk(child); continue; }
        buffer += child.textContent; // inline: span, strong, a, em …
      }
      flush();
    };
    walk(document.body);
    // A section that repeats its caption yields the same paragraph twice in a row.
    return blocks.filter((block, index) => !(block.type === 'p' && blocks[index - 1]?.type === 'p' && blocks[index - 1].text === block.text));
  }
  const visit = (node) => {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType !== 1) continue;
      const tag = child.tagName;
      if (tag === 'IMG') {
        const src = absolute(child.getAttribute('src') || child.getAttribute('data-src'), baseUrl);
        if (src && /^https?:/.test(src) && !seenImages.has(src)) { seenImages.add(src); blocks.push({ type: 'img', src, alt: clean(child.getAttribute('alt')) }); }
        continue;
      }
      if (BLOCK_TAGS.has(tag)) {
        // Images nested in a paragraph still deserve their own block.
        for (const img of child.querySelectorAll?.('img') ?? []) {
          const src = absolute(img.getAttribute('src') || img.getAttribute('data-src'), baseUrl);
          if (src && /^https?:/.test(src) && !seenImages.has(src)) { seenImages.add(src); blocks.push({ type: 'img', src, alt: clean(img.getAttribute('alt')) }); }
        }
        const text = tag === 'PRE' ? String(child.textContent ?? '').replace(/\s+$/, '') : clean(child.textContent);
        if (!text) continue;
        const type = tag === 'PRE' ? 'code' : tag === 'LI' ? 'li' : tag === 'BLOCKQUOTE' ? 'quote' : /^H[1-6]$/.test(tag) ? 'h' : 'p';
        // A blockquote/li that only wraps paragraphs: descend instead of flattening.
        if ((type === 'quote' || type === 'li') && child.querySelector?.('p,li,pre,h1,h2,h3,h4')) { visit(child); continue; }
        blocks.push({ type, text });
        continue;
      }
      visit(child);
    }
  };
  visit(document.body);
  return blocks;
}

/** Fetch and extract one page → { title, siteName, byline, excerpt, image, publishedAt, blocks }. */
export async function extractWebPage(url) {
  const html = await fetchText(url, { timeoutMs: 30_000, headers: { accept: 'text/html,application/xhtml+xml' } });
  const { document } = parseHTML(html);
  const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') ?? undefined;
  let article;
  try { article = new Readability(document, { charThreshold: 200, keepClasses: false }).parse(); } catch { article = undefined; }
  let blocks = article?.content ? htmlToBlocks(article.content, url) : [];
  if (blocks.filter((block) => block.type !== 'img').reduce((sum, block) => sum + (block.text?.length ?? 0), 0) < 200) {
    // Fallback: every visible paragraph on the page.
    const { document: raw } = parseHTML(html);
    for (const node of raw.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,svg')) node.remove();
    blocks = htmlToBlocks(raw.body?.innerHTML ?? '', url);
  }
  const textLength = blocks.reduce((sum, block) => sum + (block.text?.length ?? 0), 0);
  if (textLength < 80) throw new Error('这个网页没抓到正文（可能需要登录，或者内容是用脚本动态加载的）');
  return {
    title: clean(article?.title || meta('og:title') || document.querySelector('title')?.textContent || url),
    siteName: clean(article?.siteName || meta('og:site_name') || new URL(url).hostname.replace(/^www\./, '')),
    byline: clean(article?.byline) || undefined,
    excerpt: clean(article?.excerpt || meta('og:description')) || undefined,
    image: absolute(meta('og:image'), url),
    publishedAt: article?.publishedTime || meta('article:published_time') || undefined,
    blocks,
  };
}
