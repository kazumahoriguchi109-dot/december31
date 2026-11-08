# Evolution prototype assets

The evolution journey is now the public game entry point. Earlier cycle notes below describe its asset history.

- `sceneArt.ts`: original procedural geometry, snow texture, and pixel actor frames written for this project. No Evoland artwork, characters, sounds, maps, or text was imported.
- `renderer.ts`: original environment layout and puzzle presentation. Uses the project's existing `render/winterAssets.ts` procedural models.
- `audio.ts`: original synthesized ambience and interaction/footstep sounds. No third-party recordings were added. Signal-level checks are documented separately; listening quality remains unverified.
- Title art and dialogue portraits reuse the existing project's assets. Their provenance remains in the existing asset manifests/handoff; no new claim of third-party licensing is made here.

Evoland and Evoland 2 are references for the idea that movement, interaction, and representation can evolve. This prototype preserves the original December 31 story, two children, no combat, six cooperative puzzles, and return home.

Cycle003 adds original `actorArt.ts` pixel frames and procedural wardrobe details using the existing project models, and `acting.ts` rig poses. River texture, snowbanks, control rods and mill lighting are generated in project code. No new third-party recording or Evoland asset was imported.

November 7 material integration: the title and neutral dialogue use the owner's prepared winter material kit, with provenance/limits in `../../assets/art/SOURCES.md`. Non-neutral dialogue still uses the existing expressive SVGs. The live scene, actor rigs, pixel animation and puzzle geometry are unchanged.


## Cycle 012: winter scenery and coherent dialogue (2026-11-07)

The four existing world eras now have distinct paper-frame treatments. A generated 4 × 2 dialogue atlas keeps the protagonist and Toto in one painted style for neutral, questioning, surprised and relieved lines; see `assets/art/SOURCES.md`. The title retains the original full-body material images. All character motion and expression semantics remain unchanged.

Winter scenery is authored in `sceneArt.ts`: deterministic cool snow texture, shared instanced snow boughs and sparse bare branches, snow-capped rails, and warm lamp pools. This is a controlled approximation of the winter reference palette, not a replacement of navigable puzzle geometry. The state model, save format, camera formulas and optical apparatus remain unchanged. Buildings, distant scenery, path edges and generated-question expression softness still differ from the reference art.

`tests/visual/` contains local-only UI fixtures. They are not the game and are not production entry points. These captures cannot substitute for the normal-input whole-journey test.

The cycle also fixes an existing visibility problem: before discovering the white wall, looking from its rear could hide both friends. Only that rear-facing wall proxy fades when a friend is immediately behind it. The staircase remains undiscovered and hidden in that view; this does not alter collision, puzzle state or the camera.

## Original monochrome snow world

`monochromeArt.ts` draws individual original snow tiles, pines, stone gate masonry,
sign, lantern, table, handwheel, portal and two directional walking actors from code.
The approved concept was visually referenced, but no screenshot or generated key visual
is painted over the game. All positions and the table rotation come from live state.
Era zero uses this view; the later color, depth and resonance views remain unchanged.
