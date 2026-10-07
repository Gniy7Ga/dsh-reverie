/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// Every Remote method must take exactly one `request` parameter: the client descriptor declares one.
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/host/service.js', import.meta.url), 'utf8');
const names = JSON.parse(/const REMOTE_METHODS = (\[[\s\S]*?\]);/.exec(source)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const bad = names.filter((name) => !new RegExp(`\\n  async ${name}\\(request\\)`).test(source));
if (bad.length) { console.error('signature mismatch:', bad); process.exit(1); }
console.log(`ok: ${names.length} Remote methods take (request)`);
