# Character stat blocks and mixed initiative

## Character identity

Each of the 34 recruits has an explicit class and speed offset in `src/lib/character-stats.ts`. Existing kit roles remain separate so a class assignment cannot accidentally convert a custom skill into a generic heal or spell.

| Class | Purpose | Base HP | Base ATK | Base DEF | Base SPD |
| --- | --- | ---: | ---: | ---: | ---: |
| Vanguard | Tank | 1550 | 135 | 100 | 84 |
| Warrior | Balanced melee | 1250 | 180 | 65 | 101 |
| Ranger | Fast damage | 1000 | 180 | 40 | 116 |
| Arcanist | Fragile mage | 950 | 195 | 35 | 95 |
| Support | Healing / utility | 1150 | 160 | 50 | 103 |

Final base HP/ATK/DEF blend 70% class baseline with 30% the character's existing individual stat, then apply the rarity factor: R .96, SR 1.00, SSR 1.06, UR 1.10. Thus rarity helps modestly, but a high-rarity mage is not automatically tankier than a lower-rarity Vanguard. Base speed is class speed + individual offset + rarity bonus (0/1/2/3).

HP/ATK/DEF keep the existing level/potential scaling. Speed increases by one every ten levels and one per potential, rather than multiplying with level. Roster details show the four stats, class explanation, skill notes, and initiative rules; upgrades preview SPD gains as well.

## Initiative rules

- Each living ally and enemy rolls **SPD + a uniform integer from 0 to 24** each round. Ties use a separate random tie-break roll.
- One persisted mixed-side queue, descending score. Everyone gets one slot, not bonus actions for speed.
- Enemies can open the encounter or act between allies. The server automatically resolves enemy slots until the next player decision.
- Enemy speeds depend on enemy identity plus gentle campaign progression, not giant level multipliers.
- Defeated units are skipped. Stun consumes the next enemy slot. Guard lasts until the guarding ally's next action, even across round boundaries. Shields and damage-driven energy gain are unchanged.
- Revived units can use an unspent existing slot; units absent from the current queue join at the next round's roll.
- Victory/defeat stops resolution immediately. Loading/resuming never rerolls or re-applies opening damage.
- Legacy active battles retain their remaining old-round order once; new rounds roll initiative. Ally HP fractions and effects survive the stat-block migration.

The battle strip shows current/acted/dead slots, sides, SPD and initiative score. It scrolls horizontally to keep the current slot visible on phones. Enemy animations use the actual resolved slots, not the former assumption that all enemies retaliate only at a round boundary.

## Validation

- `npm test`: **176 passing**, including 300 seeded recommended-level campaign clears and initiative-specific tests for ordering, random reversals, opening attacks, once-per-round slots, deaths, stun, guard, shields, revive, defeat and legacy resume.
- `npx tsc --noEmit`: passes.
- Targeted ESLint for new helpers, component and tests: passes. Existing repository-wide hook lint issues remain outside this change.
- **13 scoped browser checks pass**: 3 battle inspection/background tests, 3 initiative/stat-block tests, 7 viewport tests. Persistence is mocked; the actual UI, renderer and engine are used.
- Legacy non-mocked `game.smoke.spec.ts` was not part of the passing scoped run; its existing login/boot expectations did not complete in this environment. Database-backed end-to-end behavior was not verified.
