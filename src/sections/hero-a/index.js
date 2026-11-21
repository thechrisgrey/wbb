// Hero A, "Story first".
// It opens like her story on a phone: the build video full bleed, progress bars, one kinetic word per chapter,
// her wordmark as a row of letter tiles. Scroll, and the story shrinks into a card, the tiles scatter and regroup,
// "absurdly well made." takes the screen, and the Shop button floods out into the orange field that follows.
import './style.css';
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsap.js';
import { asset } from '../../lib/media.js';
import { onVisible } from '../../lib/dom.js';
import { WORDMARK, BADGE } from '../../brand/marks.js';
import { createStory } from './story.js';

const PHONE = '(max-width: 899px)';
const DESKTOP = '(min-width: 900px)';

// Tile colours for W o o d B a b y.
const TONES = ['', 'orange', 'ink', 'brass', '', 'blush', 'orange', 'ink'];
// Where each tile is thrown mid-sequence: x and y as fractions of the stage, turns of rotation, scale.
const SCATTER = [
  [0.15, 0.31, -0.55, 1.9],
  [0.47, 0.2, 0.4, 1.5],
  [0.82, 0.34, -0.3, 2.1],
  [0.62, 0.53, 0.65, 1.6],
  [0.2, 0.6, 0.35, 2.2],
  [0.86, 0.68, -0.6, 1.7],
  [0.42, 0.76, -0.25, 2],
  [0.72, 0.86, 0.5, 1.5],
];
// The few degrees each tile keeps when it lands, so the regrouped wordmark looks placed by hand.
const REST = [-5, 3, -2, 6, 4, -3, 5, -7];
// The scroll timelines are written against this length; one unit is a tenth of the pinned distance.
const SPAN = 10;

/** An element's box relative to an ancestor, from layout offsets, so transforms in flight never skew it. */
function boxIn(el, ancestor) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== ancestor; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight, cx: x + el.offsetWidth / 2, cy: y + el.offsetHeight / 2 };
}

const glyph = ({ vb, d }) => `<svg viewBox="${vb}" aria-hidden="true"><path d="${d}" fill-rule="evenodd"/></svg>`;

/** Fill in everything that comes from data: her letter tiles, her badge, the links and the video sources. */
function render(root, data) {
  const { BRAND, BUILD_VIDEO, productByHandle } = data;
  const $ = (sel) => root.querySelector(sel);

  $('.s-hero-a__mark').innerHTML = WORDMARK.letters
    .map((letter, i) => `<span class="s-hero-a__tp"><span class="tile${TONES[i] ? ` tile--${TONES[i]}` : ''}">${glyph(letter)}</span></span>`)
    .join('');
  $('.s-hero-a__mast').innerHTML = '<i></i>'.repeat(WORDMARK.letters.length);

  const { shadow, outline, fill } = BADGE.layers;
  $('.s-hero-a__badge').innerHTML = `<svg viewBox="${BADGE.viewBox}"><path d="${shadow}" fill="#e0722c"/><path d="${outline}" fill="#16130f" fill-rule="evenodd"/><path d="${fill}" fill="#eee5c1" fill-rule="evenodd"/></svg>`;

  $('.s-hero-a__shop').href = BRAND.shopAll;
  const product = productByHandle[BUILD_VIDEO.product];
  if (product) $('[data-product]').textContent = product.title;

  const video = $('.s-hero-a__video');
  const conn = navigator.connection;
  const lite = Boolean(conn?.saveData) || /(^|-)[23]g$/.test(conn?.effectiveType || '');
  video.poster = asset(BUILD_VIDEO.poster);
  video.src = asset(lite ? BUILD_VIDEO.src720 : BUILD_VIDEO.src1080);
}

export function init(root, ctx) {
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  render(root, ctx.data);

  const stage = $('.s-hero-a__stage');
  const storyEl = $('.s-hero-a__story');
  const screen = $('.s-hero-a__screen');
  const video = $('.s-hero-a__video');
  const who = $('.s-hero-a__who');
  const cap = $('.s-hero-a__cap');
  const words = $('.s-hero-a__words');
  const meta = $('.s-hero-a__meta');
  const slot = $('.s-hero-a__slot');
  const flood = $('.s-hero-a__flood');
  const shop = $('.s-hero-a__shop');
  const tiles = $$('.s-hero-a__tp'); // positioned by the scroll sequence
  const faces = $$('.s-hero-a__tp > .tile'); // dropped in by the intro
  const mastCells = $$('.s-hero-a__mast > i');

  const { BUILD_VIDEO } = ctx.data;
  const story = createStory(
    {
      video,
      bars: $('.s-hero-a__bars'),
      words,
      taps: $$('.s-hero-a__tap'),
      playBtn: $('.s-hero-a__play'),
      chrome: $('.s-hero-a__chrome'),
      counters: $$('.s-hero-a__roll'),
    },
    { chapters: BUILD_VIDEO.chapters, duration: BUILD_VIDEO.duration, reduced: ctx.reduced },
  );
  const stopWatching = onVisible(stage, (isVisible) => story.setVisible(isVisible));

  // Reduced motion: the poster layout as it stands. Everything is visible and the video plays on tap.
  if (ctx.reduced) {
    ctx.onEntered(() => story.start());
    return () => {
      stopWatching();
      story.destroy();
    };
  }

  root.classList.add('is-live');
  let intro = null;
  let entered = false;
  /** Register a breakpoint's intro. If the preloader has already lifted (a resize), jump straight to its end. */
  const setIntro = (timeline) => {
    intro = timeline;
    if (entered) timeline.progress(1, true);
  };

  // ---------- pieces shared by the phone and desktop sequences ----------

  /** Headline letters rise out of their line masks, then the kicker, then the lede line by line. */
  function addCopy(tl, at) {
    $$('.s-hero-a__line > span').forEach((line, k) => {
      const { chars } = SplitText.create(line, { type: 'chars', aria: 'none' });
      tl.fromTo(
        chars,
        { yPercent: 128, rotation: 7 },
        { yPercent: 0, rotation: 0, duration: 1.1, ease: 'power3.out', stagger: 0.05, transformOrigin: '0% 100%' },
        at + k * 0.36,
      );
    });
    tl.fromTo($('.s-hero-a__step'), { yPercent: 40, clipPath: 'inset(0% 0% 100% 0%)' }, { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.out' }, at + 0.9);
    tl.fromTo($$('.s-hero-a__kicker > *'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power2.out', stagger: 0.18 }, at + 1.2);
    // autoSplit re-splits when the font lands or the width changes; the fresh tween takes the old one's place.
    SplitText.create($('.s-hero-a__lede'), {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        const tween = gsap.fromTo(self.lines, { yPercent: 108 }, { yPercent: 0, duration: 0.9, ease: 'power3.out', stagger: 0.14 });
        tl.add(tween, at + 1.7);
        return tween;
      },
    });
  }

  /** Tiles are thrown from where they sit (`from`) to their scatter points, tumbling, then spring home. */
  function addTiles(tl, at, from = () => ({ x: 0, y: 0, scale: 1 })) {
    tiles.forEach((tile, i) => {
      const [fx, fy, turns, scale] = SCATTER[i];
      const thrown = {
        x: () => fx * stage.offsetWidth - boxIn(tile, stage).cx,
        y: () => fy * stage.offsetHeight - boxIn(tile, stage).cy,
        scale,
        rotation: turns * 360,
      };
      tl.fromTo(
        tile,
        { x: () => from(tile, i).x, y: () => from(tile, i).y, scale: () => from(tile, i).scale, rotation: 0 },
        { ...thrown, duration: 2.1, ease: 'power2.out' },
        at + i * 0.05,
      ).fromTo(tile, { ...thrown }, { x: 0, y: 0, scale: 1, rotation: REST[i], duration: 2.3, ease: 'back.out(1.35)', immediateRender: false }, at + 2.5 + i * 0.12);
    });
  }

  /** The Shop button is the seed of the next section: the orange field grows out of its pill and the button turns ink. */
  function addFlood(tl, at) {
    const pill = () => {
      const b = boxIn(shop, stage);
      return `inset(${b.y}px ${flood.offsetWidth - b.x - b.w}px ${flood.offsetHeight - b.y - b.h}px ${b.x}px round ${b.h / 2}px)`;
    };
    tl.fromTo(flood, { clipPath: pill }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 2.2, ease: 'power2.inOut', immediateRender: false }, at)
      .fromTo($('.s-hero-a__shop-ink'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.inOut' }, at + 0.15)
      .fromTo(faces, { y: 0 }, { y: -10, duration: 0.3, ease: 'power2.out', stagger: { each: 0.07, yoyo: true, repeat: 1 }, immediateRender: false }, at + 0.5);
  }

  /** What every breakpoint's intro shares: the story chrome draws in, tiles drop into place, the button pops. */
  function addArrival(tl, at, drop) {
    tl.from($$('.s-hero-a__bars li'), { scaleX: 0, transformOrigin: '0% 50%', duration: 0.55, ease: 'wb.inout', stagger: 0.045 }, at)
      .from($('.s-hero-a__badge'), { scale: 0, rotation: -40, duration: 0.6, ease: 'wb.snap' }, at + 0.2)
      .from([$('.s-hero-a__name'), $('.s-hero-a__count')], { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, at + 0.28)
      .from(faces, { y: drop, rotation: () => gsap.utils.random(-80, 80), scale: 1.25, duration: 0.75, ease: 'wb.snap', stagger: 0.05 }, at + 0.15)
      .from($$('.s-hero-a__meta > *'), { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, at + 0.6)
      .from(shop, { scale: 0.6, y: 26, autoAlpha: 0, duration: 0.65, ease: 'wb.snap' }, at + 0.65)
      .call(() => story.start(), null, 0.35);
  }

  const mm = gsap.matchMedia();

  // ---------- phone: full-bleed story that collapses into the poster ----------
  mm.add(PHONE, () => {
    // The card keeps the screen's proportions, so its column is as wide as the free row is tall allows.
    const sizeCard = () => {
      const width = Math.min(slot.offsetHeight * (storyEl.offsetWidth / storyEl.offsetHeight), stage.clientWidth * 0.44);
      root.style.setProperty('--card-w', `${Math.round(width)}px`);
    };
    sizeCard();
    ScrollTrigger.addEventListener('refreshInit', sizeCard);

    /** Where the full-bleed story has to go to sit in its slot: offset of its centre, scale, corner radius. */
    const card = () => {
      const w = storyEl.offsetWidth;
      const h = storyEl.offsetHeight;
      const box = boxIn(slot, stage);
      const scale = Math.min(box.w / w, box.h / h);
      const radius = parseFloat(getComputedStyle(root).getPropertyValue('--card-r')) || 22;
      return { scale, x: box.x + box.w - (w * scale) / 2 - w / 2, y: box.y + (h * scale) / 2 - h / 2, radius: radius / scale };
    };
    /** A tile's masthead cell, expressed as an offset from its resting place in the poster. */
    const mast = (tile, i) => {
      const cell = boxIn(mastCells[i], stage);
      const home = boxIn(tile, stage);
      return { x: cell.cx - home.cx, y: cell.cy - home.cy, scale: cell.w / home.w };
    };

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root, start: 'top top', end: '+=220%', pin: true, anticipatePin: 1, scrub: 0.6, invalidateOnRefresh: true },
    });
    tl.set({}, {}, SPAN);

    // 1. The story closes: full bleed to a tilted, rounded card in the top right corner.
    tl.fromTo(
      storyEl,
      { x: 0, y: 0, scale: 1, rotation: 0, clipPath: 'inset(0px round 0px)' },
      { x: () => card().x, y: () => card().y, scale: () => card().scale, rotation: 3, clipPath: () => `inset(0px round ${card().radius}px)`, duration: 4.2, ease: 'power1.inOut' },
      0,
    )
      // the caption rides down to the card's bottom edge; the small print would be unreadable at card size, so it goes
      .fromTo(cap, { y: 0 }, { y: () => storyEl.offsetHeight - cap.offsetTop - words.offsetHeight - storyEl.offsetWidth * 0.05, duration: 4.2, ease: 'power1.inOut' }, 0)
      .fromTo([who, meta], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.9 }, 0.1);
    // 2. Tiles leave the masthead, tumble across the screen and regroup as the poster's wordmark.
    addTiles(tl, 0.02, mast);
    // 3. "absurdly well made." takes over.
    addCopy(tl, 2.7);
    // 4. The orange field arrives, and the card rocks back as it slides underneath.
    addFlood(tl, 7.3);
    tl.fromTo(storyEl, { rotation: 3 }, { rotation: -3, duration: 2.2, ease: 'power1.inOut', immediateRender: false }, 7.3);

    // Intro: the story opens from a card to the full screen, then its chrome arrives.
    const arrive = gsap.timeline({ paused: true });
    arrive
      .fromTo(screen, { clipPath: 'inset(15% 17% 15% 17% round 44px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.05, ease: 'wb.inout', clearProps: 'clipPath' }, 0)
      .fromTo(video, { scale: 1.22 }, { scale: 1, duration: 1.6 }, 0);
    addArrival(arrive, 0.4, () => -(boxIn(mastCells[0], stage).y + 150));
    setIntro(arrive);

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', sizeCard);
      root.style.removeProperty('--card-w');
    };
  });

  // ---------- desktop: the story is already a tall card beside the type ----------
  mm.add(DESKTOP, () => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: root, start: 'top top', end: '+=150%', pin: true, anticipatePin: 1, scrub: 0.6, invalidateOnRefresh: true },
    });
    tl.set({}, {}, SPAN);
    addTiles(tl, 0.02);
    tl.fromTo(storyEl, { rotation: 0, scale: 1 }, { rotation: -4, scale: 0.93, duration: 6.5, ease: 'power1.inOut' }, 0);
    addFlood(tl, 6.6);
    tl.fromTo(storyEl, { rotation: -4 }, { rotation: 2, duration: 2.2, ease: 'power1.inOut', immediateRender: false }, 6.6);

    const arrive = gsap.timeline({ paused: true });
    const radius = getComputedStyle(root).getPropertyValue('--card-r').trim() || '30px';
    arrive
      .fromTo(storyEl, { clipPath: `inset(100% 0% 0% 0% round ${radius})` }, { clipPath: `inset(0% 0% 0% 0% round ${radius})`, duration: 1.1, ease: 'wb.inout', clearProps: 'clipPath' }, 0)
      .fromTo(video, { scale: 1.25 }, { scale: 1, duration: 1.6 }, 0);
    addCopy(arrive, 0.2);
    addArrival(arrive, 0.5, -260);
    setIntro(arrive);
  });

  ctx.onEntered(() => {
    entered = true;
    if (intro) intro.play();
    else story.start();
  });

  return () => {
    mm.revert();
    stopWatching();
    story.destroy();
    root.classList.remove('is-live');
  };
}
