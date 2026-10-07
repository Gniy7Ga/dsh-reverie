/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
// Data from the pre-rename package (storages/my-reader) is copied once into storages/reverie.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateLegacyData } from '../src/host/store.js';

const root = mkdtempSync(join(tmpdir(), 'reverie-migrate-'));
try {
  const legacy = join(root, 'my-reader');
  const dir = join(root, 'reverie');
  mkdirSync(join(legacy, 'bodies'), { recursive: true });
  writeFileSync(join(legacy, 'library.json'), JSON.stringify({ version: 2, items: [{ id: 'a' }], memos: [] }));
  writeFileSync(join(legacy, 'bodies', 'a.json'), '{"blocks":[]}');

  assert.equal(await migrateLegacyData(dir, legacy), true);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8')).items, [{ id: 'a' }]);
  assert.ok(existsSync(join(dir, 'bodies', 'a.json')));
  assert.ok(existsSync(join(legacy, 'library.json')), 'legacy data is left in place');

  writeFileSync(join(dir, 'library.json'), JSON.stringify({ version: 2, items: [], memos: [] }));
  assert.equal(await migrateLegacyData(dir, legacy), false, 'existing new data is never overwritten');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8')).items, []);

  assert.equal(await migrateLegacyData(join(root, 'fresh'), join(root, 'missing')), false);
  console.log('ok: legacy data migration');
} finally {
  rmSync(root, { recursive: true, force: true });
}
