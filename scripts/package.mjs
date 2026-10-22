import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SKILL_NAME, DEFAULT_SOURCE, MARKER, assertSafeRelativePath, collectSkillTree, validateSkillTree, assertNoSymlinkAncestors, canonicalPath } from '../cli/install.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE_MANIFEST = '.motionx-package.json';
const excludedDirectories = new Set(['.git', 'node_modules', 'test', 'tests', '__tests__', 'research', '.history', 'history', '.motionx-history', '.cache', '__pycache__', 'dist', 'build', 'coverage', '.next', '.turbo']);
export const assertSafeArchivePath = assertSafeRelativePath;

function includeInRelease(relative, isDirectory) {
  const parts = relative.split('/');
  if (parts.some(part => excludedDirectories.has(part))) return false;
  if (parts.at(-1) === '.DS_Store' || relative === MARKER || relative === PACKAGE_MANIFEST) return false;
  if (!isDirectory && parts.at(-1) === 'SKILL.md' && relative !== 'SKILL.md') return false;
  return !/\.(?:pyc|log|tgz|zip)$/.test(relative) && !/\.test\.[^/]+$/.test(relative);
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

// Store entries without external ZIP libraries. Fixed DOS timestamps and sorted
// paths keep byte-identical releases reproducible across machines and runs.
export function createZip(files) {
  if (files.length > 0xffff) throw new Error('ZIP has too many entries; ZIP64 is not supported');
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    assertSafeArchivePath(file.path);
    const name = Buffer.from(file.path, 'utf8');
    const data = file.data;
    if (name.length > 0xffff || data.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP entry exceeds classic ZIP limits');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8 filenames
    local.writeUInt16LE(0x2821, 12); // 2000-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x314, 4); // UNIX creator, ZIP 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0x2821, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((0o100000 | (file.mode ?? 0o644)) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  if (offset + centralSize > 0xffffffff) throw new Error('ZIP exceeds classic ZIP limits');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

export async function packageSkill({ sourceDir = DEFAULT_SOURCE, outputDir = path.join(ROOT, 'dist'), packageFile = path.join(ROOT, 'package.json') } = {}) {
  const metadata = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  if (metadata.name !== SKILL_NAME || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(metadata.version ?? '')) throw new Error('Release requires the expected package name and a safe semantic version');
  const entries = await collectSkillTree(sourceDir, { normalizeModes: true, include: includeInRelease });
  const engine = validateSkillTree(entries);
  const files = entries.filter(entry => entry.type === 'file');
  const manifest = {
    schema: 1,
    package: { name: metadata.name, version: metadata.version },
    engine: { name: engine.name, version: engine.version },
    files: files.map(({ path: relative, size, sha256, mode }) => ({ path: relative, size, sha256, mode })),
  };
  files.push({ path: PACKAGE_MANIFEST, data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), mode: 0o644 });
  const data = createZip(files.map(file => ({ ...file, path: `${SKILL_NAME}/${file.path}` })));
  const resolvedOutput = await canonicalPath(outputDir);
  const resolvedSource = await canonicalPath(sourceDir);
  if (resolvedOutput === resolvedSource || resolvedOutput.startsWith(`${resolvedSource}${path.sep}`)) throw new Error('Release output must be outside the skill source');
  await assertNoSymlinkAncestors(resolvedOutput);
  await fs.mkdir(resolvedOutput, { recursive: true });
  const archivePath = path.join(resolvedOutput, `${metadata.name}-${metadata.version}.zip`);
  await assertNoSymlinkAncestors(archivePath);
  const temporary = `${archivePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data, { flag: 'wx' });
    await fs.rename(temporary, archivePath);
  } finally { await fs.rm(temporary, { force: true }); }
  return { path: archivePath, bytes: data.length, files: files.length, sha256: createHash('sha256').update(data).digest('hex') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageSkill().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => {
    process.stderr.write(`pack:skill: ${error.message}\n`);
    process.exitCode = 1;
  });
}
