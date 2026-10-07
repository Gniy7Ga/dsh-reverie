/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file src/client/VideoPlayer.jsx
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Adapted: YouTube only (Bilibili player removed), takes a video id instead of an embed URL, plugin-specific classes.
 * See NOTICE.md for details.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

/**
 * YouTube player. In the desktop shell a browser-bridge <webview> loads the
 * loopback page (real Referer, sign-in popups go to the system browser);
 * elsewhere a sandboxed iframe is used.
 */
export function VideoPlayer({ videoId, playerUrl }) {
  const bridge = typeof window !== 'undefined' ? window.dshDesktop?.browser : undefined;
  const [lease, setLease] = useState(null);
  const [error, setError] = useState('');
  const view = useRef(null);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.replace(/\sElectron\/\S+/g, '').replace(/\sDeepSeek[\w-]*\/\S+/g, '') : undefined;

  useEffect(() => {
    if (!bridge || !playerUrl) return undefined;
    let cancelled = false;
    let acquired;
    let unsubscribe;
    void bridge.acquire('reverie:youtube').then((value) => {
      acquired = value;
      if (cancelled) { void bridge.release(value.lease); return; }
      unsubscribe = bridge.onOpenRequested(value.lease, () => window.open(watchUrl, '_blank', 'noopener,noreferrer'));
      setLease(value);
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; unsubscribe?.(); if (acquired) void bridge.release(acquired.lease); setLease(null); };
  }, [bridge, playerUrl]);

  useEffect(() => {
    const element = view.current;
    if (!element || !lease) return undefined;
    let loaded = false;
    const ready = () => {
      if (loaded) return;
      loaded = true;
      element.setUserAgent?.(userAgent);
      void element.loadURL(playerUrl, { userAgent }).catch((e) => setError(e.message));
    };
    element.addEventListener('dom-ready', ready);
    return () => element.removeEventListener('dom-ready', ready);
  }, [lease, playerUrl]);

  const external = <a className="mr-link-button" href={watchUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} />在 YouTube 打开</a>;
  if (!bridge || !playerUrl || error) {
    return <div className="mr-video">
      <iframe className="mr-video-frame" src={playerUrl || `https://www.youtube-nocookie.com/embed/${videoId}`} title="YouTube 视频播放器" loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      {external}
    </div>;
  }
  return <div className="mr-video">
    {lease
      ? <webview ref={view} className="mr-video-frame" src={`about:blank#${lease.lease}`} partition={lease.partition} allowpopups="true" useragent={userAgent} title="YouTube 视频播放器" />
      : <div className="mr-video-frame mr-video-loading">正在加载播放器…</div>}
    {external}
  </div>;
}
