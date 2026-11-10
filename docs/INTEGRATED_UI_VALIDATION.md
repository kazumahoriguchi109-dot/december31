# Integrated game update verification — 2026-11-10

Integrated portal-six-seconds, character consistency, fixed later puzzle dimensions, and storybook start/pause dialogs from the published c359e6f baseline. The main.ts merge explicitly retains both shared character portraits and old-room movement restrictions.

## Passed on the final combined code
- 239 unit tests; TypeScript and Vite production build; content and bundle checks.
- Installed Google Chrome: production-build normal-input journey through all six puzzles, return, ending save resume, pause freezing, later-room fixed3D and stable camera assertions. Zero page exceptions. No save state was injected to bypass puzzles.
- Chrome: new and legacy portal natural completion at 6.0554 / 6.0524 seconds, playback rate 1. The six-second non-silent WebAudio source ran; skip/interruption/failure/resume checks passed.
- Chromium/WebKit/Firefox: storybook confirmation/pause semantics, default Back / Escape preserving save, deliberate overwrite, settings/restart, focus loop, 320/390/640px viewport bounds.
- Chrome development build: all 16 pixel portrait crops match world actor textures, chest transition, character switch and resume.
- Chrome production build: approved room art, unread dialogue resume, drag/held-key protection, movie guard and three viewport sizes.
- Screenshots reviewed for parchment pause, 320px overwrite dialog, and 390px first pixel-world portrait.

## Limits
Automated sound-source verification is not human listening. Responsive browser viewports are not actual iPhone/Safari hardware tests. The existing large-chunk Vite warning remains. The historical check:static command references missing scripts and is not counted as passed. Existing legacy test suites are not the current evolving entry point's acceptance suite.

Local evidence: /tmp/integrated-{journey,portal,storybook,portraits,art} on the verification Mac. Browser checks use isolated profiles, preserving the user's saves.
