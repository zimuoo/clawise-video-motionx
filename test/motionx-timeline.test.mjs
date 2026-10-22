import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../skills/clawise-video-motionx/engine/runtime/motionx-timeline.js', import.meta.url);
function load(elements = []) {
  let clock = 0, next = 1;
  const frames = new Map();
  const context = vm.createContext({
    document: { querySelectorAll: () => elements },
    getComputedStyle: el => ({ opacity: '1', transform: 'none', ...el.style }),
    performance: { now: () => clock },
    requestAnimationFrame: fn => { const id = next++; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  context.window = context;
  vm.runInContext(existsSync(path) ? readFileSync(path, 'utf8') : '', context);
  assert.equal(typeof context.MotionX?.timeline, 'function', 'MotionX.timeline must be exported');
  return { mx: context.MotionX, tick(ms) { clock = ms; const queued = [...frames.values()]; frames.clear(); queued.forEach(fn => fn(clock)); } };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const element = (style = {}) => ({ nodeType: 1, style: { ...style } });

test('exports a chainable paused timeline and tween inspection for layout checks', () => {
  const { mx } = load(), p = { x: 0 }, tl = mx.timeline({ paused: true });
  assert.equal(tl.to(p, { x: 10, duration: 2, ease: 'none' }, 1), tl);
  assert.equal(tl.addLabel('scene:one', .5), tl);
  assert.equal(tl.labels['scene:one'], .5);
  assert.equal(tl.duration(), 3);
  const children = tl.getChildren(false, true, true);
  assert.equal(children.length, 1);
  assert.equal(children[0].startTime(), 1);
  assert.equal(children[0].totalDuration(), 2);
  assert.equal(children[0].timeScale(), 1);
  assert.equal(children[0].targets()[0], p);
  assert.equal(tl.pause(), tl);
  assert.equal(tl.time(2, false), tl);
  assert.equal(tl.time(), 2);
  assert.equal(p.x, 5);
});

test('numeric, omitted, labels and relative positions establish the authored duration', () => {
  const { mx } = load(), tl = mx.timeline({ paused: true, defaults: { duration: 1, ease: 'none' } });
  tl.to({}, {}).addLabel('beat', 3).to({}, {}, 'beat+=.5').to({}, {}, '<+=.25').to({}, {}, '>').to({}, {}, '+=.5').set({}, {}, 9);
  assert.deepEqual(Array.from(tl.getChildren(), c => c.startTime()), [0, 3.5, 3.75, 4.75, 6.25, 9]);
  assert.equal(tl.duration(), 9);
  tl.to({}, { duration: 2 });
  assert.equal(tl.duration(), 11);
});

test('sequential to tweens derive starts from timeline time regardless of seek order', () => {
  const { mx } = load();
  const build = () => { const p = { x: 0, y: 3 }, tl = mx.timeline({ paused: true, defaults: { ease: 'none' } });
    // Intentionally insert the later tween first.
    tl.to(p, { x: 20, duration: 1 }, 2).to(p, { x: 10, duration: 1 }, 0).to(p, { y: 7, duration: 2 }, 1);
    return { p, tl }; };
  const { p, tl } = build();
  for (const t of [3, .5, 2.5, 0, 1.5, .5, 3, 2.5]) {
    tl.seek(t, false);
    const fresh = build(); fresh.tl.seek(t, false);
    assert.deepEqual(p, fresh.p);
    close(p.x, t < 1 ? t * 10 : t < 2 ? 10 : 10 + (Math.min(t, 3) - 2) * 10);
  }
});

test('overlapping tweens start at the previous tween value at their own start', () => {
  const { mx } = load(), p = { x: 0 }, tl = mx.timeline({ paused: true });
  tl.to(p, { x: 100, duration: 4, ease: 'none' }, 0).to(p, { x: 80, duration: 2, ease: 'none' }, 2);
  for (const t of [3, 1, 3]) { tl.seek(t); close(p.x, t === 1 ? 25 : 65); }
});

test('fromTo handles start-only fields, immediate rendering and restoring before start', () => {
  const { mx } = load(), p = { x: 10, y: 0 }, q = { x: 4 }, tl = mx.timeline({ paused: true });
  tl.fromTo(p, { x: 0, y: 25 }, { x: 100, duration: 2, ease: 'none' }, 2);
  assert.equal(p.x, 0);
  assert.equal(p.y, 25);
  tl.fromTo(q, { x: 0 }, { x: 20, duration: 2, ease: 'none', immediateRender: false }, 2);
  assert.equal(q.x, 4);
  tl.seek(3); assert.equal(p.x, 50); assert.equal(q.x, 10); assert.equal(p.y, 25);
  tl.seek(0); assert.equal(p.x, 0); assert.equal(q.x, 4);
});

test('fromTo takes unspecified start properties from the authored state', () => {
  const { mx } = load(), p = { x: 0, y: 10 }, tl = mx.timeline({ paused: true });
  tl.fromTo(p, { x: 0 }, { x: 20, y: 30, duration: 2, ease: 'none' });
  tl.seek(1); assert.equal(p.x, 10); assert.equal(p.y, 20);
});

test('from uses its authored duration and immediateRender options', () => {
  const { mx } = load(), p = { x: 10 }, tl = mx.timeline({ paused: true });
  tl.from(p, { x: 0, duration: 4, immediateRender: false, ease: 'none' }, 2);
  assert.equal(p.x, 10); tl.seek(4); assert.equal(p.x, 5); tl.seek(0); assert.equal(p.x, 10);
});

test('from returns to the original value, while set steps reverse deterministically', () => {
  const { mx } = load(), p = { x: 10 }, tl = mx.timeline({ paused: true });
  tl.from(p, { x: -10, duration: 2, ease: 'none' }, 1).set(p, { x: 30 }, 4);
  for (const [t, value] of [[4, 30], [2, 0], [3, 10], [0, -10], [4, 30]]) { tl.seek(t); assert.equal(p.x, value); }
});

test('stagger covers every target and extends the duration', () => {
  const { mx } = load(), p = [{ x: 0 }, { x: 0 }, { x: 0 }], tl = mx.timeline({ paused: true });
  tl.fromTo(p, { x: 0 }, { x: 10, duration: 1, stagger: .5, ease: 'none' }, 1);
  assert.equal(tl.duration(), 3);
  tl.seek(2); assert.deepEqual(p.map(v => v.x), [10, 5, 0]);
  tl.seek(0); assert.deepEqual(p.map(v => v.x), [0, 0, 0]);
});

test('staggered target starts are ordered before inferring overlapping tween endpoints', () => {
  const { mx } = load(), p = { x: 0 }, q = { x: 0 }, tl = mx.timeline({ paused: true });
  tl.to([p, q], { x: 10, duration: 1, stagger: 2, ease: 'none' }, 0)
    .to(q, { x: 20, duration: 1, ease: 'none' }, 1);
  for (const [time, expected] of [[1.5, 10], [2.5, 15], [3, 10], [0, 0], [2.5, 15], [1.5, 10]]) {
    tl.seek(time); assert.equal(q.x, expected, 'second target at ' + time);
  }
});

test('accessor proxies write on silent and repeated seeks, without enumerating the target', () => {
  const { mx } = load(), seen = [], proxy = {}, tl = mx.timeline({ paused: true });
  Object.defineProperty(proxy, 't', { get: () => 0, set: value => seen.push(value) });
  tl.fromTo(proxy, { t: 0 }, { t: 8, duration: 8, ease: 'none', immediateRender: false }, 0);
  for (const t of [7, 2, 2, 0]) { tl.seek(t, true); assert.equal(seen.at(-1), t); }
});

test('onUpdate follows all writes, completed jumps, backward jumps and suppression', () => {
  const { mx } = load(), p = { x: 0 }, q = { x: 0 }, values = [], tl = mx.timeline({ paused: true });
  tl.to(p, { x: 10, duration: 1, ease: 'none', onUpdate: () => values.push([p.x, q.x]) }, 0)
    .to(q, { x: 20, duration: 2, ease: 'none' }, 0);
  tl.seek(2, false); assert.deepEqual(values.at(-1), [10, 20]);
  tl.seek(.5, false); assert.deepEqual(values.at(-1), [5, 5]);
  const count = values.length; tl.seek(1, true); assert.equal(values.length, count); assert.equal(p.x, 10);
});

test('easing parses independent formulas and accepts pure spring functions', () => {
  const { mx } = load();
  for (const name of ['none', 'linear', 'power2.in', 'power2.out', 'power3.inOut', 'expo.out', 'expo.inOut', 'sine.inOut', 'back.out(1.5)', 'back.out(3)']) {
    const fn = mx.parseEase(name); close(fn(0), 0); close(fn(1), 1);
  }
  close(mx.parseEase('power2.in')(.5), .125);
  close(mx.parseEase('power3.out')(.5), .9375);
  close(mx.parseEase('sine.inOut')(.5), .5);
  assert.ok(mx.parseEase('back.out(2)')(.6) > 1);
  const custom = x => x * x;
  assert.equal(mx.parseEase(custom), custom);
  const p = { x: 0 }, tl = mx.timeline({ paused: true });
  tl.to(p, { x: 8, ease: custom, duration: 2 }); tl.seek(1); assert.equal(p.x, 2);
});

test('DOM selectors, style units and transform components compose and reverse', () => {
  const a = element({ transform: 'rotateY(30deg)', transformOrigin: '0 50%' }), b = element();
  const { mx } = load([a, b]);
  mx.set('#a,#b', { left: 20, top: 40 });
  assert.equal(a.style.left, '20px'); assert.equal(b.style.top, '40px');
  const tl = mx.timeline({ paused: true });
  tl.fromTo([a, b], { x: -10, yPercent: 100, scale: .5, opacity: 0 }, { x: 30, yPercent: 0, scale: 1, opacity: 1, duration: 2, ease: 'none' });
  tl.seek(1);
  assert.match(a.style.transform, /rotateY\(30deg\)/);
  assert.match(a.style.transform, /10px/); assert.match(a.style.transform, /50%/);
  assert.match(a.style.transform, /scale\(0\.75,\s*0\.75\)/);
  assert.equal(Number(a.style.opacity), .5); assert.equal(a.style.transformOrigin, '0 50%');
  const mid = a.style.transform; tl.seek(2); tl.seek(1); assert.equal(a.style.transform, mid);
});

test('relative values resolve once from the authored start', () => {
  const { mx } = load(), p = { x: 3 }, tl = mx.timeline({ paused: true });
  tl.to(p, { x: '+=8', duration: 2, ease: 'none' }, 0);
  for (const t of [2, 1, 2]) { tl.seek(t); assert.equal(p.x, 3 + t * 4); }
});

test('killing a child removes only that tween and recomputes duration', () => {
  const { mx } = load(), p = { x: 0 }, tl = mx.timeline({ paused: true });
  tl.to(p, { x: 20, duration: 2 }, 0).to({}, { duration: 10 }, 0);
  tl.getChildren()[1].kill();
  assert.equal(tl.duration(), 2); assert.equal(tl.getChildren().length, 1);
  tl.seek(2); assert.equal(p.x, 20);
});

test('play uses animation frames and pause prevents further clock advancement', () => {
  const { mx, tick } = load(), p = { x: 0 }, tl = mx.timeline({ paused: true });
  tl.to(p, { x: 10, duration: 2, ease: 'none' });
  assert.equal(tl.play(), tl); tick(1000); assert.equal(p.x, 5);
  tl.pause(); tick(1500); assert.equal(p.x, 5);
  tl.play(); tick(2500); assert.equal(p.x, 10); assert.equal(tl.paused(), true);
});

test('unsupported features and invalid numbers fail with actionable MotionX errors', () => {
  const { mx } = load(), tl = mx.timeline({ paused: true });
  assert.throws(() => mx.parseEase('magic.out'), /MotionX.*ease/i);
  assert.throws(() => tl.to({}, { repeat: -1 }), /MotionX.*repeat/i);
  assert.throws(() => tl.to({}, { duration: -1 }), /MotionX.*duration/i);
  assert.throws(() => tl.to({}, { duration: 1 }, 'not a position'), /MotionX.*position/i);
  assert.throws(() => tl.seek(NaN), /MotionX.*time/i);
});
