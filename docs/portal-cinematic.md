# Opening portal cinematic

The eighteen-second 1280×720 H.264/AAC MP4 animates the user-approved portal illustration (`assets/cinematic/portal-opening.png`). It is an original motion-illustration treatment: a continuous inward texture warp, converging pixel streams, gradual desaturation and a single dark dissolve. It is not new character acting or generated lip-sync. No downloaded stock footage, sound sample, or music was used.

The motion is three times slower than the first six-second version. The eighteen-second soundtrack is an original deterministic four-chord score and a sparse bell-like melody, with soft wind and a low landing. It is newly synthesized at natural pitch, not a slowed recording. The standalone MP4 contains that track. In game, video stays muted and the matching WebAudio effect goes through the existing volume control; muted video avoids doubling the sound. The existing ambient music fades down during the cinematic and returns after it, avoiding two scores playing at once. Hidden tabs suspend audio and visual time. Skip stops the effect. Reduced-motion mode (the game's preference or the OS setting) uses a 0.9-second still dissolve without the wind sequence.

The cinematic occurs after the desk line “うわっ！” and before the first world-arrival line. It does not advance gameplay until completion/skip. The already saved completed desk dialogue is the resume marker: a reload during the movie starts it again, without losing progress or replaying earlier dialogue. Existing world saves do not replay it. E, Escape, Space, Enter, and the focused skip button skip once. Keyboard focus is contained in the cinematic and restored to the game after entry.

Video load or playback failure falls back to the same Canvas animation. No external URLs, analytics, or playback dependencies are required. Rendering tools are development-only and not bundled.

## Rebuild

Run a local Vite development server, then set `LIVE_URL` to its origin and `FFMPEG` to an installed FFmpeg executable and run `node tools/render-portal-video.mjs`. For the approved original six-second picture track, an optional `PORTAL_SOURCE_VIDEO` reuses and stretches only its video; it never reuses the old audio. The Canvas fallback and video render both use the same threefold motion scale.

The tool writes `assets/cinematic/portal-opening.mp4` and `/tmp/portal-original-soundtrack.wav`. Review representative frames and update the exact-byte approved media manifest after intentionally changing either source or render.

Verification includes unit save-marker tests, browser natural completion, reload during playback, skip/idempotence, no replay after arrival, and OS reduced motion. Audio waveform validation does not constitute human listening validation.
