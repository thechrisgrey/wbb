# WoodBaby concept site: design and build guide

A mobile-first concept redesign of woodbabybuilds.com, built to be shown to the maker on a phone.
Everything on the page is hers: her products, prices, photos, video, copy, colors and lettering.
This guide is the contract every section follows so the page reads as one piece of work.

## Who she is, in her words

- "absurdly well made." (the headline of her current site)
- "WoodBaby · Goods & Wares" and "functional art"
- "Bold, handmade wood goods for the home — statement objects for every room, made by the woman you watch make them."
- "Bold. Objects with real personality. / Loud. Because ordinary is overrated. / Classic. Made to outlast the trends."
- Handmade in Nashville, TN. Walnut, oak, brass. Made to order, one of a kind.

Voice: confident, funny, a little cheeky, never precious. Short sentences. Use her copy from `src/data` wherever copy is needed.
If you must write a label she has no words for, keep it to a few plain words. Never invent facts, numbers, reviews, awards or follower counts.

## The six references and what we take from each

1. Warm wood interior with chunky letters on colored tiles that scatter and reassemble: our **letter tiles** (her own wordmark glyphs on solid squares).
2. Swiss poster with giant numerals, a thin circle, a diagonal split and tiny captions in the corners: our **poster type** (huge numerals, small mono captions, generous empty space).
3. A product film that moves from macro detail to the full object: **scroll-driven reveals** of her photos, detail first.
4. A sun-warmed 70s editorial portrait: the **warmth and confidence** of how she is shown. Editorial crops, never thumbnails.
5. A phone story UI with progress bars and letters that drift apart and re-form: **story mechanics** (progress bars, tap zones) and kinetic captions.
6. A gray chair turning on a turntable: the **3D turntable** for every product.

## Tokens (src/styles/tokens.css)

| Token | Value | Use |
| --- | --- | --- |
| `--cream` | `#ece7d8` | page background (hers) |
| `--paper` | `#f4efe2` | raised surfaces, text on dark (hers) |
| `--butter` | `#eee5c1` | the fill of her WB badge; tiles |
| `--ink` | `#16130f` | text, dark sections (hers) |
| `--orange` | `#e0722c` | the one loud accent (hers). Use it boldly but rarely: one orange moment per screen |
| `--brass` | `#c9a04a` | small metallic accents |
| `--walnut` | `#4b2e1c` | deep wood tone |
| `--blush` | `#f1c9b3` | soft warm tint, sparingly |

Sections alternate color fields: cream, ink, orange, paper. Full-bleed fields, hard edges, no gradients-as-decoration, no glassmorphism, no drop-shadow cards.
Depth comes from the hard offset shadow of her badge (`box-shadow: 4px 5px 0 var(--ink)`), used on tiles and stickers only.

## Type (classes in src/styles/base.css)

- `.t-display` Titan One, lowercase, very tight. Echoes her chunky wordmark. For a few huge words and for numerals (`.t-num`). Never for paragraphs.
- `.t-h1 .t-h2 .t-h3` Bricolage Grotesque, condensed and heavy. Headlines.
- `.t-serif` Instrument Serif italic. One or two words inside a headline for contrast ("functional art"), or a kicker line.
- `.t-cap` DM Mono, uppercase, tracked. The small Swiss captions: index numbers, labels, prices, "Nº 05 / 17".
- Body: Bricolage 420 at `--t-body`; `.t-lede` for intros.
- Sizes: `--t-mega`, `--t-hero`, `--t-h1`, `--t-h2`, `--t-h3`, `--t-lede`, `--t-body`, `--t-small`, `--t-cap`.

Scale contrast is the look: one very large element, a few very small captions, little in between.
Numerals are a graphic element: product numbers 01 to 17 and prices appear huge.

## Components already available

- `.btn` (+ `--orange`, `--paper`, `--ghost`), with `<span class="btn__arrow">→</span>`
- `.chip` (pill label / filter), `.sticker` (tilted orange price or badge with hard shadow)
- `.tile` (+ `--orange`, `--ink`, `--brass`, `--blush`): a square letter tile. Put one glyph SVG from `src/brand/marks.js` inside:
  `WORDMARK.letters[i]` is `{ char, vb, d }` for W o o d B a b y. Render as `<span class="tile"><svg viewBox="${vb}"><path d="${d}" fill-rule="evenodd"/></svg></span>`.
- `BADGE` in the same file is her WB badge as three layered paths (shadow `#e0722c`, outline `#16130f`, fill `#eee5c1`).
- `.media` framed image; build markup with `frame()` / `img()` from `src/lib/media.js`.
- `.wrap` (max width + gutters), `.section`, `.section--pad`, `.on-ink`, `.on-orange`, `.on-paper`.

## Data (import from src/data/index.js)

- `products`: all 17 pieces in display order. Each has `handle, title, num ('01'), n, line, url, priceMin, priceMax, options, intro[], details[], rooms[], room, roomLabel, images[], coverImage, gallery[], woodOptions[], badge?`.
- `productByHandle`, `inRoom('kitchen'|'bath'|'home')`, `maker` (her six portraits keyed `instagram, fanfix, x, snapchat, kick, discord`).
- Copy: `BRAND, MISSION, VALUES, ROOMS, FEATURE, CUSTOM, NEWSLETTER, SOCIALS, MORE_SOCIALS, BUILD_VIDEO, SHOP_ALL_COPY`.
- `priceLabel(p)` and `money(n)` in `src/lib/dom.js`.
- Every "Shop" or "Buy" action links to her live store: `p.url`, `ROOMS[i].url`, `BRAND.shopAll`. Open in a new tab (`target="_blank" rel="noopener"`).

## Section contract

Each section lives in `src/sections/<name>/`:

- `template.html`: one root element `<section class="section s-<name>" data-section="<name>" id="<name>">…</section>`. Static, meaningful HTML (real headings and text) so it reads before JS.
  Markup that depends on data (product lists) may be rendered in `init`.
- `style.css`: all selectors start with `.s-<name>`. Mobile first (390px wide); add `@media (min-width: 900px)` only to keep desktop tidy.
- `index.js`:
  ```js
  import './style.css';
  import { gsap, ScrollTrigger, linesReveal, riseIn, parallax, marquee, reducedMotion } from '../../lib/gsap.js';
  export function init(root, ctx) { /* build, animate */ return () => { /* optional cleanup */ }; }
  ```
  `ctx` gives `ctx.data`, `ctx.openProduct(handle)`, `ctx.stage()` (Promise of the shared 3D turntable or null), `ctx.onEntered(fn)` (run after the preloader), `ctx.reduced`.

Only touch files inside your own section folder. Shared files (`src/lib`, `src/styles`, `src/data`, `src/three`, `src/ui`, `src/app.js`, `index.html`) belong to the lead; if you need something from them, write it locally and report it.

## Motion language (GSAP 3.15, all plugins available via src/lib/gsap.js)

Always import `gsap` and plugins from `src/lib/gsap.js` (it registers ScrollTrigger, SplitText, Flip, Draggable, InertiaPlugin, Observer, CustomEase, ScrollToPlugin, Physics2DPlugin, DrawSVGPlugin).

House eases: `wb.out` (default settle), `wb.inout` (wipes), `wb.snap` (overshoot, for tiles and stickers), `wb.soft`.

The recurring moves. Reuse these so the page feels authored by one hand:

1. **Masked line reveal** for every headline: `linesReveal(el)` (SplitText lines rise from behind a clip).
2. **Letter tiles**: tiles drop, tumble or scatter with rotation and stagger, then lock into a row with `wb.snap`.
3. **Poster numerals**: giant numbers that roll, count or slide when the subject changes.
4. **Sticker pop**: prices and badges scale in from 0 with rotation and `wb.snap`.
5. **Field wipe**: one color field replaces another with a `clip-path` wipe or a hard-edged panel sliding, never a fade.
6. **Photo reveal**: `clip-path: inset()` opening plus the image scaling from 1.25 to 1; scrubbed parallax inside frames (`parallax(img)`).
7. **Thumb physics**: anything that looks draggable is draggable (Draggable + InertiaPlugin) and snaps.

Rules:

- Phone first. Animate only `transform`, `opacity` and `clip-path`. No animated blur, filter, box-shadow, width or height. No `backdrop-filter`.
- Full-screen and pinned blocks use `100svh` (never `100vh`). Pins: `pin: true, anticipatePin: 1`, scrub `0.5` to `1`.
- Keep vertical scrolling free: any horizontal drag surface sets `touch-action: pan-y`.
- Nothing may depend on hover. Tap targets are at least 44px.
- Respect reduced motion: wrap motion in `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` or check `reducedMotion()`; content must be fully visible without animation.
- Never leave content invisible if JS fails late: set hidden start states from JS (`gsap.set` / `gsap.from`), not in CSS.
- Create ScrollTriggers inside `init` in top-to-bottom order; kill your own in the cleanup. Do not call `ScrollTrigger.refresh()` in a loop; the app refreshes after fonts and images load.
- Images: `loading="lazy"` (the helpers do this) except the first screen. Always give frames an aspect ratio so nothing shifts.
- Videos: `muted playsinline loop preload="metadata"`, start with `play()` when in view, pause when out.

## Checking your work

Dev server: `npm run dev` (http://localhost:5173). Harness: `/dev-section.html?s=<name>`.

```
node scripts/dev/section-shot.cjs <name> <outPrefix> [steps] [device] [mode] [extraQuery]
```

It scrolls a 390x844 phone viewport through your section and writes a contact sheet. Read the sheet, fix, repeat.
Check `iphone`, `small` (360 wide) and `desktop`. Use mode `intro` to review entrances frame by frame.
No horizontal overflow, no clipped text, no console errors, nothing overlapping the bottom dock (leave `calc(var(--dock-h) + var(--safe-b) + 24px)` clear at the bottom of pinned screens).
