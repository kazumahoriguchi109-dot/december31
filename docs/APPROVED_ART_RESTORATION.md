# Approved visual continuity restoration

## Scope
The evolving puzzle route had replaced the previously established warm room, winter-clothed characters, and portrait dialogue with a generic modal and simplified figures. Restore visual continuity without reverting the six-room puzzle structure.

- Reuse the existing `roomArt`, `actorArt`, and `materialPortrait` assets and renderers. No new external art or uploaded reference screenshot is included.
- Show the furnished room during the opening and return ending. Reuse the original winter character rigs in 3D and directional pixel actors in monochrome/color rooms.
- Restore bottom dialogue panels, cream nameplates, portraits, gold outlines, and the location pill. Preserve the approved title and confirmation stacking.
- Keep all puzzle coordinates, state transitions, cooperative roles, save keys/schema, and the 15-second portal sequence unchanged.
- Support keyboard/dialogue taps while rejecting held-key repeats, dragged gestures, and the input that entered the movie as a skip.

The new puzzle rooms retain their grid-based layouts. This change restores established art and presentation; it does not recreate the legacy route's full outdoor environments.

## Verification
- 236 unit tests across 27 files passed; TypeScript/Vite build and content/bundle checks passed.
- Installed Chrome: all six puzzles completed using UI input, ending and resume verified, no JavaScript exceptions.
- Added `tools/test-restored-art.mjs`: portrait loading, opening resume, keyboard holds, outward-and-returning drags, cinematic skip guard, room/world transition, and 1280×820 / 390×844 / 640×360 layouts.
- Independent review confirmed title/settings/restart/resume, approved asset reuse, mobile layout, and new/legacy portal duration (15.063 / 15.052 seconds), interruption, intentional skip, and reduced motion.
- Independent review caught a zero-height canvas at 640×360 and a returning drag advancing dialogue. Both fixed and rechecked. Compact landscape preserves controls with a smaller 156-pixel world viewport.
