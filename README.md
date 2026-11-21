# WoodBaby concept site

A mobile-first concept redesign of [woodbabybuilds.com](https://woodbabybuilds.com), built to show the maker on a phone.

Her products, prices, photos, video, copy, colors and lettering all come from her live site. Every Shop and Buy button links to her Shopify store. Nothing is sold here.

## Run it

```
npm install
npm run dev
```

The terminal prints a Network URL. Open it on a phone on the same Wi-Fi.

`npm run build` writes a static site to `dist/`. `npm run preview` serves that build.

## What is on the page

| Section | What it does |
| --- | --- |
| Preloader | Her WB badge stamps in while the hero video loads |
| Hero | Her stool build video as a phone story, with her wordmark as letter tiles |
| Manifesto | "Bold. Loud. Classic." as a three-beat type sequence |
| Spin room | Pieces on a 3D turntable: drag to rotate, tap a swatch to change the wood |
| Rooms | Kitchen + Table, Bed + Bath, Home + Furniture |
| Feature | The Nightcap Bath Tray, from macro detail to the full tub |
| Maker | Her at work, and the mission in her words |
| Catalog | All 17 pieces with room filters |
| Custom | Commission call to action, with her letter tiles to throw around |
| Socials | Her six social cards and the newsletter block |
| Product sheet | Opens from any piece: photo story, 3D spin, her description, buy link |

## How it is built

- Vite, vanilla JS, no framework
- GSAP 3.15 for all motion: ScrollTrigger, SplitText, Flip, Draggable, InertiaPlugin, CustomEase
- Three.js for the turntable. Each piece is modeled in code from her photos, and the wood textures are cut from her own product photography.

```
index.html               page shell, sections included at build time
src/main.js              boot
src/app.js               shared context passed to every section
src/styles/              tokens, base styles, fonts
src/lib/                 GSAP setup and motion helpers, DOM and image helpers
src/data/                her catalog (catalog.json), image index (media.json), copy and presentation (site.js)
src/brand/marks.js       her wordmark letters and WB badge as SVG paths
src/sections/<name>/     one folder per section: template.html, style.css, index.js
src/ui/                  preloader, dock and menu, product sheet
src/three/               turntable stage, materials, modeling kit, one model per product
public/media/            photos, video, textures
docs/DESIGN.md           design language and the rules every section follows
```

Two dev pages help while working on one part at a time:

- `/dev-section.html?s=hero` runs a single section
- `/dev-model.html?m=the-butterfly-board` shows a single 3D model

## Updating her content

The catalog and media were captured from her store on 21 November 2026.

- `scripts/build-data.mjs <capture-dir>` rebuilds `src/data/catalog.json` from her Shopify `products.json`
- `scripts/process-media.mjs <raw-dir>` rebuilds the web images and `src/data/media.json`
- `scripts/make-textures.py <raw-dir> public/media/textures` cuts the wood textures
- Copy, taglines, display order and wood options live in `src/data/site.js`

## Adding more of her video

Her site hosts one video, the stool build. It is re-cut into build order at `public/media/video/`, and its chapters are listed in `BUILD_VIDEO` in `src/data/site.js`.

To add clips from Instagram, TikTok or YouTube, export them as MP4 (H.264, portrait, muted) into `public/media/video/` and list them in `src/data/site.js`.

## Before sharing a link

The photos, video and lettering belong to WoodBaby. The page is marked `noindex` and labeled as a concept preview. Host it somewhere private or unlisted until she has seen it.
