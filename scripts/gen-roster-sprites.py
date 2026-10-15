"""Draw the expansion's transparent pixel models. Requires Pillow.
Run from the repository root: python scripts/gen-roster-sprites.py
Design manifest: art-source/roster/recruits.json. Illustrations are separate.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageColor

ROOT = Path(__file__).resolve().parents[1]

def shade(hex_color, factor):
    return tuple(min(255, round(v * factor)) for v in ImageColor.getrgb(hex_color))

for index, c in enumerate(json.loads((ROOT / 'art-source/roster/recruits.json').read_text())):
    if c.get('modelStyle') == 'illustrated-pixel':
        print(f"Preserving illustrated model: {c['id']}")
        continue
    im = Image.new('RGBA', (86, 100))
    d = ImageDraw.Draw(im)
    ink = '#263047'
    skin = '#f4d5c2'
    color, hair = c['color'], c['hair']
    role = c['role']
    # A consistent 8..89 baseline keeps object-fit identical to the story cast.
    d.rectangle((33, 73, 40, 86), fill=ink)
    d.rectangle((47, 73, 54, 86), fill=ink)
    d.rectangle((29, 85, 40, 89), fill='#35435b')
    d.rectangle((47, 85, 58, 89), fill='#35435b')
    if role in ('Caster', 'Healer', 'Support'):
        d.polygon([(29, 41), (56, 41), (64, 81), (24, 81)], fill=ink)
        d.polygon([(31, 44), (53, 44), (59, 78), (28, 78)], fill=color)
        d.polygon([(36, 44), (44, 48), (48, 78), (39, 78)], fill=shade(color, .7))
        d.line([(31, 77), (58, 77)], fill='#eee2bd', width=2)
    else:
        d.polygon([(31, 41), (54, 41), (58, 71), (27, 71)], fill=ink)
        d.polygon([(33, 43), (52, 43), (54, 67), (30, 67)], fill=color)
        d.rectangle((32, 68, 54, 74), fill=shade(color, .65))
        d.line([(33, 47), (33, 62)], fill=shade(color, 1.35), width=2)
    d.rectangle((29, 61, 56, 64), fill='#463c43')
    d.rectangle((41, 60, 45, 65), fill='#dfbc75')
    d.polygon([(32, 43), (25, 48), (22, 59), (27, 61), (36, 48)], fill=shade(color, .8))
    d.rectangle((22, 58, 27, 64), fill=skin)
    d.polygon([(53, 43), (60, 47), (64, 57), (59, 61), (50, 49)], fill=color)
    d.rectangle((59, 57, 64, 64), fill=skin)
    # Individual hair silhouette, with long hair for several scholar designs.
    if c['id'] in ('maribel', 'seraphine', 'morrow', 'tala', 'alice', 'lumi'):
        d.polygon([(28, 19), (59, 18), (64, 61), (55, 56), (52, 29), (33, 28), (29, 61), (24, 52)], fill=shade(hair, .75))
    d.polygon([(27, 19), (31, 12), (39, 8), (49, 8), (58, 15), (60, 29), (53, 41), (33, 41), (26, 29)], fill=ink)
    d.polygon([(29, 19), (33, 13), (40, 9), (48, 9), (56, 16), (58, 28), (51, 38), (35, 38), (28, 28)], fill=hair)
    d.polygon([(31, 24), (54, 23), (54, 32), (47, 41), (39, 41), (32, 33)], fill=skin)
    d.polygon([(29, 21), (35, 13), (50, 13), (56, 22), (50, 26), (45, 21), (41, 26), (37, 21), (31, 28)], fill=hair)
    d.line([(33, 18), (37, 14), (47, 14)], fill=shade(hair, 1.2), width=1)
    d.rectangle((35, 28, 39, 29), fill=ink)
    d.rectangle((47, 28, 51, 29), fill=ink)
    d.rectangle((37, 30, 39, 33), fill=color)
    d.rectangle((47, 30, 49, 33), fill=color)
    d.point((38, 30), fill='white'); d.point((48, 30), fill='white')
    d.line([(42, 36), (45, 36)], fill='#a77c7c')
    d.polygon([(36, 43), (43, 51), (51, 43)], fill='#f3e8d8')
    d.polygon([(42, 47), (46, 49), (44, 58), (41, 51)], fill=shade(color, .6))
    # Weapons and accessories distinguish roles even at battle size.
    if role == 'Lancer':
        d.line([(66, 23), (63, 85)], fill='#c0d0df', width=3)
        d.polygon([(67, 12), (71, 25), (65, 33), (62, 24)], fill='#e0f1ff')
        d.line([(62, 31), (69, 31)], fill=color, width=2)
    elif role == 'Guardian':
        d.polygon([(57, 42), (72, 38), (80, 46), (77, 72), (67, 80), (57, 70)], fill=ink)
        d.polygon([(60, 45), (71, 41), (77, 47), (74, 70), (67, 76), (60, 68)], fill=color)
        d.line([(67, 45), (67, 69)], fill='#e6dab0', width=2)
        d.line([(61, 53), (74, 53)], fill='#e6dab0', width=2)
    elif role == 'Caster':
        d.polygon([(60, 45), (71, 42), (80, 47), (79, 62), (69, 59), (60, 62)], fill=ink)
        d.polygon([(62, 47), (70, 45), (77, 48), (76, 59), (69, 57), (62, 59)], fill='#eee2c9')
        d.line([(70, 46), (69, 57)], fill=color)
        for y in (49, 52, 55): d.line([(63, y), (67, y)], fill=color)
    elif role in ('Healer', 'Support'):
        d.rectangle((65, 28, 67, 85), fill='#bfa072')
        d.ellipse((60, 18, 73, 31), fill=color, outline='#eee2bd', width=2)
        d.line([(67, 21), (67, 28)], fill='white', width=1)
        d.line([(63, 25), (70, 25)], fill='white', width=1)
    else:
        d.line([(62, 67), (76, 32)], fill=ink, width=5)
        d.line([(63, 63), (76, 33)], fill='#d4e3ef', width=3)
        d.line([(58, 60), (68, 65)], fill='#dfbd69', width=2)
    if c['id'] == 'flint':
        d.rectangle((67, 30, 80, 42), fill='#9caabd', outline=ink, width=2)
    if c['id'] in ('vesper', 'cobalt', 'pip', 'quill'):
        d.rectangle((30, 11, 54, 16), fill=color)
        d.rectangle((26, 16, 56, 18), fill=ink)
    if c['id'] == 'altria':
        d.line([(40, 13), (43, 9), (47, 14)], fill=hair)
        d.rectangle((30, 45, 36, 53), fill='#c8d4e2')
        d.rectangle((48, 45, 55, 53), fill='#c8d4e2')
        d.rectangle((36, 52, 50, 60), fill='#c8d4e2')
    if c['id'] == 'alice':
        d.rectangle((34, 55, 51, 76), fill='#f5f1e5')
        d.polygon([(38, 10), (43, 14), (48, 10), (48, 17), (38, 17)], fill=ink)
    im = im.resize((861, 1000), Image.Resampling.NEAREST)
    im.save(ROOT / f"public/images/splash-{c['id']}.png", optimize=True)
