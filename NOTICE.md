# NOTICE · 版权与来源声明

**Reverie (dsh-reverie)**
Copyright (C) 2026 Ag (<https://github.com/Gniy7Ga>)

本程序是自由软件：你可以依据自由软件基金会发布的 GNU 通用公共许可证第 3 版（仅第 3 版，GPL-3.0-only）再发布和/或修改它。发布本程序是希望它有用，但**不提供任何担保**，也不担保适销性或适用于特定用途。完整条款见 [LICENSE](LICENSE)。

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License, version 3 only (GPL-3.0-only), as published by the Free Software Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE).

Reverie 是个人开发的社区插件，与 DeepSeek 官方、乔木 RSS 及其作者都没有隶属或背书关系。
Reverie is an independent community plugin. It is not affiliated with or endorsed by DeepSeek, Qiaomu RSS, or their authors.

---

## 1. 改编自 qiaomu-rss-dsh（GPL-3.0-only）

Reverie 的一部分代码改编自 **乔木 RSS · qiaomu-rss-dsh**：

- 项目：<https://github.com/joeseesun/qiaomu-rss-dsh>
- 作者：向阳乔木（joeseesun）及其贡献者
- 许可：GPL-3.0-only
- 参照版本：v0.8.0（对照提交 `722a59ba5943d1dd19337c3d3ec45542e824b4d5`）

qiaomu-rss-dsh 采用 GPL-3.0-only，所以 Reverie 整体也按 GPL-3.0-only 发布，并附上同一份许可证全文。按 GPL-3.0 第 5 条的要求，下表写明了来源文件、修改内容和修改时间；每个文件开头也有同样的说明。

| Reverie 中的文件 | 来源文件（qiaomu-rss-dsh） | 程度 | 修改说明（Ag，2026 年 10 月） |
| --- | --- | --- | --- |
| `src/shared/markdown.js` | `src/host/markdown.js` | 原样复制 | 移到 `src/shared/`，宿主和客户端共用 |
| `src/shared/sanitize.js` | `src/host/sanitize.js` | 原样复制 | 移到 `src/shared/`，宿主和客户端共用 |
| `src/shared/xml.js` | `src/host/xml.js` | 几乎原样 | 移到 `src/shared/`，错误信息前缀改名 |
| `src/client/NativeConversation.jsx` | `src/client/NativeConversation.jsx` | 原样复制 | 无 |
| `src/client/native-chat.js` | `src/client/native-chat.js` | 改编 | 增加独立的 Reverie 工作区（按路径查找或注册），会话来源改名 |
| `src/client/VideoPlayer.jsx` | `src/client/VideoPlayer.jsx` | 改编 | 只保留 YouTube（去掉 B 站播放器），改为接收视频 id，样式类名改为本插件前缀 |
| `src/host/video-player.js` | `src/host/video-player.js` | 改编 | 改为接收 YouTube 视频 id，支持起始时间，补充响应头 |
| `src/client/Companion.jsx` | `src/client/AskArticle.jsx` | 部分改编 | 沿用「左侧阅读、右侧挂载 Harness 原生对话」和会话绑定方式；提示词、上下文和布局重写 |
| `src/client/index.jsx` | `src/client/index.jsx` | 部分改编 | 沿用 Remote 描述符 / codec 桩和 slot 注册写法；方法、面板、slot 为本插件自有 |
| `src/host/ai.js` | `src/host/ai.js` | 部分改编 | 沿用默认模型选择和 `ctx.llm` 流式读取；提示词和中英逐段对齐翻译为新写 |
| `build.mjs` | `build.mjs` | 部分改编 | 沿用 esbuild 配置和客户端 `window.__ModuleLoader__` 包装 |

**界面**：Reverie 的阅读界面布局（左栏列表 + 中间正文 + 右侧 AI 伴读、魔法棒入口、「版本」切换）参考了乔木 RSS 的设计。样式表 `src/client/styles.css` 是另外写的，没有复制乔木 RSS 的 CSS。

**没有使用的部分**：Reverie 不调用乔木 RSS 的服务接口，不包含乔木精选、Podscribe、订阅目录等数据，也不包含 qiaomu-rss-dsh 内置的 chinese-independent-blogs 清单。

除上表和下文列出的内容外，其余代码（链接收录与转录、网页/小红书/公众号/推特抓取、输出笔记、回顾、Agent 工具、数据存储等）由 Ag 编写。

感谢向阳乔木开源乔木 RSS。

## 2. 其他第三方内容

| 内容 | 位置 | 来源 | 许可 |
| --- | --- | --- | --- |
| SVG 图标路径数据 | `src/client/icons.jsx` | [Lucide](https://lucide.dev)，Copyright (c) Lucide Icons and Contributors；其中源自 Feather 的图标 Copyright (c) 2013-present Cole Bemis | ISC；Feather 部分为 MIT。全文见 [licenses/lucide-LICENSE.txt](licenses/lucide-LICENSE.txt) |
| 推特 syndication token 计算公式（一行） | `src/host/social.js` 的 `syndicationToken` | [vercel/react-tweet](https://github.com/vercel/react-tweet)，Copyright (c) 2023 Luis Alvarez | MIT。全文见 [licenses/react-tweet-LICENSE.md](licenses/react-tweet-LICENSE.md) |
| 打包进 `lib/index.js` 的 npm 包（@mozilla/readability、linkedom 及其依赖） | `lib/index.js` | 各自项目 | Apache-2.0 / ISC / MIT / BSD-2-Clause，全文见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)（构建时自动生成） |

## 3. 运行时使用但不随包分发的软件

下面这些只在用户本机运行时调用，代码不包含在本仓库或安装包里，各自遵循原项目的许可：

- [yt-dlp](https://github.com/yt-dlp/yt-dlp)（Unlicense）、[FFmpeg](https://ffmpeg.org)（LGPL/GPL）
- [mlx-whisper](https://github.com/ml-explore/mlx-examples)（MIT）、[faster-whisper](https://github.com/SYSTRAN/faster-whisper)（MIT）、OpenAI Whisper 模型权重（MIT）
- [AI-Video-Transcriber](https://github.com/wendy7756/AI-Video-Transcriber)（Apache-2.0）：如果本机有它的安装目录，Reverie 会复用其中的 yt-dlp 和 Whisper 环境；不复制它的代码
- DeepSeek Harness 及 `@deepseek-ai/*` 包：由 Harness 安装提供，不打包进本插件

## 4. 名称与商标

YouTube、Bilibili、小宇宙、Apple Podcasts、小红书、微信公众号、X/Twitter 等名称归各自权利人所有，本插件只用来描述支持的链接类型。「乔木 RSS」是 qiaomu-rss-dsh 作者的项目名称，这里只用来说明来源。
