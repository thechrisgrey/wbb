// Spin room: every piece on the shared 3D turntable. Poster numeral behind, the piece in front, captions in the
// corners, wood swatches, and a ticket rail (Draggable + inertia) to change piece without fighting the rotate gesture.
// With no WebGL, or before any model exists, the same screen runs on her product photos.
import './style.css';
import { gsap, ScrollTrigger, Draggable, reducedMotion } from '../../lib/gsap.js';
import { $, $$, html, clamp, priceLabel, whenNear } from '../../lib/dom.js';
import { img, asset } from '../../lib/media.js';
import { WORDMARK } from '../../brand/marks.js';
import { hasModel, loadModel } from '../../three/models/index.js';

// The stool comes first: the visitor has just watched her build it in the hero.
const LINEUP = [
  'yakisugi-crane-wooden-stool',
  'the-entry-valet',
  'nightcap-bath-tray',
  'the-cornerstone-block',
  'the-butterfly-board',
  'paper-towel-holder',
  'walnut-bench',
  'walnut-tray',
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const DEG = 180 / Math.PI;

function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Break a title into two lines at the space that keeps the longer line shortest. */
function twoLines(title) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return [title];
  let best = 1;
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const len = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
    if (len < bestLen) {
      bestLen = len;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/** Resolve once the page is not scroll-locked (the product sheet or the menu is closed). */
function whenUnlocked() {
  return new Promise((resolve) => {
    const free = () => !document.body.classList.contains('is-locked');
    if (free()) return resolve();
    const mo = new MutationObserver(() => {
      if (!free()) return;
      mo.disconnect();
      resolve();
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
}

export function init(root, ctx) {
  const { products, productByHandle, ROOMS, BRAND } = ctx.data;
  const reduced = reducedMotion();
  const query = new URLSearchParams(window.location.search);

  const all = LINEUP.map((h) => productByHandle[h]).filter(Boolean);
  const modelled = all.filter((p) => hasModel(p.handle));
  // '3d' when at least one model exists and the device can draw it; otherwise her photos carry the whole line-up.
  let mode = query.get('spin') !== 'photo' && modelled.length && canWebGL() ? '3d' : 'photo';
  const pieces = mode === '3d' ? modelled : all;
  if (!pieces.length) return undefined;

  // ---------- elements ----------
  const stageEl = $('[data-spin-stage]', root);
  const host = $('[data-spin-host]', root);
  const photoEl = $('[data-spin-photo]', root);
  const numEl = $('[data-spin-numeral]', root);
  const digits = $$('.s-spin__digit', numEl);
  const rolls = $$('.s-spin__roll', numEl);
  const ringEl = $('.s-spin__ring', root);
  const circle = $('[data-spin-circle]', root);
  const dial = $('[data-spin-dial]', root);
  const lineEl = $('[data-spin-line]', root);
  const countMask = $('[data-spin-count]', root).parentElement;
  const roomMask = $('[data-spin-room]', root).parentElement;
  const caps = $$('.s-spin__cap', root);
  const priceEl = $('[data-spin-price]', root);
  const badgeEl = $('[data-spin-badge]', root);
  const hintEl = $('[data-spin-hint]', root);
  const handEl = $('[data-spin-hand]', root);
  const hintMask = $('[data-spin-hint-text]', root).parentElement;
  const navEl = $('[data-spin-nav]', root);
  const kickerEl = $('[data-spin-kicker]', root);
  const titleEl = $('[data-spin-title]', root);
  const woodsEl = $('[data-spin-woods]', root);
  const swatchesEl = $('[data-spin-swatches]', root);
  const woodMask = $('[data-spin-wood]', root).parentElement;
  const actionsEl = $('[data-spin-actions]', root);
  const viewBtn = $('[data-spin-view]', root);
  const shopLink = $('[data-spin-shop]', root);
  const rail = $('[data-spin-rail]', root);
  const track = $('[data-spin-track]', root);

  // ---------- state ----------
  let index = 0;
  let wood = pieces[0].woodOptions[0].key;
  let stage = null;
  let dead = false;
  let revealed = false; // the first piece has landed
  let dragged = false; // the visitor has rotated once
  let readEl = null; // live angle read-out, after the first drag
  let photo = 0;
  let stickerTl = null;
  let handTl = null;
  let inView = false;
  const offs = [];
  const triggers = [];
  const mine = () => !!stage && stage.state.host === host;
  const roomTitle = (p) => ROOMS.find((r) => r.key === p.room)?.title || p.roomLabel;

  /**
   * Masked swap: the current child slides out of its clip, the new one slides in behind it.
   * Safe to call again mid-flight (anything still leaving is dropped).
   */
  function swap(box, markup, dir, { animate = true, delay = 0, dur = 0.85, out = 0.38, dist = 110 } = {}) {
    const next = html(markup);
    let cur = null;
    Array.from(box.children).forEach((c) => {
      if (c.classList.contains('is-leaving')) {
        gsap.killTweensOf(c);
        c.remove();
      } else cur = c;
    });
    box.appendChild(next);
    if (!cur) return next;
    gsap.killTweensOf(cur);
    if (!animate) {
      cur.remove();
      return next;
    }
    cur.classList.add('is-leaving');
    gsap.to(cur, { yPercent: -dist * dir, duration: out, ease: 'power2.in', delay, onComplete: () => cur.remove() });
    gsap.fromTo(next, { yPercent: dist * dir }, { yPercent: 0, duration: dur, ease: 'wb.out', delay: delay + out * 0.55 });
    return next;
  }

  // ---------- "Now spin it." in her letter tiles ----------
  function buildLine() {
    const [W, o] = WORDMARK.letters;
    const tile = (l, cls) => `<span class="tile ${cls}" data-ch><svg viewBox="${l.vb}"><path d="${l.d}" fill-rule="evenodd"/></svg></span>`;
    const ch = (c, style = '') => `<span class="s-spin__ch" data-ch${style ? ` style="${style}"` : ''}>${c}</span>`;
    lineEl.setAttribute('aria-label', lineEl.textContent.trim());
    lineEl.innerHTML =
      `<span class="s-spin__word" aria-hidden="true">${ch('n')}${tile(o, 'tile--orange')}${tile(W, 'tile--ink')}</span>` +
      `<span class="s-spin__word" aria-hidden="true">${[...'spin'].map((c) => ch(c)).join('')}${ch('i', 'margin-left:0.26em')}${ch('t')}${ch('.')}</span>`;
    return $$('[data-ch]', lineEl);
  }

  // ---------- per-piece rendering ----------
  function setNumeral(p, dir, animate) {
    const before = digits.map((d) => d.getBoundingClientRect().left);
    [...p.num].forEach((c, i) => {
      if (!rolls[i]) return;
      swap(rolls[i], `<span class="s-spin__glyph">${c}</span>`, dir, { animate, delay: i * 0.07, dur: 0.95, out: 0.42, dist: 104 });
    });
    if (!animate) return;
    // digits have their own widths: glide neighbours to their new spot instead of letting them jump
    digits.forEach((d, i) => {
      const dx = before[i] - d.getBoundingClientRect().left;
      if (Math.abs(dx) > 0.5) gsap.fromTo(d, { x: `+=${dx}` }, { x: 0, duration: 0.8, ease: 'wb.out', overwrite: true });
    });
  }

  function fitTitle() {
    titleEl.style.setProperty('--fit', '1');
    const room = titleEl.clientWidth;
    const widest = Math.max(0, ...$$('.s-spin__tline > span:not(.is-leaving)', titleEl).map((s) => s.offsetWidth));
    if (room && widest > room) titleEl.style.setProperty('--fit', String(Math.max(0.6, (room / widest) * 0.985)));
  }

  function setTitle(p, dir, animate) {
    const lines = twoLines(p.title);
    const boxes = $$('.s-spin__tline', titleEl);
    titleEl.setAttribute('aria-label', p.title);
    boxes.forEach((box, i) => {
      box.setAttribute('aria-hidden', 'true');
      swap(box, `<span>${esc(lines[i] || ' ')}</span>`, dir, { animate, delay: 0.05 + i * 0.07, dur: 0.9 });
    });
    fitTitle();
  }

  function setSticker(p, animate) {
    const label = priceLabel(p);
    const from = /^From\s/.test(label);
    const fill = () => {
      priceEl.innerHTML = `${from ? '<small>From</small>' : ''}${esc(label.replace(/^From\s/, ''))}`;
      priceEl.setAttribute('aria-label', label);
      badgeEl.textContent = p.badge || '';
      badgeEl.hidden = !p.badge;
    };
    stickerTl?.kill();
    if (!animate || !revealed) {
      fill();
      if (revealed) gsap.set([priceEl, badgeEl], { scale: 1, rotation: 0 });
      return;
    }
    stickerTl = gsap
      .timeline()
      .to([priceEl, badgeEl], { scale: 0, rotation: 16, duration: 0.2, ease: 'power2.in', stagger: 0.03 })
      .add(fill)
      .fromTo(priceEl, { scale: 0, rotation: -26 }, { scale: 1, rotation: 0, duration: 0.62, ease: 'wb.snap' }, '+=0.26')
      .fromTo(badgeEl, { scale: 0, rotation: 20 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'wb.snap' }, '<0.1');
  }

  function setSwatches(p, animate) {
    const opts = p.woodOptions;
    const live = mode === '3d';
    swatchesEl.innerHTML = opts
      .map((o) => {
        const style = `--sw:${o.tint};--tex:url('${asset(`media/textures/${o.tex}.webp`)}')`;
        return live
          ? `<button class="s-spin__swatch" type="button" data-wood="${o.key}" style="${style}" aria-pressed="${o.key === wood}" aria-label="${esc(o.label)}"></button>`
          : `<span class="s-spin__swatch" style="${style}"></span>`;
      })
      .join('');
    // one wood, or photos only: name what the piece comes in; several woods on the turntable: name the one showing
    const label = live ? opts.find((o) => o.key === wood)?.label || opts[0].label : opts.map((o) => o.label).join(' · ');
    swap(woodMask, `<span>${esc(label)}</span>`, 1, { animate: animate && revealed });
    if (animate && revealed) gsap.fromTo(swatchesEl.children, { scale: 0 }, { scale: 1, duration: 0.6, ease: 'wb.snap', stagger: 0.06, delay: 0.3 });
  }

  function setRail(animate) {
    $$('[data-i]', track).forEach((t, i) => t.setAttribute('aria-current', String(i === index)));
    railTo(index, animate);
  }

  function render(p, dir, animate) {
    setNumeral(p, dir, animate);
    swap(countMask, `<span>Nº ${p.num} / ${String(products.length).padStart(2, '0')}</span>`, dir, { animate });
    swap(roomMask, `<span>${esc(roomTitle(p))}</span>`, dir, { animate, delay: 0.04 });
    swap(kickerEl, `<span>${esc(p.line)}</span>`, dir, { animate, dur: 0.9 });
    setTitle(p, dir, animate);
    setSticker(p, animate);
    setSwatches(p, animate);
    shopLink.href = p.url;
    shopLink.setAttribute('aria-label', `Shop ${p.title} on woodbabybuilds.com (opens in a new tab)`);
    viewBtn.setAttribute('aria-label', `View piece: ${p.title}`);
    host.setAttribute('aria-label', `${p.title} on a turntable. Drag sideways, or use the left and right arrow keys, to rotate it.`);
    setRail(animate);
  }

  // ---------- photos (no WebGL, or no models yet) ----------
  let photoToken = 0;
  async function showPhoto(p, i, dir, animate, kind = 'piece') {
    const n = p.gallery.length;
    photo = ((i % n) + n) % n;
    const m = p.gallery[photo];
    const token = ++photoToken;
    const shot = html(
      `<div class="s-spin__shot" style="--ph:${m.color}">${img(m, { alt: `${p.title}, photo ${photo + 1} of ${n}`, sizes: '(min-width: 900px) 42vw, 78vw', eager: true })}</div>`,
    );
    const im = shot.firstElementChild;
    if (animate && im.decode) await Promise.race([im.decode().catch(() => {}), wait(500)]);
    if (token !== photoToken || dead) return;
    const older = Array.from(photoEl.children);
    photoEl.appendChild(shot);
    const done = () => older.forEach((o) => o.remove());
    if (!animate) return done();
    const from = kind === 'piece' ? 'circle(0% at 50% 50%)' : dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
    const to = kind === 'piece' ? 'circle(72% at 50% 50%)' : 'inset(0% 0% 0% 0%)';
    gsap.fromTo(shot, { clipPath: from }, { clipPath: to, duration: kind === 'piece' ? 0.95 : 0.6, ease: 'wb.inout', onComplete: done });
    gsap.fromTo(im, { scale: 1.25 }, { scale: 1, duration: 1.2, ease: 'wb.out' });
    if (readEl) readEl.textContent = `${String(photo + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    gsap.to(dial, { rotation: (photo / n) * 360, duration: 0.9, ease: 'wb.out', overwrite: true });
  }

  function stepPhoto(dir) {
    const p = pieces[index];
    if (p.gallery.length < 2) return;
    firstTouch();
    showPhoto(p, photo + dir, dir, !reduced, 'angle');
  }

  function bindPhoto() {
    let sx = null;
    let sy = 0;
    const down = (e) => {
      sx = e.clientX;
      sy = e.clientY;
    };
    const up = (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.2) stepPhoto(dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) stepPhoto(1);
    };
    const cancel = () => (sx = null);
    const key = (e) => {
      if (e.key === 'ArrowRight') stepPhoto(1);
      else if (e.key === 'ArrowLeft') stepPhoto(-1);
    };
    photoEl.addEventListener('pointerdown', down);
    photoEl.addEventListener('pointerup', up);
    photoEl.addEventListener('pointercancel', cancel);
    photoEl.addEventListener('keydown', key);
    offs.push(() => {
      photoEl.removeEventListener('pointerdown', down);
      photoEl.removeEventListener('pointerup', up);
      photoEl.removeEventListener('pointercancel', cancel);
      photoEl.removeEventListener('keydown', key);
    });
  }

  let photoBound = false;
  function usePhotos() {
    mode = 'photo';
    host.hidden = true;
    photoEl.hidden = false;
    photoEl.tabIndex = 0;
    photoEl.setAttribute('role', 'group');
    photoEl.setAttribute('aria-label', 'Product photos. Drag sideways, or use the left and right arrow keys, for more angles.');
    const text = $('span', hintMask);
    if (text && !dragged) text.textContent = 'Drag for more angles';
    setSwatches(pieces[index], false);
    if (!photoBound) bindPhoto();
    photoBound = true;
  }

  // ---------- the hint: a hand that flicks the piece, then a live angle read-out ----------
  function startHint() {
    if (dragged) return;
    gsap.fromTo(hintEl, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 });
    if (reduced) return;
    handTl = gsap
      .timeline({ repeat: -1, repeatDelay: 0.35, delay: 1.5, paused: !inView })
      .set(handEl, { x: -6, rotation: -8, autoAlpha: 1, scale: 1 })
      .to(handEl, { scale: 0.86, duration: 0.18, ease: 'power2.out' })
      .add(() => {
        if (mode === '3d' && mine() && inView && !dragged && !stage.state.dragging) stage.nudge(2.3);
      })
      .to(handEl, { x: 20, rotation: 14, duration: 0.62, ease: 'power2.out' })
      .to(handEl, { autoAlpha: 0.25, scale: 1, duration: 0.25, ease: 'power1.out' }, '-=0.12')
      .to(handEl, { x: -6, rotation: -8, duration: 0.55, ease: 'power2.inOut' })
      .to(handEl, { autoAlpha: 1, duration: 0.2 }, '-=0.2');
  }

  function firstTouch() {
    if (dragged) return;
    dragged = true;
    handTl?.kill();
    handTl = null;
    const showRead = () => {
      handEl.className = 's-spin__dot';
      handEl.innerHTML = '';
      gsap.set(handEl, { clearProps: 'all' });
      const start = mode === '3d' ? '000°' : `${String(photo + 1).padStart(2, '0')} / ${String(pieces[index].gallery.length).padStart(2, '0')}`;
      readEl = swap(hintMask, `<span class="s-spin__read">${start}</span>`, 1, { animate: !reduced });
      if (!reduced) gsap.fromTo(handEl, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'wb.snap' });
    };
    if (reduced) showRead();
    else gsap.to(handEl, { scale: 0, rotation: -30, autoAlpha: 1, duration: 0.28, ease: 'power2.in', overwrite: true, onComplete: showRead });
  }

  // ---------- 3D stage ----------
  const setDial = gsap.quickSetter(dial, 'rotation', 'deg');
  let lastDeg = -1;
  function bindStage(st) {
    offs.push(
      st.on('change', (s) => {
        if (s.host !== host) return;
        const deg = (((s.yaw * DEG) % 360) + 360) % 360;
        setDial(deg);
        if (!readEl) return;
        const d = Math.round(deg) % 360;
        if (d === lastDeg) return;
        lastDeg = d;
        readEl.textContent = `${String(d).padStart(3, '0')}°`;
      }),
      st.on('drag', (on) => {
        if (on && st.state.host === host) firstTouch();
      }),
    );
  }

  const boot = (async () => {
    if (mode !== '3d') return null;
    await whenNear(root, '900px');
    await whenUnlocked();
    const st = await ctx.stage();
    if (dead) return null;
    if (!st) {
      usePhotos();
      return null;
    }
    loadModel(pieces[index].handle).catch(() => {}); // warm the chunk before the entrance asks for it
    await whenUnlocked();
    if (dead) return null;
    st.mount(host, { mode: 'turntable' });
    stage = st;
    bindStage(st);
    return st;
  })().catch(() => {
    if (!dead) usePhotos();
    return null;
  });

  async function showCurrent(dir, animate) {
    const p = pieces[index];
    if (mode === '3d') {
      if (!mine()) return;
      try {
        await stage.show(p.handle, { wood, immediate: !animate });
        const next = pieces[(index + 1) % pieces.length];
        if (next !== p) loadModel(next.handle).catch(() => {});
        return;
      } catch {
        if (dead) return;
        usePhotos();
      }
    }
    await showPhoto(p, 0, dir, animate, 'piece');
  }

  // ---------- change piece ----------
  function go(to, dir) {
    const n = pieces.length;
    const i = ((to % n) + n) % n;
    if (i === index) return;
    const d = dir || (i > index ? 1 : -1);
    index = i;
    const p = pieces[i];
    wood = p.woodOptions[0].key;
    render(p, d, !reduced);
    if (revealed) showCurrent(d, !reduced);
    if (!reduced) gsap.fromTo(ringEl, { scale: 0.93 }, { scale: 1, duration: 0.9, ease: 'wb.snap', overwrite: true });
  }

  function pickWood(key) {
    const p = pieces[index];
    const opt = p.woodOptions.find((o) => o.key === key);
    if (!opt || key === wood) return;
    wood = key;
    $$('[data-wood]', swatchesEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wood === key)));
    swap(woodMask, `<span>${esc(opt.label)}</span>`, 1, { animate: !reduced });
    if (mode === '3d' && mine()) stage.setWood(key);
  }

  // ---------- ticket rail ----------
  const catalogEl = document.getElementById('catalog');
  track.innerHTML =
    pieces
      .map(
        (p, i) =>
          `<button class="s-spin__ticket" type="button" data-i="${i}" aria-current="${i === 0}" aria-label="Nº ${p.num}, ${esc(p.title)}">` +
          `<span class="s-spin__thumb" style="--ph:${p.coverImage.color}">${img(p.coverImage, { sizes: '48px' })}</span>` +
          `<span class="s-spin__perf" aria-hidden="true"></span><span class="s-spin__tnum" aria-hidden="true">${p.num}</span></button>`,
      )
      .join('') +
    (catalogEl
      ? `<a class="s-spin__ticket s-spin__ticket--all" href="#catalog" data-all><span>All</span><b>${products.length}</b><span aria-hidden="true">↓</span></a>`
      : `<a class="s-spin__ticket s-spin__ticket--all" href="${BRAND.shopAll}" target="_blank" rel="noopener"><span>Shop all</span><b>${products.length}</b><span aria-hidden="true">↗</span></a>`);
  const tickets = $$('.s-spin__ticket', track);

  let minX = 0;
  let snaps = [0];
  let drag = null;
  let railMoved = false;
  function measureRail() {
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    minX = Math.min(0, rail.clientWidth - track.offsetWidth);
    snaps = [...new Set(tickets.map((t) => clamp(-(t.offsetLeft - pad), minX, 0)))];
    if (drag) {
      drag.applyBounds({ minX, maxX: 0 });
      drag.enabled(minX < 0);
    }
  }
  function railTo(i, animate) {
    const t = tickets[i];
    if (!t) return;
    const x = clamp(-(t.offsetLeft + t.offsetWidth / 2 - rail.clientWidth / 2), minX, 0);
    gsap.to(track, { x, duration: animate ? 0.8 : 0, ease: 'wb.out', overwrite: true, onComplete: () => drag?.update() });
  }
  measureRail();
  drag = Draggable.create(track, {
    type: 'x',
    inertia: true,
    bounds: { minX, maxX: 0 },
    edgeResistance: 0.78,
    minimumMovement: 5,
    dragClickables: true,
    allowContextMenu: true,
    zIndexBoost: false,
    cursor: 'grab',
    activeCursor: 'grabbing',
    snap: { x: (v) => gsap.utils.snap(snaps, clamp(v, minX, 0)) },
    onDragStart() {
      railMoved = true;
    },
    onDragEnd() {
      setTimeout(() => (railMoved = false), 80);
    },
  })[0];
  drag.enabled(minX < 0);

  const onTrackClick = (e) => {
    if (railMoved) {
      e.preventDefault();
      return;
    }
    const allLink = e.target.closest('[data-all]');
    if (allLink && catalogEl) {
      e.preventDefault();
      gsap.to(window, { scrollTo: { y: catalogEl, autoKill: true }, duration: reduced ? 0 : 1.1, ease: 'wb.inout' });
      return;
    }
    const t = e.target.closest('[data-i]');
    if (t) go(+t.dataset.i);
  };
  track.addEventListener('click', onTrackClick);

  // ---------- controls ----------
  const onNav = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const dir = btn.hasAttribute('data-spin-prev') ? -1 : 1;
    go(index + dir, dir);
    if (!reduced) gsap.fromTo(btn.firstElementChild, { x: dir * 9 }, { x: 0, duration: 0.5, ease: 'wb.snap' });
  };
  const onWood = (e) => {
    const b = e.target.closest('[data-wood]');
    if (b) pickWood(b.dataset.wood);
  };
  const onView = () => ctx.openProduct(pieces[index].handle);
  navEl.addEventListener('click', onNav);
  woodsEl.addEventListener('click', onWood);
  viewBtn.addEventListener('click', onView);
  navEl.hidden = pieces.length < 2;

  let resizeT = 0;
  const onResize = () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      fitTitle();
      measureRail();
      railTo(index, false);
    }, 150);
  };
  window.addEventListener('resize', onResize);
  document.fonts?.ready.then(() => !dead && onResize());

  // ---------- first render ----------
  if (mode === 'photo') usePhotos();
  render(pieces[0], 1, false);
  const chars = reduced ? [] : buildLine();

  // ---------- reveal: the piece lands, the words get out of its way ----------
  let landing = false;
  async function reveal() {
    if (landing || dead) return;
    landing = true;
    await showCurrent(1, !reduced);
    if (dead) return;
    revealed = true;
    if (reduced) {
      lineEl.classList.add('is-done');
      gsap.set([priceEl, badgeEl, hintEl], { autoAlpha: 1, scale: 1 });
      startHint();
      return;
    }
    // letters drift apart as the piece bursts through them
    const mid = (chars.length - 1) / 2;
    gsap.to(chars, {
      x: (i) => (i - mid) * 26 + gsap.utils.random(-20, 20),
      y: () => gsap.utils.random(-90, 90),
      rotation: () => gsap.utils.random(-80, 80),
      scale: 0,
      duration: 0.5,
      ease: 'power2.in',
      stagger: { each: 0.018, from: 'center' },
      overwrite: true,
      onComplete: () => lineEl.classList.add('is-done'),
    });
    gsap.fromTo(priceEl, { scale: 0, rotation: -26, autoAlpha: 1 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'wb.snap', delay: 0.55 });
    gsap.fromTo(badgeEl, { scale: 0, rotation: 20, autoAlpha: 1 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'wb.snap', delay: 0.68 });
    startHint();
  }

  if (reduced) {
    // no choreography: everything is already in place, the piece appears as soon as the turntable is ready
    lineEl.classList.add('is-done');
    boot.then(reveal);
    return cleanup;
  }

  // ---------- entrance ----------
  // start states (set here, never in CSS, so the section reads fine if this script never runs)
  const firstText = [$('span', kickerEl), ...$$('.s-spin__tline > span', titleEl), $('span', countMask), $('span', roomMask), $('span', woodMask)];
  gsap.set(firstText, { yPercent: 110 });
  gsap.set(chars, { autoAlpha: 0 });
  gsap.set([priceEl, badgeEl], { scale: 0 });
  gsap.set(hintEl, { autoAlpha: 0 });
  gsap.set(circle, { drawSVG: '0%' });
  gsap.set(dial, { autoAlpha: 0 });

  // 1. scrubbed: the numeral rolls up into place as the section arrives
  const rise = gsap.timeline({ defaults: { ease: 'power2.out' } });
  rise.fromTo(rolls, { yPercent: 104 }, { yPercent: 0, duration: 1, stagger: 0.22 });
  triggers.push(ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'top 22%', scrub: 0.6, animation: rise }));

  // 2. triggered: circle draws, "Now spin it." drops in on her tiles, words and tickets arrive, then the piece
  let held;
  const hold = new Promise((r) => (held = r));
  const intro = gsap.timeline({ paused: true });
  intro
    .to(circle, { drawSVG: '100%', duration: 1.2, ease: 'wb.inout' }, 0)
    .to(dial, { autoAlpha: 1, duration: 0.3 }, 0.9)
    .fromTo(
      chars,
      { yPercent: -170, rotation: () => gsap.utils.random(-34, 34), autoAlpha: 0 },
      { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.72, ease: 'wb.snap', stagger: 0.045 },
      0.05,
    )
    .to(firstText.slice(3, 5), { yPercent: 0, duration: 0.7, stagger: 0.08 }, 0.15)
    .to(firstText.slice(0, 3), { yPercent: 0, duration: 0.95, stagger: 0.085 }, 0.3)
    .fromTo($$('.s-spin__swatch', swatchesEl), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'wb.snap', stagger: 0.06 }, 0.55)
    .to(firstText[5], { yPercent: 0, duration: 0.7 }, 0.6)
    .fromTo(actionsEl.children, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, 0.6)
    .fromTo(tickets, { x: 90, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.8, stagger: 0.055 }, 0.65)
    .fromTo(navEl.children, { scale: 0 }, { scale: 1, duration: 0.55, ease: 'wb.snap', stagger: 0.07 }, 0.8)
    .add(() => held(), 1.25);
  triggers.push(
    ScrollTrigger.create({
      trigger: root,
      start: 'top 58%',
      once: true,
      onEnter: () => {
        intro.play();
        // the piece lands once the words have had their beat and the turntable is ready (or after a grace period)
        Promise.all([hold, Promise.race([boot, wait(6000)])]).then(reveal);
        // a turntable that arrives after the grace period still gets its piece
        boot.then((st) => st && revealed && !dead && showCurrent(1, true));
      },
    }),
  );

  // 3. scrubbed: the numeral hangs back a little as the screen leaves, the piece does not
  const leave = gsap.fromTo(numEl, { yPercent: 0 }, { yPercent: 16, ease: 'none', immediateRender: false });
  triggers.push(ScrollTrigger.create({ trigger: root, start: 'bottom 85%', end: 'bottom top', scrub: true, animation: leave }));

  // pause the hint loop off screen
  triggers.push(
    ScrollTrigger.create({
      trigger: root,
      start: 'top 80%',
      end: 'bottom 20%',
      onToggle: (self) => {
        inView = self.isActive;
        handTl?.paused(!inView);
      },
    }),
  );

  function cleanup() {
    dead = true;
    clearTimeout(resizeT);
    window.removeEventListener('resize', onResize);
    track.removeEventListener('click', onTrackClick);
    navEl.removeEventListener('click', onNav);
    woodsEl.removeEventListener('click', onWood);
    viewBtn.removeEventListener('click', onView);
    offs.forEach((off) => off());
    triggers.forEach((t) => t.kill());
    stickerTl?.kill();
    handTl?.kill();
    drag?.kill();
    gsap.killTweensOf([root, ...root.querySelectorAll('*')]);
  }
  return cleanup;
}
