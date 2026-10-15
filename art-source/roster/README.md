# Academy roster expansion

Adds **10 SSR**, **5 SR**, and **2 UR** recruits. `recruits.json` records the original design briefs, stats, skills and intended illustration paths. Runtime records live in `src/lib/game-data.ts`; no manifest is loaded by the browser.

## New recruits

- SSR: Aster (surveyor), Vesper (night shuttle conductor), Maribel (greenhouse medic), Cobalt (pirate broadcaster), Octavia (bellkeeper), Flint (workshop engineer), Seraphine (appeals advocate), Rook (athletics captain), Morrow (archive librarian), Tala (festival organizer).
- SR: Pip (courier), Mira (alchemist), Quill (student press), Brass (maintenance), Lumi (tea club).
- UR guests: Altria Pendragon / female Saber (Fate series), Alice (Black Souls).

All recruits use the engine's standard role-based combat rules. Healing skills restore living allies for 160% attack; healing ultimates restore 300%. Caster skills hit all enemies for 165%; other offensive skills hit one target for 165%. Offensive ultimates hit all enemies for 340%. Standard critical and defense rules still apply. Skill descriptions intentionally reflect actual behavior rather than promising unimplemented special mechanics.

All are available through the existing shared rarity pools. Rarity rates, featured Penelope share and pity rules are unchanged; individual non-featured chances shrink as pools expand. Guests do not alter the story campaign.

## Art status and provenance

All seventeen new illustrations are AI-generated, guided by the game's existing fine-lined anime artwork. Each has its own palette, clothing and club-specific props. No third-party sprite or illustration files were scraped or copied. The UR characters are fan crossover characters belonging to their respective rights holders, not original academy IP; no license to those characters is claimed. Review permissions before commercial distribution.

Rook, Morrow, Quill, Brass, Lumi, Altria and Alice received a follow-up redraw using the supplied Arknights references directly, targeting thinner contours, angular facial construction, textured painterly detail and preserved character-specific colors.

All 17 recruits now have shipped splash illustrations referenced by runtime data, including the generated Saber and Alice fan crossover illustrations. No expansion illustration slots are pending.

## Battle model refinement

All seventeen expansion recruits now use separately illustrated, detailed pixel-art battle figures rather than the coarse shared template. Their outfits and weapons use their splash illustrations as identity references and Ruta's original model as the rendering reference. The shipped files retain their existing paths, so battle, roster, avatars and pull results all receive the upgrade without gameplay changes.

The second model batch completed Pip, Mira, Quill, Brass, Lumi, Altria and Alice. No expansion battle models or splash illustrations remain pending.

`recruits.json` records `modelStyle` for each recruit. `scripts/gen-roster-sprites.py` now skips illustrated models so running the legacy template tool cannot overwrite the finished artwork.

Raw chroma-green generated sources live in ignored `art-src/models/`. Clean them with Pillow installed:

```sh
python scripts/prepare-roster-models.py aster vesper maribel cobalt octavia flint seraphine rook morrow
python scripts/prepare-roster-models.py tala --rotate 35
python scripts/prepare-roster-models.py pip mira quill brass lumi altria alice
```

Tala's broad lance pose is rotated into a diagonal action pose without stretching her body. The preparation tool removes background and green spill, keeps transparent holes in weapons, quantizes crisp pixel clusters, and aligns figures to the story roster's 861×1000 canvas and baseline. Only cleaned transparent models in `public/images/` ship. Originals are working files and are not required to render the game.

The model refinement does not introduce 3D meshes or skeletal rigs; these are detailed 2D PNG figures like the original cast, animated by the existing battle choreography. Tests cover asset integrity, transparency, matching battle scale, and all recruits' gameplay integration.

## Transparent illustration mattes

Fourteen illustrations with white exterior mattes now use alpha WebP assets. Runtime references and the recruit manifest point at these new URLs, avoiding browsers' cached opaque JPEGs. `transparency.json` records the converted IDs. Original JPEGs remain available as editing sources. Painted scenery and enclosed white fabric/hair are intentionally preserved rather than deleting every pale pixel.

Rebuild with Pillow, NumPy and SciPy installed:

```sh
python scripts/remove-keyart-mattes.py
```

The tool removes only white regions connected to the image boundary and de-mattes a narrow fringe to reduce white halos. Full painted scenes without a white matte remain unchanged.
