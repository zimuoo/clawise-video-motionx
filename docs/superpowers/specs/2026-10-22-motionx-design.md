# Clawise Video MotionX

The user approved a Clawise-owned adaptation and optimization of the motion skill, a dedicated install command, and committing/pushing to `https://github.com/zimuoo/clawise-video-motionx.git`.

## Product and distribution

- Product/skill: Clawise Video MotionX, slug `clawise-video-motionx`, executable `motionx`.
- Keep the editable HTML film, deterministic rendering, frame comments, audio, QA and export workflow. Optimize skill instructions for Clawise: infer supplied requirements, ask only for missing consequential choices, prefer configured Clawise TTS/imported recordings, report real artifacts and actual verification.
- Ship the engine, studio, templates, fonts and references inside the skill folder. Installation must not depend on the repository's parent directories or invoke the original author's npm package.
- The dedicated GitHub command is `npx --yes github:zimuoo/clawise-video-motionx install`. The root npm package exposes only the `motionx` executable, so npm can infer it. Also document the explicit HTTPS package form. A registry short name is available only after npm publication; do not claim it is published while npm authentication is absent.
- Install into the configured Clawise state root (`CLAWISE_STATE_DIR`, then `OPENCLAW_STATE_DIR`, otherwise `~/.clawise`), under `skills/clawise-video-motionx`. Preserve unrelated skills and configuration. Managed updates check modifications before replacement; do not silently overwrite user content.
- Generate a versioned ZIP for Clawise's existing skill importer, and an npm tarball. Pin releases and document exact commands.

## Branding, provenance and dependencies

- All normal UI, descriptions, help, errors, templates, generated films and share pages use Clawise branding and this repository's links. Credits/watermark are optional and default off.
- Remove author promotion, original update checks, npm fallbacks, personal cache paths, old examples and the protected cartoon likeness (`TOON.bean`, storytime grammar/template). Do not rename and redistribute that character.
- Preserve MIT source attribution in LICENSE/third-party notices. Preserve applicable three.js and font licenses with copied assets. Legal provenance is not promotional product UI.
- Replace bundled GSAP with an independently implemented deterministic MotionX timeline used by supported templates. Do not ship GSAP or claim a broad commercial authorization for its visual editor use. Implement/test the actual required API subset, reject unsupported behavior, and document that it is not a full GSAP replacement.
- Use installed Chrome/Chromium/Edge and FFmpeg/ffprobe with explicit executable overrides and actionable diagnostics. Do not download models or execute upstream install scripts during installation. Optional models and sample packs remain opt-in with licenses disclosed.
- The local studio binds loopback. Review its write/upload paths and browser-origin handling before shipping; preserve source conflict detection and history.

## Verification

Test real installation/update/status in isolated state roots, packed-skill relocatability, deterministic timeline seeking and templates, studio comments/edits, brand-free exports, and malformed/path escape cases. Run the adapted upstream tests plus new tests. Render a real Clawise demo with audio, inspect representative PNGs and MP4 with ffprobe, and create a share page/GIF/ZIP. Confirm cold install from the pushed GitHub repository before reporting the command as working.

Work is isolated in the newly cloned empty repository. Do not change or commit the unrelated Clawise desktop checkout. The user's GitHub push authorization is explicit; npm authentication is currently absent, so ship the GitHub command without blocking the task.
