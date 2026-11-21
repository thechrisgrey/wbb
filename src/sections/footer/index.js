// footer: the sign-off on cream.
// Her tagline rises line by line, her WB badge pops in as a sticker that bobs and spins when poked, the link rules draw
// themselves across two columns, and her wordmark lands at the bottom: eight vector letters drop onto a hairline shelf,
// tilted as they fall, squash on impact and snap upright. After that every letter is a toy: tap it and it boings,
// tug it sideways and it springs back, nudging its neighbours.
import './style.css';
import { gsap, ScrollTrigger, Draggable, linesReveal, riseIn, reducedMotion } from '../../lib/gsap.js';
import { WORDMARK, BADGE } from '../../brand/marks.js';

// The lettering's own bounding box inside WORDMARK (1325 x 363): letters span x 27..1268, y 26..301.
const BOX = { x: 27, y: 26, w: 1241, h: 275 };
const pct = (v) => `${(v * 100).toFixed(4)}%`;

// Tilt each letter carries while it falls (degrees). Alternating, uneven, so the drop feels thrown, not stamped.
// How far a letter can be tugged sideways (px) before it resists.
const REACH = 38;
const TILT = [-16, 11, -7, 14, -12, 9, -15, 12];

function wordMarkup() {
  return WORDMARK.letters
    .map((l, i) => {
      const style = `left:${pct((l.x - BOX.x) / BOX.w)};top:${pct((l.y - BOX.y) / BOX.h)};width:${pct(l.w / BOX.w)};height:${pct(l.h / BOX.h)}`;
      return `<span class="s-footer__l" style="${style}" data-l="${i}"><span class="s-footer__drop"><span class="s-footer__body"><svg class="s-footer__glyph" viewBox="${l.vb}" preserveAspectRatio="none" focusable="false"><path d="${l.d}" fill-rule="evenodd"/></svg></span></span></span>`;
    })
    .join('');
}

function badgeMarkup() {
  const { shadow, outline, fill } = BADGE.layers;
  return `<svg viewBox="${BADGE.viewBox}" focusable="false"><path d="${shadow}" fill="#e0722c" fill-rule="evenodd"/><path d="${outline}" fill="#16130f" fill-rule="evenodd"/><path d="${fill}" fill="#eee5c1" fill-rule="evenodd"/></svg>`;
}

export function init(root, ctx) {
  const data = ctx?.data || {};
  const reduced = ctx?.reduced ?? reducedMotion();
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));

  // ---- her copy from the data where it exists ----
  if (data.BRAND?.kicker) $('[data-kicker]').textContent = data.BRAND.kicker;

  // ---- build the wordmark and the badge ----
  const word = $('[data-word]');
  word.innerHTML = wordMarkup();
  const badge = $('[data-badge]');
  badge.innerHTML = badgeMarkup();
  const badgeSvg = badge.firstElementChild;

  // ---- back to top (works with or without motion) ----
  const topBtn = $('[data-top]');
  const onTop = () => {
    if (reduced) {
      window.scrollTo(0, 0);
      return;
    }
    const y = window.scrollY || document.documentElement.scrollTop;
    gsap.to(window, { scrollTo: { y: 0, autoKill: true }, duration: gsap.utils.clamp(1, 2.4, y / 4200), ease: 'wb.inout' });
  };
  topBtn.addEventListener('click', onTop);

  if (reduced) {
    return () => topBtn.removeEventListener('click', onTop);
  }

  const floor = $('[data-floor]');
  const letters = $$('.s-footer__l').map((el) => ({
    el,
    drop: el.querySelector('.s-footer__drop'),
    body: el.querySelector('.s-footer__body'),
    glyph: el.querySelector('.s-footer__glyph'),
  }));
  let landed = false;
  let drags = [];

  const gctx = gsap.context(() => {
    // captions
    gsap.from($$('.s-footer__caps p'), {
      autoAlpha: 0,
      y: 10,
      duration: 0.8,
      stagger: 0.08,
      scrollTrigger: { trigger: root, start: 'top 86%', once: true },
    });

    // the tagline rises from behind its own lines
    linesReveal($('[data-tag]'), { trigger: $('.s-footer__sign'), start: 'top 84%' });

    // the badge: a sticker pop, then a lazy bob that never quite stops
    const bob = gsap.to(badge, { y: -7, rotation: 3, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true });
    gsap.fromTo(
      badgeSvg,
      { scale: 0, rotation: -38 },
      {
        scale: 1,
        rotation: 0,
        duration: 0.85,
        delay: 0.35,
        ease: 'wb.snap',
        scrollTrigger: { trigger: $('.s-footer__sign'), start: 'top 84%', once: true },
        onComplete: () => bob.play(),
      },
    );

    // actions rise in (the wrappers move, never the .btn itself)
    riseIn($$('[data-act]'), { start: 'top 94%', y: 24, stagger: 0.07 });

    // link columns: heads settle, rules draw across, labels rise out of their rows
    $$('.s-footer__col').forEach((col) => {
      const heads = $$('.s-footer__head', col);
      const rows = $$('.s-footer__list li', col);
      const labels = rows.flatMap((li) => Array.from(li.querySelectorAll('a > span, a > i')));
      gsap.set(heads, { autoAlpha: 0, y: 10 });
      gsap.set([...heads, ...rows], { '--rule': 0 });
      gsap.set(labels, { yPercent: 115 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: col, start: 'top 88%', once: true } });
      tl.to(heads, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.25 }, 0)
        .to([...heads, ...rows], { '--rule': 1, duration: 0.9, ease: 'wb.inout', stagger: 0.045 }, 0.05)
        .to(labels, { yPercent: 0, duration: 0.8, stagger: 0.022 }, 0.18);
    });

    // ---- the wordmark lands ----
    const dropTl = gsap.timeline({ paused: true });
    // fall from just under the last row of links, so the letters never cross the text above
    const mark = word.parentElement;
    const fall = () => Math.max(parseFloat(getComputedStyle(mark).marginTop) * 0.9 + word.offsetHeight * 0.25, 90);
    gsap.set(floor, { scaleX: 0 });
    letters.forEach((L, i) => gsap.set(L.drop, { y: () => -fall(), rotation: TILT[i], autoAlpha: 0 }));

    dropTl.to(floor, { scaleX: 1, duration: 0.9, ease: 'wb.inout' }, 0);
    letters.forEach((L, i) => {
      const t = 0.12 + i * 0.075;
      const land = t + 0.38;
      dropTl
        .to(L.drop, { autoAlpha: 1, duration: 0.16, ease: 'none' }, t)
        .to(L.drop, { y: 0, duration: 0.38, ease: 'power2.in' }, t)
        // tilted all the way down, then it rocks upright on impact
        .to(L.drop, { rotation: 0, duration: 0.7, ease: 'wb.snap' }, land)
        .to(
          L.glyph,
          {
            keyframes: [
              { scaleX: 1.14, scaleY: 0.74, duration: 0.07, ease: 'power1.out' },
              { scaleX: 1, scaleY: 1, duration: 0.75, ease: 'elastic.out(1.1, 0.33)' },
            ],
          },
          land,
        );
    });
    dropTl.add(() => {
      landed = true;
    });

    ScrollTrigger.create({
      trigger: word,
      start: 'top 94%',
      onEnter: () => dropTl.restart(),
      onLeaveBack: () => {
        // scrolled back up past it: reset, so the next arrival lands again
        landed = false;
        dropTl.pause(0);
      },
    });
  }, root);

  // ---- toys ----
  // the badge spins when poked
  const onBadge = () => {
    gsap.to(badgeSvg, { rotation: '+=360', duration: 1, ease: 'wb.snap', overwrite: 'auto' });
    gsap.fromTo(badgeSvg, { scale: 0.86 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.35)' });
  };
  badge.addEventListener('click', onBadge);

  // letters: tap to boing, tug sideways and let go
  const nudge = (i, dir, amt) => {
    const L = letters[i];
    if (!L) return;
    gsap.fromTo(L.body, { rotation: dir * amt }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.3)', overwrite: 'auto' });
  };
  const boing = (i) => {
    const L = letters[i];
    gsap.to(L.glyph, {
      overwrite: 'auto',
      keyframes: [
        { scaleX: 1.16, scaleY: 0.7, y: 0, duration: 0.08, ease: 'power1.out' },
        { scaleX: 0.9, scaleY: 1.14, y: '-34%', duration: 0.24, ease: 'power2.out' },
        { scaleX: 1, scaleY: 1, y: 0, duration: 0.22, ease: 'power2.in' },
        { scaleX: 1.08, scaleY: 0.86, duration: 0.06, ease: 'power1.out' },
        { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' },
      ],
    });
    // the neighbours feel the landing
    gsap.delayedCall(0.6, () => {
      nudge(i - 1, -1, 5);
      nudge(i + 1, 1, 5);
    });
  };

  drags = letters.map((L, i) =>
    Draggable.create(L.body, {
      type: 'x',
      bounds: { minX: -REACH, maxX: REACH },
      edgeResistance: 0.8,
      zIndexBoost: false,
      minimumMovement: 4,
      allowContextMenu: false,
      onPress() {
        if (!landed) return;
        gsap.killTweensOf(L.body);
        gsap.to(L.glyph, { scaleX: 1.06, scaleY: 0.9, duration: 0.14, ease: 'power2.out', overwrite: 'auto' });
      },
      onDrag() {
        // lean into the tug; the glyph stretches a little the further it goes
        const k = this.x / REACH;
        gsap.set(L.body, { rotation: k * 16 });
        gsap.set(L.glyph, { scaleX: 1 + Math.abs(k) * 0.12, scaleY: 1 - Math.abs(k) * 0.08 });
      },
      onRelease() {
        gsap.to(L.body, { x: 0, rotation: 0, duration: 1.15, ease: 'elastic.out(1.1, 0.28)', overwrite: 'auto' });
        if (this.isDragging || Math.abs(this.x) > 2) {
          gsap.to(L.glyph, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.3)', overwrite: 'auto' });
          const dir = this.x > 0 ? 1 : -1;
          gsap.delayedCall(0.12, () => nudge(i + dir, -dir, 6));
        }
      },
      onClick() {
        if (landed) boing(i);
        else gsap.to(L.glyph, { scaleX: 1, scaleY: 1, duration: 0.3 });
      },
    })[0],
  );

  return () => {
    topBtn.removeEventListener('click', onTop);
    badge.removeEventListener('click', onBadge);
    drags.forEach((d) => d.kill());
    gctx.revert();
  };
}
