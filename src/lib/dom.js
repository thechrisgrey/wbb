// Small DOM helpers shared by sections.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element from an HTML string (first element of the fragment). */
export function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad2 = (n) => String(n).padStart(2, '0');
export const money = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** "From $120" or "$75" when there is a single price. */
export const priceLabel = (p) => (p.priceMin === p.priceMax ? money(p.priceMin) : `From ${money(p.priceMin)}`);

/** Lock or release page scroll (used by the product sheet and the menu). */
let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.body.classList.toggle('is-locked', locks > 0);
}

/** Resolve when the element is within `margin` of the viewport. */
export function whenNear(el, margin = '600px') {
  return new Promise((resolve) => {
    if (!('IntersectionObserver' in window)) return resolve();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          resolve();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
  });
}

/** Call back with visibility changes; returns a disconnect function. */
export function onVisible(el, cb, opts = { threshold: 0.01 }) {
  if (!('IntersectionObserver' in window)) {
    cb(true);
    return () => {};
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), opts);
  io.observe(el);
  return () => io.disconnect();
}
