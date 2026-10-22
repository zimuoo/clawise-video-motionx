import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,symlinkSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {spawnSync} from 'node:child_process';
import {startStudio} from '../skills/clawise-video-motionx/engine/cli/lib/server.js';
import {openProject} from '../skills/clawise-video-motionx/engine/cli/lib/project.js';
function project(){const dir=mkdtempSync(join(tmpdir(),'motionx-studio-'));writeFileSync(join(dir,'index.html'),`<!doctype html><html data-composition-variables='[{"id":"title","type":"string","default":"Clawise"}]'><div data-composition-id="film" data-width="320" data-height="180"><h1 data-var-text="title">Clawise</h1></div></html>`);return openProject(dir);}
test('studio is local, rejects forged hosts/untokened writes, preserves stale edits, and serves Clawise UI',async t=>{
 const p=project();const s=await startStudio(p,{port:0});t.after(()=>s.close());
 assert.equal(s.server.address().address,'127.0.0.1');const url=`http://127.0.0.1:${s.server.address().port}`;
 const html=await fetch(url).then(r=>r.text());assert.match(html,/Clawise|clawise/);assert.doesNotMatch(html,/huashu/i);
 const csrf=/"csrf":"([a-f0-9]+)"/.exec(html)[1];const state=await fetch(url+'/api/state').then(r=>r.json());
 const bad=await fetch(url+'/api/vars',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:{title:'Bad'}})});assert.equal(bad.status,403);
 const changed=await fetch(url+'/api/vars',{method:'POST',headers:{'Content-Type':'application/json','x-motionx-token':csrf},body:JSON.stringify({token:state.token,values:{title:'Clawise updated'}})});assert.equal(changed.status,200);
 const stale=await fetch(url+'/api/vars',{method:'POST',headers:{'Content-Type':'application/json','x-motionx-token':csrf},body:JSON.stringify({token:state.token,values:{title:'Lost'}})});assert.equal(stale.status,409);assert.match(readFileSync(p.index,'utf8'),/Clawise updated/);
 const status=await new Promise((resolve,reject)=>{const req=request(url,{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(status,403);
});
test('studio never serves a project symlink to a file outside its root',async t=>{
 const p=project();const secret=join(mkdtempSync(join(tmpdir(),'motionx-private-')),'secret.txt');writeFileSync(secret,'Private');symlinkSync(secret,join(p.root,'linked.txt'));
 const s=await startStudio(p,{port:0});t.after(()=>s.close());
 const r=await fetch(`http://127.0.0.1:${s.server.address().port}/p/linked.txt`);assert.equal(r.status,403);
});

test('a busy preview port releases watchers so a failed launch can exit',()=>{
 const p=project();
 const code=`import {createServer} from 'node:http'; import {startStudio} from ${JSON.stringify(new URL('../skills/clawise-video-motionx/engine/cli/lib/server.js',import.meta.url).href)}; const holder=createServer(); await new Promise(r=>holder.listen(0,'127.0.0.1',r)); try { await startStudio(${JSON.stringify(p)},{port:holder.address().port}); } catch(error) { if(error.code!=='EADDRINUSE')throw error; } await new Promise(r=>holder.close(r));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:3000});
 assert.equal(child.error,undefined,child.error?.message);assert.equal(child.status,0,child.stderr);
});
