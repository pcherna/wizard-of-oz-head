# The Great Oz(zie)

Every year for Halloween night, we do a haunted house in our garage for the kids to walk through. This year's theme is the Wizard of Oz. For that, I created this effect:

A projected green head over a fire, with steam on both sides. A hidden performer talks into a mic. The app lowers the voice, adds a large-hall reverb, and plays it through the room speakers. The jaw follows the processed voice. A presentation clicker or a phone triggers fire flares, steam bursts, and lightning with thunder.

![The Labrador head glowing green over the fire, with steam pipes and the organ backdrop](docs/TheGreatOzzie.jpg)

## Use of AI Coding Tools

This package was developed using Claude Code and Claude Opus 5.5.

## Run it

Rehearse in dev mode:

```sh
npm install
npm run dev
```

Open `http://localhost:8787/` in Chrome. Then click, or press a clicker button such as PageUp, PageDown or `b`, to start. Chrome won't start sound, the mic or fullscreen until someone clicks or presses a key, and that first press only starts the show. Show mode starts without this step. Add `?demo` to drive the mouth with fake speech and no mic.

For the show, connect the projector and run:

```sh
WIZARD_DISPLAY_X=1920 npm run show
```

Set `WIZARD_DISPLAY_X` to any x coordinate on the projector's display, from System Settings > Displays. The script builds the app, starts the server, and opens Chrome in kiosk mode on that display. Quit with Cmd+Q. Stop `npm run dev` first, because both use port 8787.

## Controls

| Key | Action |
| --- | --- |
| `PageDown`, `Right arrow`, `1` | Fire flare |
| `PageUp`, `Left arrow`, `2` | Steam burst |
| `b`, `.`, `3` | Lightning and thunder |
| `F5`, `Esc` | Mute or unmute the mic |
| `s` | Setup panel |
| `f` | Back to fullscreen |

Most presentation clickers send PageUp and PageDown. Their third button sends `b` or `.`. The setup panel shows the last key pressed. If your clicker sends something else, add the key to `KEY_MAP` in `src/config.ts`, or to `MIC_TOGGLE_KEYS` for muting.

Many clickers also have a "start show" button that sends F5 and Esc in turn. Each press mutes or unmutes the mic, so it works as a mute button. Muting silences the voice and closes the mouth, and any reverb already playing dies out. While muted, the wizard's eyes dim to a faint glow, so you can see the state from behind the curtain. The phone remote and the setup panel show it too, and the remote can toggle it. The mic starts muted every time the app starts, so unmute when you're ready to speak.

Unmuting takes effect after about a third of a second. Sound reaches the app late, by about 0.2 seconds with AirPods, so the wait keeps your last words before unmuting from leaking out. The eyes brighten when the mic actually opens, so wait for them before you speak. To change the wait, edit `unmuteHoldSec` in `src/config.ts`.

The app stops F5 from reloading the page. In fullscreen it also locks the Esc key, so only holding Esc for about 2 seconds leaves fullscreen. Press `f` to go back. In show mode Chrome runs in kiosk mode, where Esc never leaves fullscreen.

A loud shout also flares the fire, at most once every 2 seconds.

## Phone remote

The server prints the remote URL at startup, and the setup panel shows it too. It looks like `http://<mac-name>.local:8787/remote.html`. The phone must be on the same Wi-Fi as the Mac. If the page says "offline", the Wi-Fi probably blocks device-to-device traffic. In that case, join the Mac to the phone's hotspot.

The remote has buttons for fire, steam, lightning and the mic, and sliders for volume, fire level and overall brightness.

If audio fails during the show, a red message appears in the bottom-left corner. It clears itself after 10 seconds.

## Setup panel

Press `s` to open it.

- **Overall brightness:** dims the whole picture, effects and lightning included, if the projection is too bright. Black stays black, and the setup panel stays readable.
- **Mic and Speakers:** pick the mic and the room speakers. Always pick the speakers explicitly. If you don't, macOS can move the output onto the AirPods when they become the input.
- **Cue tones:** where the mute and unmute tones play. Pick the performer's AirPods, and only the performer hears them: two falling notes for muted, two rising notes for live. The voice and effects stay on the speakers. Off plays no tones. The unmute tone plays while the mic is still shut, so the mic can't pick it up.
- **Test speakers:** plays a short beep through the chosen output. If one speaker stays silent while others work, open Audio MIDI Setup and check that device's volume and Mute box. macOS keeps a separate volume for each device, and the menu-bar slider only changes the current default.
- **Pitch and Reverb:** shape the voice. Pitch 0.72 is about six semitones down.
- **Gate:** silences the mic below this level. Raise it if room noise makes the mouth twitch.
- **Mouth sensitivity:** the voice level that opens the jaw fully. Watch the meter while you speak normally. Aim for about half.
- **Head scale and height:** fit the head to the screen or scrim.
- **Shine:** strength of the glossy highlight on the head. 0 is fully matte.
- **Rim glow:** strength of the green glow around the head's outline. 0 turns it off.
- **Organ backdrop:** draws the pipe organ from the film's throne room behind the head: a stepped case of fire-lit pipes between glowing green columns, with dark silver steam pipes under the steam vents. The organ pipes brighten when the fire flares. 0 turns it off and leaves the background black, which a scrim or Pepper's ghost needs.
- **Oz sculpt:** shown only when the Oz head is selected. One slider per distortion of the Oz head: dome width, start and height, forehead ridges, brow, eye sockets, nose, cheek folds, jaw taper, chin drop, feature size and feature height. Dome start sets how low on the face the widening begins. Lower values widen the cheeks and jaw too. Feature size scales the eyes, nose and mouth together without changing the head outline, and Feature height moves them up or down. Every other slider at 0 turns its distortion off. Reset restores the defaults.

Settings save in the browser. The show profile in `.chrome-show-profile` keeps its own copy, so tune in show mode.

## Mic notes

AirPods add about 150–250 ms of Bluetooth delay. You will hear your own voice boom back late, which can make you stumble over words. Noise cancellation helps. A wired or USB mic cuts the delay to about 10 ms. The mouth stays in sync either way, because it follows the speaker output and not your voice.

## Sound effects

Each trigger plays a sound through the speakers: a whoosh with crackles for the fire, a two-vent hiss for the steam, and thunder for the lightning. Fire flares set off by a shout stay silent, so they don't cover the voice.

The app synthesizes all three sounds. To use a recording instead, save it as `public/sfx/fire.wav`, `steam.wav`, or `thunder.wav`.

## Credits

Head scan: "Infinite" by Lee Perry-Smith, CC BY 3.0, from the three.js examples. See `public/models/LeePerrySmith_License.txt`.

Labrador: ["Dog"](https://sketchfab.com/3d-models/dog-06d4813d176e4beb99d2f051d61fd865) by all of life, CC BY 4.0, from Sketchfab. See `public/models/dog_License.txt`.
