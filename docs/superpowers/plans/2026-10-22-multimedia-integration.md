# MotionX multimedia integration

The requested workflow uses Clawise's configured image provider through the runtime `image_generate` tool, its TTS tools, and the separately installed `shanqian-ai` skill. MotionX owns the editable composition, local media, timing, preview and export. Companion skills remain optional; their helpers, credentials and private implementation are not redistributed.

1. Verify the real image/TTS registrations and installed Shanqian skill contract. Evaluate the existing instructions against an image → video → narration request.
2. Add a tested `asset` command to import completed local images, audio and video into portable project paths with a provenance manifest. Reject pending/invalid files and protect existing media.
3. Teach explicit image/TTS/companion-skill selection, asynchronous completion, image-to-video and digital-human handoffs, actual-audio timing, and unavailable-capability behavior through a short entrypoint and supporting reference.
4. Test the importer, installed package, and a real mixed-media local render. Validate skill metadata and obtain an independent behavioral review. No paid generation is needed to test the integration contract.
5. Bump the minor version, publish the GitHub changes and an updated ZIP without changing the previous release.

Acceptance: a new Clawise session can select the existing capabilities without inventing tools or installing models; generated media can move with its MotionX project; narration and footage are rendered with deliberate timing; failures remain visible and never masquerade as completed media.
