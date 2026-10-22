import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {writeEncoderFrame} from '../skills/clawise-video-motionx/engine/cli/lib/encoder-stream.js';
function encoder(){const e=new EventEmitter();e.exitCode=null;e.stdin=new EventEmitter();e.stdin.write=()=>false;return e;}
test('repeated encoder backpressure releases competing close and drain listeners',async()=>{
 const e=encoder();for(let n=0;n<30;n++){
  const written=writeEncoderFrame(e,Buffer.from('frame'),()=> 'encoder failed');
  e.stdin.emit('drain');await written;
  assert.equal(e.listenerCount('close'),0);assert.equal(e.stdin.listenerCount('drain'),0);
 }
});
test('an encoder closing during a blocked write rejects and releases both listeners',async()=>{
 const e=encoder();const written=writeEncoderFrame(e,Buffer.from('frame'),()=> 'disk full');
 e.exitCode=1;e.emit('close',1);
 await assert.rejects(written,/disk full/);
 assert.equal(e.listenerCount('close'),0);assert.equal(e.stdin.listenerCount('drain'),0);
});
