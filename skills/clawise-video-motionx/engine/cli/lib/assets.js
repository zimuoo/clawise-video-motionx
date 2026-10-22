// Completed media from Clawise tools and companion skills becomes portable project input.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, openSync, closeSync, constants } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { MotionXError } from './project.js';

const extensions = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'],
  audio: ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac', '.opus'],
  video: ['.mp4', '.mov', '.webm', '.mkv'],
};
const sources = ['user', 'clawise-image', 'clawise-tts', 'shanqian-ai'];

function rejectSymlink(file) {
  let stat;
  try { stat = lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat.isSymbolicLink()) throw new MotionXError(`symbolic link is not an asset output: ${file}`);
}

function inspect(file, kind) {
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', file,
  ], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new MotionXError('asset import requires ffprobe — run motionx doctor');
  if (result.status !== 0) throw new MotionXError('asset is not readable completed media (ffprobe failed)');
  let probe;
  try { probe = JSON.parse(result.stdout); } catch { throw new MotionXError('ffprobe returned invalid media metadata'); }
  const stream = probe.streams?.find((s) => s.codec_type === (kind === 'audio' ? 'audio' : 'video'));
  if (!stream) throw new MotionXError(`asset has no ${kind === 'audio' ? 'audio' : 'visual'} stream`);
  const metadata = {};
  if (kind !== 'audio') {
    if (!(stream.width > 0 && stream.height > 0)) throw new MotionXError('asset has no valid dimensions');
    metadata.width = stream.width;
    metadata.height = stream.height;
  }
  if (kind !== 'image') {
    const duration = Number(probe.format?.duration ?? stream.duration);
    if (!(Number.isFinite(duration) && duration > 0)) throw new MotionXError('asset has no valid duration');
    metadata.duration = duration;
  }
  if (kind === 'audio') metadata.sampleRate = Number(stream.sample_rate);
  if (kind === 'video') metadata.hasAudio = probe.streams.some((s) => s.codec_type === 'audio');
  // Valid headers alone do not prove that an asynchronous download finished.
  const decode = spawnSync('ffmpeg', [
    '-v', 'error', '-xerror', '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-i', file,
    '-map', '0:v?', '-map', '0:a?', '-f', 'null', '-',
  ], { encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024 });
  if (decode.error?.code === 'ENOENT') throw new MotionXError('asset import requires FFmpeg — run motionx doctor');
  if (decode.status !== 0) throw new MotionXError('asset could not be fully decoded; file may be incomplete, corrupt or too slow to validate');
  return metadata;
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function importAsset(project, { file, id, source = 'user' } = {}) {
  if (typeof file !== 'string' || !file || /^\w+:\/\//.test(file)) throw new MotionXError('asset --file must be a completed local media file; finish generation/download first');
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new MotionXError('asset --id must contain 1–64 letters, numbers, underscores or hyphens');
  if (!sources.includes(source)) throw new MotionXError(`asset --source must be ${sources.join('|')}`);
  const input = resolve(file);
  if (!existsSync(input) || !statSync(input).isFile() || statSync(input).size === 0) throw new MotionXError('asset input is missing, empty or not a regular file; wait for a successful generation result');
  const ext = extname(input).toLowerCase();
  const kind = Object.keys(extensions).find((key) => extensions[key].includes(ext));
  if (!kind) throw new MotionXError(`unsupported media extension: ${ext || '(none)'}`);
  const metadata = inspect(input, kind);
  const sha256 = await digest(input);
  const directory = join(project.root, 'assets');
  const generated = join(directory, 'generated');
  const manifestPath = join(directory, 'media.json');
  for (const path of [directory, generated, manifestPath]) rejectSymlink(path);
  mkdirSync(generated, { recursive: true });
  const lockPath = join(directory, '.media-import.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx'); } catch (error) {
    if (error.code === 'EEXIST') throw new MotionXError('another asset import is active; retry when it finishes. After an interrupted import, verify no importer is running before removing assets/.media-import.lock');
    throw error;
  }
  try {
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 1, assets: [] };
    if (manifest.version !== 1 || !Array.isArray(manifest.assets)) throw new MotionXError('unsupported assets/media.json format');
    const path = `assets/generated/${id}-${sha256.slice(0, 12)}${ext}`;
    const asset = { id, kind, source, path, sha256, bytes: statSync(input).size, ...metadata };
    const destination = join(project.root, path);
    rejectSymlink(destination);
    const previous = manifest.assets.find((a) => a.id === id);
    if (previous && (previous.sha256 !== sha256 || previous.source !== source || previous.path !== path)) throw new MotionXError(`asset id ${id} already exists with different media or provenance; choose a new --id`);
    if (existsSync(destination)) {
      if (await digest(destination) !== sha256) throw new MotionXError(`asset file ${path} was edited; choose a new --id`);
    } else {
      copyFileSync(input, destination, constants.COPYFILE_EXCL);
      if (await digest(destination) !== sha256) {
        rmSync(destination);
        throw new MotionXError('asset changed during import; wait for generation to finish and retry');
      }
    }
    if (!previous) {
      const temporary = `${manifestPath}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, JSON.stringify({ ...manifest, assets: [...manifest.assets, asset] }, null, 2) + '\n', { flag: 'wx' });
        renameSync(temporary, manifestPath);
      } finally { rmSync(temporary, { force: true }); }
    }
    return previous || asset;
  } finally { closeSync(lock); rmSync(lockPath, { force: true }); }
}
