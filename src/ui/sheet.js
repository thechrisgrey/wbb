// Product sheet. open(handle) slides it up over the page: her photos as a tap-through story with progress bars,
// the piece on the 3D turntable (free rotate + pinch), her words, and one button to buy on her live store.
import './sheet.css';
import { gsap, Draggable, reducedMotion } from '../lib/gsap.js';
import { lockScroll, money } from '../lib/dom.js';
import { src, srcset } from '../lib/media.js';
import { hasModel } from '../three/models/index.js';

const STORY_SECONDS = 4.6;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SPECIES_WORDS = [
  ['rosewood', 'rosewood'],
  ['mahogany', 'mahogany'],
  ['walnut', 'walnut'],
  ['maple', 'maple'],
  ['oak', 'oak'],
  ['yakisugi', 'ebonized'],
  ['black', 'ebonized'],
];

export function initSheet(ctx) {
  const root = document.getElementById('sheet');
  if (!root) return null;
  const { products, productByHandle } = ctx.data;
  const reduced = reducedMotion();
  const q = (sel) => root.querySelector(sel);
  const panel = q('.sheet__panel');
  const backdrop = q('.sheet__backdrop');
  const scroller = q('[data-sheet-scroll]');
  const slidesEl = q('[data-sheet-slides]');
  const barsEl = q('[data-sheet-bars]');
  const photosEl = q('[data-sheet-photos]');
  const stageEl = q('[data-sheet-stage]');
  const hostEl = q('[data-sheet-host]');
  const modesEl = q('[data-sheet-modes]');
  const woodsEl = q('[data-sheet-woods]');
  const bodyEl = q('[data-sheet-body]');

  let current = null;
  let isOpen = false;
  let mode = 'photos';
  let photo = 0;
  let barTween = null;
  let wood = null;
  let stage = null;
  let borrowed = null; // where the shared canvas lived before the sheet took it
  let opener = null;
  let token = 0;

  // ---------- render ----------
  function render(p) {
    q('[data-sheet-index]').textContent = `Nº ${p.num} / ${products.length} · ${p.roomLabel}`;
    slidesEl.innerHTML = p.gallery
      .map(
        (m, i) =>
          `<div class="sheet__slide${i === 0 ? ' is-on' : ''}" style="--ph:${m.color}"><img src="${src(m, 600)}" srcset="${srcset(m)}" sizes="(min-width: 900px) 560px, 100vw" alt="${esc(p.title)}, photo ${i + 1} of ${p.gallery.length}" ${
            i === 0 ? 'decoding="sync"' : 'loading="lazy" decoding="async"'
          } draggable="false"></div>`,
      )
      .join('');
    barsEl.innerHTML = p.gallery.map(() => '<span><i></i></span>').join('');
    barsEl.hidden = p.gallery.length < 2;

    const options = p.options
      .map(
        (o, gi) =>
          `<div class="sheet__group"><h3 class="t-cap">${esc(o.name)}</h3><div class="sheet__chips">${o.values
            .map((v, vi) => `<button type="button" class="chip" data-opt="${gi}" data-val="${esc(v)}" aria-pressed="${vi === 0}">${esc(v)}</button>`)
            .join('')}</div></div>`,
      )
      .join('');
    bodyEl.innerHTML = `
      <div class="sheet__kicker"><span class="chip">${esc(p.roomLabel)}</span>${p.badge ? `<span class="sticker">${esc(p.badge)}</span>` : ''}</div>
      <h2 class="t-h1 sheet__title" id="sheet-title">${esc(p.title)}</h2>
      <p class="t-serif sheet__line">${esc(p.line)}</p>
      <div class="sheet__intro">${p.intro.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      ${options}
      ${p.details.length ? `<ul class="sheet__details">${p.details.map((d, i) => `<li><span class="t-cap">${String(i + 1).padStart(2, '0')}</span><span>${esc(d)}</span></li>`).join('')}</ul>` : ''}
      <p class="t-cap sheet__fine">Made to order · Handmade in Nashville, TN</p>`;

    q('[data-sheet-price-cap]').textContent = p.priceMin === p.priceMax ? 'Price' : 'From';
    q('[data-sheet-price]').textContent = money(p.priceMin);
    q('[data-sheet-cta]').href = p.url;
    q('[data-sheet-num]').textContent = p.num;

    const has3d = hasModel(p.handle);
    modesEl.toggleAttribute('data-single', !has3d);
    renderWoods(p);
  }

  function renderWoods(p) {
    const opts = p.woodOptions;
    const active = opts.find((o) => o.key === wood) || opts[0];
    woodsEl.innerHTML =
      opts.length > 1
        ? opts.map((o) => `<button type="button" class="sheet__wood" style="--sw:${o.swatch}" data-wood="${o.key}" aria-pressed="${o.key === active.key}" aria-label="${esc(o.label)}"></button>`).join('') +
          `<span class="t-cap sheet__wood-label" data-wood-label>${esc(active.label)}</span>`
        : `<span class="t-cap sheet__wood-label">${esc(active.label)}</span>`;
  }

  // ---------- photo story ----------
  function runBar() {
    barTween?.kill();
    if (!current || current.gallery.length < 2) return;
    const fills = barsEl.querySelectorAll('i');
    fills.forEach((f, i) => gsap.set(f, { scaleX: i < photo ? 1 : 0 }));
    if (reduced) {
      gsap.set(fills[photo], { scaleX: 1 });
      return;
    }
    barTween = gsap.to(fills[photo], { scaleX: 1, duration: STORY_SECONDS, ease: 'none', onComplete: () => goPhoto(photo + 1, 1) });
    if (mode !== 'photos') barTween.pause();
  }

  function goPhoto(to, dir = 1) {
    if (!current) return;
    const n = current.gallery.length;
    if (n < 2) return;
    const next = ((to % n) + n) % n;
    if (next === photo) return;
    const slides = slidesEl.children;
    const out = slides[photo];
    const inc = slides[next];
    photo = next;
    [...slides].forEach((s) => (s.style.zIndex = s === inc ? 2 : s === out ? 1 : 0));
    inc.classList.add('is-on');
    if (reduced) {
      out.classList.remove('is-on');
    } else {
      gsap.killTweensOf([inc, inc.firstElementChild]);
      gsap.fromTo(inc, { clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.62, ease: 'wb.inout', onComplete: () => out.classList.remove('is-on') });
      gsap.fromTo(inc.firstElementChild, { scale: 1.16 }, { scale: 1, duration: 0.9, ease: 'wb.out' });
    }
    runBar();
  }

  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let swiped = false;
  photosEl.addEventListener('pointerdown', (e) => {
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
    swiped = false;
    barTween?.pause();
  });
  const release = (e) => {
    if (mode === 'photos') barTween?.resume();
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped = true;
      goPhoto(photo + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };
  photosEl.addEventListener('pointerup', release);
  photosEl.addEventListener('pointercancel', () => mode === 'photos' && barTween?.resume());
  photosEl.addEventListener('click', (e) => {
    const tap = e.target.closest('[data-sheet-photo]');
    if (!tap || swiped || performance.now() - downAt > 380) return; // a long press only pauses
    const dir = +tap.dataset.sheetPhoto;
    goPhoto(photo + dir, dir);
  });

  // ---------- 3D ----------
  async function enter3d() {
    const myToken = token;
    stageEl.hidden = false;
    barTween?.pause();
    if (!reduced) gsap.fromTo(stageEl, { clipPath: 'circle(0% at 84% 92%)' }, { clipPath: 'circle(150% at 84% 92%)', duration: 0.85, ease: 'wb.inout' });
    const st = await ctx.stage();
    if (myToken !== token || mode !== '3d') return;
    if (!st) {
      setMode('photos');
      modesEl.setAttribute('data-single', '');
      return;
    }
    stage = st;
    if (!borrowed) borrowed = { host: st.state.host, handle: st.state.handle, wood: st.state.wood, mode: st.state.mode };
    st.mount(hostEl, { mode: 'free' });
    st.setAuto(true);
    await st.show(current.handle, { wood });
  }

  function leave3d() {
    if (reduced) {
      stageEl.hidden = true;
    } else {
      gsap.to(stageEl, { clipPath: 'circle(0% at 84% 92%)', duration: 0.55, ease: 'wb.inout', onComplete: () => mode !== '3d' && (stageEl.hidden = true) });
    }
    barTween?.resume();
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    modesEl.querySelectorAll('[data-sheet-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sheetMode === mode)));
    if (mode === '3d') enter3d();
    else leave3d();
  }

  function returnStage() {
    if (!stage || !borrowed) return;
    const b = borrowed;
    borrowed = null;
    if (b.host && b.host.isConnected) {
      stage.mount(b.host, { mode: b.mode || 'turntable' });
      if (b.handle) stage.show(b.handle, { wood: b.wood, immediate: true });
    }
  }

  function setWood(key) {
    if (!current || !current.woods.includes(key) || key === wood) return;
    wood = key;
    renderWoods(current);
    if (mode === '3d' && stage) stage.setWood(key);
  }

  // ---------- open / close ----------
  function open(handle, { view } = {}) {
    const p = productByHandle[handle];
    if (!p) return;
    token += 1;
    const switching = isOpen;
    current = p;
    wood = p.woods[0];
    photo = 0;
    render(p);
    scroller.scrollTop = 0;

    const want3d = hasModel(p.handle) && (view === '3d' || (switching && mode === '3d'));
    // reset mode UI without animation, then enter the wanted one
    mode = 'photos';
    stageEl.hidden = true;
    gsap.set(stageEl, { clearProps: 'clipPath' });
    modesEl.querySelectorAll('[data-sheet-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sheetMode === 'photos')));

    if (!switching) {
      isOpen = true;
      opener = document.activeElement;
      root.hidden = false;
      lockScroll(true);
      ctx.dock?.hide(true);
      try {
        history.pushState({ wbSheet: handle }, '');
      } catch {
        /* history unavailable (sandboxed frame) */
      }
      gsap.killTweensOf([panel, backdrop]);
      gsap.set(panel, { y: 0 });
      if (reduced) {
        gsap.set(panel, { yPercent: 0 });
        gsap.set(backdrop, { opacity: 0.62 });
      } else {
        gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 0.62, duration: 0.5, ease: 'power2.out' });
        gsap.fromTo(panel, { yPercent: 104 }, { yPercent: 0, duration: 0.9, ease: 'wb.out' });
      }
      panel.focus({ preventScroll: true });
    }
    if (!reduced) {
      gsap.fromTo(bodyEl.children, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.045, delay: switching ? 0.05 : 0.28, ease: 'wb.out', overwrite: true });
      gsap.fromTo(slidesEl, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, delay: switching ? 0 : 0.22, ease: 'wb.inout' });
      gsap.fromTo(slidesEl.firstElementChild.firstElementChild, { scale: 1.2 }, { scale: 1, duration: 1.2, delay: switching ? 0 : 0.22, ease: 'wb.out' });
    }
    runBar();
    if (want3d) setMode('3d');
  }

  function close({ fromPop = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    token += 1;
    barTween?.kill();
    lockScroll(false);
    ctx.dock?.hide(false);
    const done = () => {
      root.hidden = true;
      gsap.set(panel, { y: 0 });
      mode = 'photos';
      stageEl.hidden = true;
      returnStage();
      opener?.focus?.({ preventScroll: true });
    };
    if (reduced) done();
    else {
      gsap.to(backdrop, { opacity: 0, duration: 0.45, ease: 'power2.in' });
      gsap.to(panel, { yPercent: 104, duration: 0.5, ease: 'power3.in', onComplete: done });
    }
    if (!fromPop && history.state?.wbSheet) history.back();
  }

  const step = (dir) => {
    const i = products.indexOf(current);
    open(products[(i + dir + products.length) % products.length].handle);
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) return close();
    if (e.target.closest('[data-sheet-prev]')) return step(-1);
    if (e.target.closest('[data-sheet-next]')) return step(1);
    const modeBtn = e.target.closest('[data-sheet-mode]');
    if (modeBtn) return setMode(modeBtn.dataset.sheetMode);
    const sw = e.target.closest('[data-wood]');
    if (sw) return setWood(sw.dataset.wood);
    const chip = e.target.closest('[data-opt]');
    if (chip) {
      bodyEl.querySelectorAll(`[data-opt="${chip.dataset.opt}"]`).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      if (!reduced) gsap.fromTo(chip, { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'wb.snap' });
      const val = chip.dataset.val.toLowerCase();
      const hit = SPECIES_WORDS.find(([word]) => val.includes(word));
      if (hit) setWood(hit[1]);
    }
  });
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' && mode === 'photos') goPhoto(photo + 1, 1);
    if (e.key === 'ArrowLeft' && mode === 'photos') goPhoto(photo - 1, -1);
  });
  window.addEventListener('popstate', () => isOpen && close({ fromPop: true }));

  // Drag the top bar down to dismiss.
  Draggable.create(panel, {
    type: 'y',
    trigger: q('[data-sheet-grab]'),
    bounds: { minY: 0, maxY: 2000 },
    onDragEnd() {
      if (this.y > 110) close();
      else gsap.to(panel, { y: 0, duration: 0.55, ease: 'wb.snap' });
    },
  });

  // Deep link: #p=<handle> opens that piece once the page is revealed.
  const deep = location.hash.match(/^#p=([\w-]+)/);
  if (deep && productByHandle[deep[1]]) ctx.onEntered(() => setTimeout(() => open(deep[1]), 900));

  return { open, close, isOpen: () => isOpen };
}
