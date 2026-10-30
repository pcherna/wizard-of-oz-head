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
  | 'spin';

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
}

export interface Trick {
  name: TrickName;
  seconds: number;
  /** Needs a separate tongue in the model. Only the Labrador has one. */
  tongue: boolean;
  /** When the trick bursts the steam vents, in seconds from the start. */
  steamAt?: number;
  /** When the trick flares the fire, in seconds from the start. */
  flareAt?: number;
  /** Plays public/sfx/<name>.mp3 or .wav first, if one exists, and starts moving when it ends. */
  clip?: boolean;
  /** dir is +1 or -1, picked at random each time, for moves that go one way. */
  pose(t: number, p: Pose, dir: number): void;
}

export function restPose(): Pose {
  return {
    yaw: 0, pitch: 0, roll: 0, idle: 1,
    jaw: 0, jawMix: 0,
    tongueOut: 0, tongueCurl: 0, tongueSide: 0, tongueDroop: 0,
    eyeOpen: 1, winkL: 0, winkR: 0, eyeGlow: 1, gazeX: 0,
    rise: 0, spray: 0, ghost: 0,
  };
}

/** The Labrador's jaw as modeled, slightly open. Lower values close it. */
const RELAXED_JAW = 0.65;

/** In the order the trick button plays them. */
export const TRICKS: Trick[] = [
  {
    // Sticks its tongue out and waggles its head: a taunt.
    name: 'blep',
    seconds: 2.1,
    tongue: true,
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
    // A wet-dog shake, with the jowls flapping and water flying off.
    name: 'shake',
    seconds: 1.4,
    tongue: false,
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
    pose(t, p, dir) {
      const e = hold(t, 0, 0.2, 1.4, 1.7);
      p.jaw = 0.75;
      p.jawMix = e;
      p.tongueOut = 1.4 * hold(t, 0.1, 0.35, 1.2, 1.5);
      p.tongueCurl = keys(t, [[0.3, 0], [0.55, 1.3], [0.68, 1.5], [0.78, 1.25], [0.92, 1.55], [1.08, 1.3], [1.35, 0]]);
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
    steamAt: 0.95,
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
    // A long spooky howl in profile, and the fire flares as it starts. The nose dips to gather breath, then the head turns and
    // swings up in one arc, banking into the turn, overshoots a little and settles. The nose
    // keeps creeping up as the howl swells.
    name: 'howl',
    seconds: 3.6,
    tongue: false,
    flareAt: 0.9,
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
    // Squirrel! The head snaps to the side and freezes, staring, then slowly comes back.
    name: 'squirrel',
    seconds: 2.8,
    tongue: false,
    clip: true,
    pose(t, p, dir) {
      const e = hold(t, 0, 0.1, 1.7, 2.6);
      p.yaw = (0.75 * dir + 0.01 * Math.sin(t * 2 * Math.PI * 18)) * e;
      p.pitch = -0.08 * e;
      p.idle = 1 - e;
      p.eyeGlow = 1 + 0.6 * e;
      p.gazeX = 0.06 * e;
    },
  },
  {
    // A cheeky wink. Both eyes flare first, so the one going dark stands out.
    name: 'wink',
    seconds: 1.5,
    tongue: false,
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
    // A full turn of the head, like a possessed doll. It's Halloween. The model has no back to
    // its skull, so the turn is fast: the hollow back flashes by in about a sixth of a second.
    name: 'spin',
    seconds: 1.3,
    tongue: false,
    pose(t, p) {
      const e = hold(t, 0, 0.15, 0.95, 1.3);
      p.yaw = 2 * Math.PI * ease((t - 0.15) / 0.8);
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
