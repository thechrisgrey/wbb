// The one import sections need: `products` is her catalog, in display order, with photos and presentation merged in.
import catalog from './catalog.json';
import media from './media.json';
import { PIECES, WOODS, ROOM_LABEL } from './site.js';

const byHandle = Object.fromEntries(catalog.map((c) => [c.handle, c]));

export const products = PIECES.map((piece, i) => {
  const c = byHandle[piece.handle];
  const images = media.products[piece.handle] || [];
  const cover = images[piece.cover] || images[0];
  return {
    ...c,
    ...piece,
    n: i + 1, // 1-based catalog number
    num: String(i + 1).padStart(2, '0'),
    room: c.rooms[0] || 'home',
    roomLabel: ROOM_LABEL[c.rooms[0] || 'home'],
    images,
    coverImage: cover,
    // cover first, then the rest in her order
    gallery: [cover, ...images.filter((im) => im !== cover)],
    woodOptions: piece.woods.map((key) => ({ key, ...WOODS[key], label: piece.woodLabels?.[key] || WOODS[key].label })),
  };
});

export const productByHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
export const maker = media.maker;
export const inRoom = (room) => products.filter((p) => p.rooms.includes(room));

export * from './site.js';
