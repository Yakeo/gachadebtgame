"""Split a generated expression sheet into per-expression portrait PNGs.

Sheets are generated as a grid of head-and-shoulders portraits on a flat green
screen, but the models do not reliably honour the grid they are asked for: a
"3 columns by 2 rows" request comes back as anything from 2x3 to 4x2, and
sometimes with a row of four above a row of three. So the grid is measured
from the artwork rather than assumed, and the portraits are cut on the lines
the model actually drew.

Every portrait is cropped with the SAME box so the face does not jump around
when the game swaps expressions mid-conversation, and the bottom edge is faded
out so the bust dissolves into the scene instead of ending on a hard line.

Usage: python3 scripts/split-expression-sheet.py <sheet.png> <character> <out-dir>
"""
import sys
import pathlib

import numpy as np
from PIL import Image

MOODS = ["calm", "happy", "angry", "shocked", "sad", "smug"]
TARGET_H = 520          # tall enough for a retina bust, small enough to ship
COLORS = 200

# When a sheet carries more portraits than there are moods, some are near
# duplicates of each other (a 7-portrait sheet draws the angry face twice side
# by side, an 8-portrait sheet draws sad twice). These are the ones worth
# keeping, in reading order.
PREFERRED = {
    "6": [0, 1, 2, 3, 4, 5],
    "7": [0, 1, 2, 4, 5, 6],
    "8": [0, 1, 2, 3, 5, 7],
    "9": [0, 1, 2, 3, 5, 8],
}


def green_mask(a: np.ndarray) -> np.ndarray:
    """The flat green screen the character is drawn on."""
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (g > 90) & (g - r > 35) & (g - b > 35)


def _group(indices: list[int]) -> list[list[int]]:
    """Group ascending indices into contiguous runs."""
    groups, current = [], []
    for i in indices:
        if current and i == current[-1] + 1:
            current.append(i)
        else:
            if current:
                groups.append(current)
            current = [i]
    if current:
        groups.append(current)
    return groups


def _dividers(profile_green: np.ndarray, profile_dark: np.ndarray, length: int, limit: float) -> list[int]:
    """Interior divider positions along one axis.

    A divider between two portraits is a line that is either solid green screen
    or a thin dark rule, spanning the axis completely. Nothing else is: a slice
    through somebody's face is part green and part artwork, and even a black
    head of hair has highlights in it.
    """
    lines = [i for i in range(length) if profile_green[i] > .96 or profile_dark[i] > .96]
    return [group[len(group) // 2] for group in _group(lines)
            if 4 < group[0] and group[-1] < length - 4 and len(group) <= length * limit]


def find_figures(im: Image.Image) -> list[tuple[int, int, int, int]]:
    """Locate the character portraits on a sheet, in reading order."""
    rgb = np.asarray(im).astype(int)
    green = green_mask(rgb)
    dark = rgb.max(axis=2) < 70
    h, w = green.shape

    row_edges = [0] + _dividers(green.mean(axis=1), dark.mean(axis=1), h, .05) + [h]
    figures = []
    for y0, y1 in zip(row_edges, row_edges[1:]):
        band_green, band_dark = green[y0:y1], dark[y0:y1]
        column_edges = [0] + _dividers(band_green.mean(axis=0), band_dark.mean(axis=0), w, .05) + [w]
        for x0, x1 in zip(column_edges, column_edges[1:]):
            figures.append((x0, y0, x1, y1))
    if len(figures) < 4:
        raise SystemExit(f"only found {len(figures)} portraits on the sheet")
    return figures


def content_box(cell: Image.Image, scale: int = 4) -> tuple[int, int, int, int]:
    """The bounding box of the character inside its cell.

    Cut lines can leave a sliver of the neighbouring portrait inside a cell.
    Those slivers are not green, so a plain bounding box would swallow them;
    this takes the LARGEST CONNECTED blob instead, which is the character.
    """
    mask = ~green_mask(np.asarray(cell))
    h, w = mask.shape
    sh, sw = max(1, h // scale), max(1, w // scale)
    small = mask[:sh * scale, :sw * scale].reshape(sh, scale, sw, scale).any(axis=(1, 3))

    seen = np.zeros_like(small)
    best, best_box = 0, None
    ys, xs = np.where(small)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack, size = [(y0, x0)], 0
        seen[y0, x0] = True
        minx = maxx = x0
        miny = maxy = y0
        while stack:
            y, x = stack.pop()
            size += 1
            minx, maxx = min(minx, x), max(maxx, x)
            miny, maxy = min(miny, y), max(maxy, y)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < sh and 0 <= nx < sw and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if size > best:
            best, best_box = size, (minx, miny, maxx + 1, maxy + 1)
    if best_box is None:
        raise SystemExit("a portrait cell has no character in it")
    minx, miny, maxx, maxy = (v * scale for v in best_box)
    return minx, miny, min(maxx + scale, w), min(maxy + scale, h)


def cut_out(cell: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Cut a portrait out of its cell, keying the green screen away."""
    face = np.asarray(cell.crop(box).convert("RGBA")).copy()
    green = green_mask(face[..., :3])
    face[..., 3] = np.where(green, 0, 255)

    # De-spill: green fringing baked into the outline would glow against a dark
    # background, so pull the green channel down on the edge pixels.
    spill = (~green) & (face[..., 1].astype(int) > face[..., 0].astype(int) + 8) \
        & (face[..., 1].astype(int) > face[..., 2].astype(int) + 8)
    face[..., 1] = np.where(spill, ((face[..., 0].astype(int) + face[..., 2].astype(int)) // 2).astype(np.uint8), face[..., 1])
    return Image.fromarray(face, "RGBA")


def split(src: pathlib.Path, char: str, out_dir: pathlib.Path) -> list[str]:
    im = Image.open(src).convert("RGB")
    figures = find_figures(im)
    rows = len({box[1] for box in figures})
    print(f"  {len(figures)} portraits on the sheet, in {rows} row{'s' if rows > 1 else ''}")

    cells = [im.crop((x0, y0, x1, y1)) for x0, y0, x1, y1 in figures]
    keep = PREFERRED.get(str(len(cells)))
    if keep is None:
        # Unknown sheet shape: take evenly spaced portraits rather than guess
        # which expressions the model chose.
        keep = [round(i * (len(cells) - 1) / (len(MOODS) - 1)) for i in range(len(MOODS))]
        print(f"  note: {len(cells)} portraits, sampling {len(keep)} of them")
    boxes = [content_box(cells[i]) for i in keep]

    # One shared crop box keeps the framing identical between expressions.
    # A median stops a single oddly-framed portrait from dragging the crop into
    # its neighbour the way a union would.
    left = int(np.median([b[0] for b in boxes]))
    top = int(np.median([b[1] for b in boxes]))
    right = int(np.median([b[2] for b in boxes]))
    bottom = int(np.median([b[3] for b in boxes]))

    written = []
    for name, cell in zip(MOODS, [cells[i] for i in keep]):
        l, t = max(0, left), max(0, top)
        r = min(cell.width, right)
        b = min(cell.height, bottom + int(.04 * cell.height))
        if r - l < 80 or b - t < 80:
            raise SystemExit(f"{char}/{name}: degenerate crop ({l},{t},{r},{b})")

        portrait = cut_out(cell, (l, t, r, b))
        # scale to a consistent height, then dissolve the cut-off chest into the
        # scene so the bust does not end on a hard straight line
        if portrait.height > TARGET_H:
            portrait = portrait.resize((round(portrait.width * TARGET_H / portrait.height), TARGET_H), Image.LANCZOS)
        pixels = np.asarray(portrait).copy()
        rows_n = pixels.shape[0]
        ramp = np.ones(rows_n)
        start = int(rows_n * .88)
        ramp[start:] = np.linspace(1, 0, rows_n - start)
        pixels[..., 3] = (pixels[..., 3].astype(float) * ramp[:, None]).astype(np.uint8)
        portrait = Image.fromarray(pixels, "RGBA")
        portrait = portrait.crop(portrait.getbbox())

        out = out_dir / f"{char}-{name}.png"
        portrait.quantize(colors=COLORS, method=Image.FASTOCTREE).save(out, optimize=True)
        written.append(f"{out.name} {portrait.width}x{portrait.height} {out.stat().st_size // 1024}KB")
    return written


if __name__ == "__main__":
    source, character, target = pathlib.Path(sys.argv[1]), sys.argv[2], pathlib.Path(sys.argv[3])
    target.mkdir(parents=True, exist_ok=True)
    for line in split(source, character, target):
        print(" ", line)
