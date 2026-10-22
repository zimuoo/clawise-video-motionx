import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packagerUrl = new URL('../scripts/package.mjs', import.meta.url);
async function packager() {
  assert.equal(await fs.access(packagerUrl).then(() => true, () => false), true, 'the self-contained skill packager must exist');
  return import(packagerUrl);
}
async function fixture(t) {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'motionx-pack-')));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, 'skill');
  await fs.mkdir(path.join(sourceDir, 'engine', 'cli'), { recursive: true });
  const files = {
    'SKILL.md': '---\nname: clawise-video-motionx\n---\nRun engine/cli/motionx.js\n',
    'engine/package.json': JSON.stringify({ name: '@clawise/motionx-engine', version: '2.3.4', type: 'module' }),
    'engine/cli/motionx.js': 'console.log("relocatable");\n',
    'engine/vendor/three.js': 'Bundled dependency',
    'engine/fonts/My Font.ttf': 'Font bytes',
    'engine/fonts/LICENSE': 'Font license',
    'LICENSE': 'Project license',
    'THIRD_PARTY_NOTICES.md': 'Dependency provenance',
    'engine/test/unit.test.js': 'Test fixture',
    'engine/node_modules/dependency/index.js': 'External dependency',
    'engine/.history/old.html': 'Old film',
    'engine/dist/output.mp4': 'Build output',
    'engine/nested/SKILL.md': 'Do not create a separate nested skill',
    'engine/runtime/clip/test/clip.test.js': 'Nested runtime test',
    'engine/runtime/clip/clip.js': 'Required nested runtime',
    '.git/config': 'Repository metadata',
  };
  for (const [name, contents] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(sourceDir, name)), { recursive: true });
    await fs.writeFile(path.join(sourceDir, name), contents);
  }
  const packageFile = path.join(temp, 'package.json');
  await fs.writeFile(packageFile, JSON.stringify({ name: 'clawise-video-motionx', version: '1.0.0' }));
  return { temp, sourceDir, packageFile, outputDir: path.join(temp, 'dist') };
}

test('builds a deterministic self-contained ZIP that Python can extract and run', async t => {
  const f = await fixture(t);
  const api = await packager();
  const release = await api.packageSkill(f);
  assert.equal(path.basename(release.path), 'clawise-video-motionx-1.0.0.zip');
  const first = await fs.readFile(release.path);
  await api.packageSkill(f);
  assert.deepEqual(await fs.readFile(release.path), first);
  const extractDir = path.join(f.temp, 'extracted');
  const unzip = spawnSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist())); z.extractall(sys.argv[2])', release.path, extractDir], { encoding: 'utf8' });
  assert.equal(unzip.status, 0, unzip.stderr);
  const names = JSON.parse(unzip.stdout);
  assert.ok(names.every(name => name.startsWith('clawise-video-motionx/')));
  assert.ok(names.includes('clawise-video-motionx/engine/vendor/three.js'));
  assert.ok(names.includes('clawise-video-motionx/engine/fonts/My Font.ttf'));
  assert.ok(names.includes('clawise-video-motionx/engine/fonts/LICENSE'));
  assert.ok(names.includes('clawise-video-motionx/engine/runtime/clip/clip.js'));
  assert.equal(names.filter(name => name.endsWith('/SKILL.md')).length, 1);
  assert.ok(!names.some(name => /\/(?:test|node_modules|\.git|\.history|dist)\//.test(name)));
  const relocated = path.join(extractDir, 'clawise-video-motionx');
  const run = spawnSync(process.execPath, [path.join(relocated, 'engine', 'cli', 'motionx.js')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'relocatable');
  const manifest = JSON.parse(await fs.readFile(path.join(relocated, '.motionx-package.json'), 'utf8'));
  assert.deepEqual(manifest.engine, { name: '@clawise/motionx-engine', version: '2.3.4' });
  assert.equal(manifest.package.version, '1.0.0');
  assert.ok(manifest.files.every(file => file.sha256.length === 64));
});

test('packaging rejects symlinks instead of dereferencing outside files', async t => {
  const f = await fixture(t);
  const api = await packager();
  await fs.writeFile(path.join(f.temp, 'secret'), 'No outside assets');
  await fs.symlink(path.join(f.temp, 'secret'), path.join(f.sourceDir, 'outside.txt'));
  await assert.rejects(api.packageSkill(f), /symbolic|symlink/i);
  assert.equal(await fs.access(f.outputDir).then(() => true, () => false), false);
});

test('packaging rejects unsafe archive names and incomplete source', async t => {
  const f = await fixture(t);
  const api = await packager();
  for (const name of ['../escape', '/absolute', 'a\\b', 'a/../b', 'C:/root', 'bad\nname']) assert.throws(() => api.assertSafeArchivePath(name), /unsafe/i);
  await fs.unlink(path.join(f.sourceDir, 'engine', 'cli', 'motionx.js'));
  await assert.rejects(api.packageSkill(f), /required|engine\/cli\/motionx.js/i);
});

test('npm metadata exposes one executable with no dependencies and a release whitelist', async () => {
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(metadata.name, 'clawise-video-motionx');
  assert.equal(metadata.version, '1.0.0');
  assert.equal(metadata.type, 'module');
  assert.deepEqual(metadata.bin, { motionx: 'cli/motionx.js' });
  assert.equal(metadata.engines.node, '>=22');
  assert.deepEqual(metadata.dependencies ?? {}, {});
  assert.deepEqual(metadata.devDependencies ?? {}, {});
  assert.ok(metadata.files.includes('skills/clawise-video-motionx/'));
  assert.ok(!metadata.files.includes('test/'));
  assert.equal(metadata.scripts['pack:skill'], 'node scripts/package.mjs');
});

test('npm tarball contains a runnable complete skill and excludes development artifacts', async t => {
  const f = await fixture(t);
  const sandbox = path.join(f.temp, 'npm-package');
  await fs.mkdir(path.join(sandbox, 'cli'), { recursive: true });
  await fs.mkdir(path.join(sandbox, 'skills'), { recursive: true });
  await fs.copyFile(path.join(root, 'package.json'), path.join(sandbox, 'package.json'));
  for (const filename of ['motionx.js', 'install.js']) await fs.copyFile(path.join(root, 'cli', filename), path.join(sandbox, 'cli', filename));
  await fs.cp(f.sourceDir, path.join(sandbox, 'skills', 'clawise-video-motionx'), { recursive: true });
  await fs.writeFile(path.join(sandbox, 'README.md'), 'Readme');
  await fs.writeFile(path.join(sandbox, 'LICENSE'), 'License');
  await fs.writeFile(path.join(sandbox, 'THIRD_PARTY_NOTICES.md'), 'Notices');
  await fs.mkdir(path.join(sandbox, 'test'));
  await fs.writeFile(path.join(sandbox, 'test', 'private.test.js'), 'Development');
  // npm.cmd is a shell wrapper on Windows. Run npm's JS entry through Node
  // so the fixture exercises the same literal-argument policy as the installer.
  const npmArgs = ['pack', '--ignore-scripts', '--json'];
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const pack = process.platform === 'win32'
    ? spawnSync(process.execPath, [npmCli, ...npmArgs], { cwd: sandbox, encoding: 'utf8' })
    : spawnSync('npm', npmArgs, { cwd: sandbox, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  const [release] = JSON.parse(pack.stdout);
  const names = release.files.map(file => file.path);
  assert.ok(names.includes('skills/clawise-video-motionx/SKILL.md'));
  assert.ok(names.includes('skills/clawise-video-motionx/engine/runtime/clip/clip.js'));
  assert.ok(names.includes('skills/clawise-video-motionx/engine/fonts/LICENSE'));
  assert.ok(names.includes('THIRD_PARTY_NOTICES.md'));
  assert.equal(names.filter(name => name.endsWith('/SKILL.md')).length, 1);
  assert.ok(!names.some(name => /(?:^|\/)(?:test|node_modules|\.git|\.history|dist)\//.test(name)));
  const extractDir = path.join(f.temp, 'npm-unpacked');
  await fs.mkdir(extractDir);
  const extract = spawnSync('tar', ['-xzf', path.join(sandbox, release.filename), '-C', extractDir], { encoding: 'utf8' });
  assert.equal(extract.status, 0, extract.stderr);
  const cli = path.join(extractDir, 'package', 'cli', 'motionx.js');
  const stateDir = path.join(f.temp, 'packed-install');
  const install = spawnSync(process.execPath, [cli, 'install', '--state-dir', stateDir, '--json'], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr);
  assert.equal(JSON.parse(install.stdout).modified, false);
  const engine = spawnSync(process.execPath, [path.join(stateDir, 'skills', 'clawise-video-motionx', 'engine', 'cli', 'motionx.js')], { encoding: 'utf8' });
  assert.equal(engine.status, 0, engine.stderr);
  assert.equal(engine.stdout.trim(), 'relocatable');
});
