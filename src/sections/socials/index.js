// Socials: she is "the woman you watch", so this is where you go watch her.
// Six tall story cards (her own portraits and her own words from the Socials page) on a deck you throw sideways.
// The deck snaps card to card, cards lean into the throw, the card in front is the big one, and a counter and a
// progress line follow. Tap the card in front to open it; tap a card at the side to bring it forward.
// Below: the other platforms as chips, and her newsletter block (a preview: nothing is sent anywhere).
import './style.css';
import { gsap, ScrollTrigger, Draggable, linesReveal, riseIn } from '../../lib/gsap.js';
import { $, $$, clamp, pad2 } from '../../lib/dom.js';
import { img } from '../../lib/media.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Where her face sits in each photo (object-position), so a 3:4 crop of a 5:4 photo keeps her in frame.
const FOCUS = {
  instagram: ['44%', '20%'],
  fanfix: ['44%', '18%'],
  x: ['46%', '18%'],
  snapchat: ['46%', '16%'],
  kick: ['50%', '30%'],
  discord: ['58%', '20%'],
};

const SIDE_SCALE = 0.86; // a card one step away from the front
const MAX_TILT = 7; // degrees

function cardMarkup(s, m, i, total) {
  const [fx, fy] = FOCUS[s.key] || ['50%', '22%'];
  const pic = m
    ? `<span class="s-socials__pic media" style="--ph:${m.color};--fx:${fx};--fy:${fy}">${img(m, { alt: `WoodBaby on ${s.label}`, sizes: '(min-width: 900px) 340px, 68vw' })}</span>`
    : '<span class="s-socials__pic media"></span>';
  return `
    <li class="s-socials__cell">
      <a class="s-socials__card" href="${s.url}" target="_blank" rel="noopener" draggable="false" data-i="${i}"
         aria-label="${esc(s.label)}, ${esc(s.line)}. ${esc(s.cta)} (opens in a new tab)">
        ${pic}
        <span class="s-socials__no t-cap" aria-hidden="true">${pad2(i + 1)} / ${pad2(total)}</span>
        <span class="s-socials__handle sticker" aria-hidden="true">${esc(s.handle)}</span>
        <span class="s-socials__bar" aria-hidden="true">
          <span class="s-socials__label t-display"><span>${esc(s.label)}</span></span>
          <span class="s-socials__row">
            <span class="s-socials__line">${esc(s.line)}</span>
            <span class="s-socials__cta btn btn--orange">${esc(s.cta)} <span class="btn__arrow">→</span></span>
          </span>
        </span>
      </a>
    </li>`;
}

export function init(root, ctx) {
  const { SOCIALS = [], MORE_SOCIALS = [], NEWSLETTER, BRAND, maker = {} } = ctx.data;
  const motion = !ctx.reduced;
  const total = SOCIALS.length;

  // ---------- build ----------
  const deck = $('[data-deck]', root);
  const track = $('[data-track]', root);
  track.innerHTML = SOCIALS.map((s, i) => cardMarkup(s, maker[s.key], i, total)).join('');
  $('[data-total]', root).textContent = `${pad2(total)} channels`;
  $('[data-of]', root).textContent = pad2(total);
  $('[data-more]', root).innerHTML = MORE_SOCIALS.map(
    (m) => `<li><a class="chip s-socials__chip" href="${m.url}" target="_blank" rel="noopener">${esc(m.label)} <span class="s-socials__arr" aria-hidden="true">↗</span></a></li>`,
  ).join('');
  if (NEWSLETTER) {
    $('[data-news-title]', root).textContent = NEWSLETTER.title;
    $('[data-news-body]', root).textContent = NEWSLETTER.body;
  }
  if (BRAND?.store) $('[data-store]', root).href = BRAND.store;

  const cells = $$('.s-socials__cell', track);
  const cards = $$('.s-socials__card', track);
  const pics = cards.map((c) => $('img', c));
  const idxEl = $('[data-idx]', root);
  const fill = $('[data-fill]', root);
  const [prevBtn, nextBtn] = $$('[data-step]', root);

  // ---------- the deck ----------
  let snaps = [];
  let active = 0;
  let centers = [];
  let viewC = 0;
  let pitch = 1;
  let lastX = 0;
  let lastT = 0;
  let dragged = false;
  let caught = false; // a press that stopped a moving deck is a catch, not a tap
  let throwT = 0;

  // (quickSetter cannot drive the 'scale' alias, so set both axes)
  const setScale = cards.map((c) => {
    const sx = gsap.quickSetter(c, 'scaleX');
    const sy = gsap.quickSetter(c, 'scaleY');
    return (v) => {
      sx(v);
      sy(v);
    };
  });
  const labels = $$('.s-socials__label', track);
  const setPicX = pics.map((p) => (p ? gsap.quickSetter(p, 'xPercent') : () => {}));
  const tilt = motion ? cards.map((c) => gsap.quickTo(c, 'rotation', { duration: 0.55, ease: 'power3.out' })) : null;
  const settle = motion ? gsap.delayedCall(0.1, () => tilt.forEach((t) => t(0))).pause() : null;

  const xNow = () => Number(gsap.getProperty(track, 'x')) || 0;

  function setActive(k, animate = true) {
    if (k === active) return;
    const dir = k > active ? 1 : -1;
    active = k;
    idxEl.textContent = pad2(k + 1);
    if (motion && animate) gsap.fromTo(idxEl, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.42, ease: 'wb.out', overwrite: true });
    prevBtn.disabled = k === 0;
    nextBtn.disabled = k === total - 1;
  }

  function update() {
    const x = xNow();
    // progress: the line runs from one sixth to full as the deck travels
    const span = snaps[0] - snaps[total - 1] || 1;
    const p = clamp((snaps[0] - x) / span, 0, 1);
    gsap.set(fill, { scaleX: (1 + p * (total - 1)) / total });

    // which card is in front, and how far every card is from the front
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < total; i++) {
      const d = (x + centers[i] - viewC) / pitch;
      const a = Math.abs(d);
      if (a < best) {
        best = a;
        k = i;
      }
      if (motion) {
        setScale[i](1 - Math.min(a, 1.4) * (1 - SIDE_SCALE));
        setPicX[i](clamp(-d * 7, -12, 12)); // the photo drifts inside its frame: a window, not a sticker
      }
    }
    setActive(k);

    // cards lean into the throw and stand back up when it slows
    if (tilt) {
      const now = performance.now();
      const v = ((x - lastX) / Math.max(now - lastT, 8)) * 16; // px per frame
      lastX = x;
      lastT = now;
      const r = clamp(v * 0.22, -MAX_TILT, MAX_TILT);
      tilt.forEach((t) => t(r));
      settle.restart(true);
    }
  }

  const drag = Draggable.create(track, {
    type: 'x',
    inertia: motion,
    edgeResistance: 0.86,
    overshootTolerance: 0.4,
    throwResistance: 2600,
    maxDuration: 0.9,
    minDuration: 0.3,
    dragClickables: true,
    allowContextMenu: true,
    zIndexBoost: false,
    minimumMovement: 6,
    cursor: 'grab',
    activeCursor: 'grabbing',
    snap: {
      x(v) {
        // never more than two cards per flick, so a throw feels like dealing, not spinning a wheel
        const from = snaps[active];
        const near = gsap.utils.snap(snaps, v);
        const j = clamp(snaps.indexOf(near), active - 2, active + 2);
        return snaps[j] ?? from;
      },
    },
    onPress() {
      dragged = false;
      caught = performance.now() - throwT < 90 || gsap.isTweening(track);
      lastX = this.x;
      lastT = performance.now();
      if (motion) gsap.to(cells, { scale: 0.97, duration: 0.35, ease: 'wb.out', overwrite: 'auto' });
    },
    onRelease() {
      if (motion) gsap.to(cells, { scale: 1, duration: 0.7, ease: 'wb.snap', overwrite: 'auto' });
      if (!motion) goTo(active); // no inertia: still land square on a card
    },
    onDragStart() {
      dragged = true;
    },
    onDrag: update,
    onThrowUpdate() {
      throwT = performance.now();
      update();
    },
    onThrowComplete: update,
  })[0];

  // every name as large as the bar allows, never wider than it
  function fitLabels() {
    labels.forEach((l) => {
      l.style.fontSize = '';
      const base = parseFloat(getComputedStyle(l).fontSize) || 40;
      const w = l.firstElementChild.offsetWidth;
      const room = l.clientWidth;
      if (w > room && room > 0) l.style.fontSize = `${Math.floor(base * (room / w) * 0.98 * 10) / 10}px`;
    });
  }

  function measure() {
    fitLabels();
    const w = cells[0]?.offsetWidth || 1;
    viewC = deck.clientWidth / 2;
    centers = cells.map((c) => c.offsetLeft + c.offsetWidth / 2);
    pitch = total > 1 ? centers[1] - centers[0] : w;
    snaps = centers.map((c) => Math.round(viewC - c));
    drag.applyBounds({ minX: snaps[total - 1], maxX: snaps[0] });
    gsap.set(track, { x: snaps[active] });
    drag.update();
    update();
  }

  function goTo(i, dur = 0.75) {
    const k = clamp(i, 0, total - 1);
    gsap.to(track, {
      x: snaps[k],
      duration: motion ? dur : 0,
      ease: 'wb.out',
      overwrite: true,
      onUpdate() {
        throwT = performance.now();
        update();
      },
      onComplete() {
        drag.update();
        update();
      },
    });
    setActive(k);
  }

  // Tap the front card: the link opens (native, so iOS treats it as a real tap). A drag is never a tap.
  // Tap a card at the side: bring it to the front instead.
  const onClick = (e) => {
    const card = e.target.closest('.s-socials__card');
    if (!card) return;
    if (dragged || caught) {
      e.preventDefault();
      dragged = false;
      caught = false;
      return;
    }
    const i = Number(card.dataset.i);
    if (e.detail !== 0 && i !== active) {
      e.preventDefault();
      goTo(i);
    }
  };
  track.addEventListener('click', onClick, true);

  // Keyboard: whatever card takes focus comes to the front.
  const onFocus = (e) => {
    if (!e.target.matches?.(':focus-visible')) return; // a tap also focuses the link; only keyboard focus steers
    const card = e.target.closest?.('.s-socials__card');
    if (card) goTo(Number(card.dataset.i), 0.5);
  };
  track.addEventListener('focusin', onFocus);

  const onStep = (e) => goTo(active + Number(e.currentTarget.dataset.step));
  prevBtn.addEventListener('click', onStep);
  nextBtn.addEventListener('click', onStep);
  prevBtn.disabled = true;

  measure();
  document.fonts?.ready.then(() => fitLabels());
  ScrollTrigger.addEventListener('refreshInit', measure);
  const onResize = () => measure();
  window.addEventListener('resize', onResize);

  // ---------- newsletter: preview only ----------
  const form = $('[data-news]', root);
  const note = $('[data-note]', root);
  const onSubmit = (e) => {
    e.preventDefault();
    const first = note.hidden;
    note.hidden = false;
    if (motion && first) gsap.fromTo(note, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6 });
  };
  form.addEventListener('submit', onSubmit);

  // ---------- entrance ----------
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    linesReveal($('.s-socials__h', root), { start: 'top 86%' });
    riseIn($$('.s-socials__eyebrow, .s-socials__meter, .s-socials__more', root), { start: 'top 94%', y: 20 });

    // cards fan in from the right, each one swinging up off the table, then the stickers pop on
    const stickers = $$('.s-socials__handle', track);
    const bars = $$('.s-socials__bar', track);
    gsap.set(cells, { x: () => window.innerWidth * 0.9, rotation: 16, transformOrigin: '50% 120%', autoAlpha: 0 });
    gsap.set(stickers, { scale: 0, rotation: -24 });
    gsap.set(bars, { yPercent: 18, autoAlpha: 0 });
    const fan = gsap.timeline({ paused: true });
    fan
      .to(cells, { x: 0, rotation: 0, autoAlpha: 1, duration: 1.25, stagger: 0.075, ease: 'wb.out' }, 0)
      .to(bars, { yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.075, ease: 'wb.out' }, 0.35)
      .to(stickers, { scale: 1, rotation: 0, duration: 0.7, stagger: 0.075, ease: 'wb.snap' }, 0.6);
    ScrollTrigger.create({ trigger: deck, start: 'top 82%', once: true, onEnter: () => fan.play() });

    // the newsletter panel arrives as a field wipe, bottom edge first
    const news = $('.s-socials__news', root);
    gsap.fromTo(
      news,
      { clipPath: 'inset(100% 0% 0% 0% round 24px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.05, ease: 'wb.inout', scrollTrigger: { trigger: news, start: 'top 88%', once: true } },
    );
    linesReveal($('.s-socials__news-h', root), { trigger: news, start: 'top 80%', delay: 0.35 });
    riseIn($$('.s-socials__news-body, .s-socials__field', root), { start: 'top 96%', y: 18 });

    return () => fan.kill();
  });

  return () => {
    track.removeEventListener('click', onClick, true);
    track.removeEventListener('focusin', onFocus);
    prevBtn.removeEventListener('click', onStep);
    nextBtn.removeEventListener('click', onStep);
    form.removeEventListener('submit', onSubmit);
    window.removeEventListener('resize', onResize);
    ScrollTrigger.removeEventListener('refreshInit', measure);
    settle?.kill();
    drag.kill();
    mm.revert();
  };
}
