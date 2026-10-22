import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const installerUrl = new URL('../cli/install.js', import.meta.url);
async function installer() {
  assert.equal(await fs.access(installerUrl).then(() => true, () => false), true, 'the safe installer module must exist');
  return import(installerUrl);
}
async function fixture(t) {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'motionx-install-')));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const sourceDir = path.join(temp, 'source');
  await fs.mkdir(path.join(sourceDir, 'engine', 'cli'), { recursive: true });
  await fs.mkdir(path.join(sourceDir, 'engine', 'fonts'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '---\nname: clawise-video-motionx\n---\nAn isolated skill.\n');
  await fs.writeFile(path.join(sourceDir, 'engine', 'package.json'), JSON.stringify({ name: 'motionx-engine', version: '1.0.0', type: 'module', scripts: { install: 'exit 99' } }));
  await fs.writeFile(path.join(sourceDir, 'engine', 'cli', 'motionx.js'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  await fs.writeFile(path.join(sourceDir, 'engine', 'fonts', 'LICENSE'), 'Font license');
  const stateDir = path.join(temp, 'state');
  return { temp, sourceDir, stateDir, target: path.join(stateDir, 'skills', 'clawise-video-motionx') };
}

test('installs the complete skill and reports managed version and clean content', async t => {
  const f = await fixture(t);
  const api = await installer();
  assert.equal((await api.statusSkill(f)).installed, false);
  const result = await api.installSkill(f);
  assert.equal(result.installed, true);
  assert.equal(result.managed, true);
  assert.equal(result.modified, false);
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(result.version, metadata.version);
  assert.equal(await fs.readFile(path.join(f.target, 'engine', 'fonts', 'LICENSE'), 'utf8'), 'Font license');
  assert.match(await fs.readFile(path.join(f.target, '.motionx-install.json'), 'utf8'), /sha256/);
});

test('preserves unrelated skills and config across install and update', async t => {
  const f = await fixture(t);
  const api = await installer();
  const other = path.join(f.stateDir, 'skills', 'other', 'SKILL.md');
  await fs.mkdir(path.dirname(other), { recursive: true });
  await fs.writeFile(other, 'User skill');
  await fs.writeFile(path.join(f.stateDir, 'config.json'), '{"keep":true}');
  await api.installSkill(f);
  await fs.writeFile(path.join(f.sourceDir, 'new-reference.md'), 'New release');
  await api.installSkill({ ...f, operation: 'update' });
  assert.equal(await fs.readFile(path.join(f.target, 'new-reference.md'), 'utf8'), 'New release');
  assert.equal(await fs.readFile(other, 'utf8'), 'User skill');
  assert.equal(await fs.readFile(path.join(f.stateDir, 'config.json'), 'utf8'), '{"keep":true}');
});

test('refuses local edits, deletion and additions unless force is explicit', async t => {
  const f = await fixture(t);
  const api = await installer();
  await api.installSkill(f);
  await fs.writeFile(path.join(f.target, 'SKILL.md'), 'User edit');
  assert.equal((await api.statusSkill(f)).modified, true);
  await assert.rejects(api.installSkill(f), /modified|edited/i);
  assert.equal(await fs.readFile(path.join(f.target, 'SKILL.md'), 'utf8'), 'User edit');
  await api.installSkill({ ...f, force: true });
  await fs.unlink(path.join(f.target, 'engine', 'fonts', 'LICENSE'));
  assert.equal((await api.statusSkill(f)).modified, true);
  await api.installSkill({ ...f, force: true });
  await fs.mkdir(path.join(f.target, 'user-empty-directory'));
  assert.equal((await api.statusSkill(f)).modified, true);
  await assert.rejects(api.installSkill(f), /modified|edited/i);
});

test('refuses an unowned directory unless force is explicit', async t => {
  const f = await fixture(t);
  const api = await installer();
  await fs.mkdir(f.target, { recursive: true });
  await fs.writeFile(path.join(f.target, 'mine.txt'), 'Do not replace');
  assert.equal((await api.statusSkill(f)).managed, false);
  await assert.rejects(api.installSkill(f), /unowned|unmanaged/i);
  assert.equal(await fs.readFile(path.join(f.target, 'mine.txt'), 'utf8'), 'Do not replace');
  await api.installSkill({ ...f, force: true });
  assert.equal((await api.statusSkill(f)).managed, true);
});

test('rejects source symlinks, linked targets and linked state directories even with force', async t => {
  const f = await fixture(t);
  const api = await installer();
  const outside = path.join(f.temp, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'private.txt'), 'Private');
  await fs.symlink(path.join(outside, 'private.txt'), path.join(f.sourceDir, 'linked.txt'));
  await assert.rejects(api.installSkill(f), /symbolic|symlink/i);
  await fs.unlink(path.join(f.sourceDir, 'linked.txt'));
  await fs.mkdir(path.dirname(f.target), { recursive: true });
  await fs.symlink(outside, f.target);
  await assert.rejects(api.installSkill({ ...f, force: true }), /symbolic|symlink/i);
  await fs.unlink(f.target);
  await fs.rm(f.stateDir, { recursive: true });
  await fs.symlink(outside, f.stateDir);
  await assert.rejects(api.installSkill({ ...f, force: true }), /symbolic|symlink/i);
  assert.equal(await fs.readFile(path.join(outside, 'private.txt'), 'utf8'), 'Private');
});

test('rejects incomplete sources and paths that overlap the source', async t => {
  const f = await fixture(t);
  const api = await installer();
  await fs.unlink(path.join(f.sourceDir, 'engine', 'package.json'));
  await assert.rejects(api.installSkill(f), /engine\/package.json|required/i);
  assert.equal(await fs.access(f.stateDir).then(() => true, () => false), false);
  await fs.writeFile(path.join(f.sourceDir, 'engine', 'package.json'), '{"name":"engine","version":"1.0.0"}');
  await assert.rejects(api.installSkill({ ...f, stateDir: f.sourceDir }), /overlap|inside|source/i);
});

test('rolls back the old installation if the staged replacement cannot be renamed', async t => {
  const f = await fixture(t);
  const api = await installer();
  const stage = path.join(f.temp, 'stage');
  const target = path.join(f.temp, 'target');
  const backup = path.join(f.temp, 'backup');
  await fs.mkdir(stage);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'old.txt'), 'Original');
  const rename = async (from, to) => {
    if (from === stage) throw Object.assign(new Error('Simulated disk failure'), { code: 'EIO' });
    return fs.rename(from, to);
  };
  await assert.rejects(api.replaceAtomically({ stage, target, backup, rename }), /Simulated disk failure/);
  assert.equal(await fs.readFile(path.join(target, 'old.txt'), 'utf8'), 'Original');
  assert.equal(await fs.access(backup).then(() => true, () => false), false);
});

test('resolves state directory by explicit option, Clawise, OpenClaw then home', async () => {
  const api = await installer();
  const env = { CLAWISE_STATE_DIR: '/clawise', OPENCLAW_STATE_DIR: '/openclaw' };
  assert.equal(api.resolveStateDir({ stateDir: '/explicit', env, home: '/home/example' }), path.resolve('/explicit'));
  assert.equal(api.resolveStateDir({ env, home: '/home/example' }), path.resolve('/clawise'));
  assert.equal(api.resolveStateDir({ env: { OPENCLAW_STATE_DIR: '/openclaw' }, home: '/home/example' }), path.resolve('/openclaw'));
  assert.equal(api.resolveStateDir({ env: {}, home: '/home/example' }), path.resolve('/home/example/.clawise'));
});

test('root CLI import has no engine execution or filesystem side effects', async t => {
  const f = await fixture(t);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(path.join(root, 'cli', 'motionx.js')).href)});`], { encoding: 'utf8', env: { ...process.env, CLAWISE_STATE_DIR: f.stateDir } });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
  assert.equal(await fs.access(f.stateDir).then(() => true, () => false), false);
});

test('CLI forwards literal engine arguments without a shell', async t => {
  const f = await fixture(t);
  const sandbox = path.join(f.temp, 'package');
  await fs.mkdir(path.join(sandbox, 'cli'), { recursive: true });
  await fs.copyFile(path.join(root, 'package.json'), path.join(sandbox, 'package.json'));
  for (const filename of ['motionx.js', 'install.js']) await fs.copyFile(path.join(root, 'cli', filename), path.join(sandbox, 'cli', filename));
  await fs.mkdir(path.join(sandbox, 'skills'), { recursive: true });
  await fs.cp(f.sourceDir, path.join(sandbox, 'skills', 'clawise-video-motionx'), { recursive: true });
  const evil = `$(touch ${path.join(f.temp, 'shell-was-used')})`;
  const child = spawnSync(process.execPath, [path.join(sandbox, 'cli', 'motionx.js'), 'render', 'a b', evil], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ['render', 'a b', evil]);
  assert.equal(await fs.access(path.join(f.temp, 'shell-was-used')).then(() => true, () => false), false);
  const status = spawnSync(process.execPath, [path.join(sandbox, 'cli', 'motionx.js'), 'status', '--state-dir', f.stateDir, '--json'], { encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).installed, false);
  const install = spawnSync(process.execPath, [path.join(sandbox, 'cli', 'motionx.js'), 'install', '--state-dir', f.stateDir, '--json'], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stderr);
  assert.equal(JSON.parse(install.stdout).modified, false);
  const invalid = spawnSync(process.execPath, [path.join(sandbox, 'cli', 'motionx.js'), 'install', '--state-dri', '/oops'], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /unknown|unsupported/i);
});

test('updates preserve edits saved while the new version is staging',async t=>{
 const f=await fixture(t);const api=await installer();await api.installSkill(f);
 for(let i=0;i<80;i++)await fs.writeFile(path.join(f.sourceDir,`staging-${i}.md`),'New release');
 const {readdirSync,writeFileSync}=await import('node:fs');let changed=false;
 // Poll the actual staging directory: macOS fs.watch batches events and can
 // report its creation only after the entire update has finished.
 const observer=setInterval(()=>{
  if(!changed&&readdirSync(path.dirname(f.target)).some(name=>name.includes('.stage-'))){changed=true;writeFileSync(path.join(f.target,'SKILL.md'),'User saved during update');}
 },1);t.after(()=>clearInterval(observer));
 await assert.rejects(api.installSkill(f),/changed|modified|edited/i);
 assert.equal(changed,true,'the edit must happen during the update');
 assert.equal(await fs.readFile(path.join(f.target,'SKILL.md'),'utf8'),'User saved during update');
});

test('overlap checks resolve case aliases of existing ancestors',async t=>{
 const f=await fixture(t);const api=await installer();const alias=path.join(f.temp,'SOURCE');
 if(!await fs.access(alias).then(()=>true,()=>false)){t.skip('case sensitive filesystem');return;}
 await assert.rejects(api.installSkill({...f,stateDir:path.join(alias,'state')}),/overlap|source/i);
});

test('ownership hashes use Windows content semantics and retain POSIX mode checks',async()=>{
 const api=await installer();const a=[{path:'bin/motionx',type:'file',mode:0o755,size:1,sha256:'a'},{path:'engine',type:'directory',mode:0o755}];
 const b=a.map(e=>({...e,mode:e.type==='directory'?0o777:0o666}));
 assert.equal(api.treeHash(a,{platform:'win32'}),api.treeHash(b,{platform:'win32'}));
 assert.notEqual(api.treeHash(a,{platform:'linux'}),api.treeHash(b,{platform:'linux'}));
});
