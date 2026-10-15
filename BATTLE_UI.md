# Battle command inspection and chapter scenery

- Selecting Attack, Skill, Guard, or Ultimate previews it without issuing an action. The inspector shows the character's own skill/ultimate notes, energy cost or gain, target category, selected enemy where applicable, and readiness.
- Only Activate spends a turn. Unaffordable skills remain inspectable; activation respects energy and animation locks. Inspecting a command pauses Auto; Auto itself keeps its existing action policy.
- Keyboard: 1–4 inspect; Enter activates when focus is not already on another button. Normal button keyboard behavior is preserved. Touch uses the same select-then-activate flow.
- Chapter artwork is now five painted anime environments: academy courtyard, underground west-wing lab, stained-glass chapel, corporate headquarters, and reactor core. New `*-anime.jpg` URLs avoid stale cached pixel backgrounds. Battlefield rendering uses smooth image interpolation and lighter overlays.
- `tests/battle-commands.test.ts` checks descriptions, costs, special-kit targets, and the five distinct JPEG assets. `tests/battle-ui.smoke.spec.ts` checks desktop/mobile preview-before-action and actual rendering of every chapter background, mocking persistence only.

Validation: 162 unit/asset tests and 10 browser smoke tests passed; TypeScript and targeted lint for the new components/helpers/tests passed. Existing repository-wide hook lint issues remain outside this change.
