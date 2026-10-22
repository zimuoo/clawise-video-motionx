# Clawise Video MotionX

Editable motion graphics, launch films and explainers for Clawise. Local studio, frame comments, deterministic animation, bundled fonts, and MP4/MOV/WebM/GIF export.

[中文](README.md) · [Skill](skills/clawise-video-motionx/SKILL.md)

```sh
npx --yes github:zimuoo/clawise-video-motionx install
```

Requires Node.js22+ and Git. Installs the complete skill under `~/.clawise/skills/clawise-video-motionx`. Refresh Clawise skills or start a new conversation afterward. GitHub installation works independently of npm registry publication; the registry short package command is not published yet.

Explicit HTTPS alternative:

```sh
npx --yes --package=git+https://github.com/zimuoo/clawise-video-motionx.git motionx install
```

Use `install --state-dir "/path/to/state"` for a custom state root. Priority: explicit option, `CLAWISE_STATE_DIR`, `OPENCLAW_STATE_DIR`, `~/.clawise`. `update` preserves unowned or locally edited installations unless `--force` is explicit. Concurrent edits during staging are preserved. Symlink paths are rejected; use their actual path. `status` reports ownership/version/modifications.

A self-contained ZIP is available in [Releases](https://github.com/zimuoo/clawise-video-motionx/releases/latest) for Clawise import.

Rendering requires locally installed Chrome/Chromium/Edge, FFmpeg and ffprobe. No browser, model or sample pack is downloaded by installation.

```sh
npx --yes github:zimuoo/clawise-video-motionx doctor
npx --yes github:zimuoo/clawise-video-motionx demo ./my-film
```

The demo starts a local studio. In another terminal:

```sh
npx --yes github:zimuoo/clawise-video-motionx check ./my-film
npx --yes github:zimuoo/clawise-video-motionx sound ./my-film
npx --yes github:zimuoo/clawise-video-motionx render ./my-film --workers 2
```

Twelve templates, editable variables, local preview, pickable objects, comment inbox, versioned renders, stills, transparency and static share pages are included. No forced platform watermark. Use real client materials; original example illustrations are clearly labeled. Optional voice models require explicit `--allow-download`; importing existing audio needs no model. The independently written MotionX Timeline implements a [limited documented API](skills/clawise-video-motionx/references/timeline.md).

## Images, narration and generated footage

The skill uses Clawise's available `image_generate` tool for artwork, `clawise_tts_list_voices` / `clawise_tts_synthesize` for narration, and the separately installed `shanqian-ai` skill for image-to-video, video generation, digital humans and supported voice/remix workflows. MotionX owns the editable composition, timing, preview and export. Companion tools/skills must already be available; installation does not enable them, copy their private helpers, or store credentials.

Completed local results can be imported into an existing project:

```sh
npx --yes github:zimuoo/clawise-video-motionx asset ./film --file "/actual/generated/image.png" --id intro --source clawise-image
npx --yes github:zimuoo/clawise-video-motionx asset ./film --file "/actual/delivered/clip.mp4" --id opening --source shanqian-ai
```

The command needs FFmpeg and ffprobe. It verifies full decoding, copies media to content-addressed relative paths, reports dimensions/duration, and records provenance in `assets/media.json`. It does not invoke a generation service or automatically insert footage into the composition. The agent wires the returned paths into the timeline, waits for successful asynchronous jobs, and checks actual narration timing. Existing asset ids cannot silently overwrite different media. See the [multimedia workflow](skills/clawise-video-motionx/references/multimedia.md).

For development: `npm test`, `npm run pack:skill`, `npm pack`. No npm runtime dependencies. The ZIP includes its own engine and licenses and excludes development artifacts.

[MIT](LICENSE); fonts and three.js keep their own licenses. Required original notices and adaptation provenance are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
