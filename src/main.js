import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { ScrollTrigger } from './lib/gsap.js';
import { ctx, initSections, markEntered, registerSheet } from './app.js';

const sections = import.meta.glob('./sections/*/index.js', { eager: true });
const ui = import.meta.glob('./ui/*.js', { eager: true });

function boot() {
  document.documentElement.classList.add('is-ready');

  // Shell: product sheet first (sections call ctx.openProduct), then the dock.
  const sheet = ui['./ui/sheet.js']?.initSheet?.(ctx);
  if (sheet) registerSheet(sheet);
  ctx.dock = ui['./ui/dock.js']?.initDock?.(ctx) || null;

  initSections(sections);
  window.__wb = ctx; // handy in the console: __wb.openProduct('the-butterfly-board')

  // Preloader lifts the curtain, then intros run.
  const loader = ui['./ui/loader.js']?.runLoader;
  const done = loader ? loader(ctx) : Promise.resolve();
  done.then(markEntered);

  // Pin and trigger positions depend on fonts and images; re-measure when they land.
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  window.addEventListener('load', refresh, { once: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
