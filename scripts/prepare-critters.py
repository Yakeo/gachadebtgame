"""Prepare uploaded/generated critters as alpha art and whole-body battle rigs.
Run with .venv/bin/python scripts/prepare-critters.py (Pillow required).
Generated source files live in ignored art-src/critters; originals remain untouched.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import colorsys
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'kidjester': 'Kid Jester.png', 'mrblack': 'Mr. Black.png',
    'mreats': 'Mr. Eats.png', 'mrhide': 'Mr. Hide.png', 'takobuddy': 'Tako Buddy.png',
    **{name: f'art-src/critters/{name}.png' for name in ['teacup', 'moth', 'stapler', 'bell', 'turnip']},
    **{f'foe-{name}': f'art-src/critters/foe-{name}.png' for name in ['shroom', 'cat', 'prime', 'enforcer', 'fragment']},
}

def clean(source):
    im = Image.open(source).convert('RGBA')
    if source.parent.name == 'critters':
        # Flood only edge-connected matte/spill, leaving enclosed purple bodies intact.
        ImageDraw.floodfill(im, (0, 0), (0, 0, 0, 0), thresh=210)
        pixels = []
        for r, g, b, a in im.getdata():
            if r > 190 and b > 190 and g < 110 and min(r, b) - g > 110:
                pixels.append((0, 0, 0, 0))
            else:
                pixels.append((r, g, b, a))
        im.putdata(pixels)
    box = im.getbbox()
    if not box:
        raise ValueError(f'Empty figure: {source}')
    return im.crop(box)

def rig(im):
    # Uniform fit, preserving deliberately wide/short creatures, never stretching.
    im = im.copy()
    im.thumbnail((266, 260), Image.Resampling.LANCZOS)
    alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    im = im.convert('RGB').quantize(colors=64, dither=Image.Dither.NONE).convert('RGBA')
    im.putalpha(alpha)
    im = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (861, 1000))
    canvas.alpha_composite(im, ((861-im.width)//2, 900-im.height))
    return canvas

manifest = []
for cid, relative in SOURCES.items():
    source = ROOT / relative
    if not source.exists():
        raise FileNotFoundError(f'{relative}: keep generated working source to rebuild')
    im = clean(source)
    if cid.startswith('foe-'):
        dest = f'public/images/enemies/critter-{cid[4:]}.png'
    else:
        dest = f'public/images/splash-{cid}.png'
        art = im.copy()
        art.thumbnail((800, 900), Image.Resampling.NEAREST)
        art.save(ROOT / f'public/images/keyart-{cid}.webp', lossless=True)
    (ROOT / dest).parent.mkdir(parents=True, exist_ok=True)
    model = rig(im)
    model.save(ROOT / dest, optimize=True)
    manifest.append({'id': cid, 'source': relative, 'model': '/' + dest.removeprefix('public/'), 'illustration': None if cid.startswith('foe-') else f'/images/keyart-{cid}.webp', 'width': 861, 'height': 1000})

# Three mushroom species and the lighter security chassis share a coherent family.
for cid, source, shift in [('bluecap', 'shroom', .32), ('reroom', 'shroom', -.27), ('sentry', 'prime', .46)]:
    im = Image.open(ROOT / f'public/images/enemies/critter-{source}.png').convert('RGBA')
    pixels = []
    for r, g, b, a in im.getdata():
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        # Recolor only the species' signature hue; preserve faces and outlines.
        change = (.20 < h < .45) if source == 'shroom' else (.08 < h < .2)
        if change and s > .2:
            r, g, b = (round(c*255) for c in colorsys.hsv_to_rgb((h+shift)%1, s, v))
        pixels.append((r, g, b, a))
    im.putdata(pixels)
    im.save(ROOT / f'public/images/enemies/critter-{cid}.png', optimize=True)
    manifest.append({'id': f'foe-{cid}', 'source': f'palette variant of foe-{source}', 'model': f'/images/enemies/critter-{cid}.png', 'illustration': None, 'width': 861, 'height': 1000})
for entry in manifest:
    path = ROOT / ('public' + entry['model'])
    model = Image.open(path).convert('RGBA')
    entry['transparentPixels'] = model.getchannel('A').histogram()[0]
    entry['bounds'] = list(model.getbbox())
    entry['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
(ROOT / 'art-source/roster/critters.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Prepared {len(SOURCES)} figures, 10 illustrations and 3 enemy variants.')
