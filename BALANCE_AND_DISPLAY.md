# Campaign pacing and display sizing

## Campaign balance

The five chapters now require an **equipped squad average** of LV **1, 7, 15, 23, 31** respectively for new clears. This is not a per-character or rarity gate: a veteran can carry a new recruit. Previously cleared operations remain replayable at any level, and existing active battles can resume. Rejected starts do not spend energy.

Stage recommendations increase from LV 1 to LV 39 across 25 operations; chapter bosses recommend 7, 15, 23, 31 and 39. Recommendations exceed the entry floors so players can try difficult fights early without being forced to max every recruit. Levels 40–50 and potentials provide additional headroom.

Enemy attack grows from 75 at the opening to 803 at the finale (roughly 42% above the former finale), with the original rising defense and normal HP curve retained. Bosses use 2.4× normal HP. The old 1.5M/5M boss HP overrides and the accompanying hidden 1000×/2500× damage multiplier are removed together: crossing 10,000 HP no longer changes the damage rules. Older active battles migrate once while preserving enemy health ratios and statuses.

Credits now scale with operation index `w` (1–25):

- First clear: `1,500 + 1,400w` credits, plus the unchanged 200 gems.
- Replay: `600 + 400w` credits; no repeat first-clear gems.

The map, victory panel and authoritative reward action all use the same helper. All first clears provide 492,500 credits, in addition to starting credits and missions. This supports substantial four-person training, while late-game recommended levels still benefit from occasional replays. Pull rates, gem costs, level prices, energy costs and regeneration are unchanged.

Validation includes 300 deterministic full encounters (25 stages × 6 seeds × an all-SR and an SSR team), at recommended levels with zero potentials and sensible healing/skill use. These are viability checks, not a guarantee that every team or auto-battle strategy wins. Under-level entry, replay access, rewards, old-save migration and damage continuity have independent tests.

## Display behavior

`GameViewport` observes available CSS-pixel space. Desktop layouts fit a logical 1440×810 composition, scaling up for high-resolution screens (up to 2.5×) and down for smaller laptops. Ultrawide screens use the extra width. Phone layouts remain unscaled for touch readability. Device pixel ratio and pinch-zoom scale are not used.

The app owns the dynamic viewport height; the document does not scroll. The home menu fits tested desktop viewports and taller portrait phones. Long lists, story text and shorter phone layouts retain **internal scrolling** so content and controls remain reachable. Fixed dialogs are contained in the game frame and their maximum height uses the frame's logical dimensions.

The previously referenced font files were absent. Barlow/Barlow Condensed are now shipped locally as WOFF2 with their SIL Open Font License notices, avoiding fallback metrics and external font requests.

Tests:

```sh
npm test
npm run typecheck
# With the app running and a Playwright Chromium installation:
npx playwright test tests/viewport.smoke.spec.ts
```

The viewport browser checks mock persistence only (no database required), covering 1024×600, 1366×768, 1920×1080, 3840×2160, 1920×720, 390×844 and 844×390, including modal bounds and reachable home controls.
