# Verification · 1.0.0

Local environment: macOS, Node25.9.0, Chrome156, FFmpeg/ffprobe installed. Node22 and other operating systems are covered by the added CI workflow; results must be checked separately before claiming them.

- `npm test`:225 tests,216 passed,9 skipped,0 failed. The nine skips require an optional external sample pack; it was intentionally not downloaded. Coverage includes installer rollback/edit protection, timeline order and callbacks, camera moves, template initialization, browser capture, MP4/MOV/WebM/GIF/alpha/blur, source export, audio mixing, voice alignment, local studio and CSRF/path protections.
- Independent browser sweep of all12 templates: no runtime/browser/history-dependent errors. Templates may warn about missing real product material, materials documentation, or optional talking-head footage. Replace illustrative/default materials before a client delivery.
- Skill creator validation: passed. All relative skill Markdown links resolve. Brand scan excludes only required legal notices and finds no upstream author promotion or bundled restricted character/animation library.
- Actual ZIP integrity, every manifest file checksum, single SKILL.md discovery, relocated skill launcher and npm tarball inventory: verified. Runtime dependencies and required fonts/licenses are included; development artifacts are excluded.
- Original Clawise demo:12.000s,1920×1080,30fps,H.264 video plus AAC audio. Intro/workflow/ending stills visually inspected. Full check:0errors; after adding materials.md, no unresolved material warning. Second real render completed without the inherited encoder-listener warning.
- Video QA: no single-frame pops. Calm title/card reading holds and end-card stillness trigger heuristic still/flat-motion warnings; these are intentional in the documented demo direction, not reported as universally passing creative quality.
- GIF and static HTML/source ZIP generated locally. Nothing was automatically posted to social platforms.

Baseline skill evaluation exposed the original promotion in the template, signature, studio and sharing instructions. The revised independent evaluation produced Clawise-only frames and used actual checks to catch a partially copied template rather than claiming a successful screenshot was a finished film.

Cross-platform installer permission handling has a Windows semantics regression test. Actual Windows execution, GitHub CI status and the cold remote installation are recorded after publication; they are not inferred from the macOS run.

## Remote distribution verification

Public GitHub commit baca598 was installed with an empty npm cache and a fresh Clawise state using exactly `npx --yes github:zimuoo/clawise-video-motionx install`. Ownership status reported managed and unmodified. The installed skill independently ran doctor, created clawise-launch, checked6 frames plus4 seek-history comparisons with0errors/0warnings, synthesized audio and rendered12s MP4. No source checkout was used by the installed engine.

Initial CI: Ubuntu/macOS Node22 core suites passed. Windows exposed a test harness assumption that `npm` is directly executable; its `npm.cmd` wrapper must be run through Node's npm CLI entry for a no-shell subprocess. The fixture was corrected; installer/timeline behavior itself passed the other41 Windows tests. Final CI result is recorded on GitHub Actions.
