# Wizard of Oz Head — Build Tracker

Plan: `.claude/plans/i-want-to-create-smooth-sloth.md`

## Day 1 (Oct 28): audio end to end, head look test
- [x] Scaffold: Vite multi-page, TS strict, Three.js, ws server
- [x] Head look test: A (procedural) vs B (Lee Perry-Smith), shared glow material + shader jaw
- [x] Pick head base mesh: scan (B) by default. Procedural looks like an egg-mask. Both stay selectable in the setup panel.
- [x] Voice pipeline: pitch worklet, low-shelf, reverb, compressor, setSinkId
- [x] Lip sync: envelope on dry pitched signal → jawOpen, lipWidth
- [ ] Mic shootout: AirPods Pro (ANC) vs wired — latency, self-echo, feedback

## Day 2 (Oct 29): fire, steam, motion
- [x] Fire shader + embers, intensity uniform, flare
- [x] Steam emitters + burst
- [x] Head motion: idle noise, onset nods, blinks, eye glow

## Day 3 (Oct 30): triggers, show mode
- [x] Clicker key map + last-key display
- [x] WebSocket relay + phone remote
- [x] Lightning flash + thunder (synth, wav fallback)
- [x] Auto-flare on shouts (2 s debounce)
- [x] scripts/show.sh (build, serve, Chrome kiosk)

## Day 4 (Oct 31): rehearsal
- [ ] Tune on real projector + speakers
- [ ] 30-minute soak test

## Domain rules found during the build
- The mouth follows the dry pitched signal, not the reverb tail, so it closes between words.
- AudioContext.resume() never settles without a user gesture. Cap the wait at 500 ms, then show the click overlay.
- One nod per syllable: onset fires on a rise of 0.2 over the trough (level > 0.3), then re-arms after the level falls to 60% of its peak.
- Volume goes up to 2, so a limiter sits after the master gain. Synth thunder peaked at 1.42 before the fix.
- Steam vents follow the viewport width (72% of half-width), so they stay on screen on any projector aspect ratio.
- The AudioContext is pinned to 48 kHz. Left unset, it copies the default output's rate. With AirPods as the macOS output, their headset mode makes that 24 kHz, and the speaker output went silent (reported Oct 27). Chrome resamples the 24 kHz AirPods mic into the 48 kHz context (verified with a synthetic stream).
- Silent Studio Display Speakers turned out to be a macOS per-device mute (volume 0, mute on), not the app. Its channels are fine: 8 channels, stereo pair 1,2.
- show.sh refuses to start if port 8787 is busy. Otherwise it would attach to a running dev server.

## Measurements
- Latency (AirPods):
- Latency (wired):

## Review
Built and verified on Oct 27 (ahead of schedule):
- tsc clean, vite build clean, prod server serves every asset, path traversal returns 404.
- Pitch shifter: 220 Hz in gives 157.4 Hz out at ratio 0.72 (expected 158.4). Gate silences input below threshold.
- Lip sync on a synthetic syllable train: jaw 0.07–0.54 during speech, 0 in silence, 8 onsets for 8 syllables at quiet, normal, and loud levels.
- Lightning flicker profile matches the design. Synth thunder renders a crack plus about 6 s of rumble.
- Relay: phone remote over the LAN IP sends effects. Settings sync in both directions.
- Not yet verified: real mic input, speaker output and feedback, latency by ear, real clicker key codes, the projector, kiosk launch, the 30-minute soak test.
