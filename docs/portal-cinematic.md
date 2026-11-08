# Opening portal cinematic

The fifteen-second 1280×720 H.264/AAC MP4 uses the user-approved portal illustration. The camera and nearby figures move through two gradual inward stages with converging particles. Only the final second dissolve to dark; roughly fourteen seconds retain a visible, moving picture. This is motion illustration, not new character acting or lip-sync.

The soundtrack is original: six warm chords, a sparse bell-like melody, soft wind, and a low landing. It is synthesized at its natural pitch for fifteen seconds, not accelerated or pitch-shifted audio. The standalone MP4 includes the score. In game the muted movie and matching WebAudio PCM avoid duplicated sound. Existing ambient music fades out during the movie and returns afterward. Volume zero, hidden-tab suspension, skip cleanup, and the 900ms reduced-motion alternative remain supported.

## Reliable start and deliberate skipping

The previous eighteen-second file and natural timer were correct, but a second E press shortly after the final dialogue could dismiss the movie almost immediately. A short guard alone also allowed slower dialogue-key presses to skip it. E/Space/Enter now never skip from general focus. Escape remains an immediate, deliberate skip. The explicit skip button supports pointer/touch activation, or Tab followed by native Enter/Space activation, after the first 1.2 seconds. Double clicks cannot transfer directly into the newly displayed skip button.

Loading time does not consume the animation. The small video is fetched completely before playback. If video readiness is slow or playback is rejected, the decoded illustration starts the equivalent Canvas animation; that choice is retained rather than jumping into the middle of a late video. If neither asset is ready, a loading message remains and no animation timer runs. Video completion follows actual media time, not a wall timer that could expire while waiting for bytes.

Both the new room-puzzle entry and the previous adventure use this same cinematic. The new entry preserves unread introduction lines and a separate unfinished-movie marker; the previous entry uses completed desk dialogue as its pending-entry save marker. Reloading during the movie restarts it, while existing world saves do not replay it. After completion or deliberate skip, the world-entry action runs once.

## Rebuild and verification

Run Vite, then set `LIVE_URL` to its origin and `FFMPEG` to an installed encoder and run `node tools/render-portal-video.mjs`. The fifteen-second version is rendered from the Canvas source, not stretched from the earlier movie with its long dark ending. Review representative frames and update the exact-byte video manifest only after intentionally replacing the output.

Verification covers natural duration, rapid key presses, held repeats, double clicks, delayed media, explicit skipping, save/reload, reduced motion, sound controls, and the world transition. Audio decode and waveform checks are not a claim of human listening validation. No third-party footage, sampled audio, or music is included.

## Fifteen-second revision (2026-11-08)

Requested change: halve the previous 30-second sequence. The MP4 and original PCM score are regenerated at 15 seconds; runtime playbackRate remains 1. Note frequencies are unchanged. Chord/bell starts, durations and envelopes are arranged for the shorter form rather than resampling the former track. Motion phase is 2.5 (previously 5), preserving the total particle travel, with a one-second ending dissolve.

`LIVE_URL=<preview or public origin> node tools/test-portal-duration.mjs` launches the installed Google Chrome with a separate profile, starts both editions from a fresh game, measures the visible movie to arrival without skipping, exercises non-skip dialogue keys, then checks completion/unfinished reload, explicit skip, and reduced motion. Results and representative screenshots are written to `/tmp/portal-fifteen-qa` (or `PORTAL_QA_OUT`). The existing focused cinematic suite targets `?edition=legacy` explicitly.

Local shipped-build verification: installed Google Chrome measured 15.057 seconds from visible playback to arrival for both the new entry and the legacy adventure. Both used the MP4 at playbackRate 1; JavaScript exceptions were absent. Completed replay suppression, interrupted-new-entry resume, deliberate Escape skip, and the short reduced-motion still also passed. ffprobe reported exactly 15.000 seconds for both media streams. All 232 unit tests and content/bundle validation passed. The score peak was 0.1438, samples were finite, and both endpoints were zero; this is signal verification, not a claim of listening review.
