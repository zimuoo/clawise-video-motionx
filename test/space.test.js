import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../skills/clawise-video-motionx/engine/cli/lib/browser.js';
import { openFilm } from '../skills/clawise-video-motionx/engine/cli/lib/capture.js';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '../skills/clawise-video-motionx/engine');
const skip = !findChrome() && 'no Chrome';

// A page world: a flat card, a lifted and turned panel with a dot inside, and one camera move back to flat.
function spaceFilm(script) {
  const dir = mkdtempSync(join(tmpdir(), 'motionx-space-'));
  mkdirSync(join(dir, 'vendor'));
  copyFileSync(join(PKG, 'runtime/motionx-timeline.js'), join(dir, 'vendor/motionx-timeline.js'));
  copyFileSync(join(PKG, 'runtime/motionx.js'), join(dir, 'vendor/motionx.js'));
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<script src="vendor/motionx-timeline.js"></script><script src="vendor/motionx.js"></script>
<style>html,body{margin:0}#film{position:relative;width:1920px;height:1080px;overflow:hidden;background:#eee}
#a{position:absolute;left:300px;top:200px;width:600px;height:400px;background:#d97757}
#b{position:absolute;left:1100px;top:300px;width:400px;height:300px;background:#333;transform:translateZ(200px) rotateY(30deg)}
#c{position:absolute;left:100px;top:100px;width:50px;height:50px;background:#fff}</style></head><body>
<div id="film" data-composition-id="film" data-width="1920" data-height="1080"><div id="world"><div id="a"></div><div id="b"><i id="c"></i></div></div></div>
<script>
const tl = MotionX.timeline({ paused: true });
window.__timelines = window.__timelines || {}; window.__timelines.film = tl;
const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); };
${script}
</script></body></html>`);
  return join(dir, 'index.html');
}

test('MX.space: the resting pose is the flat layout, fit frames an element, a move ends exactly flat at any seek order', { skip }, async () => {
  const film = await openFilm(spaceFilm(`
    const cam = MX.space('#world', { fov: 35 });
    window.flat = box('#a');
    window.locC = cam.locate('#c');
    cam.set({ fit: '#a', pad: 0 });
    window.fit = box('#a');
    cam.set({ fit: '#a', pad: 0, yaw: 30, pitch: 15 });
    cam.to(tl, 1, { flat: true, duration: 1 });
    tl.to({}, { duration: 1 }, 2);`), {});
  try {
    assert.deepEqual(await film.evaluate('window.flat'), [300, 200, 600, 400]);
    // a 600×400 card fit with no padding fills the 1080 height, centred
    assert.deepEqual(await film.evaluate('window.fit'), [150, 0, 1620, 1080]);
    // the dot inside the turned, lifted panel: its centre carried through translateZ(200) rotateY(30°)
    const c = await film.evaluate('window.locC');
    assert.ok(Math.abs(c.x - (1300 - 75 * Math.cos(Math.PI / 6))) < 0.01 && Math.abs(c.z - 237.5) < 0.01, JSON.stringify(c));
    // the pose is a function of time: the end is flat whether we get there from 0 or come back from later
    await film.seek(2.5);
    assert.deepEqual(await film.evaluate('box("#a")'), [300, 200, 600, 400]);
    await film.seek(0);
    const start = await film.evaluate('box("#a")');
    assert.notDeepEqual(start, [300, 200, 600, 400]);
    await film.seek(1.5);
    const mid = await film.evaluate('box("#a")');
    await film.seek(0.2); await film.seek(1.5);
    assert.deepEqual(await film.evaluate('box("#a")'), mid);
    assert.deepEqual(film.errors, []);
  } finally { await film.close(); }
});

test('MX.space: the same pose drives a Three-style camera (position, look direction, fov)', { skip }, async () => {
  // a stand-in with the parts of THREE.PerspectiveCamera the camera touches
  const film = await openFilm(spaceFilm(`
    class M { makeBasis(x, y, z) { this.b = [x, y, z]; return this; } }
    const cam3 = { isPerspectiveCamera: true, fov: 30, aspect: 1, matrix: new M(),
      position: { set(x, y, z) { Object.assign(this, { x, y, z }); } },
      quaternion: { setFromRotationMatrix(m) { cam3.basis = m.b; } },
      updateProjectionMatrix() { cam3.updated = true; }, updateMatrixWorld() {} };
    const cam = MX.space(cam3, { fov: 30 });
    cam.set({ target: [0, 1, 0], distance: 10, yaw: 90, pitch: 0 });
    window.r = { p: { ...cam3.position }, back: cam3.basis[2], fov: cam3.fov, aspect: cam3.aspect };
    cam.set({ target: [0, 0, 0], distance: 10, yaw: 0, pitch: 30 });
    window.r2 = { p: { ...cam3.position } };
    tl.to({}, { duration: 1 });`), {});
  try {
    const r = await film.evaluate('window.r');
    // yaw 90: standing on +x, looking back along -x (the basis's z axis points away from the view: +x)
    assert.ok(Math.abs(r.p.x - 10) < 1e-6 && Math.abs(r.p.y - 1) < 1e-6 && Math.abs(r.p.z) < 1e-6, JSON.stringify(r));
    assert.ok(Math.abs(r.back.x - 1) < 1e-6, JSON.stringify(r.back));
    assert.equal(r.fov, 30);
    assert.ok(Math.abs(r.aspect - 16 / 9) < 1e-9);
    // pitch 30: above the target (y up in Three)
    const r2 = await film.evaluate('window.r2');
    assert.ok(Math.abs(r2.p.y - 5) < 1e-6 && Math.abs(r2.p.z - 10 * Math.cos(Math.PI / 6)) < 1e-6, JSON.stringify(r2));
  } finally { await film.close(); }
});

test('MX.space: replacing the camera clock preserves unrelated tweens across multiple moves', { skip }, async () => {
  const film = await openFilm(spaceFilm(`
    window.marker = { x: 0 };
    tl.to(window.marker, { x: 100, duration: 4, ease: 'none' }, 0);
    const cam = MX.space('#world', { fov: 35 });
    cam.set({ target: [600, 400, 0], distance: 1000, yaw: 30 });
    cam.to(tl, 0, { yaw: -20, duration: 1, ease: 'none' });
    cam.to(tl, 1, { yaw: 15, distance: 1600, duration: 1, ease: 'none' });
    cam.to(tl, 2, { flat: true, duration: 1, ease: 'none' });
    window.childCount = tl.getChildren().length;
    tl.to({}, { duration: 1 }, 3);
  `), {});
  try {
    assert.equal(await film.evaluate('window.childCount'), 2, 'one unrelated tween and one camera clock');
    for (const [time, value] of [[3.5, 87.5], [.5, 12.5], [1.5, 37.5], [0, 0], [3.5, 87.5]]) {
      await film.seek(time);
      assert.equal(await film.evaluate('window.marker.x'), value, 'unrelated tween at ' + time);
    }
    assert.deepEqual(await film.evaluate('box("#a")'), [300, 200, 600, 400]);
    await film.seek(1.5);
    const mid = await film.evaluate('box("#a")');
    await film.seek(0); await film.seek(1.5);
    assert.deepEqual(await film.evaluate('box("#a")'), mid);
    assert.deepEqual(film.errors, []);
  } finally { await film.close(); }
});

test('MX.camera: future moves preserve the current zoom and deterministic backward seeks', { skip }, async () => {
  const film = await openFilm(spaceFilm(`
    const cam = MX.camera('#world', { width: 1920, height: 1080 });
    cam.to(tl, 0, { zoom: 2, duration: 1, ease: 'none' });
    cam.to(tl, 2, { zoom: 4, duration: 1, ease: 'none' });
    window.cameraZoom = () => cam.zoom();
  `), {});
  try {
    for (const [time, expected] of [[.5, Math.sqrt(2)], [1, 2], [1.5, 2], [2.5, Math.sqrt(8)], [3, 4], [0, 1], [.5, Math.sqrt(2)]]) {
      await film.seek(time);
      const actual = await film.evaluate('window.cameraZoom()');
      assert.ok(Math.abs(actual - expected) < 1e-8, `zoom at ${time}: ${actual} != ${expected}`);
    }
    assert.deepEqual(film.errors, []);
  } finally { await film.close(); }
});
