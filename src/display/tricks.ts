// Dog tricks for the trick button: short choreographed poses layered over the head's idle motion.
// Each trick is a pure function of the time since it started, and ends back at rest.

export type TrickName =
  | 'blep'
  | 'shake'
  | 'lick'
  | 'tilt'
  | 'sneeze'
  | 'howl'
  | 'pant'
  | 'squirrel'
  | 'wink'
  | 'ghost'
  | 'spin'
  | 'melt'
  | 'colors'
  | 'nap'
  | 'monkeys'
  | 'lunge'
  | 'hiccups'
  | 'bubble'
  | 'vampire';

/** Things a trick sets off around the head. */
export type Cue = 'steam' | 'wideSteam' | 'flare' | 'douse' | 'lightning' | 'monkeys' | 'pop';

/** Offsets from the head's normal behavior. restPose() changes nothing. */
export interface Pose {
  /** Radians added to the head's turn (+ turns to the viewer's left), nod (+ nose down) and roll. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Idle sway, from 1 (normal) to 0 (frozen). */
  idle: number;
  /** Jaw opening in lip-sync units (0 shut, 1 full gape, more gapes wider), and how far it overrides speech. */
  jaw: number;
  jawMix: number;
  /** Tongue slide out of the mouth: 0 in, 1 a blep, more reaches further. */
  tongueOut: number;
  /** Radians the tongue tip curls up toward the nose. */
  tongueCurl: number;
  /** Sideways tongue offset at the tip, in mesh units. */
  tongueSide: number;
  /** How far the tongue hangs down past the lip. 0 sticks straight out. */
  tongueDroop: number;
  /** Multiplies the lid opening. 0 shuts both eyes. */
  eyeOpen: number;
  /** Shuts one eye: 0 open, 1 shut. */
  winkL: number;
  winkR: number;
  /** Multiplies the eye glow. */
  eyeGlow: number;
  /** Pupil offset sideways, for the eyes that are painted on. */
  gazeX: number;
  /** Raises the head, in world units. */
  rise: number;
  /** How hard the head flings water drops off, 0 to 1. */
  spray: number;
  /** Turns the head into a pale, see-through ghost, 0 to 1. */
  ghost: number;
  /** Melts the head down into a puddle, 0 to 1. */
  melt: number;
  /** Steps through the Emerald City colors: 0 green, 1 purple, 2 yellow, 3 red, 4 green again. */
  colors: number;
  /** Moves the head toward the audience, in world units. */
  lunge: number;
  /** Floats "Z"s up from the head while above 0.5. */
  zzz: number;
  /** Size of a chewing-gum bubble at the mouth, 0 (none) to 1. */
  bubble: number;
  /** Leans the head along its nose, in world units, stretching the neck. */
  lean: number;
  /** Paints the hollow inside of the head solid, for when its open back shows, 0 to 1. */
  cap: number;
  /** Grows the upper canines into long fangs, 0 to 1. */
  fangs: number;
  /** Turns the eyes blood red, 0 to 1. */
  eyeRed: number;
}

export interface Trick {
  name: TrickName;
  seconds: number;
  /** Needs a separate tongue in the model. Only the Labrador has one. */
  tongue: boolean;
  /** Needs separate upper canines in the model. Only the Labrador has them. */
  fangs?: boolean;
  /** [seconds from the start, cue] pairs. */
  cues?: [number, Cue][];
  /**
   * Looks for public/sfx/<name>.mp3 or .wav. 'first' plays it before the trick moves, and the
   * trick starts when it ends. 'instead' plays it in place of the synthesized sound.
   */
  clip?: 'first' | 'instead';
  /** Small enough for autopilot to play on its own. */
  auto?: boolean;
  /** dir is +1 or -1, picked at random each time, for moves that go one way. */
  pose(t: number, p: Pose, dir: number): void;
}

/** Blends a pose toward rest: k 1 leaves it, k 0 is rest. */
export function blendToRest(p: Pose, k: number) {
  const rest = restPose();
  for (const key of Object.keys(p) as (keyof Pose)[]) p[key] = rest[key] + (p[key] - rest[key]) * k;
}

export function restPose(): Pose {
  return {
    yaw: 0, pitch: 0, roll: 0, idle: 1,
    jaw: 0, jawMix: 0,
    tongueOut: 0, tongueCurl: 0, tongueSide: 0, tongueDroop: 0,
    eyeOpen: 1, winkL: 0, winkR: 0, eyeGlow: 1, gazeX: 0,
    rise: 0, spray: 0, ghost: 0,
    melt: 0, colors: 0, lunge: 0, zzz: 0, bubble: 0,
    fangs: 0, eyeRed: 0, lean: 0, cap: 0,
  };
}

/** The Labrador's jaw as modeled, slightly open. Lower values close it. */
const RELAXED_JAW = 0.65;

/** When the shake's water hits the fire and puts it out. trick-sounds.ts hisses then. */
export const SHAKE_DOUSE = 0.38;
/** When each hiccup jolts, in seconds. trick-sounds.ts plays a "hic!" at each. */
export const HICCUP_TIMES = [0.15, 0.85, 1.35, 2.3];
/** When the gum bubble pops. */
export const BUBBLE_POP = 3.25;
/** When the head melts down for real, partway through "what a world, what a world". */
export const MELT_DOWN = 4.8;
/** When the witch speaks in public/sfx/melt.wav, [start, end] in seconds, measured from its pauses. */
const MELT_LINES: [number, number][] = [[0.03, 1.03], [1.29, 2.11], [2.52, 3.53], [3.79, 7.4]];
/** When the napping dog wakes with a start. trick-sounds.ts snores until then. */
export const NAP_WAKE = 5.2;

/** In the order the trick button plays them. */
export const TRICKS: Trick[] = [
  {
    // Sticks its tongue out and waggles its head: a taunt.
    name: 'blep',
    seconds: 2.1,
    tongue: true,
    auto: true,
    pose(t, p) {
      const e = hold(t, 0, 0.25, 1.6, 1.95);
      const out = hold(t, 0.1, 0.4, 1.5, 1.85);
      p.jaw = 0.85;
      p.jawMix = e;
      p.tongueOut = out;
      p.tongueDroop = 1;
      p.tongueSide = 0.05 * Math.sin(t * 2 * Math.PI * 6) * out;
      p.roll = 0.18 * e;
      p.yaw = 0.12 * Math.sin(t * 2 * Math.PI * 2.5) * e;
      p.eyeOpen = 1 - 0.5 * e;
      p.idle = 1 - 0.7 * e;
    },
  },
  {
    // A wet-dog shake, with the jowls flapping and water flying off. The water puts the fire out
    // in a hiss of steam, and it relights a moment later.
    name: 'shake',
    seconds: 1.4,
    tongue: false,
    cues: [[SHAKE_DOUSE, 'douse'], [SHAKE_DOUSE - 0.2, 'steam']],
    pose(t, p) {
      const e = hold(t, 0, 0.1, 0.95, 1.35);
      const w = t * 2 * Math.PI * 5;
      p.roll = 0.5 * Math.sin(w) * e;
      p.yaw = 0.2 * Math.sin(w + 0.8) * e;
      p.jaw = RELAXED_JAW + 0.3 * Math.abs(Math.sin(w));
      p.jawMix = e;
      p.eyeOpen = 1 - 0.85 * e;
      p.idle = 1 - e;
      p.spray = hold(t, 0.05, 0.15, 0.8, 1.05);
    },
  },
  {
    // Licks its nose: the tongue comes out, curls up, and swipes across once and back. Each
    // stroke has its own speed and reach, the tip flicks up on each pass, and the head leans in.
    name: 'lick',
    seconds: 1.8,
    tongue: true,
    auto: true,
    pose(t, p, dir) {
      const e = hold(t, 0, 0.2, 1.4, 1.7);
      p.jaw = 0.75;
      p.jawMix = e;
      // Far enough out that the broad front of the tongue clears the upper lip, then curled up
      // to nearly upright, so the body of the tongue presses flat against the nose, not just its edge.
      p.tongueOut = 1.8 * hold(t, 0.1, 0.35, 1.2, 1.5);
      p.tongueCurl = keys(t, [[0.3, 0], [0.55, 1.25], [0.68, 1.45], [0.78, 1.2], [0.92, 1.5], [1.08, 1.25], [1.35, 0]]);
      const side = dir * keys(t, [[0.45, 0], [0.62, 0.09], [0.86, -0.08], [1.05, 0.02], [1.25, 0]]);
      p.tongueSide = side;
      p.yaw = 0.8 * side;
      p.roll = -0.6 * side;
      p.pitch = -0.1 * e;
      p.eyeOpen = 1 - 0.6 * e;
      p.idle = 1 - 0.7 * e;
    },
  },
  {
    // The classic confused tilt, to one side, with bright eyes.
    name: 'tilt',
    seconds: 1.7,
    tongue: false,
    auto: true,
    pose(t, p, dir) {
      const e = hold(t, 0, 0.22, 1.15, 1.6);
      p.roll = 0.42 * dir * e;
      p.pitch = -0.05 * e;
      p.idle = 1 - 0.8 * e;
      p.eyeGlow = 1 + 0.4 * e;
    },
  },
  {
    // Ah... ah... CHOO. The head rears back twice, then snaps forward and blasts the steam vents.
    name: 'sneeze',
    seconds: 2.3,
    tongue: false,
    // The plumes take a moment to build, so they start early enough to billow out on the "choo" at 1.2 s.
    cues: [[0.95, 'wideSteam']],
    pose(t, p) {
      const windup = (0.5 * ease(t / 0.45) + 0.5 * ease((t - 0.6) / 0.4)) * (1 - ease((t - 1.2) / 0.06));
      const snap = hold(t, 1.2, 1.26, 1.4, 2.1);
      const quiver = 0.04 * Math.sin(t * 2 * Math.PI * 9) * windup;
      p.pitch = -0.3 * windup + 0.35 * snap;
      p.jaw = RELAXED_JAW + 0.25 * windup + quiver + 0.5 * hold(t, 1.2, 1.24, 1.3, 1.5);
      p.jawMix = Math.max(windup, snap);
      p.eyeOpen = 1 - 0.9 * Math.max(windup, snap);
      p.idle = 1 - Math.max(windup, snap);
    },
  },
  {
    // "A horse of a different color": purple, yellow, red, then back to green, with a happy bob.
    name: 'colors',
    seconds: 4.4,
    tongue: false,
    pose(t, p) {
      const e = hold(t, 0, 0.3, 3.9, 4.3);
      p.colors = keys(t, [[0, 0], [0.35, 1], [1.3, 1], [1.65, 2], [2.6, 2], [2.95, 3], [3.9, 3], [4.3, 4]]);
      p.rise = 0.03 * Math.abs(Math.sin(t * Math.PI * 2.2)) * e;
      p.roll = 0.1 * Math.sin(t * Math.PI * 1.1) * e;
      p.eyeGlow = 1 + 0.5 * e;
      p.idle = 1 - 0.6 * e;
    },
  },
  {
    // A long spooky howl in profile, and the fire flares as it starts. The nose dips to gather breath, then the head turns and
    // swings up in one arc, banking into the turn, overshoots a little and settles. The nose
    // keeps creeping up as the howl swells.
    name: 'howl',
    seconds: 3.6,
    tongue: false,
    cues: [[0.9, 'flare']],
    pose(t, p, dir) {
      const e = hold(t, 0, 0.3, 3.0, 3.5);
      const up = -keys(t, [[0, 0], [0.25, -0.08], [0.85, 0.68], [1.1, 0.6], [2.6, 0.66], [2.95, 0.66], [3.45, 0]]);
      p.yaw = dir * (keys(t, [[0.05, 0], [0.6, 0.52], [0.95, 0.6], [3.0, 0.6], [3.5, 0]]) + 0.03 * Math.sin(t * 1.3) * e);
      p.roll = dir * keys(t, [[0.05, 0], [0.45, 0.1], [0.9, 0.04], [3.0, 0.04], [3.5, 0]]);
      p.pitch = up;
      p.jaw = 0.95 + 0.04 * Math.sin(t * 2 * Math.PI * 5.5);
      p.jawMix = hold(t, 0.6, 0.95, 2.85, 3.25);
      p.eyeOpen = 1 + 1.1 * Math.min(0, up);
      p.idle = 1 - e;
    },
  },
  {
    // Happy panting, tongue hanging out to one side.
    name: 'pant',
    seconds: 2.4,
    tongue: true,
    auto: true,
    pose(t, p) {
      const e = hold(t, 0, 0.25, 2.0, 2.4);
      const beat = Math.sin(t * 2 * Math.PI * 3.6);
      p.jaw = 0.95 + 0.12 * beat;
      p.jawMix = e;
      p.tongueOut = 0.6 * e;
      p.tongueDroop = 1.5;
      p.tongueSide = 0.07 * e;
      p.pitch = 0.03 * beat * e;
      p.eyeOpen = 1 - 0.4 * e;
    },
  },
  {
    // Squirrel! The head snaps to the side and leans in, stretching its neck, freezes staring, then slowly comes back.
    name: 'squirrel',
    seconds: 2.8,
    tongue: false,
    clip: 'first',
    pose(t, p, dir) {
      const e = hold(t, 0, 0.1, 1.7, 2.6);
      p.yaw = (0.75 * dir + 0.01 * Math.sin(t * 2 * Math.PI * 18)) * e;
      p.lean = keys(t, [[0, 0], [0.18, 0.42], [0.32, 0.36], [1.7, 0.36], [2.6, 0]]);
      p.pitch = -0.08 * e;
      p.idle = 1 - e;
      p.eyeGlow = 1 + 0.6 * e;
      p.gazeX = 0.06 * e;
    },
  },
  {
    // Hiccups: four little jolts at uneven intervals, each with a "hic!".
    name: 'hiccups',
    seconds: 3.0,
    tongue: false,
    auto: true,
    pose(t, p) {
      let jolt = 0;
      for (const at of HICCUP_TIMES) jolt = Math.max(jolt, hold(t, at, at + 0.04, at + 0.07, at + 0.35));
      p.rise = 0.06 * jolt;
      p.pitch = -0.14 * jolt;
      p.jaw = RELAXED_JAW + 0.25 * jolt;
      p.jawMix = jolt;
      p.eyeGlow = 1 + 0.9 * jolt;
      p.idle = 1 - 0.5 * hold(t, 0, 0.1, 2.6, 3.0);
    },
  },
  {
    // Blows a chewing-gum bubble that swells with each breath, wobbles, and pops in its face.
    name: 'bubble',
    seconds: 4.2,
    tongue: false,
    cues: [[BUBBLE_POP, 'pop']],
    pose(t, p) {
      const e = hold(t, 0, 0.25, 3.3, 3.9);
      const size = t < BUBBLE_POP ? keys(t, [[0.3, 0], [1.0, 0.4], [1.3, 0.36], [2.1, 0.75], [2.4, 0.7], [3.2, 1]]) : 0;
      const flinch = hold(t, BUBBLE_POP, BUBBLE_POP + 0.05, BUBBLE_POP + 0.15, BUBBLE_POP + 0.65);
      // Lips shut around the gum.
      p.jaw = 0.3;
      p.jawMix = e;
      p.bubble = size * (1 + 0.04 * Math.sin(t * 2 * Math.PI * 3));
      p.pitch = -0.06 * size + 0.12 * flinch;
      p.eyeOpen = 1 - 0.9 * flinch;
      p.eyeGlow = 1 + 0.6 * size;
      p.idle = 1 - e;
    },
  },
  {
    // A jump scare: rears back, then lunges at the audience with a bark as the lightning strikes.
    name: 'lunge',
    seconds: 1.9,
    tongue: false,
    cues: [[0.22, 'lightning']],
    pose(t, p) {
      p.lunge = keys(t, [[0, 0], [0.12, -0.25], [0.26, 2.2], [0.75, 2.0], [1.6, 0]]);
      p.pitch = keys(t, [[0, 0], [0.12, -0.12], [0.26, 0.12], [0.75, 0.08], [1.6, 0]]);
      p.jaw = 1.15;
      p.jawMix = hold(t, 0.14, 0.24, 0.6, 0.9);
      p.eyeGlow = 1 + 1.5 * hold(t, 0.1, 0.22, 0.8, 1.4);
      p.idle = 1 - hold(t, 0, 0.1, 1.2, 1.7);
    },
  },
  {
    // A cheeky wink. Both eyes flare first, so the one going dark stands out.
    name: 'wink',
    seconds: 1.5,
    tongue: false,
    auto: true,
    pose(t, p) {
      const e = hold(t, 0, 0.2, 1.0, 1.45);
      p.eyeGlow = 1 + 1.5 * hold(t, 0, 0.2, 0.95, 1.3);
      p.winkR = hold(t, 0.3, 0.4, 0.8, 0.95);
      p.roll = 0.14 * e;
      p.pitch = 0.05 * e;
      p.idle = 1 - 0.5 * e;
    },
  },
  {
    // Poppies! Nods off twice: each time the head sinks slowly and lolls to one side, then jerks
    // partway back up, a little lower each time. The third time it stays down, snoring with "Z"s rising, then wakes with a start.
    name: 'nap',
    seconds: 6.6,
    tongue: false,
    pose(t, p, dir) {
      const asleep = hold(t, 2.4, 2.9, NAP_WAKE, NAP_WAKE + 0.02);
      // One breath per 1.2 s snore, rising on the inhale.
      const breath = Math.sin(((t - 2.9) * 2 * Math.PI) / 1.2) * asleep;
      p.pitch = keys(t, [[0, 0], [0.85, 0.24], [0.97, 0.1], [1.85, 0.34], [1.97, 0.18], [2.85, 0.42], [NAP_WAKE, 0.42], [NAP_WAKE + 0.1, -0.18], [6.4, 0]]) + 0.02 * breath;
      p.roll = dir * keys(t, [[0, 0], [0.85, 0.2], [0.97, 0.08], [1.85, 0.28], [1.97, 0.15], [2.85, 0.3], [NAP_WAKE, 0.3], [NAP_WAKE + 0.1, -0.05], [6.0, 0]]);
      p.eyeOpen = keys(t, [[0, 1], [0.85, 0.3], [0.97, 0.9], [1.85, 0.2], [1.97, 0.8], [2.7, 0], [NAP_WAKE, 0], [NAP_WAKE + 0.06, 1]]);
      // The eyes fade further on each nod, flash bright on each jerk awake, and blaze on the final start.
      const nodding = keys(t, [[0, 0], [0.85, 0.7], [0.97, 0], [1.85, 0.85], [1.97, 0], [2.85, 1]]);
      p.eyeGlow = (1 - nodding) * (1 + 0.8 * (hold(t, 0.95, 0.98, 1.1, 1.5) + hold(t, 1.95, 1.98, 2.1, 2.5))) + 1.6 * hold(t, NAP_WAKE, NAP_WAKE + 0.05, NAP_WAKE + 0.3, 6.4);
      p.jaw = RELAXED_JAW + 0.12 + 0.08 * breath;
      p.jawMix = asleep;
      // A little bob each time it jerks awake, and a jump on the final start.
      const jerks = hold(t, 0.9, 0.97, 1.0, 1.2) + hold(t, 1.9, 1.97, 2.0, 2.2);
      p.rise = 0.015 * breath + 0.03 * jerks + keys(t, [[NAP_WAKE, 0], [NAP_WAKE + 0.08, 0.08], [NAP_WAKE + 0.5, 0]]);
      p.zzz = hold(t, 3.0, 3.1, 5.0, 5.1);
      p.idle = 1 - hold(t, 0, 0.4, NAP_WAKE + 0.1, 6.4);
    },
  },
  {
    // Fades into a pale, see-through ghost that drifts up and sways, then comes back.
    name: 'ghost',
    seconds: 3.6,
    tongue: false,
    pose(t, p, dir) {
      const g = hold(t, 0, 0.7, 2.6, 3.5);
      p.ghost = g;
      p.rise = 0.12 * g + 0.03 * Math.sin(t * 2.4) * g;
      p.roll = 0.08 * dir * Math.sin(t * 1.8) * g;
      p.yaw = 0.1 * dir * Math.sin(t * 1.1) * g;
      p.idle = 1 - g;
      p.eyeGlow = 1 + 0.8 * g;
    },
  },
  {
    // A vampire: the head lowers, then rises with the eyes turning blood red, the lips parting and
    // the upper canines growing into long fangs, to the opening of Bach's Toccata and Fugue in D minor.
    name: 'vampire',
    seconds: 5,
    tongue: false,
    fangs: true,
    pose(t, p, dir) {
      const bare = hold(t, 0.6, 1.5, 3.8, 4.6);
      p.fangs = hold(t, 0.7, 1.5, 3.8, 4.5);
      p.eyeRed = hold(t, 0.5, 1.0, 3.9, 4.7);
      p.pitch = keys(t, [[0, 0], [0.6, 0.2], [1.4, -0.12], [3.8, -0.1], [4.7, 0]]);
      p.yaw = 0.18 * dir * Math.sin((t - 1.4) * 1.1) * hold(t, 1.4, 2.0, 3.6, 4.3);
      p.jaw = 0.75;
      p.jawMix = bare;
      p.eyeGlow = keys(t, [[0, 1], [0.5, 0.4], [1.0, 2.2], [3.9, 2.2], [4.7, 1]]);
      p.idle = 1 - hold(t, 0, 0.3, 4.3, 4.9);
    },
  },
  {
    // Flying monkeys swoop across the backdrop, screeching. The dog looks up and follows them, mouth agape.
    name: 'monkeys',
    seconds: 4.6,
    tongue: false,
    cues: [[0.1, 'monkeys']],
    pose(t, p, dir) {
      const e = hold(t, 0, 0.4, 3.8, 4.5);
      // The flock crosses toward the dir side. A positive yaw turns the nose toward +x.
      p.yaw = dir * keys(t, [[0.3, -0.5], [1.2, -0.3], [2.6, 0.5], [3.3, 0.55]]) * e;
      p.pitch = -0.28 * e;
      p.jaw = 0.9;
      p.jawMix = hold(t, 0.8, 1.1, 3.0, 3.5);
      p.eyeGlow = 1 + 0.7 * e;
      p.idle = 1 - e;
    },
  },
  {
    // "I'm melting!" Timed to the witch's lines in public/sfx/melt.wav: the head writhes at "Look
    // what you've done!", sags a little through "I'm melting! Melting!", drips down into a puddle
    // in clouds of steam through "Oh, what a world, what a world", then rises back up whole.
    name: 'melt',
    seconds: 8.8,
    tongue: false,
    clip: 'instead',
    cues: [[0.3, 'steam'], [1.8, 'steam'], [3.6, 'steam'], [MELT_DOWN, 'steam'], [5.8, 'steam'], [6.6, 'steam']],
    pose(t, p, dir) {
      // Only a slight sag through "I'm melting! Melting!" and the start of "Oh, what a world".
      // The real melt runs from MELT_DOWN to 7 s, and it rises back up after she finishes at 7.4 s.
      const melt = (0.15 * ease((t - 1.3) / 2.5) + 0.85 * Math.pow(ease((t - MELT_DOWN) / 2.2), 1.4)) * (1 - ease((t - 7.4) / 1.0));
      const writhe = hold(t, 0.1, 0.5, 6.5, 7.2);
      // The jaw works on each of her lines, until the mouth has melted away.
      let talk = 0;
      for (const [a, b] of MELT_LINES) talk = Math.max(talk, hold(t, a, a + 0.08, b - 0.08, b));
      p.melt = melt;
      p.roll = 0.15 * dir * melt;
      p.yaw = 0.15 * Math.sin(t * 5) * writhe;
      p.jaw = 0.85 + 0.25 * Math.abs(Math.sin(t * 2 * Math.PI * 3));
      p.jawMix = talk * (1 - melt);
      p.eyeOpen = 1 - 0.5 * melt;
      p.eyeGlow = 1 - 0.7 * melt;
      p.idle = 1 - hold(t, 0, 0.3, 7.9, 8.7);
    },
  },
  {
    // A full turn of the head, like a possessed doll. It's Halloween. The model has no back to
    // its skull, so the turn is fast: the hollow back flashes by in about a sixth of a second.
    name: 'spin',
    seconds: 1.3,
    tongue: false,
    pose(t, p) {
      const e = hold(t, 0, 0.15, 0.95, 1.3);
      p.yaw = 2 * Math.PI * ease((t - 0.15) / 0.8);
      p.cap = e;
      p.idle = 1 - e;
      p.eyeGlow = 1 + 0.5 * e;
    },
  },
];

/** 0 before a, eases up to 1 at b, holds until c, eases back to 0 at d. */
function hold(t: number, a: number, b: number, c: number, d: number): number {
  return ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));
}

/** Eases from key to key through [time, value] pairs, holding the end values outside them. */
function keys(t: number, k: [number, number][]): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    const [t1, v1] = k[i];
    if (t < t1) {
      const [t0, v0] = k[i - 1];
      return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
    }
  }
  return k[k.length - 1][1];
}

function ease(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
