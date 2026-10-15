# SR critter roster

Ten active SRs share the unchanged 20% SR band equally (2% each before pity).

| ID | Name | Origin |
| --- | --- | --- |
| kidjester | Kid Jester | Root upload |
| mrblack | Mr. Black | Root upload |
| mreats | Mr. Eats | Root upload |
| mrhide | Mr. Hide | Root upload |
| takobuddy | Tako Buddy | Root upload |
| teacup | Sir Sips | New teacup-crab with biscuit claws |
| moth | Mothball | New sleepy moth with a stolen lamp |
| stapler | Staple Stan | New stapler-crocodile |
| bell | Ding Dong | New autonomous bell |
| turnip | Count Turnip | New turnip vampire with a juice carton |

Each has transparent illustration and battle art, a class/stat profile, skill descriptions, three companion lines and individual advance/skill animation. Compact or wide bodies retain their original proportions rather than being stretched into humanoid silhouettes.

## Legacy compatibility

Ninette, Byte, Pip, Mira, Quill, Brass and Lumi are retired from new summons, not deleted. Existing IDs, levels, potentials, duplicate tokens, squads, history and story references remain valid. Owned legacy recruits remain visible and usable; unowned retired recruits are hidden. Ninette remains the established story starter. Legacy recruits have zero summon odds and are not shown in the active rates list.

## Enemies

Five new designs cover Spun Shroom, Clockwork Cat, Sentry Prime, Corporate Enforcer and Corrupted Fragment. Bluecap and Reroom use mushroom palette variants; the regular Sentry uses a Prime chassis variant. This updates eight enemy IDs, including their friendly R roster versions. Existing slime models and the Terminal/story boss designs are unchanged.

## Asset preparation

`critters.json` records all 18 shipped models, including their alpha bounds, transparent pixel counts and SHA-256 hashes. Models use the existing 861×1000 rig, visible foot baseline y=900, nearest-neighbor pixel clusters and transparent padding. Illustrations are transparent lossless WebP.

Preparation: `python scripts/prepare-critters.py` (requires Pillow). The five user uploads are tracked at the repository root. The ten generated working originals are local/ignored under `art-src/critters/`; retain those separately to regenerate the full set. A clean checkout uses the committed processed public assets directly and does not require the working originals or Python.

Regression coverage includes exact active SR odds, actual summons/upgrades/equipment/duplicates/battle actions for all ten, legacy-save compatibility, asset integrity/alpha/baseline, enemy references, 150 seeded full-campaign clears at recommended levels, and desktop/mobile roster, combat and recruitment UI checks.
