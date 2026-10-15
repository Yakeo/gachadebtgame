# Remaining roster / enemy art completion

All 44 recruits now explicitly reference separate PNG battle models and illustration assets, including legacy owned units. Angelina and Byte no longer use the generic humanoid SVG. The five R recruits (Spun Shroom, Blue Cap, Reroom, Clockwork Cat and Sentry) now have real detail-page illustrations. Cat and Sentry also receive matching updated models. The server terminal boss has a real pixel model rather than an SVG fallback.

## Angelina

Her illustration is **official Arknights Elite 2 art**, fetched from Aceship's `Arknight-Images` repository (`characters/char_291_aglina_2.png`), not an AI repaint. The original transparent PNG is retained under `art-source/official/`; its source and SHA-256 hashes are recorded in `angelina-e2.json`. The shipped WebP is a lossless resized version with alpha preserved. Copyright remains with the original rights holders; attribution does not grant a license. Only her matching battle model is newly generated. Visual metadata uses brown hair and an Originium staff rather than the former pink-haired rapier placeholder. Existing rarity, stats, roles, skills, IDs and summons remain unchanged.

## Uploaded mushrooms

| Uploaded original | Battle model / ID |
| --- | --- |
| Spun Shroom.png | upload-shroom.png / shroom |
| Reroom.png | upload-reroom.png / reroom |
| Buroom.png | upload-bluecap.png / bluecap (also buroom alias) |
| Yeroom.png | upload-yeroom.png / yeroom |
| Boom Shroom.png | upload-boomshroom.png / boomshroom |
| HitMonShroom.png | upload-hitmonshroom.png / hitmonshroom |

These are cropped from their existing alpha and uniformly nearest-neighbor scaled, not regenerated or palette-swapped. Their original designs and proportions are preserved. All have transparent 861×1000 rigs with visible baseline y=900. The first three replace the current mushroom encounters and friendly R versions. The other three are registered with names and ready to render as enemy IDs; existing encounters and balance have deliberately not been rewritten. The five previously supplied slime originals already have real models via `scripts/gen-slime-sprites.mjs` and remain unchanged.

## Regeneration

Run `python scripts/prepare-roster-completion.py` with Pillow. The six uploaded originals and official E2 source are tracked. Generated working originals live under ignored `art-src/completion/`; retain those separately to regenerate their derived models/illustrations. Clean checkouts need only the shipped public assets, not Pillow or working originals. `completion.json` records all 16 new models, source paths, alpha bounds, transparent pixel counts and SHA-256 hashes. The two humanoids are calibrated to the original cast's visible height; the mascots keep their intentionally shorter/wider silhouettes.
