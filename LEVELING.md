# Bulk character leveling

In Characters, select an owned recruit, then drag **Levels to add**, use **− / +**, or select **MAX** to choose the number of affordable levels. The panel shows the target level, HP/ATK/DEF gains, credits available and total cost before confirmation. Selection resets when changing characters and clamps when the budget changes.

The level cap remains 50. Prices are unchanged: gaining a level at current level L costs `200 × L` credits. Buying N levels costs the sum of each intervening level, not a discounted flat price:

`200 × N × (2L + N − 1) / 2`

For example, levels 1 → 4 cost `200 + 400 + 600 = 1,200` credits.

`src/lib/leveling.ts` supplies both client pricing and authoritative server validation. The upgrade action accepts `{ action: "upgrade", id, levels: N }`. Omitting `levels` retains the existing single-level behavior. Malformed counts, over-cap requests and insufficient balances are rejected before credit deduction. Database save locking continues to make the operation atomic.

Run `npm test` for pricing, affordability, input-validation and gameplay regression tests.
