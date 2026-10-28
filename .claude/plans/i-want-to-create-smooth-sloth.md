# Wizard of Oz Floating Head — Plan

## Context

A Halloween party on **Oct 31, 2026** needs a projected Great Oz: a glowing green head over a fire, with steam venting on both sides. A performer hides in the same room and speaks into a mic. The app deepens the voice, adds a booming reverb, and plays it through the room speakers. The head's jaw and lips follow that processed voice. A presentation clicker and a phone remote trigger a fire flare, a steam burst, and lightning with thunder.

The folder is empty. This is a greenfield build with four days of runway, so every choice below favors reliability over polish.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Stack | Local web app: Vite + TypeScript + Three.js + Web Audio. A Node server relays commands. Chrome in kiosk mode drives the projector. No Electron for now. |
| Head | Stylized 3D, built in code. The day-1 look test picks the base mesh (see Step 2). |
| Voice | Mic → pitch down → bass boost → large-hall reverb → compressor → speakers. |
| Lip sync | Driven by the processed *dry* signal, so mouth and sound stay in sync. The reverb tail must not keep the mouth moving. |
| Mic | Any input device. Test AirPods Pro with ANC against a wired/USB mic on day 1. |
| Triggers | Presentation clicker (keys configurable) and phone remote over venue Wi-Fi. |
| Effects | Fire flare, steam burst, lightning flash + thunder. Loud shouts also auto-flare the fire. |
| Display | Projector. Pure black background, fullscreen, no cursor. |
| Mute | None. The mic is always live. |

## Architecture

```
[Mic] → getUserMedia → AudioWorklet pitch shifter (+ noise gate)
        ├→ AnalyserNode → lipsync envelope → head jaw/lips, auto-flare
        └→ low-shelf → Convolver reverb (wet/dry) → Compressor → setSinkId(speakers)

[Clicker keys] ─┐
[Phone remote] ─┴→ WebSocket server (Node) → display page → effect commands
```

## File layout

```
package.json            vite, three, ws, tsx, typescript
vite.config.ts          multi-page build: index.html (display), remote.html (phone)
server/server.ts        serves dist/, WebSocket relay, prints LAN + .local URL
index.html / remote.html
src/config.ts           key map, pitch ratio, reverb length, thresholds, colors
src/control/commands.ts shared command types: fire | steam | lightning | settings
src/control/input.ts    keyboard map + WebSocket client (auto-reconnect)
src/audio/voice.ts      audio graph, device selection, setSinkId
src/audio/pitch-worklet.ts  granular two-tap delay-line pitch shifter + gate
src/audio/lipsync.ts    RMS + band ratio → jawOpen, lipWidth, onset events
src/audio/thunder.ts    synthesized thunder (noise + filtered envelopes)
src/display/main.ts     start overlay (audio gesture + fullscreen), render loop
src/display/scene.ts    renderer, camera, EffectComposer + UnrealBloomPass
src/display/head.ts     mesh, glow material, vertex-shader jaw, motion, blinks
src/display/fire.ts     fbm noise shader plane + ember particles
src/display/steam.ts    soft-sprite particle emitters, left and right
src/display/lightning.ts screen flash + light spike, calls thunder
src/display/setup-panel.ts  hidden panel (key S): devices, tuning, FPS, last key
src/remote/main.ts      big buttons + volume and fire-level sliders
scripts/show.sh         build, start server, launch Chrome --kiosk
```

## Steps

### Day 1 (Oct 28): audio end to end, plus the head look test

1. **Scaffold.** Set up Vite multi-page, TypeScript strict, Three.js, and `server/server.ts` with `ws`.
2. **Head look test (decision gate).** Build two candidates. Both use the same glow material and vertex-shader jaw.
   - **A. Procedural:** deform a sphere in code to make a tall bald cranium, heavy brow, deep eye sockets, cheekbones, and chin.
   - **B. Lee Perry-Smith scan:** use the bald head scan that ships with Three.js (`examples/models/gltf/LeePerrySmith/LeePerrySmith.glb`, CC BY 3.0, so verify the license and credit it). Tint and stylize it.
   - **Jaw:** rotate vertices below the mouth line around an ear-level hinge, with a smooth weight falloff. Add a dark mouth-cavity mesh behind it. Add width scaling for lip shape.
   - **Material:** green emissive base, Fresnel rim glow, slight translucency and flicker for the "projected in smoke" look, bloom on top.
   - **Pick one by end of day.** My recommendation is B if A looks like a lumpy egg. Hand-sculpting a face in code is the biggest risk to the deadline.
3. **Voice pipeline.**
   - Turn off `echoCancellation`, `noiseSuppression` and `autoGainControl` so Chrome does not mangle the voice.
   - Use a pitch ratio of about 0.72. Build the reverb from a synthesized impulse: decaying noise, about 3 s.
   - Pick input and output devices in the setup panel and save them to localStorage. Route output with `AudioContext.setSinkId`, so AirPods input does not pull output onto the AirPods.
4. **Lip sync.** Run an envelope follower on the dry pitched signal (attack about 30 ms, release about 80 ms) and map it to `jawOpen`. Map the ratio of high-band to low-band energy to `lipWidth`.
5. **Mic shootout.** Test AirPods Pro (ANC on) against a wired mic. Judge latency, self-echo disruption and speaker feedback at show volume.

### Day 2 (Oct 29): fire, steam, motion

6. **Fire.** Use an fbm-noise shader on a billboard below the head, with additive blending and an `intensity` uniform that controls height and brightness. Add ember particles.
7. **Steam.** Add two emitters with soft procedural sprites, upward drift and turbulence. A `burst()` call raises emission for about 1 s.
8. **Head motion.**
   - Idle: layered noise drives yaw (±20°), pitch (±8°) and a slight roll, with a slow bob.
   - Voice: syllable onsets add nod impulses through a spring. Louder speech means more motion.
   - Blink every 3–6 s at random. The eyes glow brighter on loud speech.

### Day 3 (Oct 30): triggers and show mode

9. **Clicker.** Default map: PageDown → fire flare, PageUp → steam burst, `b`/`.` → lightning. The setup panel shows the last key pressed, so we can map the real clicker. Chrome `--kiosk` keeps the clicker's Esc button from exiting fullscreen.
10. **WebSocket relay and phone remote.** The server broadcasts commands to the display. The remote has buttons for Fire, Steam and Lightning, plus sliders for master volume and base fire level. Its URL is `http://<mac>.local:8787/remote.html`.
11. **Lightning.** Two or three white flickers on a full-screen overlay, a matching light spike on the head, and synthesized thunder (a crack followed by a low-passed rumble) on the speaker output. If `public/sfx/thunder.wav` exists, play it instead.
12. **Auto-flare.** When the envelope crosses the shout threshold, trigger a fire flare, with a 2 s debounce.
13. **`scripts/show.sh`.** Builds, starts the server, and opens Chrome in kiosk mode on the projector display.

### Day 4 (Oct 31): on-site rehearsal

14. Tune pitch, reverb, gate, volume and head scale/position on the real projector and speakers. Run a 30-minute soak test.

## Verification

- `npx tsc --noEmit` is clean.
- **Audio:** speak into the chosen mic and confirm a deep, booming voice from the speakers. The jaw should open on syllables and close in the gaps, with no chatter during the reverb tail.
- **Latency:** clap test by ear for each mic. Record the result in `tasks/todo.md`.
- **Feedback:** run at show volume with the mic at a realistic distance from the speakers. Expect no howl.
- **Triggers:** each clicker button and each phone button fires its effect. The display reconnects if the server restarts.
- **Auto-flare:** a shout flares the fire, and normal speech does not.
- **Soak:** 30 minutes in kiosk mode. FPS stays at about 60 and memory is flat in Chrome's performance monitor.
- **Projector:** the background is true black, with no visible frame edges or cursor.

## Task tracking

After approval, copy these steps to `tasks/todo.md` as checkboxes. Add any domain rules that surface during the build there, and finish with a short review section.

## Open gaps and guesses

- **Head base mesh** (A or B) is undecided until the day-1 look test.
- **Mic choice** is undecided until the day-1 shootout. Self-echo of about 200 ms on AirPods may disrupt the performer.
- **Idle motion style** is my guess: autonomous noise plus voice-driven nods. Nobody specified it.
- **Eye treatment** is a guess: dark sockets, glowing irises, blinks.
- **Synthesized thunder** may sound thin. The fallback is a CC0 sample that you drop into `public/sfx/`.
- **Pitch shifter quality:** a granular shifter adds some warble. The monster voice should hide it. If it doesn't, switch to a phase-vocoder worklet.
- **Clicker key codes** are assumed until we see the real device.
- **Venue Wi-Fi** may block device-to-device traffic (client isolation). If it does, the Mac joins a phone hotspot.
