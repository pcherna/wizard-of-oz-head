# The Great Oz

A projected green head over a fire, with steam on both sides. A hidden performer talks into a mic. The app lowers the voice, adds a large-hall reverb, and plays it through the room speakers. The jaw follows the processed voice. A presentation clicker or a phone triggers fire flares, steam bursts, and lightning with thunder.

## Run it

Rehearse in dev mode:

```sh
npm install
npm run dev
```

Open `http://localhost:8787/` in Chrome and click once to start audio. Add `?demo` to drive the mouth with fake speech and no mic.

For the show, connect the projector and run:

```sh
WIZARD_DISPLAY_X=1920 npm run show
```

Set `WIZARD_DISPLAY_X` to any x coordinate on the projector's display, from System Settings > Displays. The script builds the app, starts the server, and opens Chrome in kiosk mode on that display. Quit with Cmd+Q. Stop `npm run dev` first, because both use port 8787.

## Controls

| Key | Action |
|---|---|
| PageDown, Right arrow, 1 | Fire flare |
| PageUp, Left arrow, 2 | Steam burst |
| `b`, `.`, 3 | Lightning and thunder |
| `s` | Setup panel |

Most presentation clickers send PageUp and PageDown. Their third button sends `b` or `.`. The setup panel shows the last key pressed. If your clicker sends something else, add the key to `KEY_MAP` in `src/config.ts`.

A loud shout also flares the fire, at most once every 2 seconds.

## Phone remote

The server prints the remote URL at startup, and the setup panel shows it too. It looks like `http://<mac-name>.local:8787/remote.html`. The phone must be on the same Wi-Fi as the Mac. If the page says "offline", the Wi-Fi probably blocks device-to-device traffic. In that case, join the Mac to the phone's hotspot.

## Setup panel

Press `s` to open it.

- **Mic and Speakers:** pick the mic and the room speakers. Always pick the speakers explicitly. If you don't, macOS can move the output onto the AirPods when they become the input.
- **Test speakers:** plays a short beep through the chosen output. If one speaker stays silent while others work, open Audio MIDI Setup and check that device's volume and Mute box. macOS keeps a separate volume for each device, and the menu-bar slider only changes the current default.
- **Pitch and Reverb:** shape the voice. Pitch 0.72 is about six semitones down.
- **Gate:** silences the mic below this level. Raise it if room noise makes the mouth twitch.
- **Mouth sensitivity:** the voice level that opens the jaw fully. Watch the meter while you speak normally. Aim for about half.
- **Head scale and height:** fit the head to the screen or scrim.
- **Shine:** strength of the glossy highlight on the head. 0 is fully matte.
- **Rim glow:** strength of the green glow around the head's outline. 0 turns it off.
- **Organ backdrop:** draws the pipe organ from the film's throne room behind the head: a stepped case of fire-lit pipes between glowing green columns. The pipes brighten when the fire flares. 0 turns it off and leaves the background black, which a scrim or Pepper's ghost needs.
- **Oz sculpt:** one slider per distortion of the Oz head: dome width, start and height, forehead ridges, brow, eye sockets, nose, cheek folds, jaw taper, chin drop, feature size and feature height. Dome start sets how low on the face the widening begins. Lower values widen the cheeks and jaw too. Feature size scales the eyes, nose and mouth together without changing the head outline, and Feature height moves them up or down. Every other slider at 0 turns its distortion off. Reset restores the defaults.

Settings save in the browser. The show profile in `.chrome-show-profile` keeps its own copy, so tune in show mode.

## Mic notes

AirPods add about 150–250 ms of Bluetooth delay. You will hear your own voice boom back late, which can make you stumble over words. Noise cancellation helps. A wired or USB mic cuts the delay to about 10 ms. The mouth stays in sync either way, because it follows the speaker output and not your voice.

## Sound effects

Each trigger plays a sound through the speakers: a whoosh with crackles for the fire, a two-vent hiss for the steam, and thunder for the lightning. Fire flares set off by a shout stay silent, so they don't cover the voice.

The app synthesizes all three sounds. To use a recording instead, save it as `public/sfx/fire.wav`, `steam.wav`, or `thunder.wav`.

## Credits

Head scan: "Infinite" by Lee Perry-Smith, CC BY 3.0, from the three.js examples. See `public/models/LeePerrySmith_License.txt`.

Labrador: ["Dog"](https://sketchfab.com/3d-models/dog-06d4813d176e4beb99d2f051d61fd865) by all of life, CC BY 4.0, from Sketchfab. See `public/models/labrador-head_License.txt`.
