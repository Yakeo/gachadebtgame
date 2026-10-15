"""Remove border-connected white mattes, preserving interior whites and painted scenery.
Requires Pillow, numpy, scipy. Run from any directory. Original JPEGs stay as
editable source assets; runtime links move to alpha WebP only when a matte exists.
"""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
records = []
for source in sorted((ROOT / 'public/images').glob('keyart-*.jpg')):
    image = Image.open(source).convert('RGB')
    rgb = np.asarray(image).astype(np.float32)
    lo = rgb.min(axis=2)
    hi = rgb.max(axis=2)
    # Connected components avoid globally erasing white hair, robes and armor.
    candidate = (lo >= 225) & (hi - lo <= 45)
    labels, _ = ndimage.label(candidate)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border = border[border != 0]
    background = np.isin(labels, border)
    if background.mean() < .005:
        continue  # Full painted scenes are not a white matte.
    alpha = np.ones(lo.shape, dtype=np.float32)
    alpha[background] = 0
    # De-matte a narrow pale boundary instead of leaving a white JPEG halo.
    distance = ndimage.distance_transform_edt(~background)
    fringe = (~background) & (distance <= 1.5) & (lo > 170) & (hi - lo < 65)
    alpha[fringe] = np.clip(1 - lo[fringe] / 255, .05, 1)
    straight = rgb.copy()
    straight[fringe] = np.clip((rgb[fringe] - 255 * (1 - alpha[fringe, None])) / alpha[fringe, None], 0, 255)
    straight[background] = 0
    rgba = np.dstack([straight.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    target = source.with_suffix('.webp')
    Image.fromarray(rgba).save(target, quality=93, method=6)
    records.append({'id': source.stem.removeprefix('keyart-'), 'path': '/images/' + target.name, 'width': image.width, 'height': image.height, 'transparentPixels': int(background.sum()), 'fraction': round(float(background.mean()), 4)})
    print(f'{source.stem}: {background.mean():.1%} white matte removed, {target.stat().st_size:,} bytes')
(ROOT / 'art-source/roster/transparency.json').write_text(json.dumps(records, indent=2) + '\n')
