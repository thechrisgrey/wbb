// Shared app context handed to every section's init(root, ctx).
// Lives in its own module so both the real page (main.js) and the section harness (dev-section.html) build it the same way.
import { gsap, ScrollTrigger, reducedMotion } from './lib/gsap.js';
import * as data from './data/index.js';

let stagePromise = null;
let sheetApi = null;
const enteredCallbacks = [];
let entered = false;

export const ctx = {
  gsap,
  ScrollTrigger,
  data,
  reduced: reducedMotion(),
  dock: null, // set by the shell once the dock exists

  /** Lazy-load three.js and return the shared turntable stage. Resolves to null when WebGL is unavailable. */
  stage() {
    if (!stagePromise) {
      stagePromise = import('./three/stage.js').then((m) => (m.webglAvailable() ? m.getStage() : null)).catch(() => null);
    }
    return stagePromise;
  },

  /** Open the product sheet for a handle. Sections call this from cards and buttons. */
  openProduct(handle, opts = {}) {
    if (sheetApi) sheetApi.open(handle, opts);
    else window.open(data.productByHandle[handle]?.url, '_blank', 'noopener');
  },

  /** Run fn once the preloader has lifted (immediately if it already has). Use for intro animations. */
  onEntered(fn) {
    if (entered) fn();
    else enteredCallbacks.push(fn);
  },
};

export function registerSheet(api) {
  sheetApi = api;
}

export function markEntered() {
  if (entered) return;
  entered = true;
  document.documentElement.classList.add('is-entered');
  enteredCallbacks.splice(0).forEach((fn) => fn());
}

/** Find every [data-section] in the document, in DOM order, and run its module's init. */
export function initSections(modules, root = document) {
  const cleanups = [];
  root.querySelectorAll('[data-section]').forEach((el) => {
    const name = el.dataset.section;
    const mod = modules[`./sections/${name}/index.js`];
    if (!mod?.init) return;
    try {
      const off = mod.init(el, ctx);
      if (typeof off === 'function') cleanups.push(off);
    } catch (err) {
      console.error(`[section:${name}]`, err);
    }
  });
  return () => cleanups.forEach((off) => off());
}
