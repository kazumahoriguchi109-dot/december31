# Opening portal cinematic

The thirty-second 1280×720 H.264/AAC MP4 uses the user-approved portal illustration. The camera and nearby figures move through two gradual inward stages with converging particles. Only the final two seconds dissolve to dark; roughly twenty-eight seconds retain a visible, moving picture. This is motion illustration, not new character acting or lip-sync.

The soundtrack is original: six warm chords, a sparse bell-like melody, soft wind, and a low landing. It is synthesized at its natural pitch for thirty seconds, not slowed audio. The standalone MP4 includes the score. In game the muted movie and matching WebAudio PCM avoid duplicated sound. Existing ambient music fades out during the movie and returns afterward. Volume zero, hidden-tab suspension, skip cleanup, and the 900ms reduced-motion alternative remain supported.

## Reliable start and deliberate skipping

The previous eighteen-second file and natural timer were correct, but a second E press shortly after the final dialogue could dismiss the movie almost immediately. A short guard alone also allowed slower dialogue-key presses to skip it. E/Space/Enter now never skip from general focus. Escape remains an immediate, deliberate skip. The explicit skip button supports pointer/touch activation, or Tab followed by native Enter/Space activation, after the first 1.2 seconds. Double clicks cannot transfer directly into the newly displayed skip button.

Loading time does not consume the animation. The small video is fetched completely before playback. If video readiness is slow or playback is rejected, the decoded illustration starts the equivalent Canvas animation; that choice is retained rather than jumping into the middle of a late video. If neither asset is ready, a loading message remains and no animation timer runs. Video completion follows actual media time, not a wall timer that could expire while waiting for bytes.

Completed desk dialogue remains the pending-entry save marker. Reloading during the movie restarts it, while existing world saves do not replay it. After completion or deliberate skip, the world-entry action runs once.

## Rebuild and verification

Run Vite, then set `LIVE_URL` to its origin and `FFMPEG` to an installed encoder and run `node tools/render-portal-video.mjs`. The thirty-second version is rendered from the Canvas source, not stretched from the earlier movie with its long dark ending. Review representative frames and update the exact-byte video manifest only after intentionally replacing the output.

Verification covers natural duration, rapid key presses, held repeats, double clicks, delayed media, explicit skipping, save/reload, reduced motion, sound controls, and the world transition. Audio decode and waveform checks are not a claim of human listening validation. No third-party footage, sampled audio, or music is included.
