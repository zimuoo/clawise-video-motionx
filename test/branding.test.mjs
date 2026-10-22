import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const skill=join(root,'skills/clawise-video-motionx');
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]); }
test('distributed user-facing code and guidance carry Clawise branding',()=>{
 const allowed=/LICENSE|OFL\.txt|THIRD_PARTY|NOTICE|provenance\.md|LICENSES\.md/;
 const offenders=[];
 for(const f of files(skill)){
  if(allowed.test(f)||!/\.(?:js|mjs|html|md|json|yaml)$/.test(f)||f.endsWith('three.min.js'))continue;
  if(/huashu|花叔|alchaincyf|豆子花叔|TOON\.bean|GSAP|gsap/i.test(readFileSync(f,'utf8')))offenders.push(relative(root,f));
 }
 assert.deepEqual(offenders,[],'original promotion, restricted assets, and GSAP must be absent');
});
test('engine signature is disabled by default and only opts into Clawise',()=>{
 const code=readFileSync(join(skill,'engine/runtime/motionx-engine.js'),'utf8');
 assert.match(code,/getAttribute\('data-mx-signature'\) \|\| 'off'/);
 assert.match(code,/Clawise/);
});
test('restricted character and original promo templates are excluded',()=>{
 assert.equal(existsSync(join(skill,'engine/templates/storytime')),false);
 assert.equal(existsSync(join(skill,'engine/runtime/clip/grammars/y4_storytime.js')),false);
 assert.equal(existsSync(join(skill,'references/about-author.md')),false);
 const toon=readFileSync(join(skill,'engine/runtime/clip/lib/toon.js'),'utf8');
 assert.doesNotMatch(toon,/TOON\.bean|豆子|花叔/);
});
