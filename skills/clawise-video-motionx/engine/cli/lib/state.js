import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
export const stateDir=(env=process.env,home=homedir())=>resolve(env.CLAWISE_STATE_DIR || env.OPENCLAW_STATE_DIR || join(home,'.clawise'));
export const motionxHome=(env=process.env,home=homedir())=>resolve(env.MOTIONX_HOME || join(stateDir(env,home),'motionx'));
export const cacheDir=(env=process.env,home=homedir())=>join(motionxHome(env,home),'cache');
