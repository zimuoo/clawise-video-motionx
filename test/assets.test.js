import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { importAsset } from '../skills/clawise-video-motionx/engine/cli/lib/assets.js';

const cli = resolve('skills/clawise-video-motionx/engine/cli/motionx.js');
const available = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'motionx-media-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const film = join(root, '产品 film');
  mkdirSync(film);
  writeFileSync(join(film, 'index.html'), '<html><body>unchanged composition</body></html>');
  const image = join(root, '插件 image.png');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x48', '-frames:v', '1', image]);
  assert.equal(r.status, 0, r.stderr?.toString());
  return { root, film, image };
}
function run(f, file, id = 'hero', source = 'clawise-image') {
  return spawnSync(process.execPath, [cli, 'asset', f.film, '--file', file, '--id', id, '--source', source], { encoding: 'utf8' });
}

test('image plugin output becomes a portable, verified asset with provenance', { skip: !available }, (t) => {
  const f = fixture(t);
  const result = run(f, f.image);
  assert.equal(result.status, 0, result.stderr);
  const asset = JSON.parse(result.stdout);
  assert.equal(asset.kind, 'image');
  assert.equal(asset.source, 'clawise-image');
  assert.equal(asset.width, 64);
  assert.equal(asset.height, 48);
  assert.match(asset.path, /^assets\/generated\/hero-[a-f0-9]{12}\.png$/);
  assert.deepEqual(readFileSync(join(f.film, asset.path)), readFileSync(f.image));
  const manifest = JSON.parse(readFileSync(join(f.film, 'assets/media.json')));
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.assets, [asset]);
  assert.ok(!JSON.stringify(manifest).includes(f.root), 'manifest must move with the project');
  assert.equal(readFileSync(join(f.film, 'index.html'), 'utf8'), '<html><body>unchanged composition</body></html>');
  assert.equal(run(f, f.image).status, 0, 'same import is idempotent');
  assert.equal(JSON.parse(readFileSync(join(f.film, 'assets/media.json'))).assets.length, 1);
});

test('TTS audio and Shanqian footage retain real durations and stream details', { skip: !available }, (t) => {
  const f = fixture(t);
  for (const [kind, source, ext, input] of [
    ['audio', 'clawise-tts', 'wav', 'sine=frequency=440:duration=0.4'],
    ['video', 'shanqian-ai', 'mp4', 'color=c=blue:s=64x48:d=0.6'],
  ]) {
    const file = join(f.root, `output.${ext}`);
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', input, file]).status, 0);
    const r = run(f, file, kind, source);
    assert.equal(r.status, 0, r.stderr);
    const asset = JSON.parse(r.stdout);
    assert.equal(asset.kind, kind);
    assert.equal(asset.source, source);
    assert.ok(asset.duration > 0.3 && asset.duration < 0.8);
    if (kind === 'audio') assert.ok(asset.sampleRate > 0);
    else assert.equal(asset.width, 64);
  }
});

test('an existing id cannot silently replace different media', { skip: !available }, (t) => {
  const f = fixture(t);
  assert.equal(run(f, f.image).status, 0);
  const before = readFileSync(join(f.film, 'assets/media.json'), 'utf8');
  const another = join(f.root, 'another.png');
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x48', '-frames:v', '1', another]).status, 0);
  const r = run(f, another);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already|exists|different/i);
  assert.equal(readFileSync(join(f.film, 'assets/media.json'), 'utf8'), before);
});

test('pending, empty, corrupt and unsafe inputs do not enter the manifest', { skip: !available }, (t) => {
  const f = fixture(t);
  const empty = join(f.root, 'empty.mp4');
  const fake = join(f.root, 'fake.png');
  writeFileSync(empty, '');
  writeFileSync(fake, '<html>generation pending</html>');
  for (const file of [join(f.root, 'not-finished.png'), empty, fake, 'https://example.com/image.png']) {
    assert.notEqual(run(f, file).status, 0, file);
  }
  assert.notEqual(run(f, f.image, '../outside').status, 0);
  assert.ok(!existsSync(join(f.film, 'assets/media.json')));
});

test('symlinked output directories cannot redirect media writes', { skip: !available || process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  const outside = join(f.root, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(f.film, 'assets'), 'dir');
  const r = run(f, f.image);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /symbolic|symlink/i);
  assert.ok(!existsSync(join(outside, 'generated')));
});

test('simultaneous imports never lose a successful manifest entry', { skip: !available }, async (t) => {
  const f = fixture(t);
  const results = await Promise.allSettled(['first', 'second'].map((id) => importAsset({ root: f.film }, { file: f.image, id })));
  const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.id);
  assert.ok(successful.length > 0);
  const manifest = JSON.parse(readFileSync(join(f.film, 'assets/media.json')));
  assert.deepEqual(manifest.assets.map((a) => a.id).sort(), successful.sort());
  for (const r of results.filter((r) => r.status === 'rejected')) assert.match(r.reason.message, /active|retry|concurrent/i);
  for (const id of ['first', 'second']) await importAsset({ root: f.film }, { file: f.image, id });
  assert.equal(JSON.parse(readFileSync(join(f.film, 'assets/media.json'))).assets.length, 2, 'retry preserves both entries');
});

test('manually edited media cannot be overwritten by a repeat import', { skip: !available }, (t) => {
  const f = fixture(t);
  const r = run(f, f.image);
  assert.equal(r.status, 0, r.stderr);
  const { path } = JSON.parse(r.stdout);
  writeFileSync(join(f.film, path), 'manual edit');
  const again = run(f, f.image);
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /edited/i);
  assert.equal(readFileSync(join(f.film, path), 'utf8'), 'manual edit');
});

test('truncated footage with valid metadata is rejected before manifest commit', { skip: !available }, (t) => {
  const f = fixture(t);
  const file = join(f.root, 'truncated.mp4');
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=128x96:duration=1', '-c:v', 'libx264', '-movflags', '+faststart', file]).status, 0);
  const bytes = readFileSync(file);
  writeFileSync(file, bytes.subarray(0, bytes.length - 400));
  assert.equal(spawnSync('ffprobe', ['-v', 'error', '-show_format', file]).status, 0, 'headers remain readable');
  const result = run(f, file, 'truncated', 'shanqian-ai');
  assert.notEqual(result.status, 0, 'incomplete stream must not count as completed footage');
  assert.ok(!existsSync(join(f.film, 'assets/media.json')));
});
