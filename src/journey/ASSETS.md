# Evolution prototype assets

The evolution journey is now the public game entry point. Earlier cycle notes below describe its asset history.

- `sceneArt.ts`: original procedural geometry, snow texture, and pixel actor frames written for this project. No Evoland artwork, characters, sounds, maps, or text was imported.
- `renderer.ts`: original environment layout and puzzle presentation. Uses the project's existing `render/winterAssets.ts` procedural models.
- `audio.ts`: original synthesized ambience and interaction/footstep sounds. No third-party recordings were added. Signal-level checks are documented separately; listening quality remains unverified.
- Title art and dialogue portraits reuse the existing project's assets. Their provenance remains in the existing asset manifests/handoff; no new claim of third-party licensing is made here.

Evoland and Evoland 2 are references for the idea that movement, interaction, and representation can evolve. This prototype preserves the original December 31 story, two children, no combat, six cooperative puzzles, and return home.

Cycle003 adds original `actorArt.ts` pixel frames and procedural wardrobe details using the existing project models, and `acting.ts` rig poses. River texture, snowbanks, control rods and mill lighting are generated in project code. No new third-party recording or Evoland asset was imported.

November 7 material integration: the title and neutral dialogue use the owner's prepared winter material kit, with provenance/limits in `../../assets/art/SOURCES.md`. Non-neutral dialogue still uses the existing expressive SVGs. The live scene, actor rigs, pixel animation and puzzle geometry are unchanged.
