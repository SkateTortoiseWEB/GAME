"""
Cuts the Cinder sprite sheet (a 4x3 grid on a baked-in checkerboard) into transparent PNGs, one per pose.

    pip install pillow numpy scipy
    python3 scripts/slice-panda.py path/to/sheet.jpg

Poses are written to public/panda/<name>.png on a shared canvas with the feet on one baseline.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = sys.argv[1] if len(sys.argv) > 1 else "design/cinder-sprite-sheet.jpg"
OUT = "public/panda"
COLS, ROWS = 4, 3
NAMES = [  # row-major, matching the sheet
    "idle", "happy", "celebrate", "think",
    "sad", "scared", "tumble", "ponder",
    "sulk", "nervous", "scorched", "sleep",
]

im = np.asarray(Image.open(SRC).convert("RGB")).astype(np.int16)
H, W, _ = im.shape
mx, mn = im.max(axis=2), im.min(axis=2)

# Background = bright, nearly colourless pixels (the checkerboard) connected to the sheet's edge.
# The thick dark outline around each pose stops the flood, so the fur inside is never touched.
candidate = (((mx - mn) < 46) & (mn > 160)) | (mn > 165)  # the second term also clears the warm glow behind the celebrate pose
labels, _ = ndi.label(candidate)
edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
bg = np.isin(labels, edge_labels[edge_labels > 0])
alpha = ~bg

# Drop specks and shave the 1-2px light halo the JPEG leaves around the outline.
alpha = ndi.binary_opening(alpha, iterations=1)
alpha = ndi.binary_erosion(alpha, iterations=1)
comp, n = ndi.label(alpha)
sizes = ndi.sum(alpha, comp, range(1, n + 1))
for i, s in enumerate(sizes, start=1):
    if s < 60:
        alpha[comp == i] = False
soft = ndi.gaussian_filter(alpha.astype(np.float32), 0.9)

rgba = np.dstack([im.astype(np.uint8), (np.clip(soft, 0, 1) * 255).astype(np.uint8)])
rgba[..., 3][~ndi.binary_dilation(alpha, iterations=2)] = 0

cw, ch = W / COLS, H / ROWS
crops = []
for idx, name in enumerate(NAMES):
    r, c = divmod(idx, COLS)
    x0, x1, y0, y1 = int(c * cw), int((c + 1) * cw), int(r * ch), int((r + 1) * ch)
    cell = rgba[y0:y1, x0:x1]
    ys, xs = np.nonzero(cell[..., 3] > 20)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    crops.append((name, Image.fromarray(cell).crop(box)))

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
