// Maker: her, at work. "made by the woman you watch make them."
// 1. Her line, very large, rising line by line from behind masks.
// 2. An editorial collage: a big workshop frame that opens with a clip and drifts inside itself, two smaller prints
//    laid over it at slight angles that move at their own depth, and a turning seal that speeds up with the scroll.
// 3. The build as a deck of prints in the order of her stool video. Drag the top print and throw it: it flies off
//    with rotation and lands at the back of the deck. A giant orange numeral rolls behind the deck to the new step.
// 4. Her mission with line reveals, the facts she states on thin rules that draw in, and her letters as tiles.
import './style.css';
import { gsap, ScrollTrigger, SplitText, Draggable, riseIn } from '../../lib/gsap.js';
import { $, $$, clamp, pad2 } from '../../lib/dom.js';
import { asset, img } from '../../lib/media.js';
import { BADGE, WORDMARK } from '../../brand/marks.js';

// Build stills (public/media/build/<file>.webp, 606x1080), one per chapter of her build video (BUILD_VIDEO.chapters).
const STILL = {
  cut: { file: 'saw', alt: 'Cutting a board on the table saw', ph: '#9b8b78' },
  join: { file: 'chisel', alt: 'Chiselling out a joint at the bench', ph: '#a59880' },
  clamp: { file: 'clamps', alt: 'The glue-up held in red clamps', ph: '#6b5c4c' },
  burn: { file: 'torch', alt: 'Charring the wood with a torch', ph: '#b59a78' },
  paint: { file: 'paint', alt: 'Painting the crane by hand, by the sea', ph: '#6f6a64' },
  reveal: { file: 'stool', alt: 'The finished Yakisugi Crane Stool', ph: '#3d3a30' },
  sit: { file: 'sit', alt: 'Sitting on the finished stool', ph: '#8a8178' },
};
const FALLBACK_CHAPTERS = ['cut', 'join', 'clamp', 'burn', 'paint', 'reveal', 'sit'].map((key) => ({ key, word: key[0].toUpperCase() + key.slice(1) + '.' }));

// Resting pose of each depth in the deck: a loose, hand-dropped stack. Index 0 is the top print.
const SLOTS = [
  { x: 0, y: 0, rotation: -1.5, scale: 1 },
  { x: 7, y: -12, rotation: 4.5, scale: 0.955 },
  { x: -8, y: -22, rotation: -6, scale: 0.91 },
  { x: 3, y: -30, rotation: 8, scale: 0.87 },
];
const slot = (i) => ({ ...SLOTS[Math.min(i, SLOTS.length - 1)], autoAlpha: i < SLOTS.length ? 1 : 0 });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const still = (name) => asset(`media/build/${name}.webp`);
const stillImg = (name, alt, lazy = true) =>
  `<img src="${still(name)}" width="606" height="1080" alt="${esc(alt)}" ${lazy ? 'loading="lazy" ' : ''}decoding="async" draggable="false">`;

/** The seal: her phrases set on a circle around her WB badge. */
function sealMarkup() {
  const { shadow, outline, fill } = BADGE.layers;
  const words = 'handmade in Nashville · made to order · one of a kind · ';
  return `
    <svg class="s-maker__ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs><path id="s-maker-circle" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs>
      <text><textPath href="#s-maker-circle" textLength="288" lengthAdjust="spacing">${words}</textPath></text>
    </svg>
    <svg class="s-maker__mark" viewBox="${BADGE.viewBox}" aria-hidden="true" focusable="false">
      <path d="${shadow}" fill="#16130f" fill-rule="evenodd"/><path d="${outline}" fill="#16130f" fill-rule="evenodd"/><path d="${fill}" fill="#eee5c1" fill-rule="evenodd"/>
    </svg>`;
}

/** Split one element into masked lines and return a paused reveal that survives re-splits. */
function maskedLines(el, { delay = 0, stagger = 0.09, y = 112 } = {}) {
  const state = { played: false, tween: null };
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: 's-maker__ln',
    autoSplit: true,
    onSplit(self) {
      state.tween = gsap.fromTo(self.lines, { yPercent: y }, { yPercent: 0, duration: 1.1, stagger, delay: state.played ? 0 : delay, ease: 'wb.out', paused: !state.played });
      return state.tween;
    },
  });
  return {
    play() {
      state.played = true;
      state.tween?.play();
    },
  };
}

export function init(root, ctx) {
  const { maker, BRAND, MISSION, BUILD_VIDEO } = ctx.data;
  const motion = !ctx.reduced;
  const cleanups = [];

  // ---------- copy (hers, from the data) ----------
  if (MISSION) {
    $('[data-mission-kicker]', root).textContent = MISSION.kicker;
    const t = MISSION.title.replace(/\.$/, '');
    const cut = t.lastIndexOf('functional art');
    $('[data-mission-title]', root).innerHTML =
      cut > 0 ? `${esc(t.slice(0, cut))}<span class="t-serif">${esc(t.slice(cut))}.</span>` : esc(MISSION.title);
    $('[data-mission-body]', root).innerHTML = MISSION.body.map((p, i) => `<p${i === 0 ? ' class="t-lede"' : ''}>${esc(p)}</p>`).join('');
  }
  if (BRAND?.shopAll) $('[data-shop]', root).href = BRAND.shopAll;

  // ---------- collage ----------
  const plates = {
    main: $('[data-plate="main"] [data-frame]', root),
    face: $('[data-plate="face"] [data-frame]', root),
    hand: $('[data-plate="hand"] [data-frame]', root),
  };
  plates.main.style.setProperty('--ph', '#b8a993');
  plates.main.innerHTML = stillImg('mallet', 'She sets a joint with a mallet in her workshop');
  if (maker?.snapchat) {
    plates.face.style.setProperty('--ph', maker.snapchat.color);
    plates.face.innerHTML = img(maker.snapchat, { alt: 'Portrait of the maker', sizes: '(min-width: 900px) 26vw, 40vw' });
  }
  plates.hand.style.setProperty('--ph', '#6a4a34');
  plates.hand.innerHTML = stillImg('crane', 'Her hand painting a crane onto charred wood');
  const seal = $('[data-seal]', root);
  seal.innerHTML = sealMarkup();

  // ---------- tiles: her wordmark letters ----------
  const tilesEl = $('[data-tiles]', root);
  tilesEl.innerHTML = WORDMARK.letters
    .map((l, i) => `<span class="tile${i === 4 ? ' tile--orange' : ''}"><svg viewBox="${l.vb}" aria-hidden="true" focusable="false"><path d="${l.d}" fill-rule="evenodd"/></svg></span>`)
    .join('');

  // ---------- facts: a rule above each row that can draw in ----------
  $$('.s-maker__fact', root).forEach((f) => f.insertAdjacentHTML('afterbegin', '<i class="s-maker__rule" aria-hidden="true"></i>'));

  // ---------- the deck ----------
  const chapters = (BUILD_VIDEO?.chapters?.length ? BUILD_VIDEO.chapters : FALLBACK_CHAPTERS).filter((c) => STILL[c.key]);
  const N = chapters.length;
  const deckEl = $('[data-deck]', root);
  deckEl.innerHTML = chapters
    .map((c, i) => {
      const s = STILL[c.key];
      return `
      <li class="s-maker__card" data-i="${i}" aria-label="${pad2(i + 1)} of ${pad2(N)}: ${esc(c.word.replace(/\.$/, ''))}">
        <div class="s-maker__print" style="--ph:${s.ph}">${stillImg(s.file, s.alt, i > 2)}</div>
        <p class="s-maker__label"><b>${esc(c.word.replace(/\.$/, '').toLowerCase())}</b><span class="t-cap">${pad2(i + 1)} / ${pad2(N)}</span></p>
      </li>`;
    })
    .join('');
  const cards = $$('.s-maker__card', deckEl);
  const segsEl = $('[data-segs]', root);
  segsEl.innerHTML = chapters.map(() => '<i><b></b></i>').join('');
  const segs = $$('b', segsEl);
  const big = $('[data-big]', root);
  big.innerHTML = `<span class="s-maker__bignum">${pad2(1)}</span>`;
  const nowN = $('[data-now-n]', root);
  const nowW = $('[data-now-w]', root);

  let order = cards.slice(); // order[0] is the print on top
  let step = 0; // which chapter is on top
  const D = motion ? 1 : 0; // durations collapse to zero with reduced motion

  const stack = () => order.forEach((c, i) => (c.style.zIndex = String(N - i)));
  const place = (c, i, opts = {}) => gsap.to(c, { ...slot(i), duration: 0.75 * D, ease: 'wb.out', overwrite: 'auto', ...opts });

  function readout(dir) {
    const k = Number(order[0].dataset.i);
    if (k === step && dir) return;
    step = k;
    nowN.textContent = `${pad2(k + 1)} / ${pad2(N)}`;
    nowW.textContent = chapters[k].word.replace(/\.$/, '');
    segs.forEach((b, i) => gsap.to(b, { scaleX: i <= k ? 1 : 0, duration: 0.5 * D, ease: 'wb.out', overwrite: true }));

    // the poster numeral rolls to the new step: old number leaves one way, new one arrives from the other
    const old = $('.s-maker__bignum', big);
    const next = document.createElement('span');
    next.className = 's-maker__bignum';
    next.textContent = pad2(k + 1);
    big.appendChild(next);
    if (!motion || !old) {
      old?.remove();
      return;
    }
    const d = dir || 1;
    gsap.fromTo(next, { yPercent: 100 * d }, { yPercent: 0, duration: 0.8, ease: 'wb.inout' });
    gsap.to(old, { yPercent: -100 * d, duration: 0.8, ease: 'wb.inout', onComplete: () => old.remove() });
    if (motion) gsap.fromTo(nowW, { yPercent: 60 * d, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'wb.out', overwrite: true });
  }

  /** Throw the top print off to one side; it slides back in underneath the others. */
  function fling(dir = 1, velocity = 0) {
    const card = order[0];
    order = order.slice(1).concat(card);
    drags.forEach((d, i) => (cards[i] === order[0] ? d.enable() : d.disable()));
    const sx = Number(gsap.getProperty(card, 'x')) || 0;
    const far = dir * (window.innerWidth * 0.62 + card.offsetWidth * 0.75);
    const speed = Math.max(Math.abs(velocity), 1400);
    const t = clamp(Math.abs(far - sx) / speed, 0.28, 0.5);

    gsap.killTweensOf(card);
    const tl = gsap.timeline();
    tl.to(card, { x: far, y: -36 - Math.min(Math.abs(velocity) / 40, 40), rotation: dir * (22 + Math.min(Math.abs(velocity) / 120, 16)), scale: 0.96, duration: t * D, ease: 'power2.out' })
      .add(stack)
      .to(card, { ...slot(N - 1), autoAlpha: 1, duration: 0.7 * D, ease: 'wb.out' })
      .set(card, { autoAlpha: slot(N - 1).autoAlpha });

    // everything beneath moves up one place, with a little snap
    order.slice(0, -1).forEach((c, i) => place(c, i, { duration: 0.7 * D, ease: 'wb.snap', delay: 0.04 * i * D }));
    readout(1);
  }

  /** Bring the print at the back back to the top, from the left. */
  function unfling() {
    const card = order[order.length - 1];
    order = [card].concat(order.slice(0, -1));
    gsap.killTweensOf(card);
    stack();
    drags.forEach((d, i) => (cards[i] === card ? d.enable() : d.disable()));
    gsap.fromTo(
      card,
      { x: -(window.innerWidth * 0.62 + card.offsetWidth * 0.75), y: -50, rotation: -26, scale: 0.96, autoAlpha: 1 },
      { ...slot(0), duration: 0.75 * D, ease: 'wb.out', overwrite: true },
    );
    order.slice(1).forEach((c, i) => place(c, i + 1, { duration: 0.6 * D }));
    readout(-1);
  }

  // drag the top print sideways; vertical swipes keep scrolling the page (touch-action: pan-y)
  let vx = 0;
  let lastX = 0;
  let lastT = 0;
  let moved = false;
  const drags = cards.map((card) =>
    Draggable.create(card, {
      type: 'x',
      zIndexBoost: false,
      allowContextMenu: true,
      minimumMovement: 4,
      onPress() {
        gsap.killTweensOf(card);
        vx = 0;
        lastX = this.x;
        lastT = performance.now();
        moved = false;
      },
      onDrag() {
        const now = performance.now();
        const dt = Math.max(now - lastT, 8);
        vx = vx * 0.4 + ((this.x - lastX) / dt) * 1000 * 0.6;
        lastX = this.x;
        lastT = now;
        moved = true;
        const w = card.offsetWidth || 1;
        gsap.set(card, { rotation: SLOTS[0].rotation + this.x * 0.075, y: -Math.abs(this.x) * 0.06, scale: 1 + Math.min(Math.abs(this.x) / w, 1) * 0.02 });
        hideHint();
      },
      onRelease() {
        if (!moved) return;
        const now = performance.now();
        const v = now - lastT > 90 ? 0 : vx; // a pause before letting go cancels the throw
        const w = card.offsetWidth || 1;
        const x = this.x;
        const thrown = Math.abs(x) > w * 0.34 || (Math.abs(v) > 520 && Math.sign(v) === Math.sign(x) && Math.abs(x) > 10);
        if (thrown) fling(Math.sign(x) || 1, v);
        else gsap.to(card, { ...slot(0), duration: 0.65 * D, ease: 'wb.snap', overwrite: true });
      },
    })[0],
  );
  drags.forEach((d, i) => i > 0 && d.disable());

  const hint = $('[data-hint]', root);
  let hinted = false;
  function hideHint() {
    if (hinted) return;
    hinted = true;
    gsap.to(hint, { autoAlpha: 0.35, duration: 0.4 });
  }

  const onNext = () => fling(1, 0);
  const onPrev = () => unfling();
  $('[data-next]', root).addEventListener('click', onNext);
  $('[data-prev]', root).addEventListener('click', onPrev);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') onNext();
    else if (e.key === 'ArrowLeft') onPrev();
    else return;
    e.preventDefault();
  };
  deckEl.tabIndex = 0;
  deckEl.addEventListener('keydown', onKey);
  cleanups.push(() => {
    $('[data-next]', root).removeEventListener('click', onNext);
    $('[data-prev]', root).removeEventListener('click', onPrev);
    deckEl.removeEventListener('keydown', onKey);
    drags.forEach((d) => d.kill());
  });

  // resting deck
  stack();
  order.forEach((c, i) => gsap.set(c, slot(i)));
  segs.forEach((b, i) => gsap.set(b, { scaleX: i === 0 ? 1 : 0, transformOrigin: 'left center' }));

  // ---------- motion ----------
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const collage = $('[data-collage]', root);
    const deckwrap = $('[data-deckwrap]', root);

    // 1. headline: each line rises from behind its mask, the serif "you watch" a beat later and from further down
    const hl = $$('.s-maker__hl', root).map((el, k) => maskedLines(el, { delay: 0.1 * k + (k === 1 ? 0.06 : 0), y: k === 1 ? 125 : 112 }));
    riseIn($$('.s-maker__head .s-maker__eyebrow', root), { start: 'top 92%', y: 18 });
    ScrollTrigger.create({ trigger: $('.s-maker__h', root), start: 'top 86%', once: true, onEnter: () => hl.forEach((h) => h.play()) });

    // 2. collage: the big frame opens from the bottom while its photo settles, scrubbed by the scroll
    const mainFig = plates.main;
    const mainImg = $('img', mainFig);
    gsap
      .timeline({ scrollTrigger: { trigger: collage, start: 'top 92%', end: 'top 30%', scrub: 0.6 } })
      .fromTo(mainFig, { clipPath: 'inset(100% 0% 0% 0% round 4px)' }, { clipPath: 'inset(0% 0% 0% 0% round 4px)', ease: 'power2.out', duration: 1 }, 0)
      .fromTo(mainImg, { scale: 1.32 }, { scale: 1.1, ease: 'power1.out', duration: 1 }, 0);
    gsap.fromTo(mainImg, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: collage, start: 'top bottom', end: 'bottom top', scrub: true } });

    // the two small prints arrive tilted and keep drifting at their own depth
    const facePlate = $('[data-plate="face"]', root);
    const handPlate = $('[data-plate="hand"]', root);
    gsap
      .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: collage, start: 'top bottom', end: 'bottom top', scrub: 0.8 } })
      .fromTo(facePlate, { y: 110, rotation: 9 }, { y: -50, rotation: -2, duration: 1 }, 0)
      .fromTo(handPlate, { y: 120, rotation: -10 }, { y: -30, rotation: 2, duration: 1 }, 0)
      .fromTo(seal, { y: 60 }, { y: -40, duration: 1 }, 0);
    gsap.set([facePlate, handPlate], { autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: collage,
      start: 'top 80%',
      once: true,
      onEnter: () => gsap.to([facePlate, handPlate], { autoAlpha: 1, duration: 0.6, stagger: 0.12, ease: 'none' }),
    });
    riseIn($$('.s-maker__fig', root), { start: 'top 96%', y: 12 });

    // the seal pops like a sticker, then turns for as long as it is on screen; scroll speed winds it up
    const ring = $('.s-maker__ring', seal);
    gsap.set(seal, { scale: 0, rotation: -40 });
    ScrollTrigger.create({ trigger: seal, start: 'top 90%', once: true, onEnter: () => gsap.to(seal, { scale: 1, rotation: 0, duration: 0.9, ease: 'wb.snap' }) });
    const spin = gsap.to(ring, { rotation: 360, duration: 22, ease: 'none', repeat: -1, transformOrigin: '50% 50%', paused: true });
    let settle;
    const spinST = ScrollTrigger.create({
      trigger: collage,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? spin.play() : spin.pause()),
      onUpdate(self) {
        const v = self.getVelocity();
        gsap.to(spin, { timeScale: (v < 0 ? -1 : 1) * (1 + Math.min(7, Math.abs(v) / 260)), duration: 0.25, overwrite: true });
        clearTimeout(settle);
        settle = setTimeout(() => gsap.to(spin, { timeScale: v < 0 ? -1 : 1, duration: 1.2, overwrite: true }), 140);
      },
    });

    // 3. the deck is dealt onto the table, the numeral rises behind it, then the top print nudges to say "throw me"
    const bigNum = $('.s-maker__bignum', big);
    riseIn($$('.s-maker__deckhead .s-maker__eyebrow, .s-maker__ctrl', root), { start: 'top 94%', y: 20 });
    order.forEach((c, i) => gsap.set(c, { y: 260 + i * 40, rotation: (i % 2 ? 1 : -1) * (14 + i * 3), autoAlpha: 0 }));
    gsap.set(bigNum, { yPercent: 100 });
    const deal = gsap.timeline({ paused: true });
    deal.to(bigNum, { yPercent: 0, duration: 1.1, ease: 'wb.out' }, 0);
    order
      .slice()
      .reverse()
      .forEach((c, k) => {
        const i = order.length - 1 - k;
        deal.to(c, { ...slot(i), duration: 0.9, ease: 'wb.snap' }, 0.1 + k * 0.07);
      });
    deal.add(() => {
      const top = order[0];
      if (hinted || Number(gsap.getProperty(top, 'x'))) return;
      gsap
        .timeline({ delay: 0.25 })
        .to(top, { x: 34, rotation: SLOTS[0].rotation + 4, y: -4, duration: 0.42, ease: 'power2.out' })
        .to(top, { x: 0, rotation: SLOTS[0].rotation, y: 0, duration: 0.8, ease: 'wb.snap' });
    });
    ScrollTrigger.create({ trigger: deckwrap, start: 'top 72%', once: true, onEnter: () => deal.play() });

    // 4. mission: kicker and title lines, then the body; rules draw across, facts slide in; tiles drop and lock
    const title = maskedLines($('[data-mission-title]', root), { stagger: 0.085 });
    ScrollTrigger.create({ trigger: $('[data-mission-title]', root), start: 'top 86%', once: true, onEnter: () => title.play() });
    riseIn($$('.s-maker__kicker, .s-maker__body > p', root), { start: 'top 90%', y: 24 });

    const rules = $$('.s-maker__rule', root);
    const factText = $$('.s-maker__fact dt, .s-maker__fact dd', root);
    gsap.set(rules, { scaleX: 0 });
    gsap.set(factText, { autoAlpha: 0, x: -14 });
    ScrollTrigger.create({
      trigger: $('.s-maker__facts', root),
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(rules, { scaleX: 1, duration: 1.1, stagger: 0.1, ease: 'wb.inout' });
        gsap.to(factText, { autoAlpha: 1, x: 0, duration: 0.8, stagger: 0.05, delay: 0.2, ease: 'wb.out' });
      },
    });

    const tiles = $$('.tile', tilesEl);
    tiles.forEach((t, i) => gsap.set(t, { y: -140 - (i % 3) * 40, rotation: gsap.utils.random(-50, 50, 1), autoAlpha: 0 }));
    ScrollTrigger.create({
      trigger: tilesEl,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(tiles, { y: 0, rotation: 0, autoAlpha: 1, duration: 0.95, ease: 'wb.snap', stagger: { each: 0.055, from: 'random' } }),
    });
    riseIn($$('.s-maker__cta', root), { start: 'top 96%', y: 20 });

    return () => {
      clearTimeout(settle);
      spin.kill();
      spinST.kill();
    };
  });

  return () => {
    mm.revert();
    cleanups.forEach((fn) => fn());
  };
}
