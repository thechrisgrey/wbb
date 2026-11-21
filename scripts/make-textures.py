"""Cut wood-grain textures out of her own product photos (one-off).
Usage: python3 scripts/make-textures.py <raw-dir> <out-dir>
Grain runs along X in every output. Lighting is flattened so the 3D lights do the shading."""
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

def flatten(im, radius=70, keep=0.25):
    a = np.asarray(im).astype(np.float32) + 1.0
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) + 1.0
    mean = a.reshape(-1, 3).mean(0)
    flat = a / blur * mean
    res = flat * (1 - keep) + a * keep
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))

def crop(path, box, rotate=False, size=(1024, 512)):
    im = Image.open(os.path.join(raw, path)).convert('RGB').crop(box)
    if rotate: im = im.rotate(90, expand=True)
    return flatten(im).resize(size, Image.LANCZOS)

def grade(im, mul=(1, 1, 1), gamma=1.0, contrast=1.0, sat=1.0):
    a = (np.asarray(im).astype(np.float32) / 255.0) ** gamma
    a = a * np.array(mul, np.float32)
    im2 = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    im2 = ImageEnhance.Contrast(im2).enhance(contrast)
    return ImageEnhance.Color(im2).enhance(sat)

def save(im, name, q=82):
    im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=q, method=6)
    a = np.asarray(im).reshape(-1, 3).mean(0)
    print(name, im.size, 'mean #%02x%02x%02x' % tuple(int(v) for v in a))

walnut = crop('products/walnut-tray/02.jpg', (190, 500, 950, 880), rotate=True)
oak = crop('products/walnut-tray/02.jpg', (20, 1070, 1100, 1380))
mahog = crop('products/catch-it-all-tray/02.jpg', (380, 430, 730, 980), rotate=True)

save(grade(walnut, contrast=1.06), 'walnut')
save(grade(oak, contrast=1.05), 'oak')
save(grade(oak, mul=(1.07, 1.06, 1.02), gamma=0.80, contrast=0.80, sat=0.62), 'maple')
save(grade(mahog, contrast=1.04), 'mahogany')
save(grade(mahog, mul=(0.80, 0.66, 0.62), gamma=1.22, contrast=1.12, sat=0.95), 'rosewood')
save(grade(oak, mul=(0.33, 0.31, 0.30), gamma=1.9, contrast=1.5, sat=0.25), 'ebonized')

# End grain: a glued-up block of small walnut squares, each a rotated or flipped patch.
rng = np.random.default_rng(7)
src = np.asarray(grade(walnut, contrast=1.1))
N, cell = 8, 128
board = np.zeros((N * cell, N * cell, 3), np.uint8)
for j in range(N):
    for i in range(N):
        x = int(rng.integers(0, src.shape[1] - cell)); y = int(rng.integers(0, src.shape[0] - cell))
        patch = np.rot90(src[y:y + cell, x:x + cell], int(rng.integers(0, 4)))
        if rng.random() < 0.5: patch = patch[:, ::-1]
        tone = 0.80 + 0.36 * rng.random()
        patch = np.clip(patch.astype(np.float32) * tone, 0, 255).astype(np.uint8)
        board[j * cell:(j + 1) * cell, i * cell:(i + 1) * cell] = patch
edge = np.ones((N * cell, N * cell), np.float32)
for k in range(0, N * cell, cell):
    edge[k:k + 2, :] *= 0.72; edge[:, k:k + 2] *= 0.72
board = np.clip(board * edge[..., None], 0, 255).astype(np.uint8)
save(Image.fromarray(board), 'endgrain')

# Oak version of the end-grain block.
src = np.asarray(grade(oak, contrast=1.12))
board = np.zeros((N * cell, N * cell, 3), np.uint8)
for j in range(N):
    for i in range(N):
        x = int(rng.integers(0, src.shape[1] - cell)); y = int(rng.integers(0, src.shape[0] - cell))
        patch = np.rot90(src[y:y + cell, x:x + cell], int(rng.integers(0, 4)))
        tone = 0.84 + 0.22 * rng.random()
        board[j * cell:(j + 1) * cell, i * cell:(i + 1) * cell] = np.clip(patch.astype(np.float32) * tone, 0, 255).astype(np.uint8)
board = np.clip(board * edge[..., None], 0, 255).astype(np.uint8)
save(Image.fromarray(board), 'endgrain-oak')
