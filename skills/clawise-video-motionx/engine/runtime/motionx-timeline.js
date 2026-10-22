// MotionX Timeline — independently authored, MIT licensed.
// A small timeline for local compositions. Seeking evaluates authored property tracks from their
// original values; no integration, animation history, external library, or wall clock is involved.
(function (root) {
  'use strict';
  const fail = message => { throw new Error('MotionX: ' + message); };
  const finite = (value, name) => {
    const n = Number(value);
    if (!Number.isFinite(n)) fail(name + ' must be a finite number');
    return n;
  };
  const nonnegative = (value, name) => {
    const n = finite(value, name);
    if (n < 0) fail(name + ' must be >= 0');
    return n;
  };
  const clamp = x => Math.max(0, Math.min(1, x));
  const format = x => String(Math.round(x * 1e10) / 1e10);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function parseEase(value = 'power1.out') {
    if (typeof value === 'function') return value;
    if (value === 'none' || value === 'linear') return x => x;
    const match = /^(power[1-4]|sine|expo|back)(?:\.(inOut|in|out))?(?:\(([-+\d.e]+)\))?$/.exec(value);
    if (!match || (match[3] && match[1] !== 'back')) fail('unsupported ease "' + value + '"');
    const family = match[1], direction = match[2] || 'out';
    const overshoot = match[3] == null ? 1.70158 : finite(match[3], 'back ease overshoot');
    const easeIn = family.startsWith('power') ? x => x ** (Number(family.slice(5)) + 1)
      : family === 'sine' ? x => 1 - Math.cos(x * Math.PI / 2)
      : family === 'expo' ? x => x === 0 ? 0 : 2 ** (10 * (x - 1))
      : x => x * x * ((overshoot + 1) * x - overshoot);
    return x => x <= 0 ? 0 : x >= 1 ? 1 : direction === 'in' ? easeIn(x)
      : direction === 'out' ? 1 - easeIn(1 - x)
      : x < .5 ? easeIn(x * 2) / 2 : 1 - easeIn((1 - x) * 2) / 2;
  }

  const reserved = new Set(['duration', 'ease', 'stagger', 'immediateRender', 'onUpdate', 'delay']);
  const unsupported = new Set(['repeat', 'repeatDelay', 'yoyo', 'onStart', 'onComplete', 'onReverseComplete', 'overwrite', 'keyframes', 'scrollTrigger', 'modifiers', 'startAt', 'runBackwards', 'callbackScope', 'onUpdateParams']);
  function properties(vars) {
    const result = {};
    for (const [key, value] of Object.entries(vars || {})) {
      if (unsupported.has(key)) fail('unsupported tween option "' + key + '"');
      if (!reserved.has(key)) result[key] = value;
    }
    return result;
  }
  function targets(value) {
    if (typeof value === 'string') {
      if (!root.document) fail('selector targets require a document');
      return Array.from(root.document.querySelectorAll(value));
    }
    if (value == null) return [];
    if (Array.isArray(value) || (!value.nodeType && typeof value !== 'function' && typeof value.length === 'number')) return Array.from(value).flatMap(targets);
    if (typeof value !== 'object' && typeof value !== 'function') fail('targets must be objects, elements, or selectors');
    return [value];
  }

  const transforms = new Set(['x', 'y', 'z', 'xPercent', 'yPercent', 'scaleX', 'scaleY', 'scaleZ', 'rotation', 'rotationX', 'rotationY']);
  const unitless = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flexGrow', 'flexShrink', 'order']);
  const nodes = new WeakMap();
  function nodeState(target) {
    let state = nodes.get(target);
    if (!state) {
      const css = root.getComputedStyle ? root.getComputedStyle(target) : target.style;
      const base = css.transform && css.transform !== 'none' ? css.transform : '';
      state = { base, x: 0, y: 0, z: 0, xPercent: 0, yPercent: 0, scaleX: 1, scaleY: 1, scaleZ: 1, rotation: 0, rotationX: 0, rotationY: 0 };
      nodes.set(target, state);
    }
    return state;
  }
  function expand(target, values) {
    if (!target.nodeType || !own(values, 'scale')) return values;
    const result = { ...values, scaleX: values.scale, scaleY: values.scale };
    delete result.scale;
    return result;
  }
  function read(target, key) {
    if (!target.nodeType) return target[key] == null ? 0 : target[key];
    if (transforms.has(key)) return nodeState(target)[key];
    const css = root.getComputedStyle ? root.getComputedStyle(target) : target.style;
    const value = key.startsWith('--') ? css.getPropertyValue(key) : css[key];
    return value == null || value === '' || value === 'auto' ? (key === 'opacity' ? 1 : 0) : value;
  }
  function write(target, key, value, dirty) {
    if (!target.nodeType) { target[key] = value; return; } // Keep accessor setters intact.
    if (transforms.has(key)) { nodeState(target)[key] = finite(value, key); dirty.add(target); return; }
    const text = typeof value === 'number' ? format(value) + (unitless.has(key) || key.startsWith('--') ? '' : 'px') : String(value);
    if (key.startsWith('--')) target.style.setProperty(key, text);
    else target.style[key] = text;
  }
  function flush(dirty) {
    for (const target of dirty) {
      const s = nodeState(target), f = format;
      target.style.transform = [s.base, `translate(${f(s.xPercent)}%, ${f(s.yPercent)}%)`,
        `translate3d(${f(s.x)}px, ${f(s.y)}px, ${f(s.z)}px)`,
        `rotate(${f(s.rotation)}deg) rotateX(${f(s.rotationX)}deg) rotateY(${f(s.rotationY)}deg)`,
        `scale(${f(s.scaleX)}, ${f(s.scaleY)}) scaleZ(${f(s.scaleZ)})`].filter(Boolean).join(' ');
    }
  }
  const numeric = value => typeof value === 'number' ? { n: value, unit: '' }
    : typeof value === 'string' && /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?[a-z%]*$/i.test(value.trim())
      ? { n: parseFloat(value), unit: value.trim().replace(/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i, '') } : null;
  function relative(value, base) {
    if (typeof value !== 'string' || !/^[+-]=/.test(value)) return value;
    const a = numeric(base), b = numeric(value.slice(2));
    if (!a || !b || (a.unit && b.unit && a.unit !== b.unit)) fail('incompatible relative value "' + value + '"');
    const n = a.n + (value[0] === '+' ? 1 : -1) * b.n;
    return a.unit || b.unit ? n + (b.unit || a.unit) : n;
  }
  function interpolate(a, b, p) {
    const x = numeric(a), y = numeric(b);
    if (x && y && (!x.unit || !y.unit || x.unit === y.unit)) {
      const n = x.n + (y.n - x.n) * p, unit = y.unit || x.unit;
      return unit ? format(n) + unit : n;
    }
    return p < 1 ? a : b;
  }
  function valueAt(track, time) {
    let value = track.base;
    for (let i = 0; i < track.entries.length; i++) {
      const entry = track.entries[i];
      if (time < entry.at) {
        if (i === 0 && entry.immediate) value = entry.from;
        break;
      }
      const progress = entry.duration === 0 ? 1 : entry.ease(clamp((time - entry.at) / entry.duration));
      value = interpolate(entry.from, entry.to, progress);
    }
    return value;
  }

  class Tween {
    constructor(parent, list, from, to, options, kind, at) {
      Object.assign(this, { parent, list, from, to, options, kind, at });
      this.length = options.duration + Math.max(0, list.length - 1) * options.stagger;
    }
    startTime() { return this.at; }
    totalDuration() { return this.length; }
    duration() { return this.length; }
    timeScale() { return 1; }
    targets() { return this.list.slice(); }
    kill() { this.parent.children = this.parent.children.filter(child => child !== this); this.parent.dirty = true; return this; }
  }

  class Timeline {
    constructor(options = {}) {
      for (const key of Object.keys(options)) if (!['paused', 'defaults', 'onUpdate'].includes(key)) fail('unsupported timeline option "' + key + '"');
      this.defaults = { duration: .5, ease: 'power1.out', ...(options.defaults || {}) };
      properties(this.defaults);
      this.labels = Object.create(null);
      this.children = [];
      this.bases = new Map();
      this.tracks = [];
      this.dirty = true;
      this.position = 0;
      this.stopped = true;
      this.onUpdate = options.onUpdate;
      if (!options.paused) this.play();
    }
    duration() { return this.children.reduce((end, child) => Math.max(end, child.at + child.length), 0); }
    totalDuration() { return this.duration(); }
    timeScale() { return 1; }
    paused() { return this.stopped; }
    getChildren(_nested = true, tweens = true) { return tweens ? this.children.slice() : []; }
    _position(value) {
      if (value == null) return this.duration();
      if (typeof value === 'number') return nonnegative(value, 'position');
      if (typeof value !== 'string') fail('unsupported position "' + value + '"');
      if (own(this.labels, value)) return this.labels[value];
      if (/^\d*\.?\d+$/.test(value)) return nonnegative(value, 'position');
      const match = /^(.*?)(?:([+-])=(\d*\.?\d+))?$/.exec(value);
      const anchor = match && match[1], recent = this.children[this.children.length - 1];
      let base;
      if (anchor === '') base = this.duration();
      else if (anchor === '<') base = recent ? recent.at : 0;
      else if (anchor === '>') base = recent ? recent.at + recent.length : 0;
      else if (own(this.labels, anchor)) base = this.labels[anchor];
      else fail('unsupported or unknown position "' + value + '"');
      return nonnegative(base + (match[2] === '-' ? -1 : 1) * Number(match[3] || 0), 'position');
    }
    addLabel(name, position) { this.labels[name] = this._position(position); return this; }
    _add(kind, target, fromVars, toVars, position) {
      const vars = { ...this.defaults, ...toVars }, from = properties(fromVars), to = properties(vars);
      const options = { ...vars, duration: nonnegative(kind === 'set' ? 0 : vars.duration, 'duration'),
        stagger: nonnegative(vars.stagger || 0, 'stagger'), ease: parseEase(vars.ease),
        immediate: kind !== 'to' && kind !== 'set' && vars.immediateRender !== false };
      const list = targets(target), at = this._position(position) + nonnegative(vars.delay || 0, 'delay');
      for (const item of list) {
        let base = this.bases.get(item);
        if (!base) { base = new Map(); this.bases.set(item, base); }
        for (const key of new Set([...Object.keys(expand(item, from)), ...Object.keys(expand(item, to))])) if (!base.has(key)) base.set(key, read(item, key));
      }
      this.children.push(new Tween(this, list, from, to, options, kind, at));
      this.dirty = true;
      // Initialize from/fromTo states immediately without firing author callbacks.
      if (options.immediate) this.seek(this.position, true);
      return this;
    }
    to(target, vars, position) { return this._add('to', target, {}, vars, position); }
    from(target, vars, position) { return this._add('from', target, vars, vars, position); }
    fromTo(target, from, to, position) { return this._add('fromTo', target, from, to, position); }
    set(target, vars, position) { return this._add('set', target, {}, vars, position); }
    _compile() {
      const byTarget = new Map();
      for (const [target, bases] of this.bases) {
        const props = new Map(); byTarget.set(target, props);
        for (const [key, base] of bases) props.set(key, { target, key, base, entries: [] });
      }
      // A staggered target can start after a later-authored child. Order those actual starts before
      // inferring values, so every property track sees only events preceding its own start.
      const events = this.children.flatMap(child => child.list.map((target, index) => ({
        child, target, at: child.at + child.options.stagger * index,
      }))).sort((a, b) => a.at - b.at);
      for (const { child, target, at } of events) {
        const from = expand(target, child.from), to = expand(target, child.to);
        for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
          const track = byTarget.get(target).get(key), before = valueAt(track, at);
          const start = child.kind === 'to' || child.kind === 'set' || !own(from, key) ? before : relative(from[key], before);
          const end = child.kind === 'from' ? before : own(to, key) ? relative(to[key], start) : start;
          track.entries.push({ at, from: start, to: end, duration: child.options.duration, ease: child.options.ease, immediate: child.options.immediate });
        }
      }
      this.tracks = [...byTarget.values()].flatMap(props => [...props.values()]);
      this.dirty = false;
    }
    seek(time, suppressEvents = true) {
      const requested = nonnegative(time, 'seek time');
      this.position = Math.min(this.duration(), requested);
      if (this.dirty) this._compile();
      const dirty = new Set();
      // Compute everything before writes: setters are free to inspect other application state.
      const values = this.tracks.map(track => [track, valueAt(track, this.position)]);
      for (const [track, value] of values) write(track.target, track.key, value, dirty);
      flush(dirty);
      if (!suppressEvents) {
        for (const child of this.children) if (typeof child.options.onUpdate === 'function') child.options.onUpdate.call(child);
        if (typeof this.onUpdate === 'function') this.onUpdate.call(this);
      }
      return this;
    }
    time(value, suppressEvents = true) { return value == null ? this.position : this.seek(value, suppressEvents); }
    pause(time) { if (time != null) this.seek(time); this.stopped = true; if (this.frame != null) root.cancelAnimationFrame(this.frame); this.frame = null; return this; }
    play(time) {
      if (time != null) this.seek(time);
      if (!this.stopped) return this;
      if (typeof root.requestAnimationFrame !== 'function') fail('play requires requestAnimationFrame');
      this.stopped = false;
      const at = root.performance.now(), start = this.position;
      const step = now => {
        if (this.stopped) return;
        this.seek(start + (now - at) / 1000, false);
        if (this.position >= this.duration()) this.pause();
        else this.frame = root.requestAnimationFrame(step);
      };
      this.frame = root.requestAnimationFrame(step);
      return this;
    }
    kill() { this.pause(); this.children = []; this.dirty = true; return this; }
  }

  root.MotionX = {
    version: '1.0.0',
    timeline: options => new Timeline(options),
    parseEase,
    set(target, vars) {
      const tl = new Timeline({ paused: true });
      tl.set(target, vars, 0).seek(0);
      return tl.getChildren()[0];
    },
  };
})(typeof window === 'undefined' ? globalThis : window);
