/*!
 * SPDX-License-Identifier: GPL-3.0-only
 * Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga)
 *
 * This file is derived from qiaomu-rss-dsh, file build.mjs
 * <https://github.com/joeseesun/qiaomu-rss-dsh>,
 * Copyright (C) 向阳乔木 (joeseesun) and contributors, licensed GPL-3.0-only.
 * Modified by Ag, October 2026. Partly adapted: the esbuild setup and window.__ModuleLoader__ wrapper for the client bundle.
 * See NOTICE.md for details.
 */
/**
 * Build the plugin: host bundle (ESM, DSH peers external) + client bundle
 * (window.__ModuleLoader__ CJS wrapper, react / DSH packages external).
 */
import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { thirdPartyNotices } from './scripts/third-party-licenses.mjs';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'lib'), { recursive: true });

/** Top-of-file notice for the built artifacts; per-file notices are kept at the end (legalComments: 'eof'). */
const NOTICE = `/*!
 * Reverie (dsh-reverie) — https://github.com/Gniy7Ga/dsh-reverie
 * Copyright (C) 2026 Ag (https://github.com/Gniy7Ga). SPDX-License-Identifier: GPL-3.0-only
 * Contains code adapted from qiaomu-rss-dsh by 向阳乔木 (joeseesun), GPL-3.0-only,
 * https://github.com/joeseesun/qiaomu-rss-dsh, and third-party components listed in
 * NOTICE.md and THIRD_PARTY_LICENSES.md. Source: the src/ directory of the repository above.
 */`;

const host = await esbuild.build({
  entryPoints: [join(here, 'src/host/index.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: join(here, 'lib/index.js'),
  external: ['@deepseek-ai/*', 'node:*', 'canvas'],
  banner: { js: `${NOTICE}\nimport { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);` },
  logLevel: 'info',
  legalComments: 'eof',
  metafile: true,
});

const banner = `${NOTICE}
window.__ModuleLoader__.load({
	id: "dsh-reverie",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`;
const footer = `
		return module.exports;
	}
});
`;

const client = await esbuild.build({
  entryPoints: [join(here, 'src/client/index.jsx')],
  loader: { '.css': 'text' },
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'react',
  outfile: join(here, 'lib/client.js'),
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*'],
  logLevel: 'info',
  legalComments: 'eof',
  metafile: true,
  banner: { js: banner },
  footer: { js: footer },
});

// Every npm package that ends up inside lib/ gets its license text in THIRD_PARTY_LICENSES.md.
writeFileSync(join(here, 'THIRD_PARTY_LICENSES.md'), thirdPartyNotices(here, [host.metafile, client.metafile]));

copyFileSync(join(here, 'src/python/asr_worker.py'), join(here, 'lib/asr_worker.py'));

for (const file of ['lib/index.js', 'lib/client.js']) {
  console.log(`${file.padEnd(16)} ${(statSync(join(here, file)).size / 1024).toFixed(1)} KB`);
}
