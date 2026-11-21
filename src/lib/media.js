// Builds responsive <img> markup from entries in src/data/media.json.
// Every image exists as <base>-600.webp and <base>-1200.webp; `color` is its dominant tone, used as the placeholder.

/** Resolve a path under public/ so the site works from any base path. */
export const asset = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\//, '')}`;

export const src = (m, size = 1200) => asset(`${m.base}-${size}.webp`);

export const srcset = (m) => `${asset(`${m.base}-600.webp`)} 600w, ${asset(`${m.base}-1200.webp`)} 1200w`;

/**
 * <img> string for a media entry.
 * @param m       entry from media.json ({ base, w, h, ratio, color })
 * @param opts    { alt, sizes, eager, cls, draggable }
 */
export function img(m, { alt = '', sizes = '100vw', eager = false, cls = '' } = {}) {
  const h = Math.round(1200 / m.ratio);
  return `<img class="${cls}" src="${src(m, 600)}" srcset="${srcset(m)}" sizes="${sizes}" width="1200" height="${h}" alt="${alt.replace(/"/g, '&quot;')}" ${
    eager ? 'fetchpriority="high" decoding="sync"' : 'loading="lazy" decoding="async"'
  } draggable="false">`;
}

/** A framed image: wrapper carries the placeholder color and aspect ratio, image fills it. */
export function frame(m, { alt = '', sizes = '100vw', eager = false, cls = '', ratio } = {}) {
  return `<figure class="media ${cls}" style="--ph:${m.color};aspect-ratio:${ratio || m.ratio}">${img(m, { alt, sizes, eager })}</figure>`;
}

/** Preload an image and resolve when decoded (never rejects). */
export function preload(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = im.onerror = () => resolve(im);
    im.src = url;
    if (im.decode) im.decode().then(() => resolve(im)).catch(() => {});
  });
}
