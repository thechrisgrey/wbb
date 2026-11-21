// Her build video, driven like a phone story: one progress bar per chapter that fills with video.currentTime,
// a caption that changes exactly on the chapter times, tap right or left to skip, press and hold to pause.
// The video is the clock. Everything here follows it, so nothing can drift out of sync.
import { gsap } from '../../lib/gsap.js';
import { createCaptions } from './captions.js';

const HOLD_MS = 220; // a press longer than this is a hold (pause), not a tap (skip)
const two = (n) => String(n).padStart(2, '0');

/** Swap the text inside a clipped .s-hero-a__roll, sliding the old value out and the new one in. */
function roll(mask, value, dir, animate) {
  const old = mask.lastElementChild;
  if (old.textContent === value) return;
  if (!animate) {
    old.textContent = value;
    return;
  }
  const next = old.cloneNode();
  next.textContent = value;
  mask.append(next);
  gsap.fromTo(next, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.5, ease: 'wb.out' });
  gsap.to(old, { yPercent: -100 * dir, duration: 0.5, ease: 'wb.out', overwrite: true, onComplete: () => old.remove() });
}

/**
 * @param el        { video, bars, words, taps, playBtn, chrome, counters } elements
 * @param chapters  [{ t, key, word }] in seconds, ascending
 * @param duration  length of the video in seconds
 * @param reduced   no autoplay and no kinetic captions; the video still plays on tap
 */
export function createStory(el, { chapters, duration, reduced = false }) {
  const { video, bars, playBtn, chrome } = el;
  const last = chapters.length - 1;

  bars.innerHTML = chapters.map(() => '<li><i></i></li>').join('');
  const fills = Array.from(bars.querySelectorAll('i')).map((fill) => gsap.quickSetter(fill, 'scaleX'));
  const captions = createCaptions(el.words, chapters, { reduced });

  let index = -1;
  let started = false; // the intro has handed over
  let visible = true; // the hero is on screen
  let held = false; // a finger is holding the story
  let blocked = false; // the browser refused autoplay, or reduced motion asked us not to
  let ticking = false;
  const listeners = new AbortController();
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: listeners.signal });

  const chapterAt = (time) => {
    let i = last;
    while (i > 0 && time < chapters[i].t) i--;
    return i;
  };

  function setChapter(i) {
    const dir = index < 0 || i > index || (index === last && i === 0) ? 1 : -1;
    const animate = !reduced && index >= 0;
    index = i;
    fills.forEach((fill, j) => j !== i && fill(j < i ? 1 : 0));
    captions.show(i);
    el.counters.forEach((mask) => roll(mask, two(i + 1), dir, animate));
  }

  /** Read the video clock and bring bars, caption and counters in line with it. */
  function tick() {
    const time = video.currentTime;
    const i = chapterAt(time);
    if (i !== index) setChapter(i);
    const from = chapters[i].t;
    const to = i < last ? chapters[i + 1].t : duration;
    fills[i](gsap.utils.clamp(0, 1, (time - from) / (to - from)));
  }

  function setTicking(wanted) {
    if (wanted === ticking) return;
    ticking = wanted;
    if (wanted) gsap.ticker.add(tick);
    else gsap.ticker.remove(tick);
  }

  function block() {
    blocked = true;
    playBtn.hidden = false;
    apply();
  }

  /** Play or pause to match the current state. Call after any of the flags change. */
  function apply() {
    const shouldPlay = started && visible && !held && !blocked;
    if (shouldPlay && video.paused) {
      // iOS Low Power Mode rejects muted autoplay with NotAllowedError: fall back to the poster and "Tap to play".
      video.play()?.catch((err) => err.name === 'NotAllowedError' && block());
    } else if (!shouldPlay && !video.paused) {
      video.pause();
    }
    setTicking(shouldPlay);
  }

  function seek(i) {
    video.currentTime = chapters[i].t + 0.02;
    tick();
  }

  /** dir +1: next chapter (wraps to the first). dir -1: previous chapter (the first restarts). */
  const skip = (dir) => seek(dir > 0 ? (index + 1) % chapters.length : Math.max(0, index - 1));

  function playFromTap() {
    blocked = false;
    started = true;
    playBtn.hidden = true;
    apply(); // still inside the tap, so play() is allowed
  }

  function setHeld(value) {
    if (held === value) return;
    held = value;
    gsap.to(chrome, { autoAlpha: value ? 0 : 1, duration: 0.2, ease: 'power1.out', overwrite: true });
    apply();
  }

  el.taps.forEach((zone) => {
    const dir = zone.classList.contains('s-hero-a__tap--prev') ? -1 : 1;
    let timer = 0;
    let wasHold = false;
    const release = () => {
      clearTimeout(timer);
      wasHold = held;
      setHeld(false);
    };
    on(zone, 'pointerdown', (e) => {
      if (e.button) return;
      wasHold = false;
      clearTimeout(timer);
      if (!blocked) timer = setTimeout(() => setHeld(true), HOLD_MS);
    });
    on(zone, 'pointerup', release);
    on(zone, 'pointercancel', release); // the touch turned into a scroll
    on(zone, 'pointerleave', release);
    on(zone, 'contextmenu', (e) => e.preventDefault());
    on(zone, 'click', () => {
      if (wasHold) wasHold = false;
      else if (blocked) playFromTap();
      else skip(dir);
    });
  });
  on(playBtn, 'click', playFromTap);

  setChapter(0);
  captions.fit();
  // Captions are sized from the display face's real metrics, so measure again once it has loaded.
  document.fonts?.load('1em "Titan One"').then(captions.fit, () => {});

  return {
    /** Begin playback (called by the intro). With reduced motion it waits for a tap instead. */
    start() {
      if (started) return;
      started = true;
      if (reduced) block();
      else apply();
    },
    /** Tell the story whether the hero is on screen; it pauses itself when it is not. */
    setVisible(value) {
      visible = value;
      apply();
    },
    destroy() {
      listeners.abort();
      setTicking(false);
      video.pause();
      captions.destroy();
    },
  };
}
