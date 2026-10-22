import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['--test','test/fx.test.js'],{stdio:'inherit',env:{...process.env,MOTIONX_BENCH:'1'}});
child.on('error',error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
