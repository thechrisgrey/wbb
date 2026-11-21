#!/usr/bin/env python3
"""Painted-crane decals for the Yakisugi Crane Stool, cut from her own product photos.

  python3 -I scripts/dev/textures-yakisugi-crane-wooden-stool.py <photo 04> <photo 03> [preview dir]

Writes into public/media/textures:
  yakisugi-crane-wooden-stool-crane.webp  the egret on the inner (stained) face of the leg. Left to right runs from
                                          the back of the leg to its front edge, bottom row = floor. The texture's
                                          right edge is the front corner, where the body wraps round.
  yakisugi-crane-wooden-stool-wing.webp   the wing that wraps round: the leg's front edge (left STRIP_FRAC of the
                                          width, inner corner to outer corner) then the charred outer face
                                          (front corner to back), cut from photo 03.

Each face is rectified with a perspective transform solved from four corner points of the plank picked by eye,
the warm light is flattened by dividing by a smooth estimate of the lighting on the bare wood, and an alpha matte
keeps only the paint: the paint is much lighter and greyer than the wood, the dark feather linework inside the
bird is closed back in, and the orange legs and beak are kept with a hue term. Mattes are clipped to a hand-drawn
region round the bird so the lit patch of wood up the plank is never picked up. Needs numpy and Pillow only.
"""
import os
import sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'media', 'textures')
PX = 100  # pixels per inch in the rectified faces

# Placement in inches, read by the model file (keep the two in step).
CRANE_U0, CRANE_U1 = 2.4, 11.75  # crane texture spans this much of the leg's depth, measured from the back edge
CRANE_V0, CRANE_V1 = 0.0, 9.6  # and this height above the floor
STRIP_W = 0.85  # leg thickness (the front edge strip)
WING_U1 = 6.6  # outer face: the wing texture runs this far back from the front corner
WING_V0, WING_V1 = 1.6, 10.6


def homography(src, dst):
    """Coefficients for Image.transform(PERSPECTIVE): output (x, y) -> input (X, Y)."""
    a, b = [], []
    for (x, y), (X, Y) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        b.append(X)
        a.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
        b.append(Y)
    return tuple(np.linalg.solve(np.array(a, float), np.array(b, float)))


def rectify(img, quad, w_in, h_in):
    """quad: photo points of the face corners (top-left, top-right, bottom-right, bottom-left) -> w_in x h_in inches."""
    w, h = int(round(w_in * PX)), int(round(h_in * PX))
    c = homography(quad, [(0, 0), (w, 0), (w, h), (0, h)])
    return np.asarray(img.transform((w, h), Image.Transform.PERSPECTIVE, c, Image.BICUBIC)).astype(np.float32)


def rank(a, k, fn):
    for axis in (0, 1):
        pad = [(k // 2, k // 2) if i == axis else (0, 0) for i in range(2)]
        a = fn(sliding_window_view(np.pad(a, pad, mode='edge'), k, axis=axis), axis=-1)
    return a


def smoothstep(a, lo, hi):
    t = np.clip((a - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, r):
    """Gaussian-like blur of a float array: three passes of a box filter per axis (edges clamped)."""
    a = a.astype(np.float32)
    k = max(1, int(round(r * 1.2)))
    for axis in (0, 1):
        for _ in range(3):
            pad = [(k + 1, k) if i == axis else (0, 0) for i in range(2)]
            c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
            hi = np.take(c, np.arange(2 * k + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * k - 1), axis=axis)
            a = (hi - lo) / (2 * k + 1)
    return a


def close(a, r):
    """Soft morphological closing with a round-ish footprint of radius about r pixels."""
    grown = smoothstep(blur(a, r), 0.08, 0.25)
    return 1 - smoothstep(blur(1 - grown, r), 0.08, 0.25)


def poly_mask(shape, pts, soft=4):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([(x * PX, y * PX) for x, y in pts], fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(soft)), dtype=np.float32) / 255


def lighting(lum, paint_guess, r):
    """Smooth lighting over the bare wood (normalized blur that ignores the paint)."""
    wgt = 1 - paint_guess
    return blur(lum * wgt, r) / np.maximum(blur(wgt, r), 1e-3)


def finish(rgb, alpha, size_long, out, preview=None, bg=(70, 42, 26), pct=96):
    h, w = alpha.shape
    s = size_long / max(w, h)
    size = (int(round(w * s)), int(round(h * s)))
    # Paint colour: white-balance so the white paint reads as an off-white, not as lamp-lit beige.
    sel = alpha > 0.8
    ref = np.percentile(rgb[sel], pct, axis=0)
    rgb = rgb * (np.array([238, 235, 228], np.float32) / np.maximum(ref, 1))[None, None, :]
    # Soft knee: a stripe of direct sun on the paint would otherwise blow out; roll it off into the same white.
    lum = rgb.mean(-1, keepdims=True)
    knee, top = 215.0, 246.0
    over = np.maximum(lum - knee, 0)
    rolled = knee + (top - knee) * (1 - np.exp(-over / (top - knee)))
    rgb = rgb * np.where(lum > knee, rolled / np.maximum(lum, 1), 1)
    rgb = np.clip(rgb, 0, 255)
    # Spread the paint colour out under the soft edge so the fringe never shows wood colour.
    a3 = (alpha > 0.5).astype(np.float32)
    fill = np.stack([blur(rgb[:, :, c] * a3, 3) for c in range(3)], -1) / np.maximum(blur(a3, 3), 1e-3)[:, :, None]
    rgb = np.where(a3[:, :, None] > 0, rgb, np.clip(fill, 0, 255))
    rgba = np.dstack([rgb, np.clip(alpha, 0, 1) * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA').resize(size, Image.LANCZOS)
    im.save(out, 'WEBP', quality=90, method=6, exact=True)
    print('wrote', out, size, os.path.getsize(out) // 1024, 'KB')
    if preview:
        base = Image.new('RGBA', size, bg + (255,))
        Image.alpha_composite(base, im).convert('RGB').save(preview + '_comp.png')
        im.getchannel('A').save(preview + '_alpha.png')


# ---------------------------------------------------------------------------------------------- crane (photo 04)


def crane(photo, out, preview=None):
    img = Image.open(photo).convert('RGB')
    # Inner face of the leg, from the back edge to the front corner, floor up to just under the stretcher.
    # Corners picked by eye on the 1600 x 2400 photo; the top line converges with the bottom edge to the left.
    hq = 15.0
    face = rectify(img, [(535, 350), (1300, 452), (1290, 2275), (580, 1700)], 12.0, hq)
    u0, u1 = int(CRANE_U0 * PX), int(CRANE_U1 * PX)
    face = face[int((hq - CRANE_V1) * PX) : int((hq - CRANE_V0) * PX), u0:u1]
    h, w, _ = face.shape
    r, g, b = face[:, :, 0], face[:, :, 1], face[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = face.max(-1)
    sat = (mx - face.min(-1)) / np.maximum(mx, 1)

    # Region round the bird, in inches of the cropped face (x from its left edge, y down from its top).
    region = poly_mask((h, w), [(0.0, 3.3), (1.2, 2.1), (1.5, 0.6), (4.2, 0.15), (5.8, 0.5), (6.6, 1.8), (9.6, 2.2),
                                (9.6, 9.6), (6.6, 9.6), (5.6, 8.7), (3.6, 7.5), (0.6, 4.7), (0.0, 4.4)])

    # Paint is lighter and much greyer than the stained wood. The cleanest single cue is green against red:
    # the stain is red-brown (g/r about 0.6), the white, grey and olive paint is near neutral (g/r 0.85 to 1).
    gr = g / np.maximum(r, 1)
    guess = smoothstep(gr, 0.76, 0.86) * region
    light = lighting(lum, smoothstep(blur(guess, 6), 0.05, 0.2), 40)
    rel = lum / np.maximum(light, 20)  # 1 = like the bare wood here, paint well above
    a_neutral = smoothstep(gr, 0.75, 0.85) * smoothstep(lum, 35, 60)
    a_light = smoothstep(rel, 1.5, 2.1) * smoothstep(0.55 - sat, 0.0, 0.15)  # white paint in the strongest light
    # Orange legs and beak: saturated, hue between red and yellow, brighter than the dark wood round them.
    hue_ok = (r > g) & (g > b)
    hue_pos = (g - b) / np.maximum(r - b, 1)  # 0 red .. 1 yellow
    a_orange = hue_ok * smoothstep(hue_pos, 0.3, 0.42) * (1 - smoothstep(hue_pos, 0.75, 0.9)) * smoothstep(rel, 1.4, 2.0) * smoothstep(r, 140, 180)
    alpha = np.maximum(np.maximum(a_neutral, a_light), a_orange) * region
    # Keep the dark linework inside the bird: a soft closing (grow, then shrink back) fills thin dark strokes.
    alpha = np.maximum(alpha, close(alpha, 5))
    # Drop specks: anything not part of a larger painted area fades out.
    alpha = alpha * smoothstep(blur(alpha, 4), 0.25, 0.45)
    alpha = smoothstep(blur(alpha, 1.0), 0.25, 0.75)

    # Flatten the warm light: bring every pixel to the lighting of a reference, keep the paint's own shading.
    flat = face * (np.median(light[alpha > 0.5]) / np.maximum(light, 20))[:, :, None]
    flat = 0.4 * flat + 0.6 * face * (np.mean(light) / np.maximum(blur(light, 80), 20))[:, :, None]
    # The last few columns sit in the shadow line of the front corner: carry the paint straight to the edge.
    flat[:, -6:] = flat[:, -7:-6]
    alpha[:, -6:] = alpha[:, -7:-6]
    finish(flat, alpha, 1024, out, preview, pct=70)


# ---------------------------------------------------------------------------------------------- wing (photo 03)


def wing(photo, out, preview=None):
    img = Image.open(photo).convert('RGB')
    # Outer (charred) face. The camera is low and close and the top of the front corner is out of frame, so the
    # map is solved from four points whose places on the face are known: both bottom corners of the plank, and
    # the wing tip and the top of the wing root at the front corner, measured on photo 01 (taken square-on enough
    # to rectify from the plank's own corners: tip 5.55 in back and 8.39 in up, root top 6.39 in up).
    plane = [(5.55, 8.39), (0, 6.39), (12, 0), (0, 0)]
    photo = [(878, 997), (604, 1291), (1040, 1580), (600, 2110)]
    c = homography(photo, plane)

    def at(u, v):
        d = c[6] * u + c[7] * v + 1
        return ((c[0] * u + c[1] * v + c[2]) / d, (c[3] * u + c[4] * v + c[5]) / d)

    quad = [at(0, 18), at(12, 18), at(12, 0), at(0, 0)]
    outer = rectify(img, quad, 12.0, 18.0)
    # Front edge strip between the inner corner (about x 512) and the outer corner, at the same heights.
    strip = rectify(img, [(quad[0][0] - 92, quad[0][1]), quad[0], quad[3], (quad[3][0] - 88, quad[3][1])], STRIP_W, 18.0)
    y0, y1 = int((18 - WING_V1) * PX), int((18 - WING_V0) * PX)
    face = np.concatenate([strip[y0:y1], outer[y0:y1, : int(WING_U1 * PX)]], axis=1)
    h, w, _ = face.shape
    sw = int(round(STRIP_W * PX))
    r, g, b = face[:, :, 0], face[:, :, 1], face[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = face.max(-1)
    sat = (mx - face.min(-1)) / np.maximum(mx, 1)

    # On the char the paint is simply far lighter than the near-black wood (the grey under-feathers included).
    a_char = smoothstep(lum, 48, 80)
    # On the lighter front-edge strip, paint is lighter and greyer than the oiled wood.
    gr = g / np.maximum(r, 1)
    a_strip = np.maximum(smoothstep(gr, 0.8, 0.88) * smoothstep(lum, 60, 90), smoothstep(lum, 175, 205))
    alpha = a_char.copy()
    alpha[:, :sw] = a_strip[:, :sw]
    region = poly_mask((h, w), [(0.0, 3.6), (STRIP_W, 3.8), (2.5, 3.0), (4.2, 2.2), (5.4, 1.6), (6.6, 1.6), (6.6, 2.8),
                                (5.0, 4.1), (3.0, 5.5), (1.6, 6.8), (STRIP_W, 7.9), (0.0, 8.6)], soft=3)
    alpha *= region
    alpha = np.maximum(alpha, close(alpha, 4))
    alpha = alpha * smoothstep(blur(alpha, 4), 0.25, 0.45)
    alpha = smoothstep(blur(alpha, 1.0), 0.25, 0.75)

    light = lighting(lum, rank(alpha, 15, np.max), 50)
    flat = face * (np.median(light[alpha > 0.5]) / np.maximum(light, 15))[:, :, None] ** 0.3
    # The low sun tints the wing beige; the paint is white, so take most of that cast out.
    grey = flat.mean(-1, keepdims=True)
    flat = grey + (flat - grey) * 0.55
    finish(flat, alpha, 1024, out, preview, bg=(18, 16, 15))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    prev = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(OUT, exist_ok=True)
    crane(sys.argv[1], os.path.join(OUT, 'yakisugi-crane-wooden-stool-crane.webp'), prev and os.path.join(prev, 'crane'))
    wing(sys.argv[2], os.path.join(OUT, 'yakisugi-crane-wooden-stool-wing.webp'), prev and os.path.join(prev, 'wing'))
