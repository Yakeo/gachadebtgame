# Character stat blocks and mixed initiative

## Character identity

Each of the 44 recruits has an explicit class and speed offset in `src/lib/character-stats.ts`. Existing kit roles remain separate so a class assignment cannot accidentally convert a custom skill into a generic heal or spell.

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

- Each living ally and enemy rolls **SPD + a D20 (uniform integer from 1 to 20)** each round. Ties use a separate random tie-break roll.
- One persisted mixed-side queue, descending score. Everyone gets one slot, not bonus actions for speed.
- Enemies can open the encounter or act between allies. The server automatically resolves enemy slots until the next player decision.
- Enemy speeds depend on enemy identity plus gentle campaign progression, not giant level multipliers.
- Defeated units are skipped. Stun consumes the next enemy slot. Guard lasts until the guarding ally's next action, even across round boundaries. Shields and damage-driven energy gain are unchanged.
- Revived units can use an unspent existing slot; units absent from the current queue join at the next round's roll.
- Victory/defeat stops resolution immediately. Loading/resuming never rerolls or re-applies opening damage.
- Legacy active battles retain their remaining old-round order once; new rounds roll initiative. Ally HP fractions and effects survive the stat-block migration.

The battle strip shows turn positions, current/acted/dead slots, sides, SPD, each persisted D20 result and total initiative score. Waiting units show how many slots remain before their turn. New encounters play one 650ms animated D20 flourish before commands unlock (100ms, no dice motion, with Reduced Motion). Later rounds reroll without another opening delay. These are server rolls, never client-generated cosmetic results. Older saved entries without a die field are labeled LEGACY until their next normal reroll.

The strip scrolls horizontally to keep the current slot visible on phones. Enemy animations use the actual resolved slots, not the former assumption that all enemies retaliate only at a round boundary.

## Validation

- `npm test`: **200 passing**, including 300 seeded recommended-level campaign clears and initiative-specific tests for ordering, random reversals, opening attacks, once-per-round slots, deaths, stun, guard, shields, revive, defeat and legacy resume.
- `npx tsc --noEmit`: passes.
- Targeted ESLint for new helpers, component and tests: passes. Existing repository-wide hook lint issues remain outside this change.
- **9 scoped browser checks pass**: 2 loading-background/D20 timing checks, 3 initiative/stat-block checks, and 4 battlefield layout/pause checks. Persistence is mocked; the actual UI, renderer and engine are used.
- Legacy non-mocked `game.smoke.spec.ts` was not part of the passing scoped run; its existing login/boot expectations did not complete in this environment. Database-backed end-to-end behavior was not verified.

## Loading art refresh

`public/images/loading-campus.jpg` is an original generated anime campus environment: bright cyan skies, sunlit white academy architecture, pools and greenery, not pixel art. Loading-only styles retain its saturation and brightness, with localized translucent backing for legible text. Title/login and campaign art are unchanged.
