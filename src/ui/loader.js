// Preloader. Counts up against real work (fonts, the hero poster, the first seconds of video), stamps her WB badge,
// then lifts the ink field like a curtain. Resolves when the page is revealed so intros can start.
import './loader.css';
import { gsap, reducedMotion } from '../lib/gsap.js';
import { BADGE } from '../brand/marks.js';
import { BUILD_VIDEO } from '../data/site.js';
import { asset, preload } from '../lib/media.js';

const MIN_MS = 1900;
const MAX_MS = 5200;

export function badgeSvg(cls = '') {
  const layer = (d, fill, name) => `<svg class="${cls} badge-layer badge-layer--${name}" viewBox="${BADGE.viewBox}" aria-hidden="true"><path d="${d}" fill="${fill}" fill-rule="evenodd"/></svg>`;
  return layer(BADGE.layers.shadow, '#e0722c', 'shadow') + layer(BADGE.layers.outline, '#16130f', 'outline') + layer(BADGE.layers.fill, '#eee5c1', 'fill');
}

function warmVideo() {
  // Fetch enough of the hero video that it can start the moment the curtain lifts.
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = asset(window.innerWidth > 700 ? BUILD_VIDEO.src1080 : BUILD_VIDEO.src720);
    const done = () => resolve();
    v.addEventListener('canplaythrough', done, { once: true });
    v.addEventListener('loadeddata', done, { once: true });
    v.addEventListener('error', done, { once: true });
    v.load();
  });
}

export function runLoader() {
  const el = document.getElementById('loader');
  if (!el) return Promise.resolve();
  const count = el.querySelector('[data-loader-count]');
  const bar = el.querySelector('[data-loader-bar]');
  const badge = el.querySelector('[data-loader-badge]');
  badge.innerHTML = badgeSvg();
  document.body.classList.add('is-locked');

  const tasks = [document.fonts?.ready ?? Promise.resolve(), preload(asset(BUILD_VIDEO.poster)), warmVideo()];
  let finished = 0;
  const progress = { shown: 0 };
  const startedAt = performance.now();
  const reduced = reducedMotion();

  const render = () => {
    count.textContent = String(Math.round(progress.shown)).padStart(2, '0');
    gsap.set(bar, { scaleX: progress.shown / 100 });
  };
  const advance = (to, duration = 0.7) => gsap.to(progress, { shown: to, duration, ease: 'power2.out', onUpdate: render, overwrite: true });

  return new Promise((resolve) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - startedAt)) / 1000;
      advance(100, Math.max(0.5, wait)).then(exit);
    };

    const exit = () => {
      document.body.classList.remove('is-locked');
      if (reduced) {
        gsap.to(el, { autoAlpha: 0, duration: 0.3, onComplete: () => (el.remove(), resolve()) });
        return;
      }
      const reveal = () => {
        el.style.pointerEvents = 'none';
        resolve();
      };
      const tl = gsap.timeline({ onComplete: () => (el.remove(), resolve()) });
      tl.to(count, { yPercent: -110, duration: 0.55, ease: 'wb.inout' }, 0)
        .to('.loader__cap, .loader__line, .loader__bar', { autoAlpha: 0, duration: 0.3 }, 0)
        .to(badge, { scale: 1.12, duration: 0.25, ease: 'power2.out' }, 0.05)
        .to(badge, { scale: 0, rotate: -14, duration: 0.5, ease: 'back.in(1.6)' }, 0.3)
        .to('.loader__field', { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.95, ease: 'wb.inout' }, 0.42)
        // reveal the page a beat before the curtain is fully up so the hero intro overlaps it
        .call(reveal, null, 0.62);
    };

    if (!reduced) {
      gsap.set('.loader__field', { clipPath: 'inset(0% 0% 0% 0%)' });
      const [shadow, outline, fill] = badge.querySelectorAll('svg');
      gsap
        .timeline()
        .from(outline, { scale: 0, rotate: -18, duration: 0.7, ease: 'wb.snap', transformOrigin: '50% 60%' }, 0.05)
        .from(fill, { scale: 0, duration: 0.6, ease: 'wb.snap', transformOrigin: '50% 60%' }, 0.2)
        .from(shadow, { xPercent: -5, yPercent: -7, autoAlpha: 0, duration: 0.5, ease: 'wb.out' }, 0.42)
        .from('.loader__line', { yPercent: 60, autoAlpha: 0, duration: 0.7 }, 0.5)
        .from('.loader__cap', { autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.3);
    }

    advance(24, 0.9);
    tasks.forEach((t) =>
      Promise.resolve(t).then(() => {
        finished += 1;
        if (finished === tasks.length) release();
        else advance(24 + (finished / tasks.length) * 60);
      }),
    );
    setTimeout(release, MAX_MS);
  });
}
