"""
Cuts the Cinder sprite sheet (a 4x3 grid on a baked-in checkerboard) into transparent PNGs, one per pose.

    pip install pillow numpy scipy
    python3 scripts/slice-panda.py [path/to/sheet.jpg]      (default: design/cinder-sprite-sheet.jpg)

Poses are written to public/panda/<name>.png on a shared canvas with the feet on one baseline.
Floating decorations (hearts, stars, flowers...) stay with the pose they belong to: every loose piece is
attached to the nearest panda body.
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = sys.argv[1] if len(sys.argv) > 1 else "design/cinder-sprite-sheet.jpg"
OUT = "public/panda"
COLS, ROWS = 4, 3
NAMES = [  # row-major, matching the sheet
    "idle", "cheer", "jump", "curious",
    "joy", "love", "relax", "shy",
    "tense", "worried", "tumble", "sleep",
]

os.makedirs(OUT, exist_ok=True)
im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.int16)
H, W, _ = im.shape
mx, mn = im.max(axis=2), im.min(axis=2)

# Background = bright, nearly colourless pixels (the checkerboard) connected to the sheet's edge.
# The thick dark outline around each pose stops the flood, so the fur inside is never touched.
candidate = (((mx - mn) < 46) & (mn > 160)) | (mn > 165)
labels, _ = ndi.label(candidate)
edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
bg = np.isin(labels, edge_labels[edge_labels > 0])
alpha = ~bg

# Drop specks and shave the 1-2px light halo the JPEG leaves around the outline.
alpha = ndi.binary_opening(alpha, iterations=1)
alpha = ndi.binary_erosion(alpha, iterations=1)
comp, n = ndi.label(alpha)
sizes = np.asarray(ndi.sum(alpha, comp, range(1, n + 1)))
for i, s in enumerate(sizes, start=1):
    if s < 60:
        alpha[comp == i] = False
comp, n = ndi.label(alpha)
sizes = np.asarray(ndi.sum(alpha, comp, range(1, n + 1)))
boxes = ndi.find_objects(comp)

# Each pose's body is the biggest piece inside its grid cell; everything else attaches to the nearest body.
cw, ch = W / COLS, H / ROWS
bodies = {}
for i in range(n):
    sl = boxes[i]
    cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
    cell = int(cy // ch) * COLS + int(cx // cw)
    if cell not in bodies or sizes[i] > sizes[bodies[cell] - 1]:
        bodies[cell] = i + 1
owner = np.full(n + 1, -1)
for cell, label in bodies.items():
    owner[label] = cell
for i in range(1, n + 1):
    if owner[i] != -1:
        continue
    sl = boxes[i - 1]
    cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
    best, best_d = -1, 1e9
    for cell, label in bodies.items():
        b = boxes[label - 1]
        dy = max(b[0].start - cy, 0, cy - b[0].stop)
        dx = max(b[1].start - cx, 0, cx - b[1].stop)
        d = (dx * dx + dy * dy) ** 0.5
        if d < best_d:
            best, best_d = cell, d
    if best_d < 140:  # close enough to be a decoration of that pose; otherwise it is stray and dropped
        owner[i] = best

soft = ndi.gaussian_filter(alpha.astype(np.float32), 0.9)
rgba = np.dstack([im.astype(np.uint8), (np.clip(soft, 0, 1) * 255).astype(np.uint8)])
dil = ndi.binary_dilation(alpha, iterations=2)
rgba[..., 3][~dil] = 0

crops = []
for cell, name in enumerate(NAMES):
    mask = np.isin(comp, np.nonzero(owner == cell)[0])
    mask = ndi.binary_dilation(mask, iterations=2)
    piece = rgba.copy()
    piece[..., 3][~mask] = 0
    ys, xs = np.nonzero(piece[..., 3] > 20)
    crops.append((name, Image.fromarray(piece).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))))

# One shared canvas, bottom-centre aligned, so swapping poses never makes the panda jump.
cw_max = max(c.width for _, c in crops)
ch_max = max(c.height for _, c in crops)
SCALE = 360 / ch_max
for name, crop in crops:
    canvas = Image.new("RGBA", (cw_max, ch_max), (0, 0, 0, 0))
    canvas.paste(crop, ((cw_max - crop.width) // 2, ch_max - crop.height), crop)
    canvas = canvas.resize((round(cw_max * SCALE), 360), Image.LANCZOS)
    canvas.save(f"{OUT}/{name}.png", optimize=True)
    print(name, canvas.size)
