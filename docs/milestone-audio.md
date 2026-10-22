# Milestone audio

The table plays four short Fish Audio voice cues for significant state changes: victory, defeat, a new villain stage, and Ironheart's suit upgrade. Ordinary actions, opening a saved mission, and undo do not play a cue. Sound is off by default; **Sound settings** in the header provides an enable checkbox and a volume slider. The initial volume is 45%, and both preferences persist in the current browser.

## Assets and provenance

The clips were generated through the connected Fish Audio text-to-speech tool on 22 October 2026 using the public **ATOMIC** voice (`4c6a6762e4ac4bdebdb4fa8525d054a2`) and `s2.1-pro`. These are spoken cues, rather than a dedicated nonverbal sound-effects model.

| Event | Spoken line | MP3 duration | Size |
| --- | --- | ---: | ---: |
| Victory | Victory! | 1.31 s | 10,760 bytes |
| Defeat | Mission failed. | 1.85 s | 15,149 bytes |
| Villain stage | New threat. | 2.14 s | 17,448 bytes |
| Ironheart upgrade | Suit upgraded. | 2.04 s | 16,612 bytes |

The four clips total **59,969 bytes**. Leading and trailing silence was trimmed, loudness normalized to -20 LUFS with a -3 dBTP target, and the result encoded as mono 44.1 kHz MP3. [The asset manifest](../public/audio/milestones/manifest.json) records each generation task, source URL, script, processed size, duration and SHA-256. The browser loads the processed files from this application; gameplay does not call Fish Audio or require a Fish credential.

## Playback contract

`significantEvent` compares a successfully dispatched command with its previous state. The UI sends each fresh event directly to the audio controller, independently of the Remotion animation and reduced-motion preference. No audio starts until the player enables sound and a pointer or keyboard gesture unlocks the browser audio context.

Only one clip can play at a time. Victory and defeat take priority over stage changes, which take priority over suit upgrades. Event IDs prevent duplicate playback; skipped or muted events are consumed and never replayed later. Undo, leaving the game, replacing a mission, signing out, hiding the page, muting, setting volume to zero and unmounting stop playback and invalidate pending decodes. Failed downloads or blocked autoplay leave gameplay usable and may recover for a later event.

## Verification

Run `npm test -- --run tests/milestone-audio.test.ts tests/milestones.test.ts` for event detection, preferences, deduplication, priority, cancellation, resource cleanup and failure recovery. The current focused suite passes **19 tests**.

Run `npm run test:audio` against a running application, or set `BASE_URL` to a deployment. The browser harness uses native game commands and preserves each original forty-card source deck. It checks actual HTTP asset bytes and manifest hashes, real Web Audio decoding and playback, controls, interruption, saved preferences, and silence for ordinary actions, undo and reload. It covers 1920, 1280, 390 and 320 px viewports, reduced motion, and normal animation playback. The frozen local run completed **27 checks, 25 accessibility audits and 25 layout checks**, with four verified assets and no browser errors. Its hidden-page listener check emulates the visibility signal because headless Chromium does not reliably background tabs; controller cancellation is also covered independently by unit tests. A final build or deployment should run the same harness again.
