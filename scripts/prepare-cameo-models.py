"""Cut the cameo guests out of their source art and build battle models.

Both cameo sources are illustrations rather than character sprites, and each one
fails a different naive approach:

* Ch'en (Arknights E2) already ships with a real alpha channel - the dark
  backdrop was keyed out upstream - but the *inside* of that alpha is a full
  scene: a dragon, wreckage, floodlights. Trimming the alpha alone gives a small,
  boxed diorama that reads as a cut-out photograph beside the hand-drawn roster.
  So the source is cropped to the superintendent herself and a seeded GrabCut
  pass separates her from the wreckage; the original alpha is intersected with
  the result so nothing outside the diorama can creep back in.
* Katsushika Hokusai (Fate/Grand Order) arrives opaque, and its border is not a
  blank field to key out - it is painted scenery (blue waves, orange koi, a
  lantern). A white-matte flood removes about 2% of the frame, and a chroma key
  eats her blue sleeves. The same seeded GrabCut separates the figure instead.

The seeds are deliberately coarse - a handful of rectangles expressed as
fractions of the crop - so the result is reproducible and easy to review.

After the matte, both follow the roster pipeline: downsample to readable pixel
clusters, quantize, upscale without blur, and compose onto the roster's 861x1000
canvas at the shared 900px floor.

Requires Pillow and opencv-python-headless. Example:
    python scripts/prepare-cameo-models.py chen hokusai
"""
import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CANVAS = (861, 1000)
FLOOR = 900

SOURCES = {
    "chen": {
        "path": ROOT / "art-source/cameo/chen-source.png",
        "matte": "alpha-then-grabcut",
        # Crop to the figure. Fractions of the original 2048x2048 scene.
        "focus": (0.32, 0.33, 0.66, 0.87),
        # Inside that crop, the dragon and the wreckage are background, and her
        # head and torso are the only unambiguous foreground.
        "background": [(0.00, 0.00, 0.00, 1.00), (1.00, 0.00, 1.00, 1.00),
                       (0.00, 0.94, 1.00, 1.00)],
        "foreground": [(0.28, 0.10, 0.72, 0.30), (0.22, 0.30, 0.80, 0.72)],
        "keep_components": 6,
    },
    "hokusai": {
        "path": ROOT / "art-source/cameo/hokusai-source.png",
        "matte": "grabcut",
        "focus": (0.06, 0.02, 0.96, 0.99),
        # The four corners of the painting are its scenery.
        "background": [(0.00, 0.00, 0.15, 0.40), (0.93, 0.00, 1.00, 0.24),
                       (0.00, 0.82, 0.29, 1.00), (0.70, 0.84, 1.00, 1.00)],
        "foreground": [(0.38, 0.12, 0.70, 0.40), (0.30, 0.40, 0.80, 0.75)],
        "keep_components": 8,
    },
}

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("ids", nargs="+", choices=sorted(SOURCES))
parser.add_argument("--height", type=int, default=820, help="figure height on the canvas")
args = parser.parse_args()


def seeded_matte(image: Image.Image, background, foreground, keep_components: int) -> np.ndarray:
    """Separate a painted figure from its painted surroundings."""
    rgb = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    height, width = bgr.shape[:2]
    mask = np.full((height, width), cv2.GC_PR_BGD, np.uint8)

    def region(fraction):
        x0, y0, x1, y1 = fraction
        return (slice(int(y0 * height), max(int(y1 * height), int(y0 * height) + 1)),
                slice(int(x0 * width), max(int(x1 * width), int(x0 * width) + 1)))

    mask[0:3, :] = cv2.GC_BGD
    mask[-3:, :] = cv2.GC_BGD
    mask[:, 0:3] = cv2.GC_BGD
    mask[:, -3:] = cv2.GC_BGD
    for rect in background:
        mask[region(rect)] = cv2.GC_BGD
    for rect in foreground:
        mask[region(rect)] = cv2.GC_FGD

    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, None, bg_model, fg_model, 8, cv2.GC_INIT_WITH_MASK)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Keep the figure plus its close detail; drop stray slivers of scenery.
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), 8)
    if count > 1:
        keep = np.argsort(stats[1:, cv2.CC_STAT_AREA])[::-1][:keep_components] + 1
        alpha = np.where(np.isin(labels, keep), 255, 0).astype(np.uint8)
    return cv2.medianBlur(alpha, 7)


for character in args.ids:
    spec = SOURCES[character]
    source: Path = spec["path"]
    if not source.exists():
        raise SystemExit(f"{character}: missing source {source}")

    image = Image.open(source)
    if spec.get("focus"):
        x0, y0, x1, y1 = spec["focus"]
        width, height = image.size
        image = image.crop((int(x0 * width), int(y0 * height), int(x1 * width), int(y1 * height)))
    image = image.convert("RGBA")

    alpha = seeded_matte(image, spec["background"], spec["foreground"], spec["keep_components"])
    if spec["matte"] == "alpha-then-grabcut":
        # Never let the matte add pixels the source did not have.
        source_alpha = np.array(image.getchannel("A"))
        alpha = np.minimum(alpha, (source_alpha > 127).astype(np.uint8) * 255)
    image = Image.fromarray(np.dstack([np.array(image.convert("RGB")), alpha]), "RGBA")

    bbox = image.getbbox()
    if bbox is None:
        raise ValueError(f"{character}: no figure survived the matte")
    image = image.crop(bbox)

    small_height = 328
    small_width = max(1, round(image.width * small_height / image.height))
    image = image.resize((small_width, small_height), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 110 else 0)
    image = image.convert("RGB").quantize(colors=128, dither=Image.Dither.NONE).convert("RGBA")
    image.putalpha(alpha)

    height = args.height
    width = round(small_width * height / small_height)
    if width > 841:
        width = 841
        height = round(small_height * width / small_width)
    image = image.resize((width, height), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", CANVAS)
    canvas.alpha_composite(image, ((CANVAS[0] - width) // 2, FLOOR - height))
    target = ROOT / f"public/images/splash-{character}.png"
    canvas.save(target, optimize=True)
    print(f"{character}: {target.stat().st_size:,} bytes, bounds {canvas.getbbox()}")
