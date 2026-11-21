#!/usr/bin/env python3
"""Textures for the Entry Valet model, cut from her own product photos.

  python3 scripts/dev/textures-the-entry-valet.py <photo 09: White Rabbit, three-quarter view> [photo 07: front view]

Writes into public/media/textures:
  the-entry-valet-rabbit.webp   the White Rabbit engraving as a white, alpha-only decal that covers the glass disc
  the-entry-valet-figure.webp   the figured walnut face of the catchall, colour-matched to the shared walnut texture
                                (only when the front-view photo is given)

Rabbit: the glass outline in the photo is found and fitted with a perspective map (the mirror is seen at an
angle), the glass is flattened to a square, and the engraving is lifted off the reflection behind it: it reads
lighter than the room where the mirror shows beige, and greyer where the mirror shows the white door.
Needs numpy and Pillow only.
"""
import os
import sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'media', 'textures')


def bilinear(arr, x, y):
    h, w = arr.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx = x - x0
    fy = y - y0
    return arr[y0, x0] * (1 - fx) * (1 - fy) + arr[y0, x0 + 1] * fx * (1 - fy) + arr[y0 + 1, x0] * (1 - fx) * fy + arr[y0 + 1, x0 + 1] * fx * fy


def rank(a, k, fn):
    """Separable min or max filter with a k x k window."""
    for axis in (0, 1):
        pad = [(k // 2, k // 2) if i == axis else (0, 0) for i in range(2)]
        a = fn(sliding_window_view(np.pad(a, pad, mode='edge'), k, axis=axis), axis=-1)
    return a


def smoothstep(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------------------------- rabbit


def fit_glass(rgb):
    """Perspective map from the glass disc (u, v in -1..1, v up) to photo pixels.

    x = px + (A u + Bx) / (1 + k u),  y = py + (-C v + By) / (1 + k u)
    The outline alone cannot tell perspective from an off-centre view, so k comes from where the shelf's
    edges converge in this photo (their vanishing point is about 1900 px right of centre, on y = 700).
    """
    h, w, _ = rgb.shape
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    c0 = np.array([545.0, 712.0])  # rough centre and half-axes of the glass, by eye
    ax, ay = 392.0, 472.0
    pts = []
    for t in np.linspace(0, 2 * np.pi, 900, endpoint=False):
        d = np.array([np.cos(t), np.sin(t)])
        re = 1 / np.hypot(d[0] / ax, d[1] / ay)
        r = np.arange(re + 55, re - 45, -0.5)  # walk inwards across the rim
        line = bilinear(lum, c0[0] + d[0] * r, c0[1] + d[1] * r)
        span = 6
        ok = (line[:-span] < 125) & (line[span:] > 150)  # dark walnut, then bright glass
        if not ok.any():
            continue
        i = int(np.argmax(np.where(ok, line[span:] - line[:-span], -1e9)))
        j = i + int(np.argmax(np.diff(line[i : i + span + 1]))) + 0.5
        p = c0 + d * (r[0] - 0.5 * j)
        if 725 < p[1] < 1050:  # the shelf crosses the mirror here
            continue
        pts.append(p)
    pts = np.array(pts)
    p0 = np.array([w / 2, 700.0])
    k = 0.205

    def resid(q, sel):
        a, bx, c, by = q
        xx = sel[:, 0] - p0[0]
        yy = sel[:, 1] - p0[1]
        u = (xx - bx) / (a - k * xx)
        v = (yy * (1 + k * u) - by) / c
        return np.hypot(u, v) - 1

    q = np.array([ax, c0[0] - p0[0], ay, c0[1] - p0[1]])
    keep = np.ones(len(pts), bool)
    for _ in range(4):  # Levenberg-Marquardt, dropping outliers between rounds
        lam = 1e-3
        for _ in range(60):
            r0 = resid(q, pts[keep])
            jac = np.zeros((len(r0), 4))
            for n in range(4):
                dq = np.zeros(4)
                dq[n] = 1e-4 * max(1, abs(q[n]))
                jac[:, n] = (resid(q + dq, pts[keep]) - r0) / dq[n]
            hm = jac.T @ jac
            step = np.linalg.solve(hm + lam * np.diag(np.diag(hm)), -(jac.T @ r0))
            if np.sum(resid(q + step, pts[keep]) ** 2) < np.sum(r0**2):
                q = q + step
                lam *= 0.5
            else:
                lam *= 4
        r_all = resid(q, pts)
        keep = np.abs(r_all) < max(0.004, 2.5 * np.std(r_all[keep]))
    print('glass fit: A=%.1f Bx=%.1f C=%.1f By=%.1f k=%.3f, rms %.4f of the radius over %d edge points' % (*q, k, np.sqrt(np.mean(r_all[keep] ** 2)), keep.sum()))
    return (*q, k, p0)


def flatten_glass(rgb, fit, n):
    a, bx, c, by, k, p0 = fit
    jj, ii = np.mgrid[0:n, 0:n]
    u = (ii + 0.5) / n * 2 - 1
    v = 1 - (jj + 0.5) / n * 2
    x = p0[0] + (a * u + bx) / (1 + k * u)
    y = p0[1] + (-c * v + by) / (1 + k * u)
    return np.stack([bilinear(rgb[:, :, ch], x, y) for ch in range(3)], -1)


def rabbit(photo, out, n=1400, size=1024):
    rgb = np.asarray(Image.open(photo).convert('RGB')).astype(np.float32)
    flat = flatten_glass(rgb, fit_glass(rgb), n)
    s = n / 1400.0  # the hand-placed numbers below were read off a 1400 px flattening
    blue = flat[:, :, 2]  # beige room against a neutral engraving: blue separates them best

    # Where the mirror shows the room in beige or shadow, the engraving is lighter than what is behind it.
    k = int(121 * s) | 1
    behind = rank(rank(blue, k, np.min), k, np.max)  # opening: the room without the engraving
    a_beige = (blue - behind) / np.maximum(205 - behind, 25)

    # Left of the door's edge the mirror shows white trim, and the engraving is greyer than it.
    rows = slice(int(300 * s), int(760 * s))
    edge = int(np.median([np.argmax(blue[y, int(380 * s) : int(540 * s)] < 180) for y in range(rows.start, rows.stop, 7)])) + int(380 * s)
    trim = np.percentile(blue[int(110 * s) : int(760 * s), :edge], 85, axis=0)  # per column: the trim runs straight up
    a_white = (trim[None, :] - blue[:, :edge]) / np.maximum(trim[None, :] - 185, 25)

    alpha = a_beige.copy()
    alpha[:, :edge] = a_white
    g = int(6 * s)
    for i in range(-g + 1, g):  # the door edge itself: bridge straight across it
        t = (i + g) / (2 * g)
        alpha[:, edge + i] = alpha[:, edge - g] * (1 - t) + alpha[:, edge + g] * t
    alpha = smoothstep(alpha, 0.17, 0.82)

    # Keep the hare, drop everything else the mirror reflects (cabinet lines, handles, the rim).
    upper = [(350, 150), (372, 100), (450, 96), (536, 108), (540, 62), (566, 24), (650, 18), (776, 46), (856, 104), (906, 176), (946, 210), (940, 246),
             (1010, 296), (1104, 330), (1214, 396), (1296, 468), (1344, 540), (1356, 640), (1356, 830), (874, 830), (872, 700), (884, 630), (930, 570),
             (850, 612), (790, 606), (750, 560), (730, 470), (742, 380), (776, 318), (720, 300), (560, 292), (450, 256), (380, 205)]
    lower = [(796, 960), (1290, 960), (1290, 1070), (1262, 1168), (1190, 1172), (1128, 1178), (1050, 1236), (930, 1300), (840, 1368), (740, 1402),
             (630, 1406), (596, 1362), (606, 1316), (720, 1262), (812, 1196), (806, 1100)]
    mask = Image.new('L', (n, n), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(x * s, y * s) for x, y in upper], fill=255)
    draw.polygon([(x * s, y * s) for x, y in lower], fill=255)
    mask = np.asarray(mask.filter(ImageFilter.GaussianBlur(5 * s))).astype(np.float32) / 255
    jj, ii = np.mgrid[0:n, 0:n]
    rad = np.hypot((ii + 0.5) / n * 2 - 1, (jj + 0.5) / n * 2 - 1)
    alpha = alpha * mask * smoothstep(0.985 - rad, 0, 0.012)

    # The photo's shelf hides a band of the glass. Run the cut strokes a little way in behind the model's
    # shelf, so no bare strip shows if its edges do not land exactly where the photo's did.
    top_cut, bottom_cut = int(773 * s), int(1019 * s)
    alpha[top_cut : int(830 * s)] = alpha[top_cut - 1]
    alpha[int(970 * s) : bottom_cut] = alpha[bottom_cut]
    alpha[int(830 * s) : int(970 * s)] = 0

    a8 = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    rgba = Image.merge('RGBA', (*[Image.new('L', (size, size), c) for c in (250, 250, 247)], a8))
    rgba.save(out, 'WEBP', quality=90, method=6, exact=True)
    print('wrote', out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    rabbit(sys.argv[1], os.path.join(OUT, 'the-entry-valet-rabbit.webp'))
