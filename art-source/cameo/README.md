# Cameo guests

Two URs are visitors from other games, added from art the player supplied.
`manifest.json` records where each one came from, how its matte was produced and
the hashes of every shipped file; `tests/cameo-guests.test.ts` checks all of it.

| Guest | Origin | Supplied source | Matte | Model | Illustration |
| --- | --- | --- | --- | --- | --- |
| Ch'en | Arknights (Hypergryph / Studio Montagne) | `chen-source.png` — E2 illustration, `char_010_chen_2` | alpha ∩ seeded GrabCut | `public/images/splash-chen.png` | `public/images/keyart-chen.webp` |
| Katsushika Hokusai | Fate/Grand Order (TYPE-MOON / Lasengle) | `hokusai-source.png` — 360×509 painting, opaque | seeded GrabCut | `public/images/splash-hokusai.png` | `public/images/keyart-hokusai.webp` |

Both are ordinary UR recruits mechanically: same rates, same 50-pull promise,
same roster, same combat rules, their own companion lines. They are labelled as
cameos in the character page so nobody mistakes them for academy IP, and they
are deliberately absent from the campaign script.

## Rebuilding the battle models

```sh
pip install pillow opencv-python-headless
python scripts/prepare-cameo-models.py chen hokusai
```

The two sources could not share one matte strategy:

* **Ch'en** arrives with a real alpha channel, but the *inside* of that alpha is
  a whole scene: a dragon, wreckage, floodlights. Trimming the alpha gives a
  small boxed diorama that reads as a cut-out photograph beside hand-drawn
  characters. The source is therefore cropped to the superintendent, a seeded
  GrabCut pass separates her from the wreckage, and the original alpha is
  intersected with the result so nothing outside the diorama creeps back in.
* **Hokusai** arrives as an opaque painting whose border is *scenery*, not a
  blank field: blue waves, orange koi and a lantern. A white-matte flood removes
  almost nothing (2% of the frame), and a naive chroma key eats the figure's own
  blue sleeves. `prepare-cameo-models.py` therefore seeds a GrabCut pass with one
  background region per corner and a foreground block over the face and torso.
  The seeds are coarse on purpose, so the result is reproducible and reviewable.

After the matte both follow the roster pipeline: downsample to readable pixel
clusters, quantize to 128 colours, upscale with nearest-neighbour and compose
onto the shared 861×1000 canvas at the 900px floor, so they stand at the same
height as the rest of the cast in battle.

## Rights

These characters and their art belong to their respective rights holders. No
ownership is claimed, and the in-game note says so. Review permissions before
any commercial distribution.
