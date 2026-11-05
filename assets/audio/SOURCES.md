# Audio provenance — 2026-11-05

The score, solve/cue/line effects and fallback effects are original Web Audio synthesis in `src/audio/mixer.ts`. The four era arrangements are preserved.

Three unmodified WAV files from Kenney Interface Sounds 1.0 are now used for tactile interface feedback:

| Runtime file | Original file | Use |
|---|---|---|
| src/audio/samples/press.wav | click_003.wav | interaction |
| src/audio/samples/move.wav | select_002.wav | moving between anchors |
| src/audio/samples/deny.wav | error_004.wav | unavailable action |

Author: Kenney, 2020. License: CC0 1.0 Universal. Original asset page: https://kenney.nl/assets/interface-sounds (explicit CC0 label checked 2026-11-05). The source repository and addon license notices are retained verbatim in KENNEY-CC0.txt and KENNEY-ORIGINAL.txt. These are the author’s CC0 notices, not the complete legal code; the notices link https://creativecommons.org/publicdomain/zero/1.0/ .

Official ZIP request returned HTTP 403. Bytes obtained from the documented WAV conversion at https://github.com/Calinou/kenney-interface-sounds , commit `4596a49eaf5a533948d49a47467f606bcdea70ff`. This repository links the official asset page and supplies both copies of the CC0 notice. No individual exception is listed for the selected sounds. Conversion source: Calinou; source README describes Ogg Vorbis → WAV conversion. Only selected files ship. The source checkout stays ignored locally, not in dist.

Runtime gain: press/move .28, deny .20, then the existing effect and master buses. Original WAVs are not destructively normalized. Loading and decoding begin only after user interaction. Failure falls back to the original synth effects. Repeated live instances of the same sampled effect stop the prior instance.

Other researched candidates: Kenney Impact Sounds https://kenney.nl/assets/impact-sounds (CC0, not used). No downloaded music or third-party melody is included. No subscription or paid license was used.

Automated checks measure decoding, audibility, clipping, muting and transitions. They do not establish subjective quality or listening comfort; see cycle-012 and the audition controls in tools/art/gallery.html.
