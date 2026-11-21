// The one-word chapter captions (Cut. Join. Clamp. Burn. Paint. Reveal. Sit.).
// Every word is split into characters once and owns an entrance that acts out its verb.
// Entrances only touch transform, opacity and clip-path.
import { gsap, SplitText } from '../../lib/gsap.js';

const MAX_SIZE = 41; // cqw: the tallest a short word ("Sit.") may grow
const FIT_WIDTH = 86; // cqw: the story width a word may fill, inside its side padding and orange drop

/** chapter key -> (chars, word) => timeline. Built with fromTo so a cached timeline can simply restart(). */
const ENTRANCES = {
  // Two halves of a board meeting at the blade: letters arrive from above and below on a slant.
  cut: (chars) =>
    gsap
      .timeline()
      .fromTo(
        chars,
        { yPercent: (i) => (i % 2 ? 85 : -85), skewX: -22, autoAlpha: 0 },
        { yPercent: 0, skewX: 0, autoAlpha: 1, duration: 0.42, ease: 'expo.out', stagger: 0.035 },
      ),

  // A comb joint: odd and even letters slide in from opposite sides and mesh, then take one tap of the mallet.
  join: (chars) =>
    gsap
      .timeline()
      .fromTo(
        chars,
        { xPercent: (i) => (i % 2 ? 95 : -95), autoAlpha: 0 },
        { xPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out', stagger: 0.02 },
      )
      .fromTo(
        chars,
        { scaleY: 1 },
        { scaleY: 0.88, duration: 0.07, ease: 'power1.in', transformOrigin: '50% 100%', yoyo: true, repeat: 1 },
        0.48,
      ),

  // Letters start spread apart and get squeezed tight, with a little spring back.
  clamp: (chars) => {
    const mid = (chars.length - 1) / 2;
    return gsap
      .timeline()
      .fromTo(
        chars,
        { xPercent: (i) => (i - mid) * 62, scaleX: 1.25, autoAlpha: 0 },
        { xPercent: 0, scaleX: 1, autoAlpha: 1, duration: 0.62, ease: 'back.out(2.6)' },
      );
  },

  // Letters lick upward like flame and flicker before they hold.
  burn: (chars) =>
    gsap
      .timeline()
      .fromTo(
        chars,
        { yPercent: 55, scaleY: 1.7 },
        { yPercent: 0, scaleY: 1, duration: 0.55, ease: 'power3.out', transformOrigin: '50% 100%', stagger: { each: 0.05, from: 'random' } },
      )
      .fromTo(
        chars,
        { autoAlpha: 0 },
        { keyframes: { autoAlpha: [0, 1, 0.4, 1, 0.65, 1], easeEach: 'none' }, duration: 0.5, stagger: { each: 0.05, from: 'random' } },
        0,
      ),

  // Each letter is brushed on, left to right.
  paint: (chars) =>
    gsap
      .timeline()
      .fromTo(
        chars,
        { clipPath: 'inset(-25% 115% -25% -25%)', xPercent: -20, rotation: -6 },
        { clipPath: 'inset(-25% -25% -25% -25%)', xPercent: 0, rotation: 0, duration: 0.42, ease: 'power2.out', stagger: 0.07 },
      ),

  // A slow rise from behind a straight edge.
  reveal: (chars, word) =>
    gsap
      .timeline()
      .set(word, { clipPath: 'inset(-40% -14% -5% -14%)' })
      .fromTo(chars, { yPercent: 125 }, { yPercent: 0, duration: 0.8, ease: 'wb.out', stagger: 0.045 })
      .set(word, { clearProps: 'clipPath' }),

  // Letters drop with weight, squash on landing, then settle.
  sit: (chars) =>
    gsap
      .timeline()
      .fromTo(
        chars,
        { yPercent: -190, autoAlpha: 0, scaleX: 1, scaleY: 1 },
        {
          keyframes: [
            { yPercent: 0, autoAlpha: 1, duration: 0.26, ease: 'power2.in' },
            { scaleY: 0.66, scaleX: 1.16, duration: 0.08, ease: 'power1.out' },
            { scaleY: 1, scaleX: 1, duration: 0.55, ease: 'elastic.out(1.1, 0.4)' },
          ],
          transformOrigin: '50% 100%',
          stagger: 0.07,
        },
      ),
};

const fallback = (chars) => gsap.timeline().fromTo(chars, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, stagger: 0.03 });

/**
 * Render the caption words into `container` and return { show(i), fit(), destroy() }.
 * @param chapters  [{ key, word }]
 * @param reduced   swap words without motion
 */
export function createCaptions(container, chapters, { reduced = false } = {}) {
  container.innerHTML = chapters.map((c) => `<span class="s-hero-a__word" data-key="${c.key}">${c.word}</span>`).join('');
  const words = Array.from(container.children);
  const splits = reduced ? [] : words.map((word) => SplitText.create(word, { type: 'chars', aria: 'none' }));
  const entrances = new Map(); // word -> cached timeline
  const exits = new Map(); // word -> tween that is clearing it away
  let current = -1;

  /** Size each word so it fills the story's width; short words are capped by height. Units are cqw, so it tracks the card. */
  function fit() {
    words.forEach((word) => {
      const em = parseFloat(getComputedStyle(word).fontSize);
      if (!em || !word.offsetWidth) return;
      const widthInEm = word.offsetWidth / em;
      word.style.fontSize = `${Math.min(MAX_SIZE, FIT_WIDTH / widthInEm).toFixed(2)}cqw`;
    });
  }

  function show(i) {
    if (i === current || !words[i]) return;
    const prev = words[current];
    const next = words[i];
    current = i;

    if (prev) {
      entrances.get(prev)?.pause();
      if (reduced) gsap.set(prev, { autoAlpha: 0 });
      else exits.set(prev, gsap.to(prev, { yPercent: -28, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }));
    }
    exits.get(next)?.kill();
    gsap.set(next, { yPercent: 0, autoAlpha: 1 });
    if (reduced) return;

    if (!entrances.has(next)) {
      const build = ENTRANCES[next.dataset.key] || fallback;
      entrances.set(next, build(splits[i].chars, next));
    }
    entrances.get(next).restart();
  }

  function destroy() {
    entrances.forEach((tl) => tl.kill());
    exits.forEach((tween) => tween.kill());
    splits.forEach((split) => split.revert());
  }

  return { show, fit, destroy };
}
