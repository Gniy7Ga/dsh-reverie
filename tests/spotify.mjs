/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// Offline tests for Spotify link classification and episode matching (no network).
import assert from 'node:assert/strict';
import { classifyLink } from '../src/host/media.js';
import { feedEpisodes, matchScore, normalizeTitle } from '../src/host/sources/spotify.js';

// --- classification -----------------------------------------------------------
const c = (url) => classifyLink(url);
assert.deepEqual(c('https://open.spotify.com/episode/0ePd4PUqCpN78hCjVRH0fr?si=abc123'), { type: 'media', platform: 'spotify', episodeId: '0ePd4PUqCpN78hCjVRH0fr', url: 'https://open.spotify.com/episode/0ePd4PUqCpN78hCjVRH0fr' });
assert.equal(c('https://open.spotify.com/intl-zh/episode/0ePd4PUqCpN78hCjVRH0fr').episodeId, '0ePd4PUqCpN78hCjVRH0fr');
assert.equal(c('https://open.spotify.com/embed/episode/0ePd4PUqCpN78hCjVRH0fr/video').episodeId, '0ePd4PUqCpN78hCjVRH0fr');
assert.equal(c('https://spotify.link/AbCdEf123').platform, 'spotify');
assert.equal(c('https://open.spotify.com/show/4JH4tybY1zX6e5hjCwU6gF').type, 'error');
assert.equal(c('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC').type, 'error');

// --- matching -----------------------------------------------------------------
assert.equal(normalizeTitle('AI researchers debate — how close we are?'), normalizeTitle('ai researchers debate how close we are'));
const meta = { title: 'AI researchers debate how close we are to recursive self-improvement', publishedAt: '2026-09-11T16:28:00Z', duration: 5821 };
assert.ok(matchScore(meta, { title: 'AI researchers debate how close we are to recursive self-improvement', publishedAt: '2026-09-11T16:28:11Z', duration: 5821 }) >= 120);
assert.ok(matchScore(meta, { title: 'Ep 12: AI researchers debate how close we are to recursive self-improvement', publishedAt: '2026-09-11T00:00:00Z' }) >= 70, 'prefixed title still matches');
assert.equal(matchScore(meta, { title: 'Something else entirely', publishedAt: '2026-09-11T00:00:00Z' }), 0);
assert.ok(matchScore(meta, { title: meta.title, publishedAt: '2024-01-01T00:00:00Z', duration: 1200 }) < 70, 'same title, far date and length → rejected (a rerun / different episode)');
assert.ok(matchScore({ title: '第 42 期：慢慢变好', publishedAt: '2026-01-02T00:00:00Z' }, { title: '第42期 慢慢变好', publishedAt: '2026-01-02T08:00:00Z' }) >= 100, 'Chinese titles with different punctuation and spacing');

// --- RSS --------------------------------------------------------------------------
const rss = `<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Show</title>
<item><title><![CDATA[Episode & One]]></title><pubDate>Fri, 11 Sep 2026 16:28:00 GMT</pubDate><itunes:duration>01:37:01</itunes:duration>
<enclosure url="https://cdn.example.com/1.mp3" type="audio/mpeg" length="1"/><description>Notes</description></item>
<item><title>Two</title><itunes:duration>300</itunes:duration><enclosure url="https://cdn.example.com/2.mp3"/></item>
</channel></rss>`;
const episodes = feedEpisodes(rss);
assert.equal(episodes.length, 2);
assert.deepEqual(episodes[0], { title: 'Episode & One', publishedAt: '2026-09-11T16:28:00.000Z', duration: 5821, audioUrl: 'https://cdn.example.com/1.mp3', description: 'Notes' });
assert.equal(episodes[1].duration, 300);

console.log('ok: spotify tests passed');
