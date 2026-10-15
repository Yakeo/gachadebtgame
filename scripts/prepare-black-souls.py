"""Prepare Grimm / Red Hood assets; requires Pillow and ignored art-src originals."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT = Path(__file__).resolve().parents[1]
records = []
for cid in ['grimm', 'redhood']:
    for kind in ['art', 'model']:
        source = ROOT / f'art-src/black-souls/{cid}-{kind}.png'
        im = Image.open(source).convert('RGBA')
        ImageDraw.floodfill(im, (0, 0), (0, 0, 0, 0), thresh=210)
        im.putdata([(0, 0, 0, 0) if r > 190 and b > 190 and g < 110 else (r,g,b,a) for r,g,b,a in im.getdata()])
        # Suppress pink chroma-key spill; keep any crimson accents dark red.
        im.putdata([(min(r,155),min(g,45),min(b,55),a) if a and r > 90 and b > 60 and r > g*1.8 and b > g*1.8 else (r,g,b,a) for r,g,b,a in im.getdata()])
        im = im.crop(im.getbbox())
        if kind == 'art':
            im.thumbnail((1050, 1250), Image.Resampling.LANCZOS)
            dest = ROOT / f'public/images/keyart-{cid}.webp'
            im.save(dest, lossless=True)
        else:
            im.thumbnail((280, 274), Image.Resampling.LANCZOS)
            alpha = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
            im = im.convert('RGB').quantize(colors=128, dither=Image.Dither.NONE).convert('RGBA')
            im.putalpha(alpha)
            im.putdata([(0,0,0,0) if r > 200 and b > 200 and g < 100 else (r,g,b,a) for r,g,b,a in im.getdata()])
            im = im.crop(im.getbbox())
            im = im.resize((im.width*3, im.height*3), Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', (861, 1000))
            canvas.alpha_composite(im, ((861-im.width)//2, 900-im.height))
            im = canvas
            dest = ROOT / f'public/images/splash-{cid}.png'
            im.save(dest, optimize=True)
        records.append({'id':cid,'kind':kind,'path':'/'+str(dest.relative_to(ROOT/'public')),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bounds':list(im.getbbox()),'transparentPixels':im.getchannel('A').histogram()[0]})
(ROOT/'art-source/black-souls/manifest.json').write_text(json.dumps(records,indent=2)+'\n')
