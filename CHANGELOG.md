# Changelog

## 0.6.0 — 2026-10-07

- 首次开源发布。插件改名为 **Reverie**，包名由 `my-reader-dsh` 改为 `dsh-reverie`。
- 数据目录改为 `storages/reverie/`；首次启动时自动复制旧目录 `storages/my-reader/` 的数据，旧目录保留。
- 插件对话工作区改为 `~/Reverie`。
- 新增 `config.toolchain`：可以手动指定 yt-dlp、ffmpeg、mlx-whisper / faster-whisper 的路径。
- 补充版权与来源声明：`NOTICE.md`、改编文件的文件头、构建产物里的许可说明，以及自动生成的 `THIRD_PARTY_LICENSES.md`。
