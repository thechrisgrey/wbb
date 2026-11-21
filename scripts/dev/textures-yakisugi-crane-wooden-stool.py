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
CRANE_U0, CRANE_U1 = 2.4, 12.0  # crane texture spans this much of the leg's depth, measured from the back edge
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
    im = Image.fromarray(a.astype(np.float32), mode='F')
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32)


def poly_mask(shape, pts, soft=4):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([(x * PX, y * PX) for x, y in pts], fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(soft)), dtype=np.float32) / 255


def lighting(lum, paint_guess, r):
    """Smooth lighting over the bare wood (normalized blur that ignores the paint)."""
    wgt = 1 - paint_guess
    return blur(lum * wgt, r) / np.maximum(blur(wgt, r), 1e-3)


def finish(rgb, alpha, size_long, out, preview=None, bg=(70, 42, 26)):
    h, w = alpha.shape
    s = size_long / max(w, h)
    size = (int(round(w * s)), int(round(h * s)))
    # Paint colour: white-balance so the brightest paint reads as an off-white, not as lamp-lit beige.
    sel = alpha > 0.8
    ref = np.percentile(rgb[sel], 96, axis=0)
    rgb = rgb * (np.array([243, 240, 233], np.float32) / np.maximum(ref, 1))[None, None, :]
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
    region = poly_mask((h, w), [(0.0, 3.6), (1.2, 2.2), (2.6, 2.0), (3.2, 0.25), (6.0, 0.0), (7.2, 0.9), (7.6, 2.2),
                                (9.6, 2.6), (9.6, 9.6), (5.2, 9.6), (4.8, 8.6), (3.4, 6.8), (1.4, 5.6), (0.0, 4.4)])

    # Paint is lighter and much greyer than the stained wood.
    guess = smoothstep(lum, 110, 170) * smoothstep(0.55 - sat, 0.0, 0.2) * region
    light = lighting(lum, rank(guess, 15, np.max), 40)
    rel = lum / np.maximum(light, 20)  # 1 = like the bare wood here, paint well above
    a_light = smoothstep(rel, 1.35, 1.9) * smoothstep(0.62 - sat, 0.0, 0.18)
    a_grey = smoothstep(0.42 - sat, 0.0, 0.14) * smoothstep(lum, 55, 95)  # grey-green wing feathers
    # Orange legs and beak tip: saturated, hue between red and yellow, brighter than the dark wood round the feet.
    hue_ok = (r > g) & (g > b)
    hue_pos = (g - b) / np.maximum(r - b, 1)  # 0 red .. 1 yellow
    a_orange = hue_ok * smoothstep(hue_pos, 0.25, 0.4) * (1 - smoothstep(hue_pos, 0.75, 0.9)) * smoothstep(rel, 1.5, 2.2) * smoothstep(r, 150, 190)
    alpha = np.maximum(np.maximum(a_light, a_grey), a_orange) * region
    # Keep the dark linework inside the bird: close the matte (dilate then erode).
    k = 13
    closed = rank(rank(alpha, k, np.max), k, np.min)
    alpha = np.maximum(alpha, closed)
    # Drop lone specks of light grain, then soften the edge a touch.
    alpha = np.minimum(alpha, rank(rank(alpha, 5, np.min), 5, np.max) + 0.15)
    alpha = blur(alpha, 1.2)
    alpha = smoothstep(alpha, 0.2, 0.8)

    # Flatten the warm light: bring every pixel to the lighting of a reference, keep the paint's own shading.
    flat = face * (np.median(light[alpha > 0.5]) / np.maximum(light, 20))[:, :, None]
    flat = 0.4 * flat + 0.6 * face * (np.mean(light) / np.maximum(blur(light, 80), 20))[:, :, None]
    finish(flat, alpha, 1024, out, preview)


# ---------------------------------------------------------------------------------------------- wing (photo 03)


def wing(photo, out, preview=None):
    img = Image.open(photo).convert('RGB')
    # Outer (charred) face: front corner at x 600, back edge at about x 1060; strong perspective (camera low and
    # close), so the front corner's top is far above the frame. Heights 0..18 in.
    outer = rectify(img, [(600, -858), (1080, 200), (1040, 1580), (600, 2110)], 12.0, 18.0)
    # Front edge strip between the inner corner (x 510) and the outer corner (x 600), same heights.
    strip = rectify(img, [(508, -858), (600, -858), (600, 2110), (512, 2110)], STRIP_W, 18.0)
    y0, y1 = int((18 - WING_V1) * PX), int((18 - WING_V0) * PX)
    face = np.concatenate([strip[y0:y1], outer[y0:y1, : int(WING_U1 * PX)]], axis=1)
    h, w, _ = face.shape
    sw = int(round(STRIP_W * PX))
    r, g, b = face[:, :, 0], face[:, :, 1], face[:, :, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = face.max(-1)
    sat = (mx - face.min(-1)) / np.maximum(mx, 1)

    # On the char the paint is simply far lighter than the near-black wood.
    a_char = smoothstep(lum, 60, 110)
    # On the lighter front-edge strip, paint is lighter and greyer than the wood.
    a_strip = smoothstep(lum, 150, 195) * smoothstep(0.5 - sat, 0.0, 0.2) + smoothstep(0.3 - sat, 0.0, 0.12) * smoothstep(lum, 90, 120)
    alpha = a_char.copy()
    alpha[:, :sw] = np.clip(a_strip[:, :sw], 0, 1)
    # Region round the wing (x in inches from the inner corner of the strip, y down from the top of the crop).
    region = poly_mask((h, w), [(0.0, 3.0), (0.0, 7.6), (STRIP_W, 7.6), (1.8, 5.6), (4.0, 3.2), (6.4, 0.7), (6.3, 0.0),
                                (4.6, 0.2), (2.6, 1.6), (1.4, 2.4), (STRIP_W, 3.0)], soft=3)
    alpha *= region
    k = 11
    alpha = np.maximum(alpha, rank(rank(alpha, k, np.max), k, np.min))
    alpha = np.minimum(alpha, rank(rank(alpha, 5, np.min), 5, np.max) + 0.15)
    alpha = smoothstep(blur(alpha, 1.2), 0.2, 0.8)

    light = lighting(lum, rank(alpha, 15, np.max), 50)
    flat = face * (np.median(light[alpha > 0.5]) / np.maximum(light, 15))[:, :, None] ** 0.3
    finish(flat, alpha, 1024, out, preview, bg=(18, 16, 15))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    prev = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(OUT, exist_ok=True)
    crane(sys.argv[1], os.path.join(OUT, 'yakisugi-crane-wooden-stool-crane.webp'), prev and os.path.join(prev, 'crane'))
    wing(sys.argv[2], os.path.join(OUT, 'yakisugi-crane-wooden-stool-wing.webp'), prev and os.path.join(prev, 'wing'))
