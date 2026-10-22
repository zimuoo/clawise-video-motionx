# The clawise-video-motionx project contract

A project is a folder whose `index.html` is a composition: a root element with `data-composition-id`, `data-width` and `data-height`, and a paused MotionX timeline registered in `window.__timelines[<id>]`. The renderer drives it in the user's own Chrome. That file is the only source: write MotionX, Canvas, Three.js or SVG freely. Everything below is a few extra HTML attributes — no new format. A composition that ignores them still renders; it just can't be pointed at or edited in the studio.

```
my-film/
  index.html      the source
  vendor/         motionx-timeline.js, motionx.js (runtime helpers) and other local libraries
  assets/         fonts, images, audio
  out/            renders from `motionx render`; never overwritten
  .motionx/            history, comment inbox, render log — maintained by the tools, safe to delete
```

## 1. Editable values are composition variables

Declare them on `<html data-composition-variables='[…]'>`. Types: `string`, `number` (`min`, `max`, `step`), `color`, `boolean`, `enum` (`options`). Optional `group` sorts them in the studio.

- `data-var-text="title"` replaces an element's text.
- `var(--accent)` in CSS — every scalar variable is also a CSS custom property on the root.
- `MX.vars()` once while building the timeline, for data, timing and logic.
- `data-mx-var="title"` on a container whose text a script builds (per-letter animation), so the studio can edit it in place on a double-click.

The studio and `motionx set key=value` change only each variable's `default` value — every other byte stays as written. Good candidates: titles, numbers, colors, hold durations, data arrays (a string holding JSON). If a user might want to change it without you, make it a variable.

## 2. `data-mx-id` names what people can point at

```html
<h1 data-mx-id="title" data-var-text="title">…</h1>
```

Clicks and comments resolve to the smallest clearly visible element carrying an id, and comments arrive with that id and its source line. Keep ids stable when text changes. For things drawn on a canvas, register a region: `MX.region('cat', (t) => [x, y, w, h] /* composition px, or null when absent */, '猫')`.

## 3. Timeline labels `scene:<id>` are the scenes

```js
tl.addLabel('scene:intro', 0).addLabel('scene:chart', 3.2);
```

The studio draws them as the scene strip, and comments carry the scene they were made in.

## Optional signature

Default exports have no platform signature. Explicit `data-mx-signature="auto"` enables a small Clawise MotionX credit during the last 1.2 seconds of films lasting at least 4 seconds. A corner name pins it; `"off"` disables it. Transparent overlays never receive it. Customers may use their own ending and branding.

## Timing

One paused timeline at `window.__timelines[<composition-id>]`. Without `data-duration` on the root, the film is as long as the timeline, so hold variables can change the length — end with the closing hold, e.g. `tl.to({}, { duration: V.endHold })`. Keep every position ≥ 0 (a negative position shifts the whole timeline), and remember `fromTo` renders its start state immediately (`immediateRender: false` or `set` at the moment when something must not exist earlier).

## Runtime helpers — `vendor/motionx.js`

- `MX.clock(tl, t => draw(t), duration)` — drive a frame-by-frame canvas/WebGL engine from the timeline.
- `MX.region(id, box(t), label)` — pickable canvas regions.
- `MX.space('#world' | threeCamera, { fov })` — a camera in 3D ([depth.md](depth.md)). `cam.set(pose)`, `cam.to(tl, at, { ...pose, duration, ease })`; a pose is `target: [x,y,z] | '#el'`, `distance`, `yaw` / `pitch` / `roll` (degrees), `fov`, or `fit: '#el'` with `pad`, or `flat: true` (a page's resting pose: z = 0 lands exactly on the layout), `position: [x,y,z]`, `dolly` (× distance). Moves run on arcs round the target; the pose is a pure function of time (`cam.pose(t)`, `cam.apply(t)`). A page world is an absolutely placed element whose layers sit at `translate3d`/`rotate` (page px, y down); its parent gets the perspective. `cam.attach(threeCamera)` poses a Three camera over the same page coordinates. `cam.locate('#el')` gives an element's centre in world coordinates.
- `vendor/three.min.js` (Three.js r186 + RoomEnvironment, GLTF/SVG/HDR loaders, RoundedBox, EffectComposer with Bokeh/Bloom/Output passes, Reflector, as `window.THREE`) and `vendor/motionx-three.js` (`window.MX3`), copied by the `object-3d` template:
  - `MX3.stage(canvas, { background, env: 'studio'|'room'|'x.hdr', exposure, fov, dof: { aperture, maxblur }, bloom, fog, units: 'px' })` → `{ renderer, scene, camera, render, add }`
  - `MX3.lights(stage, { span })`, `MX3.cyc(stage, { color, y, depth, radius })` — key + rim with soft shadows; a studio sweep.
  - `MX3.logo(svg | 'x.svg', { size, depth, bevel, color, metalness, roughness })` — the real SVG extruded, its own colours.
  - `MX3.screen(img, { width, aspect, bezel, depth, radius, body, glass, crop: [l, t, r, b] })` — a capture on a device or a card (bezel 0), unlit so it keeps its colours.
  - `MX3.gltf('x.glb')`, `MX3.texture(url)`, `MX3.read(url, type)` — loads that work from `file://` and are waited for.
  - `MX3.film(stage, tl, duration, cam, update)` — one clock: poses the camera, calls `update(t)`, renders once after the seek, focused on the camera's target.
  - `MX3.region(id, object, stage, label)` — the object's projected box, pickable in the studio. `MX3.ready(promise)` — wait for (and redraw after) anything else.
- `MX.cue('word', nth?, 'start'|'end')` — when a narration word is spoken (from `motionx voice`); motion anchored to words follows a new recording automatically.
- `MX.vars()` — the variables.
- `MX.sfx(name, at, opts)` — a sound effect at `at` (returns `at`); `MX.music({ product, drop, ending, marks, bpm })` — a built-in direction, or `<script type="text/vnd.abc" id="motionx-score">` — your own score, its `!mark:name!`s landing on `scene:name`; `MX.beat(n)` — n beats in seconds. `motionx sound` synthesizes them into `assets/sound.wav` + `<audio id="motionx-sound">` ([sound.md](sound.md)).

## The comment loop

1. The user presses C in the studio and clicks the frame. The comment records time, position, the object under the pointer, the scene and the current variables in `.motionx/inbox.jsonl`.
2. `motionx inbox <dir> --wait --timeout 30` waits up to 30 seconds for one, claims it and prints the context with source lines.
3. You edit `index.html` (or `motionx set`). The studio reloads at the same moment.
4. `motionx done <id> --note "…"` — the user sees your note. They can answer "not quite" with more detail; the comment comes back to your inbox with the whole thread.
5. Every version lands in `.motionx/history/`, whoever wrote it. `motionx undo` steps back.
