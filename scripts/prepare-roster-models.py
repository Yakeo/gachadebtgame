"""Key illustrated models and normalize them to the game's transparent sprite rig.
Requires Pillow. Source files (art-src/models) are ignored working assets.
Example: python scripts/prepare-roster-models.py aster vesper
"""
import argparse
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('ids', nargs='+')
parser.add_argument('--rotate', type=float, default=0, help='Angle for a wide weapon pose; no body stretching')
args = parser.parse_args()
for character in args.ids:
    if not character.isalpha():
        raise ValueError('Character IDs must contain letters only')
    source = ROOT / f'art-src/models/{character}.png'
    image = Image.open(source).convert('RGBA')
    clean = []
    for r, g, b, a in image.getdata():
        # Background is deliberately bright saturated green; dark teal costume
        # colors survive. Remove the spill at the boundary as well as the field.
        excess = g - max(r, b)
        if g > 110 and excess > 55 and g > max(r, b) * 1.45:
            clean.append((0, 0, 0, 0))
        elif excess > 25 and g > 95:
            clean.append((r, min(g, max(r, b) + 10), b, a))
        else:
            clean.append((r, g, b, a))
    image.putdata(clean)
    if args.rotate:
        image = image.rotate(args.rotate, resample=Image.Resampling.NEAREST, expand=True)
    bbox = image.getbbox()
    if bbox is None:
        raise ValueError(f'{character}: no figure survived keying')
    image = image.crop(bbox)
    # Match the original cast's 80..899 visible baseline on an 861x1000 canvas.
    # Downsample to genuine readable pixel clusters, then upscale without blur.
    small_height = 328
    small_width = round(image.width * small_height / image.height)
    width = round(small_width * 2.5)
    height = 820
    if width > 841:
        height = round(820 * 841 / width)
        width = 841
        if height < 800:
            raise ValueError(f'{character}: silhouette too wide; redraw with tighter pose')
    image = image.resize((small_width, small_height), Image.Resampling.LANCZOS)
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    image = image.convert('RGB').quantize(colors=128, dither=Image.Dither.NONE).convert('RGBA')
    image.putalpha(alpha)
    image = image.resize((width, height), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (861, 1000))
    canvas.alpha_composite(image, ((861 - width) // 2, 900 - height))
    target = ROOT / f'public/images/splash-{character}.png'
    canvas.save(target, optimize=True)
    print(f'{character}: {target.stat().st_size:,} bytes, {canvas.getbbox()}')
