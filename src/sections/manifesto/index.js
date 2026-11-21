// manifesto: Bold. Loud. Classic.
// A pinned, scrubbed three-beat type performance on the orange field, then her phrases on one running band.
// Each word arrives the way it means: "Bold." drops with weight, "Loud." builds into a shout that outgrows the screen,
// "Classic." is drawn in slowly, serif italic inside one thin circle.
import './style.css';
import { gsap, ScrollTrigger, SplitText, marquee, reducedMotion } from '../../lib/gsap.js';
import { BADGE } from '../../brand/marks.js';

// Scroll budget, in viewport heights. The slam starts a little before the stage pins so the field never sits empty.
const PRE = 0.2;
const PIN = 2.5;
const END = PRE + PIN;

// The crescendo: outline echoes above the solid word, as fractions of its size. One more, larger than the screen, follows.
const ECHOES = [0.24, 0.38, 0.62];
const SHOUT_LH = 0.86; // keep in step with .s-manifesto__shout { line-height }
const BLEED_MIN = 1.3;
const BLEED_MAX = 2.05;

// Where each beat lives on the timeline (same units as PRE / PIN).
const T = {
  bold: [0.05, 1.03],
  loud: [0.98, 1.88],
  classic: [1.9, END],
};

const bandMarkup = (BRAND) => {
  const phrases = [
    [BRAND.tagline.replace(/\.$/, ''), false], // absurdly well made
    [BRAND.sub, true], // functional art
    ['handmade in Nashville', false],
    ['made to order', true],
    ['one of a kind', false],
  ];
  const sep = `<i class="s-manifesto__sep" aria-hidden="true"><svg viewBox="${BADGE.viewBox}" focusable="false"><use href="#s-manifesto-wb"/></svg></i>`;
  return phrases.map(([text, serif]) => `<span class="s-manifesto__phrase${serif ? ' s-manifesto__phrase--serif' : ''}">${text}</span>${sep}`).join('');
};

// Her WB badge once, as a symbol; every separator on the band is a <use> of it.
const badgeDefs = () => {
  const { shadow, outline, fill } = BADGE.layers;
  return `<svg class="s-manifesto__defs" width="0" height="0" aria-hidden="true" focusable="false"><symbol id="s-manifesto-wb" viewBox="${BADGE.viewBox}"><path d="${shadow}" fill="#e0722c" fill-rule="evenodd"/><path d="${outline}" fill="#16130f" fill-rule="evenodd"/><path d="${fill}" fill="#eee5c1" fill-rule="evenodd"/></symbol></svg>`;
};

export function init(root, ctx) {
  const data = ctx?.data || {};
  const reduced = ctx?.reduced ?? reducedMotion();
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));

  const stage = $('.s-manifesto__stage');
  const top = $('.s-manifesto__top');
  const [wBold, wLoud, wClassic] = $$('[data-word]');
  const [lBold, lLoud, lClassic] = $$('[data-line]');
  const loudBeat = $('.s-manifesto__beat--loud');
  const stack = $('.s-manifesto__stack');
  const track = $('[data-track]');

  // ---- her copy, straight from the data ----
  (data.VALUES || []).forEach((v, i) => {
    const w = [wBold, wLoud, wClassic][i];
    const l = [lBold, lLoud, lClassic][i];
    if (w) w.textContent = v.word;
    if (l) l.textContent = v.line;
  });
  if (data.BRAND) {
    $('[data-kicker]').textContent = data.BRAND.kicker;
    root.insertAdjacentHTML('afterbegin', badgeDefs());
    $('[data-set]').innerHTML = bandMarkup(data.BRAND);
  }

  // ---- fit: every word is sized from its own measured width so it fills the screen from gutter to gutter ----
  const probe = document.createElement('i');
  probe.className = 's-manifesto__probe';
  probe.setAttribute('aria-hidden', 'true');
  root.prepend(probe); // 100svh tall: a stable viewport height on iOS, whatever the address bar is doing

  let live = false;
  const emWidth = (el) => el.offsetWidth / (parseFloat(getComputedStyle(el).fontSize) || 1);
  const fit = () => {
    const cs = getComputedStyle(stage);
    const W = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = probe.offsetHeight || window.innerHeight;
    if (!(W > 0) || !(H > 0)) return;
    const set = (name, px) => root.style.setProperty(name, `${px.toFixed(2)}px`);

    set('--fs-bold', Math.min(W / emWidth(wBold), H * 0.4));
    set('--fs-classic', Math.min((W * 0.985) / emWidth(wClassic), H * 0.3));
    set('--ring', Math.min(W * 0.86, H * 0.5));

    let loud = W / emWidth(wLoud);
    if (live) {
      // the stack fills the room between the captions and the sticker; the last echo takes whatever height is left
      const bs = getComputedStyle(loudBeat);
      const room = H - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - lLoud.offsetHeight - 16;
      const base = ECHOES.reduce((a, b) => a + b, 1);
      let bleed = room / (loud * SHOUT_LH) - base;
      if (bleed < BLEED_MIN) {
        bleed = BLEED_MIN;
        loud = room / (SHOUT_LH * (base + bleed));
      }
      root.style.setProperty('--loud-bleed', Math.min(bleed, BLEED_MAX).toFixed(3));
    } else {
      loud = Math.min(loud, H * 0.34);
    }
    set('--fs-loud', loud);
  };

  const onFonts = () => fit();
  fit();
  document.fonts?.ready.then(onFonts);
  ScrollTrigger.addEventListener('refreshInit', fit);

  // ---- reduced motion: three plain statements and a still band ----
  if (reduced) {
    return () => ScrollTrigger.removeEventListener('refreshInit', fit);
  }

  // ---- live ----
  live = true;
  root.classList.add('is-live');

  // echoes: aria-hidden copies of "Loud." around the real heading
  const echo = (k, bleed) => {
    const el = document.createElement('div');
    el.className = `s-manifesto__shout s-manifesto__echo t-display${bleed ? ' s-manifesto__echo--bleed' : ''}`;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = wLoud.textContent;
    el.style.setProperty('--k', k);
    return el;
  };
  ECHOES.forEach((k) => stack.insertBefore(echo(k), wLoud));
  stack.appendChild(echo('var(--loud-bleed, 1.6)', true));
  const shouts = Array.from(stack.children);

  let tick = null;
  let onTap = null;

  const gctx = gsap.context(() => {
    const drop = $('.s-manifesto__drop');
    const squash = $('.s-manifesto__squash');
    const shake = $('.s-manifesto__shake');
    const ring = $('.s-manifesto__ring');
    const circle = ring.querySelector('circle');
    const rule = $('.s-manifesto__rule');
    const reel = $('.s-manifesto__reel');
    const tracks = $$('.s-manifesto__bars i');
    const fills = $$('.s-manifesto__bars b');

    // split after the echoes exist; the heading keeps its text for assistive tech (SplitText adds the aria-label)
    const shoutChars = shouts.map((el) => SplitText.create(el, { type: 'chars', charsClass: 's-manifesto__ch' }).chars);
    const classicChars = SplitText.create(wClassic, { type: 'chars', charsClass: 's-manifesto__ch' }).chars;
    fit();

    // captions and bars settle in as the field arrives
    gsap.from([$('.s-manifesto__kicker'), $('.s-manifesto__count')], {
      autoAlpha: 0,
      y: 12,
      duration: 0.8,
      stagger: 0.09,
      scrollTrigger: { trigger: root, start: 'top 78%', once: true },
    });
    gsap.from(tracks, {
      scaleX: 0,
      duration: 0.9,
      stagger: 0.09,
      ease: 'wb.inout',
      scrollTrigger: { trigger: root, start: 'top 78%', once: true },
    });

    // start states the timeline does not own
    gsap.set(drop, { autoAlpha: 0 });
    gsap.set(loudBeat, { clipPath: 'inset(0% 0% 0% 0%)' });

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: root,
        start: `top ${PRE * 100}%`,
        end: () => `+=${Math.round(window.innerHeight * END)}`,
        scrub: 0.6,
        onToggle: (self) => (self.isActive ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)),
      },
    });

    // story bars: one per beat
    tl.fromTo(fills[0], { scaleX: 0 }, { scaleX: 1, duration: 1.0 - PRE }, PRE)
      .fromTo(fills[1], { scaleX: 0 }, { scaleX: 1, duration: 0.86 }, 1.0)
      .fromTo(fills[2], { scaleX: 0 }, { scaleX: 1, duration: END - 1.86 }, 1.86);

    // 01 Bold: falls at the screen, hits the floor, the whole poster takes the knock
    tl.set(drop, { autoAlpha: 1 }, T.bold[0])
      .fromTo(drop, { scale: 3.4, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.23, ease: 'power2.in' }, T.bold[0])
      .to(squash, { keyframes: [{ scaleX: 1.06, scaleY: 0.8, duration: 0.012 }, { scaleX: 1, scaleY: 1, duration: 0.16, ease: 'elastic.out(1.1, 0.42)' }] }, 0.28)
      .to(top, { keyframes: [{ y: 11, duration: 0.012 }, { y: 0, duration: 0.16, ease: 'elastic.out(1.2, 0.36)' }] }, 0.28)
      .fromTo(lBold, { yPercent: 108 }, { yPercent: 0, duration: 0.14, ease: 'power3.out' }, 0.31)
      .to(squash, { scale: 1.04, duration: 0.4, ease: 'sine.inOut' }, 0.45)
      .to(lBold, { yPercent: -108, duration: 0.09, ease: 'power2.in' }, 0.85)
      .to(drop, { yPercent: 230, rotation: 7, duration: 0.15, ease: 'power2.in' }, 0.87)
      .set(drop, { autoAlpha: 0 }, T.bold[1]);

    // the counter rolls when the subject changes
    tl.to(reel, { yPercent: -100 / 3, duration: 0.1, ease: 'wb.inout' }, 0.92).to(reel, { yPercent: -200 / 3, duration: 0.1, ease: 'wb.inout' }, 1.79);

    // 02 Loud: the thumb is the volume knob. Each line pops in bigger than the last, the last one does not fit.
    shouts.forEach((el, i) => {
      tl.fromTo(el, { scale: 0, rotation: -5 }, { scale: 1, rotation: 0, duration: 0.13, ease: 'wb.snap' }, T.loud[0] + i * 0.052);
    });
    tl.fromTo(lLoud, { scale: 0, rotation: -16 }, { scale: 1, rotation: 0, duration: 0.13, ease: 'wb.snap' }, 1.3)
      .to(shake, { keyframes: { x: [0, -13, 11, -8, 6, -3, 0], rotation: [0, -1.2, 1, -0.7, 0.5, -0.2, 0], ease: 'none' }, duration: 0.13 }, 1.37)
      .to(shake, { scale: 1.035, duration: 0.22, ease: 'sine.inOut' }, 1.5)
      // cut to silence: a hard edge takes the noise away from the bottom up
      .to(loudBeat, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.15, ease: 'wb.inout' }, 1.72)
      .to(shake, { yPercent: -7, duration: 0.15, ease: 'wb.inout' }, 1.72);

    // 03 Classic: one thin circle is drawn, the word rises from behind its own baseline, slowly
    tl.fromTo(circle, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.54, ease: 'power1.inOut' }, T.classic[0])
      .fromTo(classicChars, { yPercent: 116 }, { yPercent: 0, duration: 0.27, ease: 'power3.out', stagger: 0.032 }, 1.97)
      .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.12, ease: 'wb.inout' }, 2.35)
      .fromTo(lClassic, { yPercent: 116 }, { yPercent: 0, duration: 0.13, ease: 'power3.out' }, 2.39);

    const pin = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * PIN)}`,
      pin: true,
      anticipatePin: 1,
    });

    // "Loud." never sits still: a wave runs through every character, and it gets rowdier the faster the page moves
    const wave = [];
    shoutChars.forEach((chars, li) => chars.forEach((ch, ci) => wave.push({ set: gsap.quickSetter(ch, 'yPercent'), phase: ci * 0.82 + li * 0.5 })));
    let level = 0;
    let rowdy = 0;
    let kick = 0;
    let still = true;
    tick = (time) => {
      const t = tl.time();
      const on = t > T.loud[0] && t < T.loud[1];
      level += ((on ? 1 : 0) - level) * 0.1;
      if (level < 0.004) {
        if (!still) wave.forEach((w) => w.set(0));
        still = true;
        return;
      }
      still = false;
      rowdy += (Math.min(1, Math.abs(pin.getVelocity()) / 2400) - rowdy) * 0.12;
      kick *= 0.95;
      const amp = (2.4 + rowdy * 6.5 + kick * 9) * level;
      for (let i = 0; i < wave.length; i++) wave[i].set(Math.sin(time * 6 - wave[i].phase) * amp);
    };

    // a tap gives the word on stage one more hit (these targets are not touched by the scrubbed timeline)
    onTap = () => {
      const t = tl.time();
      if (t > 0.3 && t < 0.85) {
        gsap.fromTo(wBold, { scaleX: 1.07, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 0.9, ease: 'elastic.out(1.1, 0.38)', overwrite: true });
      } else if (t > 1.3 && t < 1.72) {
        kick = 1;
        gsap.fromTo(stack, { x: -12, rotation: -1 }, { x: 0, rotation: 0, duration: 0.7, ease: 'elastic.out(1.5, 0.22)', overwrite: true });
      } else if (t > 2.3) {
        gsap.fromTo(ring, { scale: 1.06 }, { scale: 1, duration: 1.4, ease: 'wb.soft', overwrite: true });
      }
    };
    stage.addEventListener('click', onTap);

    // the band: her phrases, running, pushed around by scroll velocity
    marquee(track, { speed: 62 });
  }, root);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', fit);
    if (tick) gsap.ticker.remove(tick);
    if (onTap) stage.removeEventListener('click', onTap);
    gctx.revert();
  };
}
