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

For development: `npm test`, `npm run pack:skill`, `npm pack`. No npm runtime dependencies. The ZIP includes its own engine and licenses and excludes development artifacts.

[MIT](LICENSE); fonts and three.js keep their own licenses. Required original notices and adaptation provenance are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
