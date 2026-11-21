// Catalog: the whole shop, all 17 pieces, fast to scan with a thumb.
// A poster count heads the section and counts to whatever is on show. Room chips stick to the top of the screen;
// filtering re-lays the grid with Flip so every piece travels to its new place. The grid is two editorial columns where
// every fifth piece opens up into a wide feature card, and the layout is recomputed per filter so there are never holes.
// Cards open with a photo reveal (clip opening plus a slow settle from 1.2) batched per row, and press down under the thumb.
import './style.css';
import { gsap, ScrollTrigger, Flip, linesReveal, riseIn } from '../../lib/gsap.js';
import { $, $$, pad2, priceLabel } from '../../lib/dom.js';
import { img } from '../../lib/media.js';
import { hasModel } from '../../three/models/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A turning arrow for the 360 mark.
const SPIN_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><ellipse cx="8" cy="8" rx="6.4" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.45"/><path d="M14.4 8a6.4 6.4 0 1 1-1.9-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12.9 0.9v2.9H10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Every fifth piece goes wide; then the last halves go wide until the rows close, so the grid never has a hole. */
function wideSet(list, cols) {
  const wide = new Set();
  if (cols === 2 && list.length <= 2) list.forEach((c) => wide.add(c));
  else list.forEach((c, i) => i % 5 === 4 && wide.add(c));
  let slots = list.reduce((s, c) => s + (wide.has(c) ? 2 : 1), 0);
  for (let k = list.length - 1; k >= 0 && slots % cols; k--) {
    if (!wide.has(list[k])) {
      wide.add(list[k]);
      slots++;
    }
  }
  return wide;
}

/** One photo per card. Pieces that go wide in the full view lead with a landscape shot; everyone else with a portrait. */
function pickImage(p, wide) {
  const g = p.gallery || [p.coverImage];
  if (wide) return g.find((m) => m.ratio >= 1.2) || p.coverImage;
  if (p.coverImage.ratio <= 1.1) return p.coverImage;
  return g.find((m) => m.ratio <= 1.1) || p.coverImage;
}

function cardMarkup(p, image, spin) {
  const alt = `${p.title}`;
  return `
    <button class="s-catalog__card" type="button" data-open="${p.handle}">
      <span class="s-catalog__press">
        <span class="s-catalog__media media" style="--ph:${image.color}">${img(image, { alt, sizes: '(min-width: 900px) 50vw, 100vw' })}${spin ? `<span class="s-catalog__spin" title="Can be turned in 3D">${SPIN_ICON}<span>360°</span></span>` : ''}</span>
        ${p.badge ? `<span class="s-catalog__badge sticker">${esc(p.badge)}</span>` : ''}
        <span class="s-catalog__cap">
          <span class="s-catalog__row t-cap"><span>Nº ${p.num}</span><span>${esc(p.roomLabel)}</span></span>
          <span class="s-catalog__big t-num" aria-hidden="true">${p.num}</span>
          <span class="s-catalog__title">${esc(p.title)}</span>
          <span class="s-catalog__line">${esc(p.line)}</span>
          <span class="s-catalog__price t-cap">${esc(priceLabel(p))}</span>
        </span>
      </span>
    </button>`;
}

export function init(root, ctx) {
  const { products, ROOMS, BRAND, SHOP_ALL_COPY } = ctx.data;
  const motion = !ctx.reduced;
  const grid = $('[data-grid]', root);
  const bar = $('.s-catalog__bar', root);
  const chipsEl = $('[data-chips]', root);
  const sentinel = $('.s-catalog__sentinel', root);
  const countEl = $('[data-count]', root);
  const roomLabel = $('[data-room-label]', root);
  const status = $('[data-status]', root);
  const cleanups = [];

  // ---------- copy (hers) ----------
  if (BRAND?.shopAll) $$('[data-shop-all]', root).forEach((a) => (a.href = BRAND.shopAll));
  if (SHOP_ALL_COPY) {
    // first two sentences of her shop-all copy
    const two = SHOP_ALL_COPY.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join('').trim();
    if (two) $('[data-lede]', root).textContent = two;
  }
  $('[data-range]', root).textContent = `Nº 01 / ${pad2(products.length)}`;
  countEl.textContent = pad2(products.length);

  const roomTitle = { all: 'All rooms', ...Object.fromEntries(ROOMS.map((r) => [r.key, r.title])) };
  $$('[data-filter]', chipsEl).forEach((chip) => {
    const key = chip.dataset.filter;
    const n = key === 'all' ? products.length : products.filter((p) => p.rooms.includes(key)).length;
    chip.innerHTML = `${esc(roomTitle[key] === 'All rooms' ? 'All' : roomTitle[key])} <sup>${pad2(n)}</sup>`;
  });

  // ---------- cards ----------
  const colCount = () => getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 2;
  let cols = colCount();
  const allWide = wideSet(products, 2);
  const cards = products.map((p) => {
    const el = document.createElement('li');
    el.className = 's-catalog__cell';
    el.dataset.handle = p.handle;
    el.innerHTML = cardMarkup(p, pickImage(p, allWide.has(p)), hasModel(p.handle));
    grid.appendChild(el);
    return { p, el, shown: !motion };
  });
  const byEl = new Map(cards.map((c) => [c.el, c]));

  let filter = 'all';
  const listFor = (key) => cards.filter((c) => key === 'all' || c.p.rooms.includes(key));
  const lay = (list) => {
    const wide = wideSet(list, cols);
    cards.forEach((c) => {
      c.el.hidden = !list.includes(c);
      c.el.classList.toggle('is-wide', wide.has(c));
    });
  };
  lay(listFor(filter));

  // ---------- card parts, and the reveal ----------
  const parts = (c) => ({
    media: $('.s-catalog__media', c.el),
    pic: $('.s-catalog__media img', c.el),
    cap: $$('.s-catalog__cap > *', c.el),
    spin: $('.s-catalog__spin', c.el),
    badge: $('.s-catalog__badge', c.el),
  });
  const hide = (c) => {
    const k = parts(c);
    gsap.set(k.media, { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set(k.pic, { scale: 1.2 });
    gsap.set(k.cap, { autoAlpha: 0, y: 14 });
    if (k.spin) gsap.set(k.spin, { scale: 0, rotation: -90 });
    if (k.badge) gsap.set(k.badge, { scale: 0, rotation: -28 });
  };
  const finish = (c) => {
    if (c.shown) return;
    c.shown = true;
    const k = parts(c);
    gsap.killTweensOf([k.media, k.pic, ...k.cap, k.spin, k.badge].filter(Boolean));
    gsap.set(k.media, { clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.set(k.pic, { scale: 1 });
    gsap.set(k.cap, { autoAlpha: 1, y: 0 });
    if (k.spin) gsap.set(k.spin, { scale: 1, rotation: 0 });
    if (k.badge) gsap.set(k.badge, { scale: 1, rotation: 0 });
  };
  const reveal = (els) => {
    const batch = els.map((el) => byEl.get(el)).filter((c) => c && !c.shown && !c.el.hidden);
    batch.forEach((c, i) => {
      c.shown = true;
      const k = parts(c);
      const d = i * 0.1;
      gsap.to(k.media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.05, ease: 'wb.inout', delay: d });
      gsap.to(k.pic, { scale: 1, duration: 1.6, ease: 'wb.out', delay: d });
      gsap.to(k.cap, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'wb.out', delay: d + 0.35 });
      if (k.spin) gsap.to(k.spin, { scale: 1, rotation: 0, duration: 0.8, ease: 'wb.snap', delay: d + 0.6 });
      if (k.badge) gsap.to(k.badge, { scale: 1, rotation: 0, duration: 0.75, ease: 'wb.snap', delay: d + 0.75 });
    });
  };

  // ---------- the poster count ----------
  const counter = { v: products.length };
  const setCount = (n, animate) => {
    gsap.killTweensOf(counter);
    if (!animate || !motion) {
      counter.v = n;
      countEl.textContent = pad2(n);
      return;
    }
    const from = Math.round(counter.v);
    const dir = n >= from ? 1 : -1;
    gsap.to(counter, {
      v: n,
      duration: 0.25 + Math.min(0.75, Math.abs(n - from) * 0.06),
      ease: 'power2.out',
      onUpdate() {
        const t = pad2(Math.round(counter.v));
        if (t !== countEl.textContent) {
          countEl.textContent = t;
          gsap.fromTo(countEl, { yPercent: 34 * dir }, { yPercent: 0, duration: 0.3, ease: 'wb.out', overwrite: true });
        }
      },
    });
  };

  // ---------- filtering ----------
  const chips = $$('[data-filter]', chipsEl);
  let flip;
  function setFilter(key) {
    if (key === filter) return;
    filter = key;
    const list = listFor(key);
    chips.forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.filter === key)));
    grid.setAttribute('aria-label', key === 'all' ? 'All pieces' : `${roomTitle[key]} pieces`);
    status.textContent = `Showing ${list.length} pieces: ${roomTitle[key]}`;
    roomLabel.textContent = roomTitle[key];
    setCount(list.length, true);

    // keep the active chip in view in its own little scroller
    const chip = chips.find((ch) => ch.dataset.filter === key);
    if (chip) {
      const left = chip.offsetLeft - (chipsEl.clientWidth - chip.offsetWidth) / 2;
      chipsEl.scrollTo({ left: Math.max(0, left), behavior: motion ? 'smooth' : 'auto' });
    }

    // if the bar is stuck, bring the top of the grid back under it
    const top = sentinel.getBoundingClientRect().top;
    if (top < -2) {
      const y = window.scrollY + top;
      if (motion) gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 0.75, ease: 'wb.inout' });
      else window.scrollTo(0, y);
    }

    if (!motion) {
      lay(list);
      ScrollTrigger.refresh();
      return;
    }

    flip?.progress(1);
    const before = new Set(cards.filter((c) => !c.el.hidden));
    const state = Flip.getState(cards.map((c) => c.el));
    const h0 = grid.offsetHeight;
    lay(list);
    // hold the grid's height while the cards fly (absolute), so the page under the sticky bar never collapses
    grid.style.minHeight = `${Math.max(h0, grid.offsetHeight)}px`;
    // pieces arriving from hiding must be fully drawn: Flip brings them in
    list.forEach((c) => !before.has(c) && finish(c));
    flip = Flip.from(state, {
      duration: 0.8,
      ease: 'wb.inout',
      stagger: 0.025,
      absolute: true,
      simple: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.82, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, delay: 0.25, stagger: 0.04, ease: 'wb.out' }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.82, duration: 0.35, ease: 'power2.in' }),
      onComplete: () => {
        gsap.set(cards.map((c) => c.el), { clearProps: 'opacity,visibility,transform' });
        grid.style.minHeight = '';
        ScrollTrigger.refresh();
      },
    });
  }
  const onChip = (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) setFilter(chip.dataset.filter);
  };
  chipsEl.addEventListener('click', onChip);
  cleanups.push(() => chipsEl.removeEventListener('click', onChip));

  // ---------- tap and press ----------
  let lastOpen = 0;
  const onClick = (e) => {
    const card = e.target.closest('[data-open]');
    if (!card || !grid.contains(card)) return;
    const now = performance.now();
    if (now - lastOpen < 350) return;
    lastOpen = now;
    ctx.openProduct(card.dataset.open);
  };
  grid.addEventListener('click', onClick);
  cleanups.push(() => grid.removeEventListener('click', onClick));

  if (motion) {
    let pressed = null;
    const up = () => {
      if (!pressed) return;
      gsap.to(pressed, { scale: 1, duration: 0.55, ease: 'wb.snap', overwrite: true });
      pressed = null;
    };
    const down = (e) => {
      const press = e.target.closest('.s-catalog__press');
      if (!press) return;
      up();
      pressed = press;
      gsap.to(press, { scale: 0.97, duration: 0.22, ease: 'wb.out', overwrite: true });
    };
    grid.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    grid.addEventListener('pointerleave', up);
    cleanups.push(() => {
      grid.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      grid.removeEventListener('pointerleave', up);
    });
  }

  // ---------- re-lay on a change of column count (rotation, desktop resize) ----------
  const onRefreshInit = () => {
    const n = colCount();
    if (n !== cols) {
      cols = n;
      flip?.progress(1);
      lay(listFor(filter));
    }
  };
  ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
  cleanups.push(() => ScrollTrigger.removeEventListener('refreshInit', onRefreshInit));

  // ---------- the bar gets a hairline while it is stuck ----------
  const stuck = ScrollTrigger.create({
    trigger: sentinel,
    start: () => `top top+=${-1}`,
    endTrigger: grid,
    end: 'bottom top',
    toggleClass: { targets: bar, className: 'is-stuck' },
  });
  cleanups.push(() => stuck.kill());

  // ---------- motion ----------
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const head = $('.s-catalog__head', root);

    // the count rolls up from behind its mask and counts to the number of pieces
    const digits = countEl;
    gsap.set(digits, { yPercent: 100 });
    counter.v = 0;
    countEl.textContent = '00';
    ScrollTrigger.create({
      trigger: $('.s-catalog__count', root),
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(digits, { yPercent: 0, duration: 1.1, ease: 'wb.out' });
        gsap.to(counter, {
          v: listFor(filter).length,
          duration: 1.5,
          ease: 'power3.out',
          onUpdate: () => (countEl.textContent = pad2(Math.round(counter.v))),
        });
      },
    });
    // numeral drifts up a touch slower than the page as the header leaves
    gsap.fromTo(
      $('.s-catalog__num', root),
      { y: 0 },
      { y: () => -Math.round(window.innerHeight * 0.06), ease: 'none', scrollTrigger: { trigger: head, start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } },
    );

    linesReveal($('.s-catalog__h', root), { start: 'top 88%' });
    riseIn($$('.s-catalog__eyebrow, .s-catalog__unit, .s-catalog__lede, .s-catalog__all', root), { start: 'top 92%', y: 22 });

    // chips slide in from the right like a deck being dealt
    gsap.set(chips, { autoAlpha: 0, x: 48 });
    ScrollTrigger.create({
      trigger: bar,
      start: 'top 94%',
      once: true,
      onEnter: () => gsap.to(chips, { autoAlpha: 1, x: 0, duration: 0.85, stagger: 0.07, ease: 'wb.out' }),
    });

    // cards: photo reveal, row by row
    cards.forEach((c) => !c.shown && hide(c));
    ScrollTrigger.batch(
      cards.map((c) => c.el),
      { start: 'top 92%', once: true, interval: 0.08, batchMax: 4, onEnter: reveal },
    );

    // the closing button rises (wrapper animates; the button keeps its own press transition)
    riseIn($$('.s-catalog__end, .s-catalog__cta-wrap', root), { start: 'top 95%', y: 26 });

    return () => {
      cards.forEach(finish);
      setCount(listFor(filter).length, false);
    };
  });

  return () => {
    flip?.kill();
    grid.style.minHeight = '';
    mm.revert();
    cleanups.forEach((fn) => fn());
  };
}
