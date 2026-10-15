# Battlefield-first combat layout

- Combat hides the normal account/resources header and music/status footer. Other screens keep their existing chrome.
- The arena occupies 82% of the full game frame; a compact command dock uses the remaining 18%. Operation, round, initiative, Auto and Pause are overlaid on the arena instead of consuming separate rows.
- Ally HP/energy bars and numeric values sit directly beneath each model. Enemy names/HP sit beneath their models and remain clickable as part of the target unit. Duplicate dashboard vitals rows are removed.
- Selecting a command opens a readable, dismissible description above the dock without issuing an action. The collapsed dock's Inspect button only opens the description; explicit Activate is still required. Low-energy commands remain inspectable through their command buttons.
- Pause stops Auto and locks command shortcuts. The pause menu offers Resume, Combat log and Main menu. Main menu opens a separate confirmation explaining retreat, no energy refund and lost uncollected rewards. Cancel returns to Pause; confirmed exit calls the existing retreat action, and navigates home only on success.
- Four-member squads and three-hostile encounters are checked on laptop, desktop, portrait-phone and landscape-phone sizes. Model vitals stay inside the arena.

Validation: 188 unit/asset tests, TypeScript, targeted lint, and 17 scoped browser checks passed. The four layout/exit checks were also rerun with a full level-40 squad in stage 5-4. Existing database-dependent end-to-end and repository-wide lint limitations remain unchanged.

## Foot-anchor correction

Ally vitals and enemy labels are now positioned inside each model art container, absolutely anchored within six logical pixels of its bottom. They reserve no row in the team layout and have no card background, border or padding. Four viewport checks explicitly assert this parent relationship, transparent styling, foot proximity, arena coverage, and confirmed exit behavior. The screenshot showing account chrome and separate enemy/ally cards is the older layout; those elements are not part of the current combat view. The GitHub workflow reports the previous production deployment succeeded, but the live page itself could not be inspected from this environment. An already-open tab may still be running the older client until refreshed.

## Combat model scale

Combat overrides remove the old 143/165px art cap and 160px unit cap. Models now fill 140% of their team slot (145% on portrait phones), with viewport-height limits for short displays. The art keeps its 861:1000 canvas ratio; neither artwork nor stats are changed. Portrait teams retain two rows and extra outer margins so enlarged weapons stay on screen. The 82% arena / 18% command dock split is unchanged.

Transparent foot padding is offset inside the sprite rig: normal models meet the existing ground/vitals anchor at their 90% baseline, original slimes at 84%. Attack transforms remain on their existing animation layers. Browser checks cover settled sprite size, outer-edge containment, foot-bar placement, skill inspection and pause/confirmed exit at 1366×680, 1920×1080, 390×844 and 844×390.
