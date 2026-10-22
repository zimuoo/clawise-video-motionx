import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {stateDir,motionxHome,cacheDir} from '../skills/clawise-video-motionx/engine/cli/lib/state.js';
test('MotionX personal data follows Clawise state directory precedence',()=>{
 assert.equal(stateDir({CLAWISE_STATE_DIR:'/a',OPENCLAW_STATE_DIR:'/b'},'/home/test'),resolve('/a'));
 assert.equal(stateDir({OPENCLAW_STATE_DIR:'/b'},'/home/test'),resolve('/b'));
 assert.equal(stateDir({},'/home/test'),resolve('/home/test','.clawise'));
 assert.equal(stateDir({CLAWISE_STATE_DIR:'relative'},'/home/test'),resolve('relative'));
 assert.equal(motionxHome({CLAWISE_STATE_DIR:'/a'},'/home/test'),resolve('/a','motionx'));
 assert.equal(motionxHome({MOTIONX_HOME:'/custom'},'/home/test'),resolve('/custom'));
 assert.equal(cacheDir({CLAWISE_STATE_DIR:'/a'},'/home/test'),resolve('/a','motionx','cache'));
});
