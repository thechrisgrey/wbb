// Build the favicon and touch icon from her WB badge paths.
// Usage: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { BADGE } from '../src/brand/marks.js';

const [, , w, h] = BADGE.viewBox.split(' ').map(Number);
const layers = `<path d="${BADGE.layers.shadow}" fill="#e0722c" fill-rule="evenodd"/><path d="${BADGE.layers.outline}" fill="#16130f" fill-rule="evenodd"/><path d="${BADGE.layers.fill}" fill="#eee5c1" fill-rule="evenodd"/>`;

// Square canvas with the badge centred on her orange.
const size = 2200;
const scale = (size * 0.8) / w;
const tx = (size - w * scale) / 2;
const ty = (size - h * scale) / 2;
const square = (bg, radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/><g transform="translate(${tx} ${ty}) scale(${scale})">${layers.replace('fill="#e0722c"', 'fill="#c25a1b"')}</g></svg>`;

writeFileSync('public/favicon.svg', square('#e0722c', size * 0.22));
await sharp(Buffer.from(square('#e0722c', 0))).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('wrote public/favicon.svg and public/apple-touch-icon.png');
