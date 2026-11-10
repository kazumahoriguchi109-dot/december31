# Character continuity — project ground rule

Requested by the user on 2026-11-10 after the treasure-chest transition.

The character shown beside dialogue must match the character in the current game world. Changing screens or art eras must not introduce a different character design.

- Reuse the canonical character artwork/renderers. Do not independently regenerate or substitute dialogue faces.
- In monochrome and colour 2D worlds, derive dialogue and feedback portraits from the same `pixelActor` source used by the world. Preserve pixel edges; monochrome worlds also use monochrome portraits.
- In the furnished room and 3D world, retain the existing approved portrait atlas. Preserve each character's identity: protagonist's longer hair, pale collar and amber clip; Toto's shorter hair and asymmetric red scarf.
- Expressions can change, but hair, clothing, identity and era must remain consistent. Check both characters, not only the active character.
- Check the chest → 2D transition, subsequent era transitions, ordinary feedback, actor switching and saved-game resume. The location and dialogue layout can remain unchanged.
- This rule does not authorize replacing approved artwork or changing game mechanics. New art requires a separate design decision.

Implementation: `src/evolution/characterPortrait.ts` uses the world actor's original texture and crops its face/collar pixels for 2D UI. It caches results and releases temporary Three.js resources. The room retains its existing atlas.

## Verification for this change

- Build / TypeScript, 236 unit tests, content check and bundle check passed.
- Isolated installed-Chrome regression passed: unchanged room portrait, actual treasure chest → monochrome conversation, exact crop equality with world pixels for both characters × two 2D eras × four expressions, save/resume and 3D character switching.
- Screenshots inspected at 1280×820 and 390×844; automated bounds also checked at 640×360. These are browser viewports, not physical-device testing.
- Existing restored-art regression passed (opening/resume, held input, drag, portal skip guard and controls in three viewport sizes).
