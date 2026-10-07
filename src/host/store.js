/*! SPDX-License-Identifier: GPL-3.0-only | Reverie (dsh-reverie) — Copyright (C) 2026 Ag (https://github.com/Gniy7Ga) */
/**
 * Durable plugin data under <harness home>/storages/reverie/:
 *   library.json     — timeline index (items without bodies) + memos + settings
 *   bodies/<id>.json — one file per item body (transcript / article blocks, translation)
 * Writes are atomic (temp file + rename) and debounced.
 */
import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';

export function dataDir() {
  return join(resolveDshHome(), 'storages', 'reverie');
}

/** Data written before the rename (package `my-reader-dsh`) lived here. */
export function legacyDataDir() {
  return join(resolveDshHome(), 'storages', 'my-reader');
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

/**
 * One-time copy of the pre-rename data into the new directory. The legacy
 * directory is left untouched so a rollback to the old package still works.
 */
export async function migrateLegacyData(dir, legacy, logger) {
  if (await exists(join(dir, 'library.json'))) return false;
  if (!(await exists(join(legacy, 'library.json')))) return false;
  await cp(legacy, dir, { recursive: true, errorOnExist: false, force: false });
  logger?.info?.('reverie: copied data from %s to %s', legacy, dir);
  return true;
}

function defaults() {
  return { version: 2, items: [], memos: [], companionContexts: {}, settings: { autoTranslate: true, keepMedia: false } };
}

let tempCounter = 0;
async function atomicWrite(path, text) {
  const temp = `${path}.${process.pid}.${Date.now()}.${(tempCounter += 1)}.tmp`;
  await writeFile(temp, text, { encoding: 'utf8', mode: 0o600 });
  await rename(temp, path);
}

export class LibraryStore {
  constructor(logger, dir = dataDir(), legacyDir = dir === dataDir() ? legacyDataDir() : undefined) {
    this.logger = logger;
    this.dir = dir;
    this.legacyDir = legacyDir;
    this.path = join(dir, 'library.json');
    this.data = defaults();
    this.bodies = new Map();
    this.saveTimer = undefined;
    this.saving = Promise.resolve();
    this.bodyWrites = new Map();
  }

  async load() {
    if (this.legacyDir) await migrateLegacyData(this.dir, this.legacyDir, this.logger);
    await mkdir(join(this.dir, 'bodies'), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8'));
      const base = defaults();
      this.data = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error('reverie: 无法读取已保存的数据，为避免覆盖已停止加载', { cause: error });
      this.data = defaults();
    }
  }

  touch() {
    if (this.saveTimer !== undefined) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = undefined; void this.flush().catch(() => {}); }, 500);
    this.saveTimer.unref?.();
  }

  async flush() {
    this.saving = this.saving.catch(() => {}).then(async () => {
      try {
        await mkdir(this.dir, { recursive: true });
        await atomicWrite(this.path, JSON.stringify(this.data));
      } catch (error) {
        this.logger?.warn?.('reverie: failed to save library: %s', String(error));
        throw error;
      }
    });
    return this.saving;
  }

  async dispose() {
    if (this.saveTimer !== undefined) { clearTimeout(this.saveTimer); this.saveTimer = undefined; }
    await this.flush();
  }

  item(id) { return this.data.items.find((item) => item.id === id); }

  addItem(item) {
    this.data.items.unshift(item);
    this.touch();
    return item;
  }

  patchItem(id, patch) {
    const item = this.item(id);
    if (!item) return undefined;
    Object.assign(item, patch, { updatedAt: Date.now() });
    this.touch();
    return item;
  }

  async removeItem(id) {
    this.data.items = this.data.items.filter((item) => item.id !== id);
    this.bodies.delete(id);
    await this.bodyWrites.get(id)?.catch(() => {});
    await rm(join(this.dir, 'bodies', `${id}.json`), { force: true });
    this.touch();
  }

  async body(id) {
    if (this.bodies.has(id)) return this.bodies.get(id);
    try {
      const body = JSON.parse(await readFile(join(this.dir, 'bodies', `${id}.json`), 'utf8'));
      this.bodies.set(id, body);
      return body;
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      throw error;
    }
  }

  /** Writes of one body are serialized so a late progress write never overwrites the final one. */
  async saveBody(id, body) {
    this.bodies.set(id, body);
    if (this.bodies.size > 30) this.bodies.delete(this.bodies.keys().next().value);
    const text = JSON.stringify(body);
    const write = (this.bodyWrites.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
      await mkdir(join(this.dir, 'bodies'), { recursive: true });
      await atomicWrite(join(this.dir, 'bodies', `${id}.json`), text);
    });
    this.bodyWrites.set(id, write);
    try { await write; } finally { if (this.bodyWrites.get(id) === write) this.bodyWrites.delete(id); }
  }

  memo(id) { return this.data.memos.find((memo) => memo.id === id); }
}
