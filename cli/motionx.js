#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DEFAULT_SOURCE, installSkill, statusSkill } from './install.js';

const help = `Clawise Video MotionX

Usage:
  motionx install [--state-dir PATH] [--force] [--json]
  motionx update  [--state-dir PATH] [--force] [--json]
  motionx status  [--state-dir PATH] [--json]
  motionx <engine-command> [arguments...]

Installs the complete skill under <state-dir>/skills/clawise-video-motionx.
State root: CLAWISE_STATE_DIR, then OPENCLAW_STATE_DIR, then ~/.clawise.
--force explicitly replaces an unowned or locally modified skill directory.
Engine commands are forwarded directly to the bundled engine using Node.js.
`;

function parseOptions(args, command) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--state-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--state-dir requires a path');
      options.stateDir = value;
    } else if (argument === '--force' && command !== 'status') options.force = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown option for ${command}: ${argument}`);
  }
  return options;
}

export async function main(args = process.argv.slice(2)) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Clawise Video MotionX requires Node.js 22 or newer');
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(help);
    return 0;
  }
  if (['install', 'update', 'status'].includes(command)) {
    const options = parseOptions(rest, command);
    if (options.help) { process.stdout.write(help); return 0; }
    const result = command === 'status' ? await statusSkill(options) : await installSkill(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else if (!result.installed) process.stdout.write(`Clawise Video MotionX is not installed.\nTarget: ${result.target}\n`);
    else process.stdout.write(`Clawise Video MotionX ${result.version ?? '(unmanaged)'}\nTarget: ${result.target}\nManaged: ${result.managed ? 'yes' : 'no'}\nModified: ${result.modified === null ? 'unknown' : result.modified ? 'yes' : 'no'}\n`);
    return 0;
  }
  const engine = path.join(DEFAULT_SOURCE, 'engine', 'cli', 'motionx.js');
  await fs.access(engine).catch(() => { throw new Error(`Bundled MotionX engine is missing: ${engine}. Reinstall clawise-video-motionx.`); });
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [engine, ...args], { stdio: 'inherit', shell: false });
    const handlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => child.kill(signal)]));
    for (const [signal, handler] of handlers) process.on(signal, handler);
    const cleanup = () => { for (const [signal, handler] of handlers) process.off(signal, handler); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => { cleanup(); resolve(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)); });
  });
}

// npm may invoke this file through a symlink, so compare canonical paths.
const invoked = process.argv[1] && await fs.realpath(process.argv[1]).catch(() => path.resolve(process.argv[1]));
if (invoked === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write(`motionx: ${error.message}\n`);
    process.exitCode = 1;
  });
}
