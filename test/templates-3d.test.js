import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../skills/clawise-video-motionx/engine/cli/lib/browser.js';
import { openFilm } from '../skills/clawise-video-motionx/engine/cli/lib/capture.js';
import { checkPage } from '../skills/clawise-video-motionx/engine/cli/lib/check.js';

const MX = join(dirname(fileURLToPath(import.meta.url)), '../skills/clawise-video-motionx/engine/cli/motionx.js');
const skip = !findChrome() && 'no Chrome';

for (const name of ['object-3d', 'ui-space']) {
  test(`template ${name}: a new project starts clean and its 3D frames are drawn`, { skip }, async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'motionx-tpl-')), name);
    assert.equal(spawnSync(process.execPath, [MX, 'new', dir, '--template', name]).status, 0);
    const project = { root: dir, index: join(dir, 'index.html'), motionx: join(dir, '.motionx') };
    const found = await checkPage(project, { samples: 6 });
    assert.deepEqual(found.filter((f) => f.level === 'error'), [], JSON.stringify(found));
    const film = await openFilm(project.index, {});
    try {
      await film.seek(4.5);
      // something is drawn there: distinct colours in the frame, not a blank slab. SVG artwork has fewer colours than a photograph.
      const colours = await film.evaluate(`(async () => {
        const c = document.querySelector('canvas');
        let src = c;
        if (!c) { return -1; }
        const t = document.createElement('canvas'); t.width = 192; t.height = 108;
        const g = t.getContext('2d'); g.drawImage(src, 0, 0, 192, 108);
        const d = g.getImageData(0, 0, 192, 108).data, set = new Set();
        for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4);
        return set.size;
      })()`);
      if (name === 'object-3d') {
        assert.ok(colours > 64, `the WebGL frame has ${colours} colours`);
        const current=await film.shot();
        await film.seek(.5);
        assert.notDeepEqual(await film.shot(),current,'the 3D camera produces distinct compositions at different times');
      }
      assert.deepEqual(film.errors, []);
    } finally { await film.close(); }
  });
}
