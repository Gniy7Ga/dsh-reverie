/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/host/video-player.js
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Adapted: takes a YouTube video id instead of an article, supports a start offset, adds response headers.
 * See NOTICE.md for details.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// A loopback HTML page hosts the official YouTube embed so the player sees a
// real http(s) Referer, including inside the desktop shell's custom scheme.
export class VideoPlayerServer {
  constructor() { this.token = randomBytes(24).toString('hex'); }

  async url(videoId) {
    if (!/^[\w-]{11}$/.test(videoId ?? '')) return undefined;
    if (!this.ready) {
      this.server = createServer((req, res) => {
        const host = `127.0.0.1:${this.server.address().port}`;
        if (req.headers.host !== host || req.method !== 'GET') { res.writeHead(403).end(); return; }
        const url = new URL(req.url, `http://${host}`);
        const match = new RegExp(`^/${this.token}/([\\w-]{11})$`).exec(url.pathname);
        if (!match) { res.writeHead(404).end(); return; }
        const start = Math.max(0, Number.parseInt(url.searchParams.get('t') ?? '0', 10) || 0);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-src https://www.youtube.com",
        });
        res.end(`<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;width:100%;height:100%;background:#000}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe src="https://www.youtube.com/embed/${match[1]}?rel=0${start ? `&start=${start}&autoplay=1` : ''}" title="YouTube 视频播放器" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`);
      });
      this.ready = new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve); });
      this.ready.catch(() => { this.ready = undefined; });
    }
    await this.ready;
    return `http://127.0.0.1:${this.server.address().port}/${this.token}/${videoId}`;
  }

  async dispose() {
    if (this.ready) await this.ready.catch(() => {});
    if (this.server?.listening) await new Promise((resolve) => this.server.close(resolve));
  }
}
