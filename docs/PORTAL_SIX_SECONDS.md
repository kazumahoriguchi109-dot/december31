# Six-second portal revision (2026-11-10)

Request: make entry into the game world approximately six seconds, strengthen the swirling pull, and add a suction/whoosh sound.

- Re-rendered the approved illustration at 30 unique frames per second, 1280×720, six seconds; no sped-up old clip or pitch-shifted soundtrack.
- Local spiral deformation, inward light trails, and an accelerating central pull preserve the outer scene rather than spinning the entire viewport.
- Original six-second synthesized score, rising filtered-air sound, and a descending pitched “hyun” near the final pull. The MP4 includes the soundtrack for standalone playback; the game keeps its video muted and plays the same sound through the existing volume-controlled WebAudio bus.
- Existing short reduced-motion still transition, skip guard, background pause, save/resume and fallback remain intact. No save schema or puzzle changes.

## Verification

- 236 unit tests passed; TypeScript/build, content and distribution-asset checks passed.
- Production build, installed Chrome isolated profile: new and legacy entrances both measured 6.0643 seconds, video duration 6, playback rate 1.
- Running WebAudio source observed in both entrances: duration 6, nonzero peak 0.2164 before master gain. This is an integration check, not human listening validation.
- Completed resume does not replay the movie; interrupted resume and deliberate Escape skip passed; reduced-motion transition passed (1.289 seconds including startup).
- Rendered midpoint visually inspected. All 11 existing portal Chromium regression cases passed: load rejection, late response, stuck playback promise, keyboard/double-tap guards, deliberate skip, reduced motion, reload and normal completion.
- Not verified by human listening or on an actual iPhone. Static aggregate script is not used because this checkout lacks its referenced scripts; no claim that it passed.

Reproduce: npm run dev -- --port 5196; LIVE_URL=http://127.0.0.1:5196 FFMPEG=/path/to/ffmpeg node tools/render-portal-video.mjs. Update the reviewed binary hash, build, then run LIVE_URL=http://127.0.0.1:4196/ node tools/test-portal-duration.mjs against the preview server.
