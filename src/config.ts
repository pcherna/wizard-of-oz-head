// Constants and defaults. Live-tunable values live in Settings (see settings.ts).
// Keep this file free of browser APIs: the Node server imports it too.

export const PORT = 8787;

export type EffectName = 'fire' | 'steam' | 'lightning' | 'trick';
export type HeadVariant = 'oz' | 'scan' | 'procedural' | 'labrador';

/** Presentation clickers send these keys. The setup panel shows the last key pressed. */
export const KEY_MAP: Record<string, EffectName> = {
  PageDown: 'fire',
  ArrowRight: 'fire',
  PageUp: 'steam',
  ArrowLeft: 'steam',
  b: 'trick',
  '.': 'trick',
  '1': 'fire',
  '2': 'steam',
  '3': 'trick',
};

/** Clickers have three buttons, so lightning hides behind quick steam taps: this many, each this soon after the last. */
export const STEAM_TAPS_FOR_LIGHTNING = 4;
export const STEAM_TAP_GAP_SEC = 0.6;

/** Keys that mute or unmute the mic. A clicker's "start show" button sends F5 and Esc in turn. */
export const MIC_TOGGLE_KEYS = ['F5', 'Escape'];

export interface Settings {
  /** Master output gain, 0..2. */
  volume: number;
  /** Fire, steam and thunder level, 0..1, on top of the master volume. The voice ignores it. */
  sfxVolume: number;
  /** Seconds with no button press and no speech before the dog does a small trick on its own. 0 is off. */
  autopilotSec: number;
  /** Resting fire height/brightness, 0..2. */
  fireBase: number;
  /** Voice pitch ratio, 0.5..1. Lower is deeper. */
  pitch: number;
  /** Reverb wet level, 0..1. */
  reverbWet: number;
  /** Noise gate threshold (input RMS), 0..0.05. */
  gate: number;
  /** Processed-voice RMS that opens the jaw fully, 0.02..0.3. */
  sensitivity: number;
  headScale: number;
  headY: number;
  headVariant: HeadVariant;
  /** Specular highlight strength, 0 (matte) .. 1. */
  headShine: number;
  /** Green edge glow strength, 0 (none) .. 1.5. */
  headRim: number;
  /** Brightness of the film's pipe-organ backdrop, 0 (off, pure black) .. 1.5. */
  backdrop: number;
  /** Dims the whole picture for a projector that is too bright, 0.1 .. 1. */
  brightness: number;
  /** Oz sculpt strengths, in mesh units. See oz-sculpt.ts. */
  ozDome: number;
  /** Height on the face where the dome widening begins (chin ≈ -0.6, lips ≈ 0.45, eyes ≈ 1.8). */
  ozDomeStart: number;
  ozCrown: number;
  ozForehead: number;
  ozBrow: number;
  ozEyes: number;
  ozNose: number;
  ozFolds: number;
  ozTaper: number;
  ozChin: number;
  /** Scale of the eyes-nose-mouth region (1 = unchanged). */
  ozFeatures: number;
  /** Vertical shift of the eyes-nose-mouth region. */
  ozFeatureY: number;
  inputId: string;
  outputId: string;
  /** Where mute/unmute cue tones play, such as the performer's AirPods. 'off' plays none. */
  cueOutputId: string;
  /** Turns the whole page 180°, for a projector mounted upside down. */
  flipped: boolean;
  /** Where each picture corner lands, as fractions of the screen: top-left, top-right, bottom-right, bottom-left. */
  keystone: [number, number][];
}

/** Starting strengths for the Oz sculpt, tuned by eye on Oct 27. The setup panel's reset button restores these. */
export const OZ_SCULPT_DEFAULTS = {
  ozDome: 0.59,
  ozDomeStart: 0.21,
  ozCrown: 0.95,
  ozForehead: 0.16,
  ozBrow: 0.26,
  ozEyes: 0.03,
  ozNose: 0.05,
  ozFolds: 0.1,
  ozTaper: 0,
  ozChin: 0,
  ozFeatures: 0.76,
  ozFeatureY: -0.22,
} satisfies Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
  volume: 1.51,
  sfxVolume: 0.25,
  autopilotSec: 45,
  fireBase: 0.35,
  pitch: 0.85,
  reverbWet: 0.4,
  gate: 0.004,
  sensitivity: 0.08,
  headScale: 1.57,
  headY: -0.39,
  headVariant: 'oz',
  headShine: 0,
  headRim: 0.5,
  backdrop: 0.3,
  brightness: 1,
  ...OZ_SCULPT_DEFAULTS,
  // Chrome assigns device ids per browser profile, so these stay on the system default.
  inputId: '',
  outputId: '',
  cueOutputId: 'off',
  flipped: false,
  keystone: [[0, 0], [1, 0], [1, 1], [0, 1]],
};

/** Settings the phone remote may change. Device ids stay on the display Mac. */
export const REMOTE_SETTING_KEYS = ['volume', 'sfxVolume', 'fireBase', 'brightness'] as const;

export const VOICE = {
  /**
   * After unmuting, keep the mic shut this long. Audio spoken while muted is still in transit
   * (macOS and Chrome buffers, about 10–20 ms with a wired mic) and would leak out.
   * AirPods add Bluetooth delay (about 150–250 ms) and need 0.35.
   */
  unmuteHoldSec: 0.1,
  reverbSeconds: 3.2,
  bassBoostDb: 6,
  bassBoostHz: 220,
  /**
   * Cuts breath, plosive and handling rumble before the bass boost amplifies it. The gate hides it in
   * silence, but it buzzes under the voice and its reverb. Two filters make a steep 24 dB/octave cut.
   * Chosen by ear on Oct 29 against 80 Hz, with the wired mic. It thins the lowest notes of a ~105 Hz voice a little.
   */
  lowCutHz: 120,
};

export const LIPSYNC = {
  attackSec: 0.03,
  releaseSec: 0.08,
  /** Shout = envelope above sensitivity × this factor. */
  shoutFactor: 1.8,
  autoFlareDebounceMs: 2000,
};
