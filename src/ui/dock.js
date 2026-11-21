// The dock (floating pill) and the full-screen menu it opens.
import './dock.css';
import { gsap, ScrollTrigger, reducedMotion } from '../lib/gsap.js';
import { lockScroll } from '../lib/dom.js';
import { badgeSvg } from './loader.js';

export function initDock(ctx) {
  const dock = document.getElementById('dock');
  const menu = document.getElementById('menu');
  if (!dock) return null;
  const reduced = reducedMotion();

  dock.querySelector('[data-dock-badge]').innerHTML = badgeSvg();
  const count = dock.querySelector('[data-dock-count]');
  if (count) count.textContent = String(ctx.data.products.length);

  // Rise in once the preloader lifts.
  if (!reduced) {
    gsap.set(dock, { yPercent: 180 });
    ctx.onEntered(() => gsap.to(dock, { yPercent: 0, duration: 1.1, ease: 'wb.snap', delay: 0.9 }));
  }

  const scrollTo = (target) => {
    const y = target === '0' ? 0 : target;
    gsap.to(window, { scrollTo: { y, autoKill: true }, duration: reduced ? 0 : 1.2, ease: 'wb.inout' });
  };

  dock.addEventListener('click', (e) => {
    const link = e.target.closest('[data-dock-to]');
    if (!link) return;
    e.preventDefault();
    if (isOpen) close();
    scrollTo(link.dataset.dockTo);
  });

  // Page progress along the bottom of the pill.
  const bar = dock.querySelector('[data-dock-progress]');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }) });

  // Highlight the link for the section in view. Sections may mount later, so resolve targets lazily.
  const links = [...dock.querySelectorAll('.dock__link')];
  const mark = () => {
    const mid = window.innerHeight * 0.5;
    links.forEach((a) => {
      const el = document.querySelector(a.dataset.dockTo);
      if (!el) return a.classList.remove('is-current');
      const r = el.getBoundingClientRect();
      a.classList.toggle('is-current', r.top <= mid && r.bottom >= mid);
    });
  };
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: mark });

  // ---------- menu ----------
  let isOpen = false;
  let tl = null;
  const openBtn = dock.querySelector('[data-menu-open]');

  function open() {
    if (isOpen || !menu) return;
    isOpen = true;
    menu.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    tl?.kill();
    if (reduced) return;
    tl = gsap
      .timeline()
      .fromTo(menu.querySelector('.menu__field'), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'wb.inout' }, 0)
      .fromTo(menu.querySelectorAll('.menu__links a'), { yPercent: 110 }, { yPercent: 0, duration: 0.85, stagger: 0.055, ease: 'wb.out' }, 0.22)
      .fromTo(menu.querySelectorAll('.menu__top > *, .menu__foot > *'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06 }, 0.45);
  }

  function close() {
    if (!isOpen || !menu) return;
    isOpen = false;
    openBtn.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    tl?.kill();
    if (reduced) {
      menu.hidden = true;
      return;
    }
    tl = gsap
      .timeline({ onComplete: () => (menu.hidden = true) })
      .to(menu.querySelectorAll('.menu__links a'), { yPercent: -110, duration: 0.4, stagger: 0.03, ease: 'power2.in' }, 0)
      .to(menu.querySelectorAll('.menu__top > *, .menu__foot > *'), { autoAlpha: 0, duration: 0.25 }, 0)
      .to(menu.querySelector('.menu__field'), { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'wb.inout' }, 0.18);
  }

  openBtn?.addEventListener('click', () => (isOpen ? close() : open()));
  menu?.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu-close]')) return close();
    const link = e.target.closest('[data-menu-to]');
    if (link) {
      e.preventDefault();
      close();
      scrollTo(link.dataset.menuTo);
    }
  });
  window.addEventListener('keydown', (e) => e.key === 'Escape' && close());

  return {
    el: dock,
    /** Slide the dock out of the way (the product sheet has its own buy bar). */
    hide(on) {
      gsap.to(dock, { yPercent: on ? 180 : 0, duration: reduced ? 0 : 0.6, ease: on ? 'power2.in' : 'wb.snap', overwrite: true });
    },
  };
}
