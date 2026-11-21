// Rooms: her three collections as three full-screen sheets that stack.
// Layout is plain CSS (position: sticky), so the stacking works with no JS at all and never fights the thumb.
// GSAP adds the life: the sheet underneath sinks back and dims, photos open with a clip and drift inside their frames,
// numerals roll, stickers pop, and each room's pieces sit on a strip you can throw sideways.
import './style.css';
import { gsap, ScrollTrigger, SplitText, Draggable, linesReveal, riseIn } from '../../lib/gsap.js';
import { $, $$, clamp, pad2, priceLabel } from '../../lib/dom.js';
import { img } from '../../lib/media.js';

// What each cover photo shows (alt text only; descriptive, not brand voice).
const SCENE = {
  kitchen: 'leaning on a tiled kitchen counter beside a bowl of persimmons',
  bath: 'resting across a white freestanding tub',
  home: 'in low evening sun',
};
const SIZES = {
  kitchen: '(min-width: 900px) 50vw, 100vw',
  bath: '(min-width: 900px) 34vw, 60vw',
  home: '(min-width: 900px) 40vw, 58vw',
};
// How each photo opens: [closed, open] clip-paths with the same shape so they tween cleanly.
const CLIP = {
  kitchen: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'],
  bath: ['inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'],
  home: ['inset(58% 30% 0% 30% round 29vw 29vw 20px 20px)', 'inset(0% 0% 0% 0% round 29vw 29vw 20px 20px)'],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Two digit windows. A digit that changes from the previous room carries the old glyph underneath so it can roll. */
function numeralMarkup(i) {
  const cur = pad2(i + 1);
  const prev = pad2(i);
  const dig = (k) =>
    `<span class="s-rooms__dig"><span class="s-rooms__col"${cur[k] !== prev[k] ? ' data-roll' : ''}><span>${cur[k]}</span>${cur[k] !== prev[k] ? `<span>${prev[k]}</span>` : ''}</span></span>`;
  return `<div class="s-rooms__num t-num" aria-hidden="true">${dig(0)}${dig(1)}</div>`;
}

function shotMarkup(room, piece, cover) {
  const alt = `${piece.title} ${SCENE[room.key] || ''}`.trim();
  return `
    <figure class="s-rooms__photo media" style="--ph:${cover.color}">${img(cover, { alt, sizes: SIZES[room.key] })}</figure>
    <button class="s-rooms__open" type="button" data-open="${piece.handle}" aria-label="Open ${esc(piece.title)}">
      <span class="s-rooms__tag t-cap"><span class="s-rooms__tag-no">Nº ${piece.num}</span><span>${esc(piece.title)}</span></span>
      <span class="s-rooms__badge sticker">${esc(piece.badge || priceLabel(piece))}</span>
    </button>`;
}

function stripMarkup(room, pieces) {
  const cells = pieces
    .map(
      (p) => `
      <li class="s-rooms__cell">
        <button class="s-rooms__piece" type="button" data-open="${p.handle}" aria-label="${esc(p.title)}, ${esc(priceLabel(p))}">
          <span class="s-rooms__thumb media" style="--ph:${p.coverImage.color}">${img(p.coverImage, { alt: '', sizes: '110px' })}</span>
          <span class="s-rooms__meta">
            <span class="s-rooms__no t-cap">Nº ${p.num}</span>
            <span class="s-rooms__name">${esc(p.title)}</span>
            <span class="s-rooms__price t-cap">${esc(priceLabel(p))}</span>
          </span>
        </button>
      </li>`,
    )
    .join('');
  return `
    <ul class="s-rooms__track" aria-label="${esc(room.title)} pieces">
      ${cells}
      <li class="s-rooms__cell">
        <a class="s-rooms__piece s-rooms__piece--all" href="${room.url}" target="_blank" rel="noopener">
          <span class="s-rooms__meta">
            <span class="s-rooms__no t-cap">${esc(room.title)}</span>
            <span class="s-rooms__name">Shop all ${pad2(pieces.length)}</span>
          </span>
          <span class="s-rooms__go" aria-hidden="true">→</span>
        </a>
      </li>
    </ul>`;
}

/** A sideways strip with throw and snap. Vertical swipes still scroll the page (touch-action: pan-y). */
function makeStrip(panel, count, motion) {
  const strip = $('[data-strip]', panel);
  const track = $('.s-rooms__track', strip);
  const cells = $$('.s-rooms__cell', track);
  const idxEl = $('[data-idx]', panel);
  const rail = $('.s-rooms__rail i', panel);
  let snaps = [0];
  let minX = 0;
  let seen = 1;
  let idx = 0;
  let lastX = 0;
  let lastT = 0;
  let dragged = false;

  const lean = motion ? gsap.quickTo(cells, 'skewX', { duration: 0.45, ease: 'power3.out' }) : null;
  const settle = motion ? gsap.delayedCall(0.12, () => lean(0)).pause() : null;

  function update() {
    const x = Number(gsap.getProperty(track, 'x')) || 0;
    const p = minX ? clamp(x / minX, 0, 1) : 1;
    gsap.set(rail, { scaleX: seen + (1 - seen) * p });

    // which piece is at the left edge
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(snaps[i] - x);
      if (d < best - 0.5) {
        best = d;
        k = i;
      }
    }
    if (minX && x <= minX + 2) k = count - 1;
    if (k !== idx) {
      const dir = k > idx ? 1 : -1;
      idx = k;
      idxEl.textContent = pad2(k + 1);
      if (motion) gsap.fromTo(idxEl, { yPercent: 70 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.32, ease: 'wb.out', overwrite: true });
    }

    // tickets lean into the throw
    if (lean) {
      const now = performance.now();
      const v = ((x - lastX) / Math.max(now - lastT, 8)) * 16;
      lastX = x;
      lastT = now;
      lean(clamp(v * 0.3, -5, 5));
      settle.restart(true);
    }
  }

  const drag = Draggable.create(track, {
    type: 'x',
    inertia: true,
    bounds: { minX: 0, maxX: 0 },
    edgeResistance: 0.84,
    overshootTolerance: 0.5,
    throwResistance: 1700,
    maxDuration: 1.1,
    minDuration: 0.28,
    zIndexBoost: false,
    allowContextMenu: true,
    cursor: 'grab',
    activeCursor: 'grabbing',
    snap: { x: (v) => gsap.utils.snap(snaps, v) },
    onPress() {
      dragged = false;
      lastX = this.x;
      lastT = performance.now();
      if (motion) gsap.to(cells, { scale: 0.975, duration: 0.3, ease: 'wb.out', overwrite: 'auto' });
    },
    onRelease() {
      if (motion) gsap.to(cells, { scale: 1, duration: 0.6, ease: 'wb.snap', overwrite: 'auto' });
    },
    onDragStart() {
      dragged = true;
    },
    onDrag: update,
    onThrowUpdate: update,
    onThrowComplete: update,
  })[0];

  function measure() {
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const view = strip.clientWidth - pad;
    const total = track.scrollWidth;
    minX = Math.min(0, Math.round(view - total));
    seen = clamp(view / Math.max(total, 1), 0.08, 1);
    snaps = cells.map((c) => Math.max(minX, -c.offsetLeft));
    drag.applyBounds({ minX, maxX: 0 });
    const x = clamp(Number(gsap.getProperty(track, 'x')) || 0, minX, 0);
    gsap.set(track, { x: gsap.utils.snap(snaps, x) });
    drag.update();
    update();
  }

  // keyboard: bring the focused ticket to the left edge
  const onFocus = (e) => {
    if (!e.target.matches?.(':focus-visible')) return;
    const i = cells.indexOf(e.target.closest('.s-rooms__cell'));
    if (i < 0) return;
    gsap.to(track, { x: snaps[i], duration: motion ? 0.5 : 0, ease: 'wb.out', overwrite: true, onUpdate: update });
  };
  track.addEventListener('focusin', onFocus);

  measure();
  return {
    measure,
    wasDragged: () => dragged,
    kill() {
      track.removeEventListener('focusin', onFocus);
      settle?.kill();
      drag.kill();
    },
  };
}

export function init(root, ctx) {
  const { ROOMS, inRoom, productByHandle, products } = ctx.data;
  const stack = $('.s-rooms__stack', root);
  const kids = Array.from(stack.children);
  const motion = !ctx.reduced;

  // ---------- build ----------
  const total = $('[data-rooms-total]', root);
  if (total) total.textContent = `${pad2(ROOMS.length)} rooms / ${products.length} pieces`;

  const panels = ROOMS.map((room, i) => {
    const el = $(`[data-room="${room.key}"]`, root);
    if (!el) return null;
    const pieces = inRoom(room.key);
    const piece = productByHandle[room.cover[0]];
    const cover = piece.images[room.cover[1]] || piece.coverImage;

    $('[data-shot]', el).innerHTML = shotMarkup(room, piece, cover);
    ($('.s-rooms__side', el) || $('.s-rooms__stage', el)).insertAdjacentHTML('afterbegin', numeralMarkup(i));
    $('[data-count]', el).textContent = `${pad2(pieces.length)} pieces`;
    $('[data-shop]', el).href = room.url;
    $('[data-meter]', el).innerHTML = `<span class="s-rooms__idx"><b data-idx>01</b><span>/ ${pad2(pieces.length)}</span></span><span class="s-rooms__rail"><i></i></span>`;
    $('[data-strip]', el).innerHTML = stripMarkup(room, pieces);

    return { el, key: room.key, i, strip: makeStrip(el, pieces.length, motion) };
  }).filter(Boolean);

  // Tap a ticket or a cover photo: open that piece. A throw that ends on a ticket is not a tap.
  let lastOpen = 0;
  const onClick = (e) => {
    const hit = e.target.closest('[data-open]');
    if (!hit || !root.contains(hit)) return;
    const owner = panels.find((p) => p.el.contains(hit));
    if (hit.closest('.s-rooms__track') && owner?.strip.wasDragged()) return;
    const now = performance.now();
    if (now - lastOpen < 350) return;
    lastOpen = now;
    ctx.openProduct(hit.dataset.open);
  };
  root.addEventListener('click', onClick);

  const remeasure = () => panels.forEach((p) => p.strip.measure());
  ScrollTrigger.addEventListener('refreshInit', remeasure);

  // ---------- motion ----------
  // Positions are worked out from the stack (which never sticks) plus each sheet's place in it, so they stay right
  // whatever is stuck at the moment ScrollTrigger measures.
  const topOf = (el) => {
    let y = 0;
    for (const k of kids) {
      if (k === el) break;
      y += k.offsetHeight;
    }
    return y;
  };
  const within = (el, panel) => {
    let y = 0;
    let n = el;
    while (n && n !== panel) {
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return y;
  };
  const at = (px, where) => `top+=${Math.round(px)} ${where}`;

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // intro
    linesReveal($('.s-rooms__h', root), { start: 'top 86%' });
    riseIn($$('.s-rooms__eyebrow, .s-rooms__sub', root), { start: 'top 92%', y: 22 });

    panels.forEach((p, n) => {
      const { el, key } = p;
      const card = $('.s-rooms__card', el);
      const fig = $('.s-rooms__photo', el);
      const pic = $('img', fig);
      const num = $('.s-rooms__num', el);
      const next = panels[n + 1];
      const restAfter = kids[kids.indexOf(el) + 1]; // the spacer that follows this sheet
      const rest = () => (restAfter ? restAfter.offsetHeight : 0);
      const T = () => topOf(el);
      /** Run fn once, when `target` (a child of this sheet) reaches `where` in the viewport. */
      const once = (target, where, fn) => ScrollTrigger.create({ trigger: stack, start: () => at(T() + within(target, el), where), once: true, onEnter: fn });

      // 1. photo opens while the sheet arrives (scrubbed), then drifts inside its frame for as long as it is on screen
      gsap
        .timeline({
          defaults: { duration: 1 },
          scrollTrigger: { trigger: stack, start: () => at(T() + within(fig, el), 'bottom'), end: () => at(T(), '3%'), scrub: 0.6 },
        })
        .fromTo(fig, { clipPath: CLIP[key][0] }, { clipPath: CLIP[key][1], ease: 'power2.out' }, 0)
        .fromTo(pic, { scale: 1.34 }, { scale: 1.1, ease: 'power1.out' }, 0);
      gsap.fromTo(
        pic,
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: 'none',
          scrollTrigger: { trigger: stack, start: () => at(T(), 'bottom'), end: () => at(T() + el.offsetHeight + rest(), 'top'), scrub: true },
        },
      );

      // 2. numeral: the changed digit rolls from the last room's number; the home digits also part around the doorway
      const rollers = $$('.s-rooms__col', num);
      const roll = gsap.timeline({ paused: true });
      rollers.forEach((col, k) => {
        if (col.hasAttribute('data-roll')) roll.from(col, { yPercent: -50, duration: 1.15, ease: 'wb.inout' }, 0.08 * k);
        else roll.from(col, { yPercent: 104, duration: 0.95, ease: 'wb.out' }, 0.08 * k);
      });
      once(num, '94%', () => roll.play());
      if (key === 'home') {
        const digs = $$('.s-rooms__dig', num);
        gsap
          .timeline({ scrollTrigger: { trigger: stack, start: () => at(T() + within(fig, el), 'bottom'), end: () => at(T(), '3%'), scrub: 0.6 } })
          .fromTo(digs[0], { xPercent: 46 }, { xPercent: 0, ease: 'power2.out', duration: 1 }, 0)
          .fromTo(digs[1], { xPercent: -46 }, { xPercent: 0, ease: 'power2.out', duration: 1 }, 0);
      } else {
        gsap.fromTo(
          num,
          { y: 26 },
          { y: -14, ease: 'none', scrollTrigger: { trigger: stack, start: () => at(T(), 'bottom'), end: () => at(T() + el.offsetHeight + rest(), 'top'), scrub: 0.6 } },
        );
      }

      // 3. headline: kicker and title rise line by line from behind a mask
      const head = { on: false, tweens: new Map() };
      $$('.s-rooms__kicker, .s-rooms__title', el).forEach((line, k) => {
        SplitText.create(line, {
          type: 'lines',
          mask: 'lines',
          linesClass: 's-rooms__ln',
          autoSplit: true,
          onSplit(self) {
            const tw = gsap.from(self.lines, { yPercent: 122, duration: 1.05, stagger: 0.09, delay: head.on ? 0 : 0.1 * k, ease: 'wb.out', paused: !head.on });
            head.tweens.set(line, tw);
            return tw;
          },
        });
      });
      once($('.s-rooms__type', el), '92%', () => {
        head.on = true;
        head.tweens.forEach((tw) => tw.play());
      });

      // 4. sticker pops, caption and supporting copy rise
      const badge = $('.s-rooms__badge', el);
      const tag = $('.s-rooms__tag', el);
      gsap.set(badge, { scale: 0, rotation: -28 });
      gsap.set(tag, { autoAlpha: 0, y: 12 });
      once(badge, '88%', () => gsap.to(badge, { scale: 1, rotation: 0, duration: 0.75, ease: 'wb.snap', delay: 0.15 }));
      once(tag, '94%', () => gsap.to(tag, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.1 }));

      const soft = $$('.s-rooms__where > *, .s-rooms__blurb', el);
      gsap.set(soft, { autoAlpha: 0, y: 14 });
      soft.forEach((node) => once(node, '96%', () => gsap.to(node, { autoAlpha: 1, y: 0, duration: 0.8 })));

      // 5. the button, the counter and the tickets arrive last, tickets from the right so the strip reads as a strip
      const act = $$('.s-rooms__act > *', el);
      const cells = $$('.s-rooms__cell', el);
      gsap.set(act, { autoAlpha: 0, y: 18 });
      gsap.set(cells, { autoAlpha: 0, x: 84 });
      once($('.s-rooms__act', el), '97%', () => gsap.to(act, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }));
      once($('.s-rooms__strip', el), '98%', () => gsap.to(cells, { autoAlpha: 1, x: 0, duration: 1, stagger: 0.055, ease: 'wb.out' }));

      // 6. story segment for this room fills while the room is the one on top
      gsap.fromTo(
        $$('.s-rooms__segs b', el)[n],
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: stack, start: () => at(T(), 'top'), end: () => at(T() + (next ? el.offsetHeight + rest() : rest()), 'top'), scrub: true },
        },
      );

      // 7. as the next sheet slides up, this one sinks back and dims
      if (next) {
        gsap
          .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: stack, start: () => at(topOf(next.el), 'bottom'), end: () => at(topOf(next.el), 'top'), scrub: true } })
          .to(card, { scale: 0.9 }, 0)
          .to($('.s-rooms__dim', el), { opacity: 0.62 }, 0);
      }
    });
  });

  return () => {
    root.removeEventListener('click', onClick);
    ScrollTrigger.removeEventListener('refreshInit', remeasure);
    mm.revert();
    panels.forEach((p) => p.strip.kill());
  };
}
