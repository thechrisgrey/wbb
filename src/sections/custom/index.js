// custom: commissions, and a moment of pure play.
// The headline lands big (the last word in her chunky display face, sized gutter to gutter), then her eight
// wordmark letters tumble into a tray as tiles you can grab and throw. They spin with the throw, bounce off the
// tray walls and settle with a little snap. "Tidy up" lines them up to spell WoodBaby; tap again to scatter.
// Her sentence and the way in to a custom piece follow.
import './style.css';
import { gsap, ScrollTrigger, SplitText, Draggable, InertiaPlugin, linesReveal, riseIn, reducedMotion } from '../../lib/gsap.js';
import { $, $$, clamp, pad2 } from '../../lib/dom.js';
import { WORDMARK } from '../../brand/marks.js';

// Tile fills chosen to read on the orange field (no orange tile on orange).
const COLORS = ['', 'tile--ink', 'tile--paper', 'tile--brass', 'tile--blush', 'tile--ink', '', 'tile--paper'];

// The pile they land in: each tile's place as a fraction of the free space in the tray, and its resting tilt.
const PILE = [
  [0.06, 0.1, -12],
  [0.5, 0.02, 9],
  [0.94, 0.2, 15],
  [0.32, 0.38, -6],
  [0.04, 0.64, 11],
  [0.72, 0.52, -17],
  [0.38, 0.94, 6],
  [0.96, 0.86, -9],
];
const PAD = 8; // keep tiles (and their hard shadow) off the tray edge

const tileMarkup = (l, i) =>
  `<div class="s-custom__tile" data-i="${i}"><span class="tile ${COLORS[i]}"><svg viewBox="${l.vb}" aria-hidden="true" focusable="false"><path d="${l.d}" fill-rule="evenodd"/></svg></span></div>`;

export function init(root, ctx) {
  const data = ctx?.data || {};
  const motion = !(ctx?.reduced ?? reducedMotion());

  const area = $('[data-area]', root);
  const tilesEl = $('[data-tiles]', root);
  const big = $('[data-big]', root);
  const lead = $('[data-lead]', root);
  const tidyBtn = $('[data-tidy]', root);
  const tidyLabel = $('[data-tidy-label]', root);
  const throwsEl = $('[data-throws]', root);
  const ctaWrap = $('[data-cta-wrap]', root);
  const sticker = $('[data-sticker]', root);

  // ---------- her copy ----------
  const C = data.CUSTOM;
  if (C) {
    const words = C.title.trim().split(/\s+/);
    const last = words.pop();
    const yourAt = words.lastIndexOf('your');
    lead.innerHTML = words.map((w, i) => (i === yourAt ? `<span class="t-serif">${w}</span>` : w)).join(' ');
    big.textContent = last;
    $('[data-body]', root).textContent = C.body;
    const a = $('[data-cta]', root);
    a.href = C.url;
    a.firstChild.textContent = `${C.cta} `;
  }

  // ---------- tiles ----------
  tilesEl.innerHTML = WORDMARK.letters.map(tileMarkup).join('');
  const tiles = $$('.s-custom__tile', tilesEl);
  const inner = tiles.map((t) => t.firstElementChild);

  // ---------- fit the display word to the column ----------
  const fitBig = () => {
    const W = big.parentElement.clientWidth;
    const fs = parseFloat(getComputedStyle(big).fontSize) || 1;
    const em = big.offsetWidth / fs;
    if (W > 0 && em > 0) root.style.setProperty('--fs-big', `${Math.min(W / em, 260).toFixed(2)}px`);
  };

  // ---------- tray geometry ----------
  const geo = { W: 0, H: 0, ts: 78 };
  const sizeTiles = () => {
    const W = area.clientWidth;
    geo.ts = Math.round(motion ? clamp(W * 0.215, 62, 104) : clamp((W - 56) / 4, 52, 96));
    root.style.setProperty('--ts', `${geo.ts}px`);
    geo.W = W;
    geo.H = area.clientHeight;
  };
  const free = () => ({ x: Math.max(1, geo.W - geo.ts - PAD * 2), y: Math.max(1, geo.H - geo.ts - PAD * 2) });
  const fromFrac = (fx, fy) => {
    const f = free();
    return { x: PAD + fx * f.x, y: PAD + fy * f.y };
  };
  const toFrac = (x, y) => {
    const f = free();
    return { fx: clamp((x - PAD) / f.x, 0, 1), fy: clamp((y - PAD) / f.y, 0, 1) };
  };
  /** Wood on the top row, Baby under it, centred in the tray. Always in her order. */
  const tidySpot = (i) => {
    const gx = Math.round(geo.ts * 0.1);
    const gy = Math.round(geo.ts * 0.2);
    const rowW = geo.ts * 4 + gx * 3;
    const x0 = (geo.W - rowW) / 2;
    const y0 = (geo.H - (geo.ts * 2 + gy)) / 2;
    return { x: x0 + (i % 4) * (geo.ts + gx), y: y0 + Math.floor(i / 4) * (geo.ts + gy) };
  };

  fitBig();
  sizeTiles();

  // ---------- reduced motion: the tidy word, still ----------
  if (!motion) {
    const onRefresh = () => {
      fitBig();
      sizeTiles();
    };
    document.fonts?.ready.then(fitBig);
    ScrollTrigger.addEventListener('refreshInit', onRefresh);
    tidyBtn.hidden = true;
    $('[data-hint]', root).textContent = 'WoodBaby';
    return () => ScrollTrigger.removeEventListener('refreshInit', onRefresh);
  }

  // ---------- live ----------
  root.classList.add('is-live');
  sizeTiles();

  const state = tiles.map((_, i) => ({ fx: PILE[i][0], fy: PILE[i][1], rot: PILE[i][2] }));
  let landed = false; // the tumble-in has finished
  let tidy = false;
  let throws = 0;
  let touched = false;
  let drags = [];
  let idle = null;

  const bounds = () => ({ minX: PAD, maxX: geo.W - geo.ts - PAD, minY: PAD, maxY: geo.H - geo.ts - PAD });

  const setTidy = (on) => {
    tidy = on;
    tidyBtn.setAttribute('aria-pressed', String(on));
    tidyLabel.textContent = on ? 'Scatter' : 'Tidy up';
  };

  const bumpThrows = () => {
    throws += 1;
    throwsEl.textContent = pad2(Math.min(throws, 99));
    gsap.fromTo(throwsEl, { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'wb.out', overwrite: true });
  };

  /** Nearest angle to `cur` that rests at `rest` (so a spun tile settles the short way round). */
  const restNear = (cur, rest) => rest + Math.round((cur - rest) / 360) * 360;

  /** A tile comes to rest: settle its tilt with a snap and a small squash, remember where it lies. */
  const land = (i, soft = false) => {
    const t = tiles[i];
    const s = state[i];
    s.rot = gsap.utils.random(-15, 15, 1);
    const cur = Number(gsap.getProperty(t, 'rotation')) || 0;
    gsap.to(t, { rotation: restNear(cur, s.rot), duration: 0.7, ease: 'wb.snap', overwrite: 'auto' });
    if (!soft) {
      gsap.fromTo(inner[i], { scaleX: 1.12, scaleY: 0.86 }, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1.1, 0.4)', overwrite: true });
    }
    Object.assign(s, toFrac(Number(gsap.getProperty(t, 'x')), Number(gsap.getProperty(t, 'y'))));
    shove(i);
  };

  /** A tile that lands on another knocks it out of the way, so the pile never hides a letter. */
  const shove = (i) => {
    const b = bounds();
    const ax = Number(gsap.getProperty(tiles[i], 'x'));
    const ay = Number(gsap.getProperty(tiles[i], 'y'));
    const min = geo.ts * 0.98;
    tiles.forEach((o, j) => {
      if (j === i || drags[j]?.isPressed || drags[j]?.isThrowing) return;
      const ox = Number(gsap.getProperty(o, 'x'));
      const oy = Number(gsap.getProperty(o, 'y'));
      let dx = ox - ax;
      let dy = oy - ay;
      const d = Math.hypot(dx, dy);
      if (d >= min) return;
      if (d < 1) {
        dx = ax > geo.W / 2 ? -1 : 1;
        dy = 0.3;
      }
      const k = min / (Math.hypot(dx, dy) || 1);
      let nx = clamp(ax + dx * k, b.minX, b.maxX);
      let ny = clamp(ay + dy * k, b.minY, b.maxY);
      // pinned against a wall: slide along it instead
      if (Math.hypot(nx - ax, ny - ay) < min * 0.9) {
        if (nx === b.minX || nx === b.maxX) ny = clamp(ay + (dy >= 0 ? min : -min), b.minY, b.maxY);
        else nx = clamp(ax + (dx >= 0 ? min : -min), b.minX, b.maxX);
      }
      const cur = Number(gsap.getProperty(o, 'rotation')) || 0;
      gsap.to(o, { x: nx, y: ny, rotation: cur + (dx >= 0 ? 14 : -14), duration: 0.55, ease: 'wb.snap', overwrite: 'auto', onComplete: () => drags[j]?.update() });
      Object.assign(state[j], toFrac(nx, ny));
      state[j].rot = cur + (dx >= 0 ? 14 : -14);
    });
  };

  /** Put every tile where its state says (no animation): used after a resize. */
  const place = () => {
    tiles.forEach((t, i) => {
      const p = tidy ? tidySpot(i) : fromFrac(state[i].fx, state[i].fy);
      gsap.set(t, { x: p.x, y: p.y, rotation: tidy ? 0 : state[i].rot });
    });
    drags.forEach((d) => {
      d.applyBounds(bounds());
      d.update();
    });
  };

  // ---------- the drag and the throw ----------
  const makeDrag = (t, i) => {
    let lastX = 0;
    let lastT = 0;
    let lean = 0;
    const leanTo = gsap.quickTo(t, 'rotation', { duration: 0.35, ease: 'power3.out' });
    return Draggable.create(t, {
      type: 'x,y',
      inertia: true,
      bounds: bounds(),
      edgeResistance: 0.65,
      overshootTolerance: 0.6,
      throwResistance: 900,
      minDuration: 0.35,
      maxDuration: 1.4,
      zIndexBoost: true,
      allowContextMenu: true,
      enabled: false,
      onPress() {
        touched = true;
        gsap.killTweensOf(t, 'rotation');
        gsap.to(inner[i], { scale: 1.1, duration: 0.3, ease: 'wb.out', overwrite: true });
        lastX = this.x;
        lastT = performance.now();
        lean = Number(gsap.getProperty(t, 'rotation')) || 0;
      },
      onDrag() {
        // the tile leans into the direction it is being dragged
        const now = performance.now();
        const v = ((this.x - lastX) / Math.max(now - lastT, 8)) * 16;
        lastX = this.x;
        lastT = now;
        leanTo(lean + clamp(v * 2.2, -32, 32));
      },
      onRelease() {
        gsap.to(inner[i], { scale: 1, duration: 0.5, ease: 'wb.snap', overwrite: 'auto' });
        if (!this.isThrowing) return;
        // spin with the throw, for as long as the throw lasts
        const vx = InertiaPlugin.getVelocity(t, 'x') || 0;
        const vy = InertiaPlugin.getVelocity(t, 'y') || 0;
        const speed = Math.hypot(vx, vy);
        const spin = clamp((vx >= 0 ? 1 : -1) * speed * 0.16, -420, 420);
        const cur = Number(gsap.getProperty(t, 'rotation')) || 0;
        gsap.to(t, { rotation: cur + spin, duration: this.tween ? this.tween.duration() : 0.6, ease: 'power3.out', overwrite: 'auto' });
        if (speed > 120) bumpThrows();
        if (tidy) setTidy(false);
      },
      onThrowComplete() {
        land(i);
      },
      onDragEnd() {
        if (!this.isThrowing) land(i, true);
      },
      onClick() {
        // a tap: the tile hops and flips
        if (tidy) setTidy(false);
        gsap
          .timeline({ overwrite: true })
          .to(inner[i], { y: -geo.ts * 0.42, rotation: '+=180', duration: 0.26, ease: 'power2.out' })
          .to(inner[i], { y: 0, rotation: '+=180', duration: 0.5, ease: 'bounce.out' })
          .set(inner[i], { rotation: 0 });
      },
    })[0];
  };
  drags = tiles.map(makeDrag);

  // ---------- tidy up / scatter ----------
  const doTidy = () => {
    setTidy(true);
    gsap.killTweensOf(tiles);
    tiles.forEach((t, i) => {
      const p = tidySpot(i);
      const cur = Number(gsap.getProperty(t, 'rotation')) || 0;
      gsap.to(t, { x: p.x, y: p.y, rotation: restNear(cur, 0), duration: 0.85, delay: i * 0.055, ease: 'wb.snap' });
    });
    // then a little wave runs through the name, in reading order
    gsap.fromTo(inner, { y: 0 }, { keyframes: [{ y: -geo.ts * 0.22, duration: 0.18, ease: 'power2.out' }, { y: 0, duration: 0.42, ease: 'bounce.out' }], stagger: 0.06, delay: 0.95, overwrite: true });
    gsap.delayedCall(1.4, () => drags.forEach((d) => d.update()));
  };

  const doScatter = () => {
    setTidy(false);
    gsap.killTweensOf(tiles);
    const order = gsap.utils.shuffle(PILE.map((p) => p.slice()));
    tiles.forEach((t, i) => {
      const s = state[i];
      const [fx, fy] = order[i];
      s.fx = clamp(fx + gsap.utils.random(-0.06, 0.06), 0, 1);
      s.fy = clamp(fy + gsap.utils.random(-0.06, 0.06), 0, 1);
      s.rot = gsap.utils.random(-16, 16, 1);
      const p = fromFrac(s.fx, s.fy);
      const cur = Number(gsap.getProperty(t, 'rotation')) || 0;
      const spin = gsap.utils.random([-1, 1]) * gsap.utils.random(180, 360, 1);
      gsap.to(t, { x: p.x, duration: 0.9, delay: i * 0.03, ease: 'power3.out' });
      gsap.to(t, { y: p.y, duration: 0.9, delay: i * 0.03, ease: 'wb.snap' });
      gsap.to(t, { rotation: restNear(cur + spin, s.rot), duration: 1, delay: i * 0.03, ease: 'power3.out' });
    });
    gsap.delayedCall(1.2, () => drags.forEach((d) => d.update()));
  };

  const onTidy = () => {
    if (!landed) return;
    touched = true;
    if (tidy) doScatter();
    else doTidy();
  };
  tidyBtn.addEventListener('click', onTidy);

  // ---------- an idle nudge until the first touch: one tile wiggles, as if it wants to be picked up ----------
  const nudge = () => {
    if (touched) return;
    const i = gsap.utils.random([0, 4, 6]);
    gsap.timeline().to(inner[i], { keyframes: { rotation: [0, -9, 8, -5, 3, 0], y: [0, -6, 0, -3, 0, 0] }, duration: 0.7, ease: 'none' });
    idle = gsap.delayedCall(2.6, nudge);
  };

  // ---------- resize ----------
  const onRefresh = () => {
    fitBig();
    sizeTiles();
    if (landed) place();
  };
  ScrollTrigger.addEventListener('refreshInit', onRefresh);
  document.fonts?.ready.then(fitBig);

  const triggers = [];
  const gctx = gsap.context(() => {
    // headline: the lead rises line by line, the big word drops in a letter at a time
    linesReveal(lead, { start: 'top 86%' });
    riseIn($$('.s-custom__top > *', root), { start: 'top 94%', y: 14 });
    const chars = SplitText.create(big, { type: 'chars', charsClass: 's-custom__ch' }).chars;
    fitBig();
    gsap.set(chars, { yPercent: -70, rotation: (k) => (k % 2 ? 14 : -14), autoAlpha: 0 });
    triggers.push(
      ScrollTrigger.create({
        trigger: big,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(chars, { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.7, stagger: 0.04, ease: 'wb.snap' }),
      }),
    );

    // tray captions
    riseIn($$('.s-custom__bar > *, .s-custom__meta', root), { start: 'top 92%', y: 14 });

    // tiles wait above the tray (clipped by it), then tumble in and land scattered
    tiles.forEach((t, i) => {
      const p = fromFrac(state[i].fx, state[i].fy);
      gsap.set(t, { x: p.x, y: -geo.ts * 1.6 - i * 30, rotation: gsap.utils.random(-170, 170, 1) });
    });
    triggers.push(
      ScrollTrigger.create({
        trigger: area,
        start: 'top 72%',
        once: true,
        onEnter: () => {
          const order = [3, 0, 5, 1, 6, 2, 7, 4];
          order.forEach((i, k) => {
            const t = tiles[i];
            const p = fromFrac(state[i].fx, state[i].fy);
            gsap.set(t, { x: p.x });
            gsap.to(t, { y: p.y, duration: 1.05, delay: k * 0.085, ease: 'bounce.out' });
            gsap.to(t, {
              rotation: state[i].rot,
              duration: 1.1,
              delay: k * 0.085,
              ease: 'wb.snap',
              onComplete: () => {
                if (k === order.length - 1) {
                  landed = true;
                  drags.forEach((d) => {
                    d.enable();
                    d.applyBounds(bounds());
                    d.update();
                  });
                  idle = gsap.delayedCall(1.4, nudge);
                }
              },
            });
          });
        },
      }),
    );
    // stop the idle nudge when the tray is off screen, resume when it comes back
    triggers.push(
      ScrollTrigger.create({
        trigger: area,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          if (!landed || touched) return;
          if (self.isActive) idle = idle || gsap.delayedCall(1.2, nudge);
          else {
            idle?.kill();
            idle = null;
          }
        },
      }),
    );

    // the way in: body rises, the button follows (its wrapper moves, the button keeps its own press), the sticker pops
    riseIn($('.s-custom__body', root), { start: 'top 90%', y: 24 });
    gsap.set(ctaWrap, { autoAlpha: 0, y: 22 });
    gsap.set(sticker, { scale: 0, rotation: -30 });
    triggers.push(
      ScrollTrigger.create({
        trigger: $('.s-custom__act', root),
        start: 'top 92%',
        once: true,
        onEnter: () => {
          gsap.to(ctaWrap, { autoAlpha: 1, y: 0, duration: 0.85 });
          gsap.to(sticker, { scale: 1, rotation: 0, duration: 0.75, delay: 0.25, ease: 'wb.snap' });
        },
      }),
    );
  }, root);

  return () => {
    tidyBtn.removeEventListener('click', onTidy);
    ScrollTrigger.removeEventListener('refreshInit', onRefresh);
    idle?.kill();
    triggers.forEach((t) => t.kill());
    drags.forEach((d) => d.kill());
    gctx.revert();
  };
}
