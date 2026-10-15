"""Prepare remaining roster art and the six supplied mushroom models (Pillow).
Existing slime uploads already have a deterministic pipeline: art:enemies.
Generated working originals stay in ignored art-src/completion.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = []
UPLOADS = {
    'shroom': 'Spun Shroom.png', 'reroom': 'Reroom.png', 'bluecap': 'Buroom.png',
    'yeroom': 'Yeroom.png', 'boomshroom': 'Boom Shroom.png', 'hitmonshroom': 'HitMonShroom.png',
}

def cleaned(relative, matte=False):
    im = Image.open(ROOT / relative).convert('RGBA')
    if matte:
        ImageDraw.floodfill(im, (0, 0), (0, 0, 0, 0), thresh=210)
        data = [(0, 0, 0, 0) if r > 190 and b > 190 and g < 110 and min(r, b) - g > 110 else (r, g, b, a)
                for r, g, b, a in im.getdata()]
        im.putdata(data)
    box = im.getbbox()
    if not box:
        raise ValueError(f'Empty image: {relative}')
    return im.crop(box)

def model(im, dest, source, pixel_upload=False):
    im = im.copy()
    fit = (280, 274) if any(f"/{cid}-model" in source for cid in ["byte", "angelina"]) else (266, 260)
    im.thumbnail(fit, Image.Resampling.NEAREST if pixel_upload else Image.Resampling.LANCZOS)
    if not pixel_upload:
        alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
        im = im.convert('RGB').quantize(colors=128, dither=Image.Dither.NONE).convert('RGBA')
        im.putalpha(alpha)
        # Resampling/quantization must not reintroduce chroma-key guide pixels.
        im.putdata([(0, 0, 0, 0) if r > 200 and b > 200 and g < 100 else (r, g, b, a) for r, g, b, a in im.getdata()])
    im = im.crop(im.getbbox())
    im = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
    rig = Image.new('RGBA', (861, 1000))
    rig.alpha_composite(im, ((861 - im.width) // 2, 900 - im.height))
    path = ROOT / ('public' + dest)
    path.parent.mkdir(parents=True, exist_ok=True)
    rig.save(path, optimize=True)
    MANIFEST.append({'model': dest, 'source': source, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'bounds': list(rig.getbbox()), 'transparentPixels': rig.getchannel('A').histogram()[0]})

def keyart(im, dest):
    # No background flattening; preserve the official E2's alpha and all effects.
    im = im.copy()
    im.thumbnail((1100, 1250), Image.Resampling.LANCZOS)
    im.save(ROOT / ('public' + dest), lossless=True)

for cid, source in UPLOADS.items():
    im = cleaned(source)
    dest = f'/images/enemies/upload-{cid}.png'
    model(im, dest, source, pixel_upload=True)
    if cid in ['shroom', 'reroom', 'bluecap']:
        model(im, f'/images/splash-{cid}.png', source, pixel_upload=True)
        keyart(im, f'/images/keyart-{cid}.webp')

for cid in ['byte', 'angelina']:
    source = f'art-src/completion/{cid}-model.png'
    model(cleaned(source, True), f'/images/splash-{cid}.png', source)
keyart(cleaned('art-src/completion/byte-art.png', True), '/images/keyart-byte.webp')
keyart(cleaned('art-source/official/angelina-e2.png'), '/images/keyart-angelina.webp')
for cid in ['cat', 'sentry']:
    keyart(cleaned(f'art-src/completion/{cid}-art.png', True), f'/images/keyart-{cid}.webp')
    source = f'art-src/completion/{cid}-art.png'
    model(cleaned(source, True), f'/images/splash-{cid}.png', source)
    model(cleaned(source, True), f'/images/enemies/completed-{cid}.png', source)
source = 'art-src/completion/terminal-model.png'
model(cleaned(source, True), '/images/enemies/terminal.png', source)
(ROOT / 'art-source/roster/completion.json').write_text(json.dumps(MANIFEST, indent=2) + '\n')
print(f'Prepared {len(MANIFEST)} models and seven roster illustrations.')
