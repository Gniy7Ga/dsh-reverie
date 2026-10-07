/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
import { useCallback, useRef, useState } from 'react';

export function useStable(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}


export function relativeTime(value) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return '';
  const diff = Date.now() - time;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`;
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function Avatar({ src, name, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img className="mr-avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
  return <span className="mr-avatar mr-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.5 }}>{String(name ?? '?').replace(/^@/, '').slice(0, 1).toUpperCase()}</span>;
}

