// Build web-ready media from the raw captures of woodbabybuilds.com.
// Usage: node scripts/process-media.mjs <raw-dir>   (raw-dir holds manifest.json, products/, socials/, brand/)
// Writes public/media/** and src/data/media.json (dimensions + dominant color for each image).
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const raw = process.argv[2];
if (!raw) { console.error('usage: node scripts/process-media.mjs <raw-dir>'); process.exit(1); }
const manifest = JSON.parse(readFileSync(join(raw, 'manifest.json'), 'utf8'));
const OUT = 'public/media';
const SIZES = [600, 1200];
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

async function variants(src, destBase) {
  mkdirSync(dirname(join(OUT, destBase)), { recursive: true });
  const img = sharp(src, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const [w, h] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const stats = await sharp(src, { failOn: 'none' }).rotate().resize(32).stats();
  for (const size of SIZES) {
    const file = join(OUT, `${destBase}-${size}.webp`);
    if (existsSync(file)) continue;
    await sharp(src, { failOn: 'none' }).rotate().resize({ width: size, withoutEnlargement: true })
      .webp({ quality: size > 800 ? 76 : 72, effort: 5 }).toFile(file);
  }
  return { base: `/media/${destBase}`, w, h, ratio: +(w / h).toFixed(4), color: hex(stats.dominant) };
}

const media = { products: {}, maker: {} };
for (const p of manifest.products) {
  media.products[p.handle] = [];
  for (const [i, im] of p.images.entries()) {
    const n = String(i + 1).padStart(2, '0');
    media.products[p.handle].push(await variants(join(raw, im.file), `products/${p.handle}/${n}`));
  }
  console.log(p.handle, media.products[p.handle].length);
}
for (const name of ['fanfix', 'instagram', 'x', 'snapchat', 'kick', 'discord']) {
  media.maker[name] = await variants(join(raw, `socials/${name}.jpg`), `maker/${name}`);
}
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/media.json', JSON.stringify(media, null, 1));
console.log('wrote src/data/media.json');
