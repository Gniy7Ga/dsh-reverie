# Changelog

## 0.6.1 — 2026-10-08

- 支持 Spotify 播客单集链接（`open.spotify.com/episode/…`、`spotify.link` 短链）。Spotify 的音频是加密的，Reverie 会读取节目信息，到 Apple Podcasts 公开目录和节目 RSS 里找到同一期的公开音频再转录；Spotify 独家节目会提示换其他平台的链接。
- 之前被当成网页、抓取失败的 Spotify 链接，点「重试」会按播客重新处理。
- 网络错误不再只显示 `fetch failed`，会写明连不上哪个网站和原因（超时、连接被重置等）。

## 0.6.0 — 2026-10-07

- 首次开源发布。插件改名为 **Reverie**，包名由 `my-reader-dsh` 改为 `dsh-reverie`。
- 数据目录改为 `storages/reverie/`；首次启动时自动复制旧目录 `storages/my-reader/` 的数据，旧目录保留。
- 插件对话工作区改为 `~/Reverie`。
- 新增 `config.toolchain`：可以手动指定 yt-dlp、ffmpeg、mlx-whisper / faster-whisper 的路径。
- 补充版权与来源声明：`NOTICE.md`、改编文件的文件头、构建产物里的许可说明，以及自动生成的 `THIRD_PARTY_LICENSES.md`。
