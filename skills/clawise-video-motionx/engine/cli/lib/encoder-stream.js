import {MotionXError} from './project.js';

// Each blocked write races drain with encoder exit. Whichever wins must
// remove both listeners: a render can fill this pipe hundreds of times.
export async function writeEncoderFrame(encoder, buffer, errorDetail=()=> 'encoder stopped') {
 const failed=()=>new MotionXError(`ffmpeg stopped early: ${errorDetail()}`);
 if(encoder.exitCode!=null)throw failed();
 if(!encoder.stdin.write(buffer))await new Promise((resolve,reject)=>{
  const cleanup=()=>{encoder.stdin.off('drain',drain);encoder.off('close',close);};
  const drain=()=>{cleanup();resolve();};
  const close=()=>{cleanup();reject(failed());};
  encoder.stdin.once('drain',drain);encoder.once('close',close);
 });
 if(encoder.exitCode!=null)throw failed();
}
