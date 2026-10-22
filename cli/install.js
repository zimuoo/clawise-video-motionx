import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'clawise-video-motionx';
export const MARKER = '.motionx-install.json';
export const DEFAULT_SOURCE = fileURLToPath(new URL(`../skills/${SKILL_NAME}/`, import.meta.url));
const packageInfo = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
const REQUIRED = ['SKILL.md', 'engine/cli/motionx.js', 'engine/package.json'];

const sha256 = data => createHash('sha256').update(data).digest('hex');
const isWithin = (parent, child) => child === parent || child.startsWith(`${parent}${path.sep}`);

// realpath the existing ancestor, retaining suffixes that do not exist yet.
// This resolves case aliases on case-insensitive filesystems without following
// a link during a write (callers still reject symlink ancestors).
export async function canonicalPath(location) {
  let cursor = path.resolve(location);
  const suffix = [];
  for (;;) {
    try { return path.join(await fs.realpath(cursor), ...suffix); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

export function assertSafeRelativePath(name) {
  if (typeof name !== 'string' || !name || /[\\:\x00-\x1f\x7f]/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe relative path: ${JSON.stringify(name)}`);
  }
  return name;
}

async function lstatIfPresent(location) {
  try { return await fs.lstat(location); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Reject links in the writable path as well as in the skill tree. A target
// reached through a link must never be recursively removed or replaced.
export async function assertNoSymlinkAncestors(location) {
  const absolute = path.resolve(location);
  const { root } = path.parse(absolute);
  let cursor = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = await lstatIfPresent(cursor);
    if (!stat) break;
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link in path: ${cursor}`);
  }
}

/** Read validated local files once; later copying uses these buffers only. */
export async function collectSkillTree(sourceDir, { ignoreMarker = false, normalizeModes = false, include = () => true } = {}) {
  const source = path.resolve(sourceDir);
  await assertNoSymlinkAncestors(source);
  const sourceStat = await lstatIfPresent(source);
  if (!sourceStat?.isDirectory()) throw new Error(`Skill source must be a directory: ${source}`);
  const entries = [];
  async function visit(directory, prefix = '') {
    for (const name of (await fs.readdir(directory)).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      assertSafeRelativePath(relative);
      const full = path.join(source, ...relative.split('/'));
      if (!isWithin(source, full)) throw new Error(`Source path escapes skill: ${relative}`);
      await assertNoSymlinkAncestors(full);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link in skill: ${relative}`);
      if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Unsupported file type in skill: ${relative}`);
      if ((ignoreMarker && relative === MARKER) || !include(relative, stat.isDirectory())) continue;
      const mode = normalizeModes ? (stat.isDirectory() || (stat.mode & 0o111) ? 0o755 : 0o644) : stat.mode & 0o777;
      if (stat.isDirectory()) {
        entries.push({ path: relative, type: 'directory', mode });
        await visit(full, relative);
      } else {
        const handle = await fs.open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if (!(await handle.stat()).isFile()) throw new Error(`Expected regular source file: ${relative}`);
          const data = await handle.readFile();
          entries.push({ path: relative, type: 'file', mode, size: data.length, sha256: sha256(data), data });
        } finally { await handle.close(); }
      }
    }
  }
  await visit(source);
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function treeRecords(entries) {
  return entries.map(({ data, ...record }) => record);
}

export function treeHash(entries, { platform = process.platform } = {}) {
  const records = treeRecords(entries);
  // Windows cannot round-trip POSIX executable/group/other permission bits.
  return sha256(JSON.stringify(platform === 'win32' ? records.map(({ mode, ...record }) => record) : records));
}

export function validateSkillTree(entries) {
  for (const name of REQUIRED) {
    if (!entries.some(entry => entry.path === name && entry.type === 'file')) throw new Error(`Required skill file is missing: ${name}`);
  }
  const metadata = JSON.parse(entries.find(entry => entry.path === 'engine/package.json').data.toString('utf8'));
  if (typeof metadata.name !== 'string' || typeof metadata.version !== 'string') throw new Error('engine/package.json requires a name and version');
  return metadata;
}

export function resolveStateDir({ stateDir, env = process.env, home = os.homedir() } = {}) {
  const selected = stateDir ?? (env.CLAWISE_STATE_DIR?.trim() || env.OPENCLAW_STATE_DIR?.trim() || path.join(home, '.clawise'));
  if (typeof selected !== 'string' || !selected.trim() || selected.includes('\0')) throw new Error('State directory must be a nonempty local path');
  return path.resolve(selected);
}

function targetFor(options) {
  const stateDir = resolveStateDir(options);
  return { stateDir, target: path.join(stateDir, 'skills', SKILL_NAME) };
}

export async function statusSkill(options = {}) {
  const { target } = targetFor(options);
  await assertNoSymlinkAncestors(target);
  const stat = await lstatIfPresent(target);
  const base = { target, installed: Boolean(stat), managed: false, version: null, modified: null };
  if (!stat) return base;
  if (!stat.isDirectory()) throw new Error(`Install target must be a directory: ${target}`);
  const markerPath = path.join(target, MARKER);
  const markerStat = await lstatIfPresent(markerPath);
  if (!markerStat) return base;
  if (markerStat.isSymbolicLink() || !markerStat.isFile()) throw new Error(`Refusing invalid or symbolic link ownership marker: ${markerPath}`);
  let marker;
  try { marker = JSON.parse(await fs.readFile(markerPath, 'utf8')); }
  catch { return { ...base, reason: 'Invalid ownership marker' }; }
  if (marker.owner !== SKILL_NAME || marker.schema !== 1 || typeof marker.version !== 'string' || !/^[a-f0-9]{64}$/.test(marker.sha256 ?? '')) {
    return { ...base, reason: 'Unrecognized ownership marker' };
  }
  const entries = await collectSkillTree(target, { ignoreMarker: true });
  return { ...base, managed: true, version: marker.version, modified: treeHash(entries) !== marker.sha256, sha256: marker.sha256 };
}

/** Roll back the previous directory if publishing a complete stage fails. */
export async function replaceAtomically({ stage, target, backup, rename = fs.rename }) {
  const existing = await lstatIfPresent(target);
  let backedUp = false;
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error(`Refusing unsafe install target: ${target}`);
    await rename(target, backup);
    backedUp = true;
  }
  try {
    await rename(stage, target);
  } catch (error) {
    if (backedUp) {
      try { await rename(backup, target); }
      catch (rollbackError) { throw new Error(`Installation failed; rollback failed. Recover the previous skill from ${backup}: ${rollbackError.message}`, { cause: error }); }
    }
    throw error;
  }
  if (backedUp) await fs.rm(backup, { recursive: true });
}

export async function installSkill(options = {}) {
  const source = path.resolve(options.sourceDir ?? DEFAULT_SOURCE);
  const { stateDir, target } = targetFor(options);
  // The destination must not copy itself or consume/remove its own source.
  const canonicalSource = await canonicalPath(source);
  const canonicalState = await canonicalPath(stateDir);
  const canonicalTarget = await canonicalPath(target);
  if (isWithin(canonicalSource, canonicalState) || isWithin(canonicalTarget, canonicalSource)) throw new Error('Install destination and skill source must not overlap');
  await assertNoSymlinkAncestors(target);
  const entries = await collectSkillTree(source, { normalizeModes: true });
  validateSkillTree(entries);
  if (entries.some(entry => entry.path === MARKER)) throw new Error(`Source contains reserved installer marker: ${MARKER}`);
  const skillsDir = path.dirname(target);
  await fs.mkdir(skillsDir, { recursive: true });
  await assertNoSymlinkAncestors(skillsDir);
  const lock = path.join(skillsDir, `.${SKILL_NAME}.install-lock`);
  try { await fs.mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another installation may be running. If no installer is running, remove the stale lock: ${lock}`);
    throw error;
  }
  const token = randomUUID();
  const stage = path.join(skillsDir, `.${SKILL_NAME}.stage-${token}`);
  const backup = path.join(skillsDir, `.${SKILL_NAME}.backup-${token}`);
  const fingerprint = async () => {
    const stat = await lstatIfPresent(target);
    if (!stat) return null;
    const contents = await collectSkillTree(target);
    return `${stat.dev}:${stat.ino}:${treeHash(contents)}`;
  };
  try {
    const initial = await fingerprint();
    const current = await statusSkill({ stateDir });
    if (current.installed && !options.force) {
      if (!current.managed) throw new Error(`Refusing unowned skill directory: ${target}. Review it, then use --force to replace it.`);
      if (current.modified) throw new Error(`Installed skill has been modified: ${target}. Save your edits, then use --force to replace it.`);
    }
    await fs.mkdir(stage, { mode: 0o755 });
    for (const entry of entries) {
      const destination = path.join(stage, ...entry.path.split('/'));
      if (entry.type === 'directory') {
        await fs.mkdir(destination, { mode: entry.mode });
        await fs.chmod(destination, entry.mode);
      } else {
        await fs.writeFile(destination, entry.data, { flag: 'wx', mode: entry.mode });
        await fs.chmod(destination, entry.mode);
      }
    }
    const marker = { schema: 1, owner: SKILL_NAME, version: packageInfo.version, sha256: treeHash(entries), files: treeRecords(entries) };
    await fs.writeFile(path.join(stage, MARKER), `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
    // Recheck after staging so an unsafe replacement cannot be followed.
    await assertNoSymlinkAncestors(target);
    if (await fingerprint() !== initial) throw new Error('Installed skill changed while staging the update; your edits were preserved. Retry after saving a backup.');
    await replaceAtomically({ stage, target, backup });
    return await statusSkill({ stateDir });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
    await fs.rmdir(lock);
  }
}
