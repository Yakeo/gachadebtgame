# Cameo guests

Two URs are visitors from other games. `manifest.json` records where each one
came from, how its art was built and the hashes of every shipped file;
`tests/cameo-guests.test.ts` checks all of it.

| Guest | Origin | Battle model | Illustration / keyart |
| --- | --- | --- | --- |
| Ch'en | Arknights (Hypergryph / Studio Montagne) | `public/images/splash-chen.png` | `keyart-chen.webp` from `chen-source.png` (E2 illustration, `char_010_chen_2`) |
| Katsushika Hokusai | Fate/Grand Order (TYPE-MOON / Lasengle) | `public/images/splash-hokusai.png` | `keyart-hokusai.webp` from `hokusai-source.png` (360×509 painting) |

Both are ordinary UR recruits mechanically: same rates, same 50-pull promise,
same roster, same combat rules, their own companion lines. They are labelled as
cameos in the character page so nobody mistakes them for academy IP, and they
are deliberately absent from the campaign script.

## Battle models

The first cut of these two models was the player-supplied illustration, matted
and dropped onto the roster canvas. It was recognisable and wrong: a painted
figure with soft edges and its own scenery, standing next to hand-drawn pixel
sprites. The cast's models are crisp multi-tone pixel figures on a shared
canvas, and a crop can never become one.

So the models are drawn as pixel-art sprites in the roster's own idiom —
2–3px blocks, hard edges, a limited palette, dark outlines, flat two-tone
shading, full body, neutral stance, facing slightly right — using the shipped
roster models (Altria, Angelina, Morrow) as style references. They arrive on a
flat chroma-green field, and the mechanical part is scripted:

```sh
pip install pillow numpy scipy
python scripts/prepare-cameo-sprites.py chen hokusai
```

The tool keys the green field out, rebuilds the fringe colour from the nearest
solid pixel so no green halo survives at card scale, drops keying specks,
re-grids the art to a 2× coarser lattice, quantizes to 128 colours, upscales
with nearest-neighbour and composes onto the roster's 861×1000 canvas at the
900 px floor — the same standing height as everybody else in battle.

The illustrations are not wasted: they still supply each guest's keyart, which
is what the character page and pull results show. `art-source/cameo/*-source.png`
stays in the repository as the record of the player-supplied art, and
`art-source/cameo/models/*-model-source.png` is the raw sprite each shipped
model is built from.

## Rights

These characters and their art belong to their respective rights holders. No
ownership is claimed, and the in-game note says so. Review permissions before
any commercial distribution.

## Model cache and deployment checks

The shared `Chibi` renderer uses content-hashed model URLs so a browser cannot
keep displaying the old illustration cutouts after a sprite replacement.
`node scripts/gen-model-manifest.mjs` refreshes the committed hashes, and
`next.config.ts` also runs it before development/production builds. The deploy
fetches both cameo PNGs through those versioned URLs and compares their exact
bytes with this redraw manifest, not merely with a successful homepage load.

## Hokusai's updated design

`hokusai-design-reference.png` preserves the player's newer full-body reference.
The battle sprite is redrawn from it rather than cropped: short wavy purple
hair; a crimson-bow, purple-flower and gold-pin headdress; a teal ribbon; red,
ivory and dark-purple kimono panels with bird motifs; a lacquered floral brush;
and a floating octopus familiar. The separate painting/keyart is unchanged.

Rebuild this version with:

```sh
python scripts/prepare-cameo-sprites.py hokusai --no-green
node scripts/gen-model-manifest.mjs
```

`--no-green` replaces residual green-biased chroma clusters with neighbouring
sprite colours after palette quantization. Teal is preserved. Use it only for
designs without actual green clothing; Ch'en's existing build is unchanged.
The reference, generated sprite source and final model hashes are recorded in
`manifest.json`. The browser tests check transparent corners, the 900px floor,
the red/ivory/teal palette and absence of green chroma residue.
