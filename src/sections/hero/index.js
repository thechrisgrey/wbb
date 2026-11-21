// Hero. Her stool build plays as a phone story (progress bars, one-word chapter captions, tap to skip,
// hold to pause). Her wordmark sits on top as letter tiles. Scrolling pins the screen: the story shrinks
// into a tilted card, the tiles scatter and regroup beside it, "absurdly well made." rises, and an orange
// field wipes up to hand off to the next section.
import './style.css';
import { gsap, ScrollTrigger, reducedMotion } from '../../lib/gsap.js';
import { WORDMARK } from '../../brand/marks.js';
import { asset } from '../../lib/media.js';
import { pad2 } from '../../lib/dom.js';

const TILE_COLORS = ['', 'tile--orange', 'tile--ink', 'tile--brass', 'tile--blush', '', 'tile--orange', 'tile--ink'];
const MAST_TILT = [-7, 5, -3, 6, -5, 4, -6, 3];
const STACK_TILT = [-4, 3, -2, 4, 3, -3, 2, -4];
const SCATTER_SPIN = [-210, 160, -120, 240, 190, -230, 140, -170];
const SCATTER_AT = [
  [0.1, 0.2, 1.25],
  [0.36, 0.12, 0.95],
  [0.16, 0.44, 1.5],
  [0.42, 0.34, 1.05],
  [0.08, 0.66, 1.1],
  [0.36, 0.58, 1.4],
  [0.22, 0.82, 0.95],
  [0.5, 0.76, 1.2],
];
const TILE_PX = 64;

export function init(root, ctx) {
  const { BUILD_VIDEO } = ctx.data;
  const reduced = reducedMotion();
  const $ = (sel) => root.querySelector(sel);
  const pin = $('.s-hero__pin');
  const frame = $('[data-hero-frame]');
  const video = $('[data-hero-video]');
  const barsEl = $('[data-hero-bars]');
  const wordEl = $('[data-hero-word]');
  const countEl = $('[data-hero-count]');
  const playBtn = $('[data-hero-play]');
  const slot = $('[data-hero-slot]');
  const mast = $('[data-hero-mast]');
  const stack = $('[data-hero-stack]');
  const tilesEl = $('[data-hero-tiles]');
  const chapters = BUILD_VIDEO.chapters;
  const duration = BUILD_VIDEO.duration;

  // ---------- build tiles, ghosts and bars ----------
  mast.innerHTML = '<i></i>'.repeat(8);
  stack.innerHTML = '<i></i>'.repeat(8);
  tilesEl.innerHTML = WORDMARK.letters
    .map((l, i) => `<div class="s-hero__tile"><span class="tile ${TILE_COLORS[i]}"><svg viewBox="${l.vb}"><path d="${l.d}" fill-rule="evenodd"/></svg></span></div>`)
    .join('');
  const tiles = [...tilesEl.children];
  const tileInner = tiles.map((t) => t.firstElementChild);
  barsEl.innerHTML = chapters.map(() => '<span style="flex:1"><i></i></span>').join('');
  const fills = [...barsEl.querySelectorAll('i')];

  // ---------- story ----------
  const saveData = navigator.connection?.saveData;
  video.poster = asset(BUILD_VIDEO.poster);
  video.src = asset(saveData || window.innerWidth < 340 ? BUILD_VIDEO.src720 : BUILD_VIDEO.src1080);
  let chapter = -1;
  let wantPlay = true;
  let inView = true;

  const tryPlay = () => {
    if (!wantPlay || !inView) return;
    const p = video.play();
    if (p?.then) p.then(() => (playBtn.hidden = true)).catch(() => (playBtn.hidden = false));
  };

  function setWord(text) {
    const old = [...wordEl.children];
    const next = document.createElement('span');
    next.className = 's-hero__w';
    next.style.cssText = 'position:absolute;left:0;bottom:0;display:flex;';
    next.innerHTML = [...text].map((ch) => `<span>${ch}</span>`).join('');
    wordEl.appendChild(next);
    // long words ("Clamp.", "Reveal.") shrink to stay inside the frame
    const room = frame.offsetWidth - 2 * parseFloat(getComputedStyle(wordEl).left || 16) - 6;
    if (next.offsetWidth > room) next.style.fontSize = `${(room / next.offsetWidth).toFixed(3)}em`;
    if (reduced) {
      old.forEach((n) => n.remove());
      return;
    }
    old.forEach((n) =>
      gsap.to(n.children, { yPercent: 120, rotation: () => gsap.utils.random(-28, 28), autoAlpha: 0, duration: 0.3, stagger: 0.025, ease: 'power2.in', overwrite: true, onComplete: () => n.remove() }),
    );
    gsap.fromTo(
      next.children,
      { yPercent: -70, rotation: () => gsap.utils.random(-24, 24), scale: 0.4, autoAlpha: 0 },
      { yPercent: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.62, stagger: 0.045, ease: 'wb.snap', delay: 0.08 },
    );
  }

  const numEl = $('[data-hero-num]');
  const chapWord = $('[data-hero-chapword]');
  function setChapter(i) {
    const first = chapter < 0;
    chapter = i;
    countEl.textContent = `${pad2(i + 1)} / ${pad2(chapters.length)}`;
    chapWord.textContent = chapters[i].word.replace('.', '');
    setWord(chapters[i].word);
    // the poster numeral beside the card rolls with the story
    if (reduced || first) numEl.textContent = pad2(i + 1);
    else {
      gsap.killTweensOf(numEl);
      gsap.to(numEl, {
        yPercent: -105,
        duration: 0.24,
        ease: 'power2.in',
        onComplete() {
          numEl.textContent = pad2(i + 1);
          gsap.fromTo(numEl, { yPercent: 105 }, { yPercent: 0, duration: 0.5, ease: 'wb.out' });
        },
      });
    }
  }

  function tick() {
    if (!inView) return;
    const t = video.currentTime || 0;
    let idx = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (t >= chapters[i].t) {
        idx = i;
        break;
      }
    }
    if (idx !== chapter) setChapter(idx);
    for (let i = 0; i < fills.length; i++) {
      const start = chapters[i].t;
      const end = i + 1 < chapters.length ? chapters[i + 1].t : duration;
      const v = i < idx ? 1 : i > idx ? 0 : Math.min(1, Math.max(0, (t - start) / (end - start)));
      fills[i].style.transform = `scaleX(${v.toFixed(4)})`;
    }
  }
  gsap.ticker.add(tick);

  // tap to skip, hold to pause
  let holdTimer = 0;
  let held = false;
  const onDown = () => {
    held = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      held = true;
      video.pause();
    }, 230);
  };
  const onUp = () => {
    clearTimeout(holdTimer);
    if (held) tryPlay();
  };
  const onZone = (e) => {
    const zone = e.target.closest('[data-hero-zone]');
    if (!zone) return;
    if (held) {
      held = false;
      return;
    }
    const n = chapters.length;
    const to = (((chapter < 0 ? 0 : chapter) + +zone.dataset.heroZone) % n + n) % n;
    video.currentTime = chapters[to].t + 0.02;
    tryPlay();
    if (!reduced) gsap.fromTo(fills[to].parentElement, { scaleY: 2.6 }, { scaleY: 1, duration: 0.5, ease: 'wb.out' });
  };
  frame.addEventListener('pointerdown', onDown);
  frame.addEventListener('pointerup', onUp);
  frame.addEventListener('pointercancel', onUp);
  frame.addEventListener('click', onZone);
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    wantPlay = true;
    tryPlay();
  });
  $('[data-hero-piece]')?.addEventListener('click', () => ctx.openProduct(BUILD_VIDEO.product, { view: '3d' }));

  // ---------- geometry: where the frame and the tiles start and land ----------
  const geom = { frame: { x: 0, y: 0, s: 1 }, mast: [], stack: [], scatter: [] };
  function box(el) {
    let x = 0;
    let y = 0;
    let n = el;
    while (n && n !== pin) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function measure() {
    pin.style.setProperty('--hero-ar', (frame.offsetWidth / frame.offsetHeight).toFixed(4));
    const f = box(frame);
    const s = box(slot);
    const scale = Math.min(s.w / f.w, s.h / f.h);
    // the card hugs the right edge of its slot; transform-origin is the frame's centre
    const cardW = f.w * scale;
    const cardH = f.h * scale;
    geom.frame = { x: s.x + s.w - cardW / 2 - (f.x + f.w / 2), y: s.y + cardH / 2 - (f.y + f.h / 2), s: scale };
    const cell = (c) => {
      const b = box(c);
      return { x: b.x, y: b.y, s: b.w / TILE_PX };
    };
    geom.mast = [...mast.children].map(cell);
    geom.stack = [...stack.children].map(cell);
    const W = pin.offsetWidth;
    const H = pin.offsetHeight;
    // thrown to the left and low, clear of where the card is heading (upper right)
    geom.scatter = SCATTER_AT.map(([fx, fy, s]) => ({ x: W * fx - (TILE_PX * s) / 2, y: H * fy - (TILE_PX * s) / 2, s }));
  }

  const lines = root.querySelectorAll('.s-hero__line > span');
  const sub = $('[data-hero-sub]');
  const lede = $('[data-hero-lede]');
  const actions = [...root.querySelectorAll('.s-hero__act')];
  const chap = $('[data-hero-chap]');
  const top = $('[data-hero-top]');
  const cue = $('[data-hero-cue]');
  const meta = $('[data-hero-meta]');
  let tl = null;
  let cueTween = null;

  const placeFinal = () => {
    measure();
    gsap.set(frame, { x: geom.frame.x, y: geom.frame.y, scale: geom.frame.s, rotation: 3.5, borderRadius: 26 / geom.frame.s });
    tiles.forEach((t, i) => gsap.set(t, { x: geom.stack[i].x, y: geom.stack[i].y, scale: geom.stack[i].s, rotation: STACK_TILT[i], transformOrigin: '0 0' }));
    gsap.set([top, cue, meta], { autoAlpha: 0 });
  };

  if (reduced) {
    placeFinal();
    window.addEventListener('resize', placeFinal);
  } else {
    measure();
    gsap.set(frame, { transformOrigin: '50% 50%' });
    tiles.forEach((t) => gsap.set(t, { transformOrigin: '0 0' }));
    ScrollTrigger.addEventListener('refreshInit', measure);

    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle(self) {
          inView = self.isActive || self.progress === 0;
          if (inView) tryPlay();
          else video.pause();
        },
      },
    });

    // the story becomes a card
    tl.fromTo(
      frame,
      { x: 0, y: 0, scale: 1, rotation: 0, borderRadius: 0 },
      { x: () => geom.frame.x, y: () => geom.frame.y, scale: () => geom.frame.s, rotation: 3.5, borderRadius: () => 26 / geom.frame.s, ease: 'power2.inOut', duration: 40 },
      0,
    )
      .to([top, cue, meta], { autoAlpha: 0, duration: 7 }, 0)
      .fromTo(video, { scale: 1 }, { scale: 1.08, duration: 40 }, 0);

    // tiles: masthead, thrown apart, regroup as Wood / Baby beside the card
    tiles.forEach((t, i) => {
      tl.fromTo(
        t,
        { x: () => geom.mast[i].x, y: () => geom.mast[i].y, scale: () => geom.mast[i].s, rotation: MAST_TILT[i] },
        { x: () => geom.scatter[i].x, y: () => geom.scatter[i].y, scale: () => geom.scatter[i].s, rotation: SCATTER_SPIN[i], ease: 'power2.in', duration: 17, immediateRender: true },
        1 + i * 1.1,
      ).to(t, { x: () => geom.stack[i].x, y: () => geom.stack[i].y, scale: () => geom.stack[i].s, rotation: STACK_TILT[i], ease: 'back.out(1.5)', duration: 24 }, 24 + i * 1.7);
    });

    // the line she is known for
    tl.fromTo(sub, { autoAlpha: 0, yPercent: 60 }, { autoAlpha: 1, yPercent: 0, duration: 9, ease: 'power2.out' }, 27)
      .fromTo(lines, { yPercent: 118 }, { yPercent: 0, duration: 17, stagger: 5, ease: 'power3.out' }, 29)
      .fromTo(lede, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 11, ease: 'power2.out' }, 47)
      .fromTo(actions, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 11, stagger: 4, ease: 'back.out(1.9)' }, 53)
      .fromTo(chap, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 12, ease: 'power2.out' }, 40)
      // Everything has landed by the halfway mark. The rest of the pin is a short hold, then the orange
      // manifesto slides up over this screen (it overlaps the last 100svh of the pin, see base.css),
      // while the card leans and the copy drifts up a touch underneath it.
      .to(frame, { rotation: -3, yPercent: -4, duration: 44, ease: 'power1.in' }, 84)
      .to(root.querySelector('.s-hero__copy'), { yPercent: -10, duration: 44, ease: 'power1.in' }, 84)
      .to({}, { duration: 0.001 }, 128);

    // intro, once the preloader lifts
    gsap.set(tileInner, { y: () => -window.innerHeight * 0.5, rotation: () => gsap.utils.random(-140, 140), autoAlpha: 0 });
    gsap.set([barsEl, top, meta, cue], { autoAlpha: 0 });
    ctx.onEntered(() => {
      tryPlay();
      gsap.to(tileInner, { y: 0, rotation: 0, autoAlpha: 1, duration: 1.15, stagger: 0.07, ease: 'bounce.out', delay: 0.25 });
      gsap.fromTo(barsEl, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, autoAlpha: 1, duration: 0.9, ease: 'wb.out', delay: 0.2 });
      gsap.to([top, meta, cue], { autoAlpha: 1, duration: 0.8, stagger: 0.1, delay: 0.9 });
      cueTween = gsap.fromTo(cue.querySelector('i'), { scaleY: 0 }, { scaleY: 1, duration: 1.1, ease: 'power2.inOut', repeat: -1, yoyo: true, delay: 1.2 });
    });
  }
  if (reduced) ctx.onEntered(tryPlay);

  return () => {
    gsap.ticker.remove(tick);
    ScrollTrigger.removeEventListener('refreshInit', measure);
    window.removeEventListener('resize', placeFinal);
    cueTween?.kill();
    tl?.scrollTrigger?.kill();
    tl?.kill();
    video.pause();
  };
}
