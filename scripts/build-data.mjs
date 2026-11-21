// Turn the raw Shopify catalog capture into src/data/catalog.json.
// Usage: node scripts/build-data.mjs <site-capture-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (html) =>
  decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();

const rooms = {};
for (const [room, file] of [
  ['kitchen', 'col_kitchen-table.json'],
  ['bath', 'col_bathroom.json'],
  ['home', 'col_homewares.json'],
]) {
  for (const p of load(file).products) (rooms[p.handle] ||= []).push(room);
}

const catalog = load('products_json_limit_250.out').products.map((p) => {
  const html = p.body_html || '';
  const listStart = html.search(/<ul|➤\s*DETAILS/i);
  const introHtml = listStart > 0 ? html.slice(0, listStart) : html;
  const intro = [...introHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => text(m[1]).replace(/^➤\s*/, '').replace(/^[A-Z]+:\s*/, ''))
    .filter((t) => t.length > 20);
  let details = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]).replace(/\n+/g, ' '));
  if (!details.length) {
    const block = html.match(/➤\s*DETAILS([\s\S]*?)<\/p>/i);
    if (block) {
      details = text(block[1])
        .split('\n')
        .filter((l) => l.startsWith('•'))
        .map((l) => l.replace(/^•\s*/, '').replace(/:\s*$/, ''));
    }
  }
  const prices = p.variants.map((v) => parseFloat(v.price));
  return {
    handle: p.handle,
    title: p.title,
    url: `https://woodbabybuilds.com/products/${p.handle}`,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    options: p.options.filter((o) => o.name !== 'Title').map((o) => ({ name: o.name.trim(), values: o.values })),
    intro,
    details,
    rooms: rooms[p.handle] || [],
  };
});

writeFileSync('src/data/catalog.json', JSON.stringify(catalog, null, 1));
for (const c of catalog) {
  console.log(c.handle.padEnd(30), `$${c.priceMin}-${c.priceMax}`.padEnd(12), c.rooms.join('/').padEnd(14), 'intro', c.intro.length, 'details', c.details.length);
}
