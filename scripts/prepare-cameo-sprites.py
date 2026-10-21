"""Build the cameo guests' battle models from illustrated pixel-art sprites.

The cameo guests originally shipped as crops of their source illustrations. They
were recognisable, but they read as paintings cut out and dropped beside a
roster of crisp pixel figures: soft anti-aliased edges, scenery inside the
silhouette, and a finer drawing scale than everyone else's model.

Their models are now drawn (with generative assistance, see
`art-source/cameo/README.md`) in the roster's own pixel-art idiom and delivered
on a flat chroma-green field. This script does the mechanical part of turning
such a delivery into a shipped model:

1. key the flat chroma field out, keeping a hard pixel-art edge;
2. rebuild the colour of the one-pixel fringe from the nearest solid pixel, so
   no green halo survives at battle or card scale;
3. drop stray specks that are not part of the figure;
4. re-grid the art onto a coarser pixel lattice, quantize, and upscale with
   nearest-neighbour so the blocks match the rest of the roster;
5. compose onto the roster's 861x1000 canvas standing on the shared 900px floor.

Requires Pillow, NumPy and scipy. Example:
    python scripts/prepare-cameo-sprites.py chen hokusai
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
CANVAS = (861, 1000)
FLOOR = 900
CHROMA = np.array([0, 255, 0], dtype=np.float32)

SOURCES = {
    "chen": ROOT / "art-source/cameo/models/chen-model-source.png",
    "hokusai": ROOT / "art-source/cameo/models/hokusai-model-source.png",
}

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("ids", nargs="+", choices=sorted(SOURCES))
parser.add_argument("--height", type=int, default=820, help="figure height on the canvas")
parser.add_argument("--blocks", type=int, default=2, help="pixel-block size in the shipped model")
parser.add_argument("--colors", type=int, default=128, help="palette size")
parser.add_argument("--key-tolerance", type=float, default=70.0,
                    help="RGB distance from the chroma colour treated as background")
args = parser.parse_args()


def key_chroma(rgb: np.ndarray) -> np.ndarray:
    """Binary alpha for a flat chroma field, with a soft one-pixel edge."""
    distance = np.linalg.norm(rgb.astype(np.float32) - CHROMA, axis=-1)
    return np.clip((distance - args.key_tolerance) / 45.0, 0.0, 1.0)


def drop_spill(rgb: np.ndarray, solid: np.ndarray, reach: int = 2) -> np.ndarray:
    """Pull the chroma colour out of the pixels that survived the key.

    Chunky green surrounds every edge, so a handful of genuinely drawn pixels
    are part-green blends. They are opaque, but they would read as a halo
    against the white roster cards, so their colour is replaced by the nearest
    clean neighbour.
    """
    green = rgb[..., 1].astype(np.int16) - np.maximum(rgb[..., 0], rgb[..., 2]).astype(np.int16)
    near_edge = ndimage.binary_dilation(~solid, np.ones((reach * 2 + 1, reach * 2 + 1)))
    spill = solid & near_edge & (green > 18)
    if not spill.any():
        return rgb
    clean = solid & ~spill
    if not clean.any():
        return rgb
    return np.where(spill[..., None], nearest_colour(rgb, clean), rgb)


def nearest_colour(rgb: np.ndarray, solid: np.ndarray) -> np.ndarray:
    """Replace fringe colours with the nearest solid pixel's colour."""
    _, indices = ndimage.distance_transform_edt(~solid, return_indices=True)
    return rgb[indices[0], indices[1]]


def keep_figure(alpha: np.ndarray) -> np.ndarray:
    """Drop specks, but keep every island the figure actually touches."""
    solid = alpha > 0.5
    labels, count = ndimage.label(solid, structure=np.ones((3, 3)))
    if count <= 1:
        return alpha
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    # Anything under 0.02% of the largest island is a keying artefact.
    floor = max(12, sizes.max() * 0.0002)
    keep = np.isin(labels, np.nonzero(sizes >= floor)[0] + 1)
    return np.where(keep, alpha, 0.0)


for character in args.ids:
    source = SOURCES[character]
    if not source.exists():
        raise SystemExit(f"{character}: missing source {source}")

    image = Image.open(source).convert("RGB")
    rgb = np.array(image)
    alpha = keep_figure(key_chroma(rgb))
    solid = alpha > 0.98
    if not solid.any():
        raise SystemExit(f"{character}: the chroma key found no figure")

    # Fringe pixels take their colour from the nearest solid pixel; combined
    # with the softened alpha this removes the green halo without eroding the
    # silhouette by a pixel.
    rgb = np.where(solid[..., None], rgb, nearest_colour(rgb, solid))
    rgb = drop_spill(rgb, solid)
    model = Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), "RGBA")

    bbox = model.getbbox()
    if bbox is None:
        raise SystemExit(f"{character}: no figure survived the key")
    model = model.crop(bbox)

    # Re-grid: halve the delivered resolution, quantize there, then scale up with
    # nearest-neighbour. The figure keeps its drawing but gains the roster's
    # chunky blocks instead of a second, finer pixel grid.
    grid_height = max(1, round(model.height / args.blocks))
    grid_width = max(1, round(model.width * grid_height / model.height))
    regridded = model.resize((grid_width, grid_height), Image.Resampling.BOX)
    alpha = regridded.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    regridded = regridded.convert("RGB").quantize(colors=args.colors, dither=Image.Dither.NONE)
    regridded = regridded.convert("RGBA")
    regridded.putalpha(alpha)

    height = args.height
    width = round(grid_width * height / grid_height)
    if width > CANVAS[0] - 20:
        width = CANVAS[0] - 20
        height = round(grid_height * width / grid_width)
    model = regridded.resize((width, height), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", CANVAS)
    canvas.alpha_composite(model, ((CANVAS[0] - width) // 2, FLOOR - height))
    target = ROOT / f"public/images/splash-{character}.png"
    canvas.save(target, optimize=True)
    print(f"{character}: {target.stat().st_size:,} bytes, bounds {canvas.getbbox()}, "
          f"grid {grid_width}x{grid_height}")
