# Black Souls UR guests: Grimm and Red Hood

New fan-art interpretations based on the user's supplied references, not official extracted game artwork. Black Souls and its characters belong to their respective rights holders. Reference images are retained here to preserve the requested design direction; no ownership or license grant is implied.

- **Grimm**: fully closed silver visor with black slits, muted green plume, fur mantle, battered plate armor, ragged charcoal cloak and longsword. Dark Vanguard stat profile / Striker kit.
- **Red Hood**: blonde hair, icy blue eyes, wolf-eared crimson hood with white fur, modest white dress, boots and huntsman's axe. Faster Warrior stat profile / Striker kit.

Each has a separate transparent lossless WebP illustration and detailed pixel PNG battle model, companion lines, individual advance and skill animation, and existing generic combat mechanics. UR odds remain 0.1% total, shared evenly among five URs. Existing roster/save IDs, owned characters, story and campaign balance are unchanged.

Models use the existing 861×1000 canvas, a visible y=900 foot baseline and original humanoid figure height. Source proportions are preserved, rather than stretching the figures. Pixel clusters use nearest-neighbor enlargement and a limited palette. Magenta matte and edge spill are removed before shipping.

`manifest.json` records model/illustration SHA-256 hashes, alpha bounds and transparent-pixel counts. `python scripts/prepare-black-souls.py` regenerates the assets with Pillow if the working originals are retained in ignored `art-src/black-souls/`. A clean checkout uses the committed public assets directly; original generated working files are not needed to run or build the game.

Regression tests cover UR odds and actual summoning, equipment, leveling, companions, battle commands, asset integrity/alpha/baseline and desktop/mobile roster and combat rendering.
