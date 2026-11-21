// Feature: her fan favorite, the Nightcap Bath Tray, told as a short product film driven by the thumb.
//
// The four photos are laid out in one "world" at sizes that make the brass coaster / wine glass the same size in each,
// so a single virtual camera can pull back from the macro to the wide tub without a jump. Every cut is a clip-path
// transition (an iris the shape of the coaster, a diagonal wipe, a row of planks), every frame is a transform.
// The camera and the clips are scrubbed by the scroll; the type, notes and sticker are triggered at beats so they are
// always either in or out, never half way.
import './style.css';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap.js';
import { src } from '../../lib/media.js';
import { $, $$, clamp, lerp, whenNear } from '../../lib/dom.js';

const HANDLE = 'nightcap-bath-tray';

// Where things are in her photos, as fractions of each image (measured from the originals).
const COASTER = { x: 0.5969, y: 0.5688, rx: 0.1708, ry: 0.0897, tilt: 6.36 }; // photo 1: the brass coaster, a slightly tilted ellipse
const WINE = { x: 0.4563, y: 0.5506 }; // photo 3: the point that sits under the coaster when it lifts out
const RECESS_CLOSE = { x: 0.4545, y: 0.5635, rx: 0.1586 }; // photo 3: the recess the glass hangs in
const RECESS_MID = { x: 0.5802, y: 0.5371, rx: 0.0838 }; // photo 6: the same recess from further back
const COASTER_WIDE = { x: 0.5401, y: 0.5407 }; // photo 5: the coaster in the wide shot
const TRAY_WIDE = { x: 0.6, y: 0.5 }; // photo 5: where the last frame is centred
const NOTE_POINTS = [
  { shot: 0, x: 0.6, y: 0.652 }, // bottom rim of the coaster
  { shot: 1, x: 0.456, y: 0.326 }, // rim of the glass
  { shot: 2, x: 0.452, y: 0.384 }, // the carved slot
];

// The film, in timeline units (the scroll maps to 0..END).
const T = {
  irisA: [0.5, 2.0], // the coaster on paper opens into the macro shot
  lift: [2.8, 3.7], // the coaster lifts out
  irisB: [3.05, 4.0], // the wine underneath opens into the close shot
  wipe: [5.2, 6.2], // diagonal wipe to the mid shot
  pullC: [6.2, 8.0],
  planks: [8.0, 9.0], // planks rise into the wide shot
  sheet: [9.0, 11.0], // the camera pulls back and the paper slides up
  END: 12,
};
const FILM_SCROLL = 3.3; // pinned distance, in screens
const PLANKS = 5;

const r2 = (n) => Math.round(n * 100) / 100;
const norm = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const typo = (s) => String(s).replace(/"([^"]*)"/g, '“$1”').replace(/'/g, '’'); // her words, with typographic quotes

export function init(root, ctx) {
  const { FEATURE, ROOMS, productByHandle, products } = ctx.data;
  const product = productByHandle[FEATURE?.handle] || productByHandle[HANDLE];
  if (!product) return undefined;
  const bath = ROOMS.find((r) => r.key === 'bath');

  // ---------- copy and links, from her data ----------
  const words = typo(FEATURE.title).split(' ');
  const lines = [words.slice(0, 3), words.slice(3, 5), words.slice(5, 7), words.slice(7, 8)].map((w) => w.join(' '));
  const punch = words.slice(8).join(' ');
  $$('[data-line]', root).forEach((el, i) => {
    if (!lines[i]) return;
    if (el.firstElementChild) el.firstElementChild.textContent = lines[i];
    else el.textContent = lines[i];
  });
  const leadSpans = $$('[data-lead] > span', root);
  if (leadSpans[0]) leadSpans[0].textContent = words.slice(0, 5).join(' ');
  if (leadSpans[1]) leadSpans[1].textContent = words.slice(5, 8).join(' ');
  $('[data-punch]', root).textContent = punch;
  $$('[data-kicker], [data-fav]', root).forEach((el) => (el.textContent = FEATURE.kicker));
  $('[data-name]', root).textContent = product.title;
  $('[data-body]', root).textContent = typo(FEATURE.body);
  $('[data-cta]', root).textContent = FEATURE.cta;
  $('[data-price]', root).textContent = FEATURE.price;
  $('[data-index]', root).textContent = `Nº ${product.num} / ${products.length}`;
  $('[data-note="2"] span', root).textContent = product.line;
  const shop = $('[data-shop]', root);
  shop.href = product.url;
  shop.setAttribute('aria-label', `${FEATURE.cta}, ${FEATURE.price}`);
  const room = $('[data-room]', root);
  if (bath) {
    room.href = bath.url;
    $('[data-room-label]', root).textContent = bath.title;
  }
  const onSpin = () => ctx.openProduct(product.handle, { view: '3d' });
  const spin = $('[data-spin]', root);
  spin.addEventListener('click', onSpin);

  // ---------- frames ----------
  const filmEl = $('[data-film]', root);
  const frames = [
    { key: 'macro', m: product.images[0], alt: `${product.title}: the brass coaster set into the board` },
    { key: 'close', m: product.images[2], alt: `${product.title}: a glass of red wine hanging in the board` },
    { key: 'lift', m: product.images[0], alt: '' },
    { key: 'mid', m: product.images[5], alt: `${product.title} across a white tub, holding a glass of wine` },
    { key: 'wide', m: product.images[4], alt: `${product.title} spanning a white bathtub` },
  ].filter((f) => f.m);
  const shotHtml = (f, film) =>
    `<div class="s-feature__shot s-feature__shot--${f.key}" data-shot="${f.key}" style="--ph:${f.m.color}"><div class="s-feature__world"><img src="${src(f.m, 1200)}" width="${f.m.w}" height="${f.m.h}" alt="${film ? '' : esc(f.alt)}" ${
      film ? 'loading="eager" fetchpriority="low"' : 'loading="lazy"'
    } decoding="async" draggable="false"></div></div>`;

  const mm = gsap.matchMedia();
  let filmCleanup = null;

  // Stacked layout: reduced motion, very short screens, or a missing frame.
  function buildStack() {
    root.classList.remove('is-film');
    filmEl.removeAttribute('aria-hidden');
    filmEl.innerHTML = frames
      .filter((f) => f.key !== 'lift')
      .map((f) => shotHtml(f, false))
      .join('');
    return () => {
      filmEl.innerHTML = '';
    };
  }

  mm.add(
    { film: '(prefers-reduced-motion: no-preference) and (min-height: 560px)', stack: '(prefers-reduced-motion: reduce), (max-height: 559.98px)' },
    (mq) => {
      if (mq.conditions.film && frames.length === 5) {
        filmCleanup = buildFilm();
        return () => {
          filmCleanup?.();
          filmCleanup = null;
        };
      }
      return buildStack();
    },
  );

  // ---------- the film ----------
  function buildFilm() {
    root.classList.add('is-film');
    filmEl.setAttribute('aria-hidden', 'true');
    filmEl.innerHTML =
      `<div class="s-feature__shadow" data-shadow="paper"></div>` +
      `<svg class="s-feature__ring" data-ring aria-hidden="true"><path pathLength="100" d="M0 0"/></svg>` +
      shotHtml(frames[0], true) +
      shotHtml(frames[1], true) +
      `<div class="s-feature__shadow" data-shadow="lift"></div>` +
      frames.slice(2).map((f) => shotHtml(f, true)).join('');

    const pin = $('.s-feature__pin', root);
    const stage = $('.s-feature__stage', root);
    const panel = $('[data-panel]', root);
    const ring = $('[data-ring]', root);
    const ringPath = $('path', ring);
    const shadowPaper = $('[data-shadow="paper"]', root);
    const shadowLift = $('[data-shadow="lift"]', root);
    const shot = (key) => {
      const el = $(`[data-shot="${key}"]`, root);
      const img = $('img', el);
      return { key, el, world: $('.s-feature__world', el), img, r: Number(img.getAttribute('width')) / Number(img.getAttribute('height')), vis: null, p: null, base: 1 };
    };
    const macro = shot('macro');
    const close = shot('close');
    const lift = shot('lift');
    const mid = shot('mid');
    const wide = shot('wide');
    const shots = [macro, close, lift, mid, wide];
    const ratio = (s) => s.r;

    const phrases = $$('[data-phrase]', root).map((el) => ({ el, strips: $$('.s-feature__strip', el), lines: $$('[data-line]', el) }));
    const notes = $$('[data-note]', root).map((el) => ({ el, dot: $('i', el), lead: $('b', el), label: $('span', el) }));
    const tag = $('.s-feature__tag', root);
    const rolls = $$('[data-roll] > span', root);
    const fav = $('[data-fav]', root);
    const cue = $('[data-cue]', root);
    const index = $('[data-index]', root);
    const price = $('[data-price]', root);
    const leadLines = $$('[data-lead] > span', root).map((line) => {
      // wrap each line once so it can rise from behind its own clip
      if (!line.firstElementChild) line.innerHTML = `<span>${line.innerHTML}</span>`;
      return line.firstElementChild;
    });
    const punchEl = $('[data-punch]', root);
    const punchSplit = SplitText.create(punchEl, { type: 'chars', charsClass: 's-feature__char' });
    const rise = $$('[data-in]', root);

    // ----- geometry -----
    let W = 0;
    let Hs = 0; // stage height (small viewport)
    let Hf = 0; // film height (large viewport)
    let sheetTop = 0; // where the paper sheet ends up
    let sheetTravel = 0;
    let keys = [];
    let coasterW = null;
    let noteW = [];
    const visRect = () => ({ x0: 0, y0: 0, x1: W, y1: Hf });

    const at = (s, f) => ({ x: s.p.x + f.x * s.p.w, y: s.p.y + f.y * s.p.h }); // image fraction -> world point
    const pose = (S, wp, sx, sy) => ({ S, tx: sx - wp.x * S, ty: sy - wp.y * S }); // world point wp lands on screen point (sx, sy)
    const cover = (k, s, r = visRect()) => {
      // slide the camera just enough that shot s still covers rect r
      const minX = r.x1 - (s.p.x + s.p.w) * k.S;
      const maxX = r.x0 - s.p.x * k.S;
      const minY = r.y1 - (s.p.y + s.p.h) * k.S;
      const maxY = r.y0 - s.p.y * k.S;
      return { S: k.S, tx: minX > maxX ? (minX + maxX) / 2 : clamp(k.tx, minX, maxX), ty: minY > maxY ? (minY + maxY) / 2 : clamp(k.ty, minY, maxY) };
    };

    function layout() {
      W = stage.clientWidth;
      Hs = stage.clientHeight;
      Hf = Math.max(filmEl.clientHeight, Hs);
      if (!W || !Hs) return;
      const sheetH = panel.offsetHeight;
      sheetTop = Math.max(Hs - sheetH, Hs * 0.2);
      sheetTravel = sheetH + (Hf - Hs) + 4;

      // world placement: photo 1 is one unit wide; each wider photo is scaled so its recess matches the one before
      macro.p = { x: 0, y: 0, w: 1, h: 1 / ratio(macro) };
      lift.p = macro.p;
      coasterW = at(macro, COASTER);
      const w2 = COASTER.rx / RECESS_CLOSE.rx;
      const h2 = w2 / ratio(close);
      close.p = { x: coasterW.x - WINE.x * w2, y: coasterW.y - WINE.y * h2, w: w2, h: h2 };
      const recess = at(close, RECESS_CLOSE);
      const w3 = (w2 * RECESS_CLOSE.rx) / RECESS_MID.rx;
      const h3 = w3 / ratio(mid);
      mid.p = { x: recess.x - RECESS_MID.x * w3, y: recess.y - RECESS_MID.y * h3, w: w3, h: h3 };

      const fit = (s) => Math.max(W / s.p.w, Hf / s.p.h); // px per world unit at which shot s just covers the film
      const c1 = fit(macro);
      const c2 = fit(close);
      const c3 = fit(mid);
      const cx = W * 0.5;
      const cy = Hs * 0.555;
      const S0 = Math.max(c1 * 1.3, (W * 0.82) / (2 * COASTER.rx));
      const kMid = cover(pose(c3 * 1.006, recess, W * 0.45, Hs * 0.54), mid);
      const kMid2 = cover(pose(c3 * 1.003, recess, W * 0.45, Hs * 0.54), mid);

      // the wide photo does not need an exact match (the glass is gone); give it room to cover the film at the cut
      const hx = kMid2.tx + recess.x * kMid2.S;
      const hy = kMid2.ty + recess.y * kMid2.S;
      const r4 = ratio(wide);
      const need = Math.max(hx / COASTER_WIDE.x, (W - hx) / (1 - COASTER_WIDE.x), (hy * r4) / COASTER_WIDE.y, ((Hf - hy) * r4) / (1 - COASTER_WIDE.y)) / kMid2.S;
      const w4 = Math.max(2.3, need * 1.05);
      const h4 = w4 / r4;
      wide.p = { x: recess.x - COASTER_WIDE.x * w4, y: recess.y - COASTER_WIDE.y * h4, w: w4, h: h4 };
      const top = { x0: 0, y0: 0, x1: W, y1: sheetTop };
      const S9 = Math.max(W / w4, sheetTop / h4) * 1.08;
      const tray = at(wide, TRAY_WIDE);

      const inOut = gsap.parseEase('sine.inOut');
      keys = [
        { t: 0, ...pose(S0, coasterW, cx, cy) },
        { t: T.irisA[0], ...pose(S0 * 0.985, coasterW, cx, cy) },
        { t: T.irisA[1], ...cover(pose(Math.max(c1 * 1.2, S0 * 0.88), coasterW, cx, cy), macro) },
        { t: T.lift[0], ...cover(pose(c1 * 1.13, coasterW, cx, cy), macro) },
        { t: T.irisB[1], ...cover(cover(pose(Math.max(c1 * 1.05, c2 * 1.1), coasterW, cx, cy), macro), close) },
        { t: T.wipe[0], ...cover(pose(c2 * 1.008, coasterW, cx, cy), close) },
        { t: T.wipe[1], ...cover(pose(c2 * 1.003, coasterW, cx, cy), close) },
        { t: T.pullC[1], ...kMid, ease: inOut },
        { t: T.planks[1], ...kMid2 },
        { t: T.sheet[1], ...cover(pose(S9, tray, W * 0.5, sheetTop * 0.5), wide, top), ease: inOut },
        { t: T.END, ...cover(pose(S9 * 0.955, tray, W * 0.5, sheetTop * 0.5), wide, top) },
      ];
      noteW = NOTE_POINTS.map((n) => at([macro, close, mid][n.shot], n));

      shots.forEach((s) => {
        s.base = fit(s);
        s.world.style.width = `${r2(s.p.w * s.base)}px`;
        s.world.style.height = `${r2(s.p.h * s.base)}px`;
      });
      ring.setAttribute('viewBox', `0 0 ${W} ${Hf}`);
    }

    // the camera at time t: zoom is interpolated exponentially (a steady dolly), position along the straight line between keys
    function camera(t) {
      let i = 0;
      while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
      const a = keys[i];
      const b = keys[i + 1];
      let k = clamp((t - a.t) / (b.t - a.t), 0, 1);
      if (b.ease) k = b.ease(k);
      const S = a.S * Math.pow(b.S / a.S, k);
      const u = Math.abs(b.S - a.S) < 0.001 ? k : (S - a.S) / (b.S - a.S);
      return { S, tx: lerp(a.tx, b.tx, u), ty: lerp(a.ty, b.ty, u), u };
    }

    const show = (s, on) => {
      if (s.vis === on) return;
      s.vis = on;
      s.el.style.visibility = on ? 'visible' : 'hidden';
    };
    const setClip = (el, v) => {
      if (el._clip === v) return;
      el._clip = v;
      el.style.clipPath = v;
      el.style.webkitClipPath = v;
    };
    const place = (s, c) => {
      s.world.style.transform = `translate3d(${r2(c.tx + s.p.x * c.S)}px,${r2(c.ty + s.p.y * c.S)}px,0) scale(${Math.round((c.S / s.base) * 10000) / 10000})`;
    };
    const easeIn = gsap.parseEase('power2.in');
    const easeInOut = gsap.parseEase('power2.inOut');
    const wipeEase = gsap.parseEase('power1.inOut');

    const state = { t: 0 };
    const intro = { p: 0, spin: -80, s: 0 }; // the coaster's entrance: scale, spin, shadow scale
    const gates = { head: false, disc: false };
    let sheetIn = false;
    let shotIdx = -1;

    // a tilted ellipse as a clip-path: the outline of the brass coaster
    const ellipse = (x, y, rx, ry, deg = COASTER.tilt) => {
      const rad = (deg * Math.PI) / 180;
      const dx = rx * Math.cos(rad);
      const dy = rx * Math.sin(rad);
      const arc = `A${r2(rx)} ${r2(ry)} ${deg} 1 0 `;
      return `path("M${r2(x - dx)} ${r2(y - dy)}${arc}${r2(x + dx)} ${r2(y + dy)}${arc}${r2(x - dx)} ${r2(y - dy)}Z")`;
    };
    const setVis = (el, on) => {
      if (el._on === on) return;
      el._on = on;
      el.style.visibility = on ? 'visible' : 'hidden';
    };

    function render() {
      if (!keys.length) return;
      const t = state.t;
      const c = camera(t);

      // the coaster on screen: centre and radii of its ellipse
      const qx = c.tx + coasterW.x * c.S;
      const qy = c.ty + coasterW.y * c.S;
      const a = COASTER.rx * 0.985 * c.S;
      const b = COASTER.ry * macro.p.h * 0.985 * c.S;
      const R = 1.08 * Math.hypot(Math.max(qx, W - qx), Math.max(qy, Hf - qy));
      const origin = `${r2(qx)}px ${r2(qy)}px`;

      // 1. macro: starts as the coaster alone on the paper, then the iris opens around it
      const onMacro = t < T.irisB[1];
      show(macro, onMacro);
      const k1 = norm(t, T.irisA);
      const onPaper = onMacro && k1 < 1;
      setVis(shadowPaper, onPaper);
      setVis(ring, onPaper);
      if (onMacro) {
        place(macro, c);
        setClip(macro.el, k1 < 1 ? ellipse(qx, qy, a * Math.pow(R / a, k1), b * Math.pow(R / b, k1)) : 'none');
        // the entrance: the coaster spins up from nothing, like a sticker landing
        const popped = intro.p === 1 && intro.spin === 0;
        if (macro.el._popped !== popped || !popped) {
          macro.el._popped = popped;
          macro.el.style.transformOrigin = origin;
          macro.el.style.transform = popped ? 'none' : `rotate(${r2(intro.spin)}deg) scale(${r2(intro.p)})`;
        }
      }
      if (onPaper) {
        // its hard shadow (the shadow of her badge) and the thin ring live on the paper only
        const off = W * 0.016;
        setClip(shadowPaper, ellipse(qx + off, qy + off * 1.25, a, b));
        shadowPaper.style.transformOrigin = origin;
        shadowPaper.style.transform = intro.s === 1 ? 'none' : `scale(${r2(intro.s)})`;
        const r0 = W * 0.47;
        const rr = r2(r0 * Math.pow((R * 1.12) / r0, k1));
        ringPath.setAttribute('d', `M${r2(qx)} ${r2(qy - rr)}a${rr} ${rr} 0 1 1 0 ${2 * rr}a${rr} ${rr} 0 1 1 0 ${-2 * rr}`);
      }

      // 2. close: revealed where the coaster was, then opens to the whole frame
      const onClose = t >= T.lift[0] && t < T.wipe[1];
      show(close, onClose);
      if (onClose) {
        place(close, c);
        const k = norm(t, T.irisB);
        const a2 = a * 0.97;
        const b2 = b * 0.97;
        setClip(close.el, k < 1 ? ellipse(qx, qy, a2 * Math.pow(R / a2, k), b2 * Math.pow(R / b2, k)) : 'none');
      }

      // 3. the coaster lifts out and flies off the top
      const onLift = t >= T.lift[0] && t < T.lift[1];
      show(lift, onLift);
      setVis(shadowLift, onLift);
      if (onLift) {
        place(lift, c);
        const k = easeIn(norm(t, T.lift));
        const dy = -(qy + b * 2.2 + 30) * k;
        const sc = 1 + 0.42 * k;
        const turn = -16 * k;
        const move = `translate3d(0,${r2(dy)}px,0) rotate(${r2(turn)}deg) scale(${r2(sc)})`;
        setClip(lift.el, ellipse(qx, qy, a, b));
        lift.el.style.transformOrigin = origin;
        lift.el.style.transform = move;
        const off = W * 0.075 * Math.sqrt(k);
        setClip(shadowLift, ellipse(qx, qy, a, b));
        shadowLift.style.transformOrigin = origin;
        shadowLift.style.transform = `translate3d(${r2(off)}px,${r2(off * 1.25)}px,0) ${move}`;
      }

      // 4. mid: a diagonal wipe, rising to the right
      const onMid = t >= T.wipe[0] && t < T.planks[1];
      show(mid, onMid);
      if (onMid) {
        place(mid, c);
        if (t < T.wipe[1]) {
          const k = wipeEase(norm(t, T.wipe));
          const slope = W * 0.46;
          const yL = lerp(Hf + slope + 2, -2, k);
          setClip(mid.el, `polygon(0px ${r2(yL)}px, ${W}px ${r2(yL - slope)}px, ${W}px ${Hf + 4}px, 0px ${Hf + 4}px)`);
        } else setClip(mid.el, 'none');
      }

      // 5. wide: planks rise from the bottom, left to right
      const onWide = t >= T.planks[0];
      show(wide, onWide);
      if (onWide) {
        place(wide, c);
        if (t < T.planks[1]) {
          const k = norm(t, T.planks);
          const lag = 0.11;
          let d = `0px ${Hf + 4}px`;
          for (let i = 0; i < PLANKS; i++) {
            const ki = easeInOut(clamp((k * (1 + lag * (PLANKS - 1)) - lag * i) / 1, 0, 1));
            const y = r2((Hf + 4) * (1 - ki) - (ki >= 1 ? 4 : 0));
            const x0 = r2((W * i) / PLANKS);
            const x1 = i === PLANKS - 1 ? W + 2 : r2((W * (i + 1)) / PLANKS);
            d += `, ${i === 0 ? -2 : x0}px ${y}px, ${x1}px ${y}px`;
          }
          setClip(wide.el, `polygon(${d}, ${W + 2}px ${Hf + 4}px)`);
        } else setClip(wide.el, 'none');
      }

      // 6. the sheet of paper slides up as the camera reaches the wide frame
      const sk = t < T.sheet[0] ? 0 : t >= T.sheet[1] ? 1 : c.u;
      if (panel._k !== sk) {
        panel._k = sk;
        panel.style.transform = `translate3d(0,${r2((1 - sk) * sheetTravel)}px,0)`;
      }

      // notes follow their point on the piece
      notes.forEach((n, i) => {
        const p = noteW[i];
        n.el.style.transform = `translate3d(${r2(c.tx + p.x * c.S)}px,${r2(c.ty + p.y * c.S)}px,0)`;
      });

      sync(t);
    }

    // ----- triggered pieces: each is simply in or out -----
    const E = { out: 'wb.out', inout: 'wb.inout', snap: 'wb.snap' };
    const phraseIn = (p) => {
      gsap.killTweensOf([p.strips, p.lines]);
      gsap.set(p.el, { autoAlpha: 1 });
      gsap.fromTo(p.strips, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: E.inout, stagger: 0.1 });
      gsap.fromTo(p.lines, { yPercent: 115 }, { yPercent: 0, duration: 0.85, ease: E.out, stagger: 0.1, delay: 0.14 });
    };
    const phraseOut = (p) => {
      gsap.killTweensOf([p.strips, p.lines]);
      gsap.to(p.strips, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.5, ease: E.inout, stagger: 0.06, onComplete: () => gsap.set(p.el, { autoAlpha: 0 }) });
    };
    const noteIn = (n) => {
      gsap.killTweensOf([n.dot, n.lead, n.label]);
      gsap.set(n.el, { autoAlpha: 1 });
      gsap.fromTo(n.dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: E.snap });
      gsap.fromTo(n.lead, { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: E.out, delay: 0.12 });
      gsap.fromTo(n.label, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: E.snap, delay: 0.24 });
    };
    const noteOut = (n) => {
      gsap.killTweensOf([n.dot, n.lead, n.label]);
      gsap.to([n.label, n.lead, n.dot], {
        scale: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        stagger: 0.04,
        onComplete: () => {
          gsap.set(n.el, { autoAlpha: 0 });
          gsap.set([n.label, n.lead, n.dot], { opacity: 1 });
        },
      });
    };
    const pop = (el, on, { rot = 12, delay = 0 } = {}) => {
      gsap.killTweensOf(el);
      if (on) gsap.fromTo(el, { scale: 0, rotation: rot, opacity: 1 }, { scale: 1, rotation: 0, duration: 0.7, ease: E.snap, delay });
      else gsap.to(el, { scale: 0, rotation: -rot, duration: 0.3, ease: 'power2.in' });
    };
    const fade = (el, on, delay = 0) => gsap.to(el, { autoAlpha: on ? 1 : 0, y: on ? 0 : 8, duration: on ? 0.6 : 0.25, delay: on ? delay : 0, ease: E.out, overwrite: true });

    const discIn = () => {
      gsap.killTweensOf([intro, ringPath]);
      gsap.fromTo(intro, { p: 0, spin: -80 }, { p: 1, spin: 0, duration: 1.05, ease: E.snap, onUpdate: render });
      gsap.fromTo(intro, { s: 0 }, { s: 1, duration: 0.9, ease: E.snap, delay: 0.12 });
      gsap.fromTo(ringPath, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.3, ease: E.inout, delay: 0.1 });
    };
    const discOut = () => {
      gsap.killTweensOf([intro, ringPath]);
      gsap.to(intro, { p: 0, s: 0, spin: -80, duration: 0.3, ease: 'power2.in', onUpdate: render });
      gsap.to(ringPath, { strokeDashoffset: 100, duration: 0.3, ease: 'power2.in' });
    };

    const sheetContent = [rise, leadLines, punchSplit.chars, price];
    const sheetReset = () => {
      sheetIn = false;
      gsap.killTweensOf(sheetContent.flat());
      gsap.set(rise, { opacity: 0, y: 18 });
      gsap.set(leadLines, { yPercent: 115 });
      gsap.set(punchSplit.chars, { yPercent: 70, rotation: (i) => (i % 2 ? 14 : -14), scale: 0.6, opacity: 0 });
      gsap.set(price, { scale: 0, rotation: 30 });
    };
    const sheetPlay = () => {
      sheetIn = true;
      gsap.killTweensOf(sheetContent.flat());
      gsap.to(rise[0], { opacity: 1, y: 0, duration: 0.6, ease: E.out });
      gsap.to(leadLines, { yPercent: 0, duration: 0.85, ease: E.out, stagger: 0.09, delay: 0.05 });
      gsap.to(punchSplit.chars, { yPercent: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.7, ease: E.snap, stagger: 0.045, delay: 0.22 });
      gsap.to(rise.slice(1), { opacity: 1, y: 0, duration: 0.7, ease: E.out, stagger: 0.09, delay: 0.5 });
      gsap.to(price, { scale: 1, rotation: 0, duration: 0.75, ease: E.snap, delay: 0.75 });
    };

    // each cue: visible while its gate is open and t is inside [from, to)
    const cues = [
      { gate: 'head', from: -1, to: T.lift[0] + 0.05, on: () => phraseIn(phrases[0]), off: () => phraseOut(phrases[0]) },
      { gate: 'head', from: T.irisB[0] + 0.45, to: T.wipe[0] + 0.25, on: () => phraseIn(phrases[1]), off: () => phraseOut(phrases[1]) },
      { gate: 'head', from: -1, to: 99, on: () => pop(tag, true, { rot: -8 }), off: () => pop(tag, false, { rot: -8 }) },
      { gate: 'head', from: -1, to: T.sheet[0] + 0.5, on: () => pop(fav, true, { delay: 0.12 }), off: () => pop(fav, false) },
      { gate: 'disc', from: -1, to: 99, on: discIn, off: discOut },
      { gate: 'disc', from: -1, to: T.irisA[0] + 0.45, on: () => fade([cue, index], true, 0.5), off: () => fade([cue, index], false) },
      { gate: 'head', from: T.irisA[1] - 0.35, to: T.lift[0] - 0.1, on: () => noteIn(notes[0]), off: () => noteOut(notes[0]) },
      { gate: 'head', from: T.irisB[1] - 0.15, to: T.wipe[0] + 0.1, on: () => noteIn(notes[1]), off: () => noteOut(notes[1]) },
      { gate: 'head', from: T.pullC[1] - 0.75, to: T.planks[0] + 0.3, on: () => noteIn(notes[2]), off: () => noteOut(notes[2]) },
    ].map((cue) => ({ ...cue, live: false }));

    function sync(t) {
      cues.forEach((q) => {
        const live = gates[q.gate] && t >= q.from && t < q.to;
        if (live === q.live) return;
        q.live = live;
        if (live) q.on();
        else q.off();
      });
      const idx = t < T.irisB[0] + 0.3 ? 0 : t < T.wipe[0] + 0.5 ? 1 : t < T.planks[0] + 0.5 ? 2 : 3;
      if (idx !== shotIdx) {
        shotIdx = idx;
        gsap.to(rolls, { yPercent: -25 * idx, duration: 0.7, ease: E.inout, stagger: 0.06, overwrite: true });
      }
      if (!sheetIn && t >= T.sheet[0] + 1.05) sheetPlay();
      else if (sheetIn && t < T.sheet[0] + 0.05) sheetReset();
    }

    // ----- hidden start states (set here, never in CSS) -----
    gsap.set(phrases.map((p) => p.el), { autoAlpha: 0 });
    gsap.set(notes.map((n) => n.el), { autoAlpha: 0 });
    gsap.set([tag, fav], { scale: 0 });
    gsap.set([cue, index], { autoAlpha: 0, y: 8 });
    gsap.set(ringPath, { strokeDasharray: 100, strokeDashoffset: 100 });
    sheetReset();

    layout();
    render();

    // ----- scroll -----
    const setGate = (name, on) => {
      gates[name] = on;
      sync(state.t);
    };
    const triggers = [
      ScrollTrigger.create({ trigger: pin, start: 'top 74%', onEnter: () => setGate('head', true), onLeaveBack: () => setGate('head', false) }),
      ScrollTrigger.create({ trigger: pin, start: 'top 34%', onEnter: () => setGate('disc', true), onLeaveBack: () => setGate('disc', false) }),
    ];
    const tl = gsap.timeline({ defaults: { ease: 'none' } }).to(state, { t: T.END, duration: T.END, onUpdate: render });
    const film = ScrollTrigger.create({
      animation: tl,
      trigger: pin,
      start: 'top top',
      end: () => `+=${Math.round(pin.offsetHeight * FILM_SCROLL)}`,
      pin: true,
      anticipatePin: 1,
      scrub: 0.7,
    });
    triggers.push(film);
    const onRefreshInit = () => layout();
    const onRefresh = () => render();
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
    ScrollTrigger.addEventListener('refresh', onRefresh);

    // the copy is the last frame of a pinned film: if focus lands in it early, go there
    const onFocus = () => {
      if (state.t < T.sheet[1] - 0.1) window.scrollTo(0, film.end - 2);
    };
    panel.addEventListener('focusin', onFocus);

    // decode the frames before the pin starts, so no cut waits on an image
    let alive = true;
    whenNear(root, '150%').then(() => {
      if (!alive) return;
      shots.forEach((s) => s.img.decode?.().catch(() => {}));
    });
    const onLoad = () => {
      layout();
      render();
    };
    shots.forEach((s) => s.img.complete || s.img.addEventListener('load', onLoad, { once: true }));

    return () => {
      alive = false;
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      panel.removeEventListener('focusin', onFocus);
      triggers.forEach((st) => st.kill());
      tl.kill();
      const touched = [...phrases.flatMap((p) => [p.el, ...p.strips, ...p.lines]), ...notes.flatMap((n) => [n.el, n.dot, n.lead, n.label]), tag, fav, cue, index, price, ...rise, ...leadLines, ...rolls];
      gsap.killTweensOf(touched);
      punchSplit.revert();
      gsap.set(touched, { clearProps: 'all' });
      panel.style.transform = '';
      panel._k = undefined;
      filmEl.innerHTML = '';
      root.classList.remove('is-film');
    };
  }

  return () => {
    mm.revert();
    spin.removeEventListener('click', onSpin);
  };
}
