import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { importAsset } from '../skills/clawise-video-motionx/engine/cli/lib/assets.js';
import { openProject } from '../skills/clawise-video-motionx/engine/cli/lib/project.js';
import { findChrome } from '../skills/clawise-video-motionx/engine/cli/lib/browser.js';
import { render } from '../skills/clawise-video-motionx/engine/cli/lib/render.js';
import { loudness } from '../skills/clawise-video-motionx/engine/cli/lib/audio.js';
import { HAS_FFMPEG, makeFilm, luma } from './fixture-film.js';

test('imported image, TTS-shaped audio and companion footage render after source removal and relocation', {
  skip: !HAS_FFMPEG || !findChrome(), timeout: 60_000,
}, async (t) => {
  // Synthetic local fixtures test the tool-file handoff without paid generation.
  const original = mkdtempSync(join(tmpdir(), 'motionx-tool-output-'));
  const moved = mkdtempSync(join(tmpdir(), 'motionx-media-relocated-'));
  const { project, dir } = makeFilm({ duration: 1.2, video: false, sound: false });
  t.after(() => { for (const root of [original, moved, dir]) rmSync(root, { recursive: true, force: true }); });
  const media = {};
  for (const [kind, ext, input, extra, source] of [
    ['picture', 'png', 'color=c=red:s=64x48', ['-frames:v', '1'], 'clawise-image'],
    ['footage', 'mp4', 'color=c=yellow:s=64x48:d=0.6', [], 'shanqian-ai'],
    ['narration', 'wav', 'sine=frequency=440:duration=1.2', [], 'clawise-tts'],
  ]) {
    const file = join(original, `${kind}.${ext}`);
    const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', input, ...extra, file]);
    assert.equal(r.status, 0, r.stderr?.toString());
    media[kind] = await importAsset(project, { file, id: kind, source });
  }
  const html = readFileSync(project.index, 'utf8').replace('<div id="box"></div>', `
    <div id="box"></div>
    <img src="${media.picture.path}" style="position:absolute;left:0;top:0;width:160px;height:90px" />
    <video src="${media.footage.path}" data-start="0.3" data-media-start="0" data-duration="0.6" muted playsinline></video>
    <audio id="motionx-voice" src="${media.narration.path}" data-start="0" data-duration="1.2" data-volume="0.5"></audio>`);
  writeFileSync(project.index, html);
  const relocated = join(moved, '成片 project');
  cpSync(dir, relocated, { recursive: true });
  rmSync(original, { recursive: true });
  rmSync(dir, { recursive: true });
  const out = join(moved, 'verified.mp4');
  await render(openProject(relocated), { out, fps: 30, workers: 1, video: 'extract' });
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out], { encoding: 'utf8' });
  assert.equal(probe.status, 0);
  const metadata = JSON.parse(probe.stdout);
  assert.ok(metadata.streams.some((s) => s.codec_type === 'audio'));
  const sourceLoudness = loudness(join(relocated, media.narration.path)).lufs;
  const outputLoudness = loudness(out).lufs;
  assert.ok(Math.abs(outputLoudness - sourceLoudness + 6.02) < 0.5, `half-volume narration is preserved: ${sourceLoudness} -> ${outputLoudness}`);
  assert.ok(Math.abs(Number(metadata.format.duration) - 1.2) < 0.12);
  const red = luma(out, 0.5, 10, 10, 120, 60);
  const before = luma(out, 0.1, 170, 10, 120, 60);
  const during = luma(out, 0.5, 170, 10, 120, 60);
  assert.ok(red > 50 && red < 100, `imported image is visible: ${red}`);
  assert.ok(before < 50 && during > 180, `footage respects its timeline window: ${before} -> ${during}`);
  assert.equal(JSON.parse(readFileSync(join(relocated, 'assets/media.json'))).assets.length, 3);
});
