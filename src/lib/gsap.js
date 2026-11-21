// One place that registers GSAP and its plugins, defines the house eases, and exports the motion helpers
// every section shares. Import gsap from here, never from 'gsap' directly, so plugins are always registered.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { Observer } from 'gsap/Observer';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, Draggable, InertiaPlugin, Observer, CustomEase, ScrollToPlugin, Physics2DPlugin, DrawSVGPlugin);

// House eases. "wb.out" is the default settle, "wb.snap" overshoots a touch (tiles, stickers), "wb.inout" for wipes.
CustomEase.create('wb.out', '0.16, 1, 0.3, 1');
CustomEase.create('wb.inout', '0.76, 0, 0.24, 1');
CustomEase.create('wb.snap', '0.34, 1.56, 0.64, 1');
CustomEase.create('wb.soft', '0.33, 1, 0.68, 1');

gsap.defaults({ ease: 'wb.out', duration: 0.9 });
ScrollTrigger.config({ ignoreMobileResize: true });

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

/**
 * Split an element into masked lines and return a paused-by-default reveal you can drop in a timeline
 * or hand to ScrollTrigger. Re-splits on resize and font load (autoSplit) so line breaks stay correct.
 */
export function linesReveal(target, { trigger, start = 'top 82%', stagger = 0.085, duration = 1.05, y = 105, delay = 0, scroll = true, once = true } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  if (reducedMotion()) return null;
  let tween;
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'split-line',
    autoSplit: true,
    onSplit(self) {
      tween = gsap.from(self.lines, {
        yPercent: y,
        duration,
        stagger,
        delay,
        ease: 'wb.out',
        scrollTrigger: scroll ? { trigger: trigger || el, start, once } : undefined,
      });
      return tween;
    },
  });
  return tween;
}

/** Split into characters (kept inside word wrappers so lines never break mid-word). Returns the SplitText instance. */
export function splitChars(target, opts = {}) {
  return SplitText.create(target, { type: 'words,chars', charsClass: 'split-char', wordsClass: 'split-word', ...opts });
}

/** Fade-and-rise for a batch of elements as they enter the viewport. */
export function riseIn(targets, { start = 'top 88%', y = 36, stagger = 0.08, duration = 0.9 } = {}) {
  const els = gsap.utils.toArray(targets);
  if (!els.length) return;
  if (reducedMotion()) return;
  gsap.set(els, { autoAlpha: 0, y });
  ScrollTrigger.batch(els, {
    start,
    once: true,
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration, stagger, ease: 'wb.out', overwrite: true }),
  });
}

/** Scrubbed parallax on an inner element while its frame crosses the viewport. */
export function parallax(el, { amount = 12, trigger, scrub = true } = {}) {
  if (!el || reducedMotion()) return null;
  return gsap.fromTo(
    el,
    { yPercent: -amount },
    { yPercent: amount, ease: 'none', scrollTrigger: { trigger: trigger || el.parentElement, start: 'top bottom', end: 'bottom top', scrub } },
  );
}

/** An endless horizontal ticker that speeds up and reverses with scroll velocity. Returns the tween. */
export function marquee(track, { speed = 60, reverse = false } = {}) {
  const el = typeof track === 'string' ? document.querySelector(track) : track;
  if (!el) return null;
  const first = el.children[0];
  if (!first) return null;
  // duplicate content until it covers two viewports so the loop never shows a gap
  const need = Math.ceil((window.innerWidth * 2) / Math.max(first.offsetWidth, 1)) + 1;
  for (let i = 1; i < need; i++) {
    const clone = first.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    el.appendChild(clone);
  }
  if (reducedMotion()) return null;
  const width = first.offsetWidth;
  const tween = gsap.fromTo(el, { x: 0 }, { x: -width, duration: width / speed, ease: 'none', repeat: -1 });
  tween.totalTime(tween.duration() * 500); // headroom so it can also run backwards
  let dir = reverse ? -1 : 1;
  tween.timeScale(dir);
  let settle;
  ScrollTrigger.create({
    trigger: el,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate(self) {
      const v = self.getVelocity();
      dir = (v < 0 ? -1 : 1) * (reverse ? -1 : 1);
      const boost = 1 + Math.min(5, Math.abs(v) / 320);
      gsap.to(tween, { timeScale: dir * boost, duration: 0.2, overwrite: true });
      clearTimeout(settle);
      settle = setTimeout(() => gsap.to(tween, { timeScale: dir, duration: 0.9, overwrite: true }), 140);
    },
  });
  return tween;
}

export { gsap, ScrollTrigger, SplitText, Flip, Draggable, InertiaPlugin, Observer, CustomEase };
