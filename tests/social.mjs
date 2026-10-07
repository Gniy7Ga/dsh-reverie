/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// Offline tests for 小红书 / 公众号 / 推特 link classification and page parsing (no network).
import assert from 'node:assert/strict';
import { classifyLink } from '../src/host/media.js';
import { tweetToPage, wechatToPage, xhsToPage, parseInitialState } from '../src/host/social.js';

// --- classification -----------------------------------------------------------
const c = (url) => classifyLink(url);
assert.deepEqual(c('https://twitter.com/jack/status/20?s=20'), { type: 'web', platform: 'twitter', tweetId: '20', user: 'jack', url: 'https://x.com/jack/status/20' });
assert.equal(c('https://x.com/karpathy/status/1886192184808149383/photo/1').tweetId, '1886192184808149383');
assert.equal(c('https://mobile.twitter.com/i/web/status/123456').url, 'https://x.com/i/status/123456');
assert.equal(c('https://fxtwitter.com/a_b/status/99').platform, 'twitter');
assert.equal(c('https://x.com/karpathy').type, 'error');
assert.equal(c('https://mp.weixin.qq.com/s/1bwTtJBi4vF5DEsLWFkAKw?poc_token=xyz').url, 'https://mp.weixin.qq.com/s/1bwTtJBi4vF5DEsLWFkAKw');
assert.equal(c('https://mp.weixin.qq.com/s?__biz=MzI&mid=1&idx=1&sn=abc&chksm=zz&scene=21#wechat_redirect').url, 'https://mp.weixin.qq.com/s?__biz=MzI&mid=1&idx=1&sn=abc');
assert.equal(c('https://mp.weixin.qq.com/mp/profile_ext?action=home').type, 'error');
const xhs = c('https://www.xiaohongshu.com/explore/6411cf99000000001300b6d9?xsec_token=AB&xsec_source=pc_share');
assert.equal(xhs.platform, 'xiaohongshu');
assert.equal(xhs.noteId, '6411cf99000000001300b6d9');
assert.ok(xhs.url.includes('xsec_token=AB'), 'xsec_token is kept, the note needs it');
assert.equal(c('http://xhslink.com/a/AbCdEf').platform, 'xiaohongshu');
assert.equal(c('https://www.xiaohongshu.com/user/profile/5f0000000000000000000abc/6411cf99000000001300b6d9').noteId, '6411cf99000000001300b6d9');
assert.equal(c('https://example.com/post').platform, undefined);
assert.equal(c('https://www.youtube.com/watch?v=dQw4w9WgXcQ').platform, 'youtube');

// --- 推特 -----------------------------------------------------------------------
const tweet = tweetToPage({
  text: 'Line one &amp; more\n\nLine two https://t.co/abc123', name: 'Jack', screen: 'jack', time: 1142974214000, lang: 'en',
  media: [{ type: 'image', url: 'https://pbs.twimg.com/a.jpg' }, { type: 'video', url: 'https://video.twimg.com/v.mp4', thumb: 'https://pbs.twimg.com/t.jpg', duration: 12 }],
  quote: { name: 'Ev', screen: 'ev', text: 'quoted' },
});
assert.equal(tweet.title, 'Line one & more');
assert.equal(tweet.siteName, 'Jack @jack');
assert.deepEqual(tweet.blocks.filter((b) => b.type === 'p').map((b) => b.text), ['Line one & more', 'Line two']);
assert.equal(tweet.blocks.filter((b) => b.type === 'img').length, 2);
assert.equal(tweet.blocks.at(-1).type, 'quote');
assert.deepEqual(tweet.video, { url: 'https://video.twimg.com/v.mp4', duration: 12 });
assert.equal(tweet.publishedAt, '2006-03-21T20:50:14.000Z');
assert.throws(() => tweetToPage({ text: '', media: [] }));

// --- 公众号 ---------------------------------------------------------------------
const wxHtml = `<html><head><meta property="og:title" content="og title"><meta property="og:image" content="https://mmbiz.qpic.cn/og.jpg"></head><body>
<h1 id="activity-name">  标题 A </h1><a id="js_name">号名</a>
<div id="js_content" style="visibility: hidden;">
  <section><span>第一段，</span><strong>加粗</strong><span>继续。</span></section>
  <section><section><img data-src="https://mmbiz.qpic.cn/1.png"></section><section><span>图注</span></section></section>
  <p><span>普通段落</span></p>
  <section>外层文字<section>内层文字</section></section>
  <section><span>重复</span></section><section><span>重复</span></section>
  <script>var x = 1;</script>
</div>
<script>var create_time = "1687096896" * 1; var nickname = htmlDecode("42章经"); var msg_title = '投资中的节奏 &amp; 结构'.html(false); var msg_cdn_url = "https://mmbiz.qpic.cn/cover.jpg";</script>
</body></html>`;
const wx = wechatToPage(wxHtml, 'https://mp.weixin.qq.com/s/x');
assert.equal(wx.title, '投资中的节奏 & 结构');
assert.equal(wx.siteName, '42章经');
assert.equal(wx.image, 'https://mmbiz.qpic.cn/cover.jpg');
assert.equal(wx.publishedAt, '2023-06-18T14:01:36.000Z');
assert.deepEqual(wx.blocks.map((b) => b.text ?? b.src), ['第一段，加粗继续。', 'https://mmbiz.qpic.cn/1.png', '图注', '普通段落', '外层文字', '内层文字', '重复']);
assert.throws(() => wechatToPage('<html><body>环境异常 完成验证后即可继续访问</body></html>', 'u'), /验证/);

// --- 小红书 ---------------------------------------------------------------------
const state = { note: { noteDetailMap: { '6411cf99000000001300b6d9': { note: {
  noteId: '6411cf99000000001300b6d9', type: 'video', title: '周末去哪儿', desc: '第一行[笑哭R]\n第二行 #旅行[话题]# #攻略[话题]#', time: 1700000000000,
  user: { nickname: '小明' }, imageList: [{ urlDefault: 'http://sns-webpic-qc.xhscdn.com/a.jpg' }],
  video: { capa: { duration: 33 }, media: { stream: { h264: [{ masterUrl: 'http://sns-video-bd.xhscdn.com/v.mp4' }], h265: [] } } },
  extra: null } } } } };
const xhsHtml = `<html><body><script>window.__INITIAL_STATE__=${JSON.stringify(state).replace('"extra":null', '"extra":undefined')}</script></body></html>`;
assert.ok(xhsHtml.includes('undefined'));
assert.ok(parseInitialState(xhsHtml));
const note = xhsToPage(xhsHtml, '6411cf99000000001300b6d9');
assert.equal(note.title, '周末去哪儿');
assert.equal(note.siteName, '小明');
assert.deepEqual(note.blocks.map((b) => b.text ?? b.src), ['周末去哪儿', '第一行', '第二行 #旅行 #攻略', 'https://sns-webpic-qc.xhscdn.com/a.jpg']);
assert.deepEqual(note.video, { url: 'https://sns-video-bd.xhscdn.com/v.mp4', duration: 33 });
assert.throws(() => xhsToPage('<html><script>window.__INITIAL_STATE__={"note":{"noteDetailMap":{}}}</script></html>', 'x'), /分享/);

console.log('ok: social link tests passed');
