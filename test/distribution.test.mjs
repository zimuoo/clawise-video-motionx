import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,readdirSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
test('actual npm payload relocates and initializes every shipped template without source checkout files',async t=>{
 const dir=realpathSync(mkdtempSync(join(tmpdir(),'motionx-actual-payload-')));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const args=['pack','--ignore-scripts','--json','--pack-destination',dir];
 const npmCli=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const packed=process.platform==='win32'?spawnSync(process.execPath,[npmCli,...args],{cwd:root,encoding:'utf8'}):spawnSync('npm',args,{cwd:root,encoding:'utf8'});
 assert.ifError(packed.error);assert.equal(packed.status,0,packed.stderr);
 const [info]=JSON.parse(packed.stdout);
 const extract=spawnSync('tar',['-xzf',join(dir,info.filename),'-C',dir],{encoding:'utf8'});assert.equal(extract.status,0,extract.stderr);
 const engine=join(dir,'package/skills/clawise-video-motionx/engine');
 const {checkSource}=await import(pathToFileURL(join(engine,'cli/lib/check.js')).href);
 const templates=readdirSync(join(engine,'templates')).filter(n=>existsSync(join(engine,'templates',n,'index.html')));
 assert.equal(templates.length,12);
 for(const name of templates){
  const target=join(dir,'films',name);
  const child=spawnSync(process.execPath,[join(engine,'cli/motionx.js'),'new',target,'--template',name],{encoding:'utf8'});
  assert.equal(child.status,0,`${name}: ${child.stderr}`);
  const issues=checkSource({root:target,index:join(target,'index.html'),motionx:join(target,'.motionx')});
  assert.deepEqual(issues.filter(i=>i.level==='error'),[],name);
 }
});
