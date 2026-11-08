# Adopted winter materials · 2026-11-07

These three images were supplied in the owner's generated December 31 material kit and selected for this update. They are not Evoland artwork. The original files are copied unchanged and their exact SHA-256 hashes are recorded in `approved-local-images.json`.

- `backgrounds/snow-path.png`: winter-path concept, used as decorative title artwork only. It is not a navigable map or a puzzle surface.
- `characters/player-neutral-v1.png`: generated protagonist cutout, used on the title.
- `characters/toto-neutral-v1.png`: generated Toto cutout, used on the title.
- `ui/icons/pause.svg`: code-native icon from the same kit, retained for reference; the current interface uses text for pause.

The owner requested incorporating the prepared materials and updating this game. The supplied kit does not identify a precise image-generation model or historical terms version, and this file does not assert exclusive copyright or guarantee non-infringement. No third-party image pack was downloaded for this update.

Cycle 012 adds `characters/dialogue-expressions-v2.png`, a 4-column × 2-row transparent atlas generated with the built-in image tool on 2026-11-07 from the two owner-provided neutral cutouts and the character design sheet. Top row is the protagonist, bottom row is Toto; columns are neutral, curious/questioning, surprised, relieved. All dialogue expressions now use this same painted atlas. The image is copied unchanged; the UI selects the correct cell with a CSS viewport. This is a new generated derivative, not an exact original painting or a claim of pixel-perfect identity. The live 2D/3D actors retain their separate expressions and gestures.

The generation brief required the same faces, hair, gold hairclip, terracotta/cream coat, olive coat and red scarf, eight equal chest-up crops, correctly distinguished emotions, matching scale, no text, no cell borders, and transparent silhouettes. The exact output hash is recorded in `approved-local-images.json`. No external artist asset or character was imported.

The scenery pass uses original code-native geometry/textures inspired by the owner's winter concept palette. Navigable positions and optical puzzle geometry are preserved.

The raw images add about 8.1 MiB before HTTP compression, including the approximately 2 MiB expression atlas. They retain the original pixels; responsive image variants remain future work. Do not describe this integration as a pixel-perfect recreation of all 30 concept sheets.

## Interactive title-screen redesign

`backgrounds/title-winter-v1.png` is an original generated winter key visual created with the built-in image tool for this title-screen request. The two friends, snowy path and warm lamps frame a quiet center reserved for live title text and menu controls. It is 1672 × 941 pixels, copied unchanged from the generated output; its exact hash is in `approved-local-images.json`.

The supplied classic-RPG screenshot is used only to understand the centered logo and vertically stacked menu layout. None of its logo, characters, imagery or text is included in the game assets. The date title is rendered as the game's own live HTML/CSS design. The former winter title image and full-body cutouts remain preserved in the repository but are no longer imported by this title. Dialogue and gameplay assets remain those of the published base 7718690; the separate unpublished snow/character candidate is not part of this change.

Current title/dialogue raster imports total approximately 3.84 MiB before HTTP compression (the new title image plus the retained v2 dialogue atlas). Earlier images remain as source history, not current title downloads.

## Title background loop · 2026-11-08

`backgrounds/title-winter-loop.mp4` is a deterministic cinemagraph made locally from the unchanged approved `title-winter-v1.png`. It adds code-drawn falling snow and subtle periodic warm lamp glow; it is not a newly generated Sora scene or character animation. No new external image, audio or video material was used. The live HTML title and menu are not baked into the video.

The renderer is `tools/render-title-loop.mjs` (Playwright canvas plus an installed FFmpeg). Output: 1280 × 720, 24 fps, 12 seconds, H.264/yuv420p, no audio, fast-start MP4. All animation functions have a 12-second period; the renderer checks exact equality of unencoded frames at t=0 and t=12. The last encoded frame is t=11.9583, so the wrap advances by one normal frame rather than holding a duplicated endpoint. The reviewed output hash is recorded in `approved-video.json`.

The original still remains the immediate background and failure fallback. Reduced-motion preferences and data-saving connections use the still instead of downloading the video. Playback is paused outside the title and when the page is hidden.
