# Storybook dialogs

2026-11-10: The approved B parchment/storybook direction is applied to the new-game overwrite confirmation and the pause screen. The decorative SVG is original code-drawn art (paper, border, firs and winter cottage), not an image containing the interface text. All labels remain live selectable text and native buttons.

- Only `new-confirm` and `pause` are styled; character dialogue, settings, reset confirmation and game HUD are unchanged.
- New-game warning and Back / Start choices are unchanged. Back remains first in DOM and keyboard order so initial Enter cannot accidentally overwrite a save. This deliberately differs from the concept image's primary-first arrangement.
- Pause preserves Continue / Settings / Restart this puzzle / Title. Mobile uses a two-column grid; short landscape screens use compact padding.
- Existing modal semantics, inert background, Escape, focus trap, save behavior and reduced-motion behavior remain intact. Visible button keyboard focus has a contrasting ink-blue ring.

## Verification

`npm test`: 236 passed. TypeScript/build, content and bundle checks passed. Build retains the existing large-chunk warning. The old `check:static` script references absent `scripts/` files and is not used as a passing check.

`E2E_URL=http://127.0.0.1:4192 node tools/test-storybook.mjs`: Chromium, WebKit and Firefox pass. Covers creation of a real new save through UI, unchanged overwrite warning, default Enter/Back/Escape preserving that save, deliberate overwrite opening the intro, pause operations, focus wrapping, and button bounds at 390×844, 320×568 and 640×360. Screenshots in `/tmp/storybook-qa` on the test machine. Chromium desktop and 320px screenshots visually inspected. These are local engine tests, not real iPhone/Safari device tests or a fresh complete puzzle playthrough.
