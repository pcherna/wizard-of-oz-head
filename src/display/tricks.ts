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
  | 'vampire'
  | 'perk'
  | 'doorbell'
  | 'firefly'
  | 'scratch'
  | 'pumpkin'
  | 'treat'
  | 'wizard'
  | 'rainbow';

/** Things a trick sets off around the head. */
export type Cue = 'steam' | 'wideSteam' | 'flare' | 'douse' | 'lightning' | 'monkeys' | 'pop' | 'sparks' | 'crumbs';

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
  /** Lifts each floppy ear: 0 hangs, 1 stands straight up. L is the ear on the viewer's left. */
  earL: number;
  earR: number;
  /** How bright the firefly glows, 0 (gone) to 1. */
  firefly: number;
  /** Where the firefly is, from the neck pivot, in world units at head scale 1. +x is the viewer's right. */
  flyX: number;
  flyY: number;
  flyZ: number;
  /** Pulls the firefly from its flight path into the mouth, 0 to 1. */
  flyCatch: number;
  /** Turns the head into a jack-o'-lantern: orange, with grooves, 0 to 1. */
  pumpkin: number;
  /** Lights the mouth from inside, 0 to 1: a candle in a pumpkin, or a swallowed firefly. */
  mouthGlow: number;
  /** Size of the dog biscuit, 0 (none) to 1. It balances on the nose until tossed. */
  treat: number;
  /** 1 once the biscuit is tossed. It then flies treatX, Y and Z from where it left the nose, in world units at head scale 1. */
  treatFree: number;
  treatX: number;
  treatY: number;
  treatZ: number;
  /** Pulls the tossed biscuit into the mouth, 0 to 1. */
  treatCatch: number;
  /** Radians the biscuit has spun in the air. */
  treatSpin: number;
  /** Brightness of the rainbow behind the head, 0 to 1. */
  rainbow: number;
  /** How much of the rainbow's arc is drawn, 0 to 1. The sign is the side it starts from: + the viewer's right. */
  rainbowArc: number;
}

export interface Trick {
  name: TrickName;
  seconds: number;
  /** Needs a separate tongue in the model. Only the Labrador has one. */
  tongue: boolean;
  /** Needs separate upper canines in the model. Only the Labrador has them. */
  fangs?: boolean;
  /** Needs floppy ears that can lift. Only the Labrador has them. */
  ears?: boolean;
  /** Needs the top of the nose measured, for a biscuit to balance on. Only the Labrador has it. */
  nose?: boolean;
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
    earL: 0, earR: 0,
    firefly: 0, flyX: 0, flyY: 0, flyZ: 0, flyCatch: 0,
    pumpkin: 0, mouthGlow: 0,
    treat: 0, treatFree: 0, treatX: 0, treatY: 0, treatZ: 0, treatCatch: 0, treatSpin: 0,
    rainbow: 0, rainbowArc: 0,
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
/** When the ear springs up, partway through the owner's whistle. */
export const PERK_AT = 0.5;
/** When the dog barks at the doorbell. */
export const DOORBELL_BARKS = [1.0, 1.3];
/** When the dog snaps the firefly out of the air, gulps it down, and burps it back out. */
export const FIREFLY_CATCH = 3.75;
export const FIREFLY_GULP = 4.0;
export const FIREFLY_BURP = 5.1;
/** When each scratching stroke ends, faster and faster. Each one jostles the head. */
export const SCRATCH_STROKES = [0.7, 0.98, 1.22, 1.42, 1.6, 1.76, 1.9, 2.03, 2.15, 2.27, 2.38];
/** When the candle inside the jack-o'-lantern lights, and when the dog blows it out. */
export const PUMPKIN_LIGHT = 0.9;
export const PUMPKIN_OUT = 3.4;
/** When the dog tosses the biscuit off its nose, catches it, crunches it, and swallows. */
export const TREAT_FLIP = 2.7;
export const TREAT_CATCH = 3.45;
export const TREAT_CRUNCHES = [3.75, 4.0, 4.25, 4.5];
export const TREAT_GULP = 4.85;

/** A note: [start, length, MIDI note number]. The units are each tune's own beat. */
export type Note = [number, number, number];

/**
 * "We're off to see the Wizard, the Wonderful Wizard of Oz", in 6/8, in eighth notes. From John
 * Chambers' ABC transcription of a Wizard of Oz medley. A bar of oom-pah comes first, so the
 * melody starts with its pickup at eighth 5.
 */
export const WIZARD_TUNE: Note[] = [
  [5, 1, 69], [6, 2, 74], [8, 1, 69], [9, 2, 66], [11, 1, 67], [12, 1, 69], [13, 2, 74],
  [17, 1, 69], [18, 1, 71], [19, 1, 69], [20, 1, 67], [21, 1, 66], [22, 1, 67], [23, 1, 64], [24, 4, 62],
];
/** When the march starts, and seconds per eighth note. The head bobs on every third eighth. */
export const WIZARD_START = 0.2;
export const WIZARD_EIGHTH = 0.15;

/** "Somewhere over the rainbow, way up high", in quarter notes, on a music box. */
export const RAINBOW_TUNE: Note[] = [
  [0, 2, 74], [2, 2, 86], [4, 1, 85], [5, 0.5, 81], [5.5, 0.5, 83], [6, 1, 85], [7, 1, 86], [8, 2, 74], [10, 2, 83], [12, 4, 81],
];
/** When the music box starts, and seconds per quarter note. */
export const RAINBOW_START = 0.4;
export const RAINBOW_BEAT = 0.42;

/**
 * The firefly's flight, as [seconds, x, y, z] keys in world units at head scale 1, from the neck
 * pivot. x runs toward the trick's side. It darts in from off stage, loops around the face, and
 * hovers in front of the nose just before the catch.
 */
const FLY_PATH: [number, number, number, number][] = [
  [0, 2.6, 0.6, 0.7],
  [0.8, 1.1, 0.55, 1.2],
  [1.5, -0.3, 0.7, 1.2],
  [2.1, -1.1, 0.25, 1.25],
  [2.7, -0.35, 0.0, 1.5],
  [3.2, 0.55, 0.35, 1.4],
  [FIREFLY_CATCH - 0.2, 0.1, 0.05, 1.05],
  [FIREFLY_CATCH, 0, -0.05, 0.85],
];

/** Where the firefly is t seconds in, toward the dir side, with a buzzing jitter. trick-sounds.ts pans the buzz along it. */
export function fireflyAt(t: number, dir: number): [number, number, number] {
  const at = (axis: number) => keys(t, FLY_PATH.map((k) => [k[0], k[axis]]));
  const jitter = 1 - ease((t - (FIREFLY_CATCH - 0.4)) / 0.3);
  return [
    dir * (at(1) + 0.05 * Math.sin(t * 23) * jitter),
    at(2) + 0.05 * Math.sin(t * 31 + 1) * jitter,
    at(3) + 0.04 * Math.sin(t * 19 + 2) * jitter,
  ];
}

/** In the order the trick button plays them. */
export const TRICKS: Trick[] = [
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
    // Balances a dog biscuit on its nose, trembling with the effort of waiting. Then it flips the
    // biscuit up, catches it, and crunches it happily.
    name: 'treat',
    seconds: 5.6,
    tongue: false,
    nose: true,
    cues: [[TREAT_CRUNCHES[0], 'crumbs'], [TREAT_CRUNCHES[2], 'crumbs']],
    pose(t, p, dir) {
      const wait = hold(t, 0.6, 1.2, TREAT_FLIP - 0.1, TREAT_FLIP);
      // The tremble grows as the wait drags on.
      const tremble = Math.sin(t * 2 * Math.PI * 9) * wait * (0.004 + 0.005 * ease((t - 1) / 1.5));
      const gulp = hold(t, TREAT_GULP, TREAT_GULP + 0.08, TREAT_GULP + 0.12, TREAT_GULP + 0.35);
      // Nose up to hold the biscuit level, a flick up to toss it, then down to meet it.
      p.pitch = keys(t, [[0, 0], [0.4, -0.12], [TREAT_FLIP, -0.12], [TREAT_FLIP + 0.1, -0.4], [TREAT_FLIP + 0.35, -0.42], [TREAT_CATCH, -0.1], [TREAT_CATCH + 0.15, 0.05], [4.9, 0.05], [5.5, 0]]) + tremble + 0.1 * gulp;
      p.roll = 0.6 * tremble + 0.2 * dir * hold(t, 4.95, 5.2, 5.3, 5.6);
      p.treat = t < TREAT_CATCH ? keys(t, [[0.3, 0], [0.42, 1.15], [0.52, 1]]) : 0;
      const toss = t - TREAT_FLIP;
      if (toss > 0) {
        // Thrown up, peaking 0.38 above the nose after 0.3 s, low enough to stay on screen at
        // show size, and turning over twice.
        p.treatFree = 1;
        p.treatX = 0.06 * dir * toss;
        p.treatY = 2.5 * toss - 4.1 * toss * toss;
        p.treatZ = 0.12 * toss;
        p.treatSpin = (4 * Math.PI * dir * toss) / (TREAT_CATCH - TREAT_FLIP);
      }
      p.treatCatch = ease((t - (TREAT_CATCH - 0.15)) / 0.15);
      // Each crunch opens the jaw and bites down on the beat.
      let chew = 0;
      for (const at of TREAT_CRUNCHES) chew = Math.max(chew, hold(t, at - 0.14, at - 0.06, at - 0.05, at));
      p.jaw = keys(t, [[0.2, RELAXED_JAW], [0.4, 0.3], [TREAT_CATCH - 0.3, 0.3], [TREAT_CATCH - 0.1, 1.1], [TREAT_CATCH, 0.25]]) + 0.45 * chew;
      p.jawMix = hold(t, 0.1, 0.4, 5.0, 5.4);
      p.rise = 0.05 * hold(t, TREAT_CATCH - 0.1, TREAT_CATCH, TREAT_CATCH + 0.05, TREAT_CATCH + 0.3) - 0.03 * gulp;
      p.earL = p.earR = 0.25 * hold(t, 0.4, 0.7, TREAT_FLIP, TREAT_FLIP + 0.3);
      p.eyeGlow = 1 + 0.7 * wait + hold(t, TREAT_CATCH, TREAT_CATCH + 0.1, 4.6, 5.2);
      p.eyeOpen = 1 - 0.55 * hold(t, 3.65, 3.8, 4.7, 5.0);
      p.idle = 1 - hold(t, 0, 0.4, 5.0, 5.6);
    },
  },
  {
    // "We're off to see the Wizard" on a kazoo, over an oom-pah bass. The head bobs side to side
    // on the beat, hopping like Dorothy skipping down the yellow brick road, and the ears flap.
    // On the last note it stops and lifts its nose: ta-da.
    name: 'wizard',
    seconds: 5.0,
    tongue: false,
    pose(t, p, dir) {
      const eighth = (n: number) => WIZARD_START + n * WIZARD_EIGHTH;
      const last = WIZARD_TUNE[WIZARD_TUNE.length - 1];
      const e = hold(t, 0, WIZARD_START, 4.3, 4.9);
      // +1 on even beats and -1 on odd ones, so the head lands on a side on each beat.
      const beat = (t - WIZARD_START) / (3 * WIZARD_EIGHTH);
      const bob = e * (1 - ease((t - eighth(last[0])) / 0.3));
      const swing = Math.cos(Math.PI * beat) * bob;
      p.roll = 0.2 * dir * swing;
      p.yaw = 0.12 * dir * swing;
      p.rise = 0.04 * Math.abs(Math.sin(Math.PI * beat)) * bob;
      // The ear on the high side flies up as the head lands.
      p.earL = 0.5 * Math.max(0, dir * swing) ** 2;
      p.earR = 0.5 * Math.max(0, -dir * swing) ** 2;
      p.pitch = -0.15 * hold(t, eighth(last[0]), eighth(last[0]) + 0.1, eighth(last[0] + last[1]), 4.9);
      // The mouth hums along, opening a little on each note.
      let hum = 0;
      for (const [at, len] of WIZARD_TUNE) hum = Math.max(hum, hold(t, eighth(at), eighth(at) + 0.04, eighth(at + len) - 0.05, eighth(at + len)));
      p.jaw = 0.35 + 0.3 * hum;
      p.jawMix = e;
      p.eyeGlow = 1 + 0.6 * e;
      p.eyeOpen = 1 - 0.3 * e;
      p.idle = 1 - e;
    },
  },
  {
    // A rainbow arcs across the sky behind the dog as a music box plays "Somewhere over the
    // rainbow". The dog gazes up dreamily, swaying, and one ear rises on "way up high".
    name: 'rainbow',
    seconds: 7.8,
    tongue: false,
    pose(t, p, dir) {
      const beat = (b: number) => RAINBOW_START + b * RAINBOW_BEAT;
      const e = hold(t, 0.2, 1.4, 6.8, 7.7);
      p.rainbow = hold(t, 0.2, 0.6, 6.6, 7.6);
      // The arc is drawn by "way", then hangs there until the music box rings out.
      p.rainbowArc = dir * ease((t - 0.3) / (beat(8) - 0.3));
      // The nose rises with the octave leap of "Some-where".
      p.pitch = -0.3 * hold(t, beat(1), beat(2.5), 6.6, 7.6);
      p.roll = 0.1 * Math.sin((t - 0.4) * 1.6) * e;
      p.yaw = 0.1 * dir * Math.sin((t - 0.4) * 0.8) * e;
      const ear = keys(t, [[beat(10), 0], [beat(10) + 0.3, 0.4], [beat(12), 0.4], [beat(12) + 0.3, 0.65], [6.7, 0.65], [7.4, 0]]);
      if (dir > 0) p.earR = ear;
      else p.earL = ear;
      p.rise = 0.03 * hold(t, beat(12), beat(12) + 0.3, 6.7, 7.4);
      p.eyeOpen = 1 - 0.45 * e;
      p.eyeGlow = 1 + 0.6 * e;
      p.idle = 1 - e;
    },
  },
  {
    // An owner's whistle from one side. The ear on that side springs straight up, the head turns
    // and tilts toward the sound, listening, and the ear flops back down.
    name: 'perk',
    seconds: 3.4,
    tongue: false,
    ears: true,
    auto: true,
    pose(t, p, dir) {
      const e = hold(t, PERK_AT - 0.1, PERK_AT + 0.25, 2.4, 3.2);
      const ear = earPop(t, PERK_AT, 2.4);
      if (dir > 0) p.earR = ear;
      else p.earL = ear;
      p.yaw = 0.3 * dir * e;
      // Tilting away from the raised ear stands it up straighter.
      p.roll = 0.2 * dir * hold(t, PERK_AT + 0.3, PERK_AT + 0.7, 2.3, 3.1);
      p.rise = 0.04 * hold(t, PERK_AT, PERK_AT + 0.06, PERK_AT + 0.1, PERK_AT + 0.4);
      p.eyeGlow = 1 + 0.8 * e;
      p.idle = 1 - e;
    },
  },
  {
    // Ding-dong! Trick-or-treaters. Both ears shoot up, the head snaps toward the door, two happy
    // "boof"s, then a hopeful tilt.
    name: 'doorbell',
    seconds: 3.6,
    tongue: false,
    ears: true,
    pose(t, p, dir) {
      const e = hold(t, 0.15, 0.3, 2.7, 3.5);
      p.earL = 0.8 * earPop(t, 0.18, 2.6);
      p.earR = 0.8 * earPop(t, 0.24, 2.65);
      p.yaw = 0.5 * dir * keys(t, [[0.15, 0], [0.3, 1], [2.7, 1], [3.4, 0]]);
      let bob = 0;
      for (const at of DOORBELL_BARKS) bob = Math.max(bob, hold(t, at, at + 0.04, at + 0.1, at + 0.25));
      p.jaw = RELAXED_JAW + 0.5 * bob;
      p.jawMix = bob;
      p.pitch = -0.1 * bob;
      p.roll = -0.3 * dir * hold(t, 1.7, 2.0, 2.6, 3.3);
      p.rise = 0.05 * keys(t, [[0.15, 0], [0.22, 1], [0.5, 0]]) + 0.03 * bob;
      p.eyeGlow = 1 + e;
      p.idle = 1 - e;
    },
  },
  {
    // A firefly buzzes in and loops around the dog's face, the head following it. Snap! Gulp.
    // The muzzle blinks from inside like a lantern, then a burp lets out a puff of sparks.
    name: 'firefly',
    seconds: 6.0,
    tongue: false,
    cues: [[FIREFLY_BURP, 'sparks']],
    pose(t, p, dir) {
      const e = hold(t, 0, 0.6, 5.4, 6.0);
      const [x, y, z] = fireflyAt(t, dir);
      // The fly glows in slow pulses, like a real one.
      p.firefly = hold(t, 0, 0.15, FIREFLY_CATCH - 0.02, FIREFLY_CATCH) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 1.3)));
      p.flyX = x;
      p.flyY = y;
      p.flyZ = z;
      p.flyCatch = ease((t - (FIREFLY_CATCH - 0.25)) / 0.25);
      // The head follows a moment behind the fly, until the catch.
      const [lx, ly, lz] = fireflyAt(Math.max(0, t - 0.2), dir);
      const follow = hold(t, 0.3, 0.9, FIREFLY_CATCH, FIREFLY_CATCH + 0.6);
      p.yaw = Math.max(-0.85, Math.min(0.85, Math.atan2(lx, lz))) * follow;
      p.pitch = -Math.max(-0.45, Math.min(0.45, Math.atan2(ly, Math.hypot(lx, lz)))) * follow;
      p.lean = 0.12 * hold(t, FIREFLY_CATCH - 0.2, FIREFLY_CATCH, FIREFLY_CATCH + 0.05, FIREFLY_CATCH + 0.4);
      p.jaw = keys(t, [[3.35, RELAXED_JAW], [FIREFLY_CATCH - 0.12, 1.1], [FIREFLY_CATCH, 0.25], [FIREFLY_BURP - 0.1, 0.25], [FIREFLY_BURP, 1.0], [FIREFLY_BURP + 0.35, 0.3]]);
      p.jawMix = hold(t, 3.3, 3.45, 5.6, 5.95);
      // The gulp nods the head and bobs it down.
      const gulp = hold(t, FIREFLY_GULP, FIREFLY_GULP + 0.08, FIREFLY_GULP + 0.12, FIREFLY_GULP + 0.35);
      p.pitch += 0.12 * gulp - 0.15 * hold(t, FIREFLY_BURP - 0.05, FIREFLY_BURP + 0.05, FIREFLY_BURP + 0.2, FIREFLY_BURP + 0.5);
      p.rise = -0.03 * gulp;
      // Blinks of firefly light inside the mouth, then one bright flash that the burp lets out.
      p.mouthGlow = Math.max(hold(t, 4.25, 4.32, 4.4, 4.55), hold(t, 4.65, 4.72, 4.8, 4.95), hold(t, FIREFLY_BURP - 0.08, FIREFLY_BURP, FIREFLY_BURP + 0.05, FIREFLY_BURP + 0.3));
      p.eyeGlow = 1 + 0.4 * follow + 1.2 * hold(t, 4.25, 4.35, 4.9, 5.1);
      p.eyeOpen = 1 - 0.7 * hold(t, FIREFLY_BURP - 0.05, FIREFLY_BURP + 0.05, FIREFLY_BURP + 0.3, FIREFLY_BURP + 0.6);
      p.idle = 1 - e;
    },
  },
  {
    // Scratched in the sweet spot behind one ear: the head leans into it with eyes shut in bliss,
    // that ear lifts, and the scratching speeds up, jostling the head. Then a contented groan.
    name: 'scratch',
    seconds: 3.7,
    tongue: false,
    auto: true,
    pose(t, p, dir) {
      const e = hold(t, 0, 0.4, 2.8, 3.6);
      let jostle = 0;
      for (const at of SCRATCH_STROKES) jostle = Math.max(jostle, hold(t, at, at + 0.02, at + 0.03, at + 0.1));
      const ear = 0.3 * e + 0.05 * Math.sin(t * 2 * Math.PI * 4) * e;
      if (dir > 0) p.earR = ear;
      else p.earL = ear;
      p.roll = -0.35 * dir * e + 0.03 * jostle;
      p.yaw = 0.15 * dir * e;
      p.pitch = -0.12 * e;
      p.rise = 0.012 * jostle;
      p.jaw = 0.8;
      p.jawMix = e;
      p.eyeOpen = 1 - 0.85 * e;
      p.eyeGlow = 1 + 0.4 * e;
      p.idle = 1 - e;
    },
  },
  {
    // A jack-o'-lantern: the head turns pumpkin orange with grooves, a match strikes, and a candle
    // lights inside the mouth and eyes. The dog grins, then blows its own candle out.
    name: 'pumpkin',
    seconds: 4.4,
    tongue: false,
    pose(t, p, dir) {
      p.pumpkin = hold(t, 0, 0.6, 3.6, 4.3);
      p.mouthGlow = hold(t, PUMPKIN_LIGHT, PUMPKIN_LIGHT + 0.15, PUMPKIN_OUT, PUMPKIN_OUT + 0.08);
      // A wide grin, pursed to blow at the end.
      p.jaw = keys(t, [[0.7, RELAXED_JAW], [1.0, 0.95], [3.1, 0.95], [3.3, 0.45]]);
      p.jawMix = hold(t, 0.7, 1.0, 3.7, 4.1);
      const dark = hold(t, PUMPKIN_OUT, PUMPKIN_OUT + 0.05, 3.8, 4.3);
      p.eyeGlow = (1 + 1.3 * p.mouthGlow) * (1 - 0.6 * dark);
      p.roll = 0.08 * dir * Math.sin(t * 2) * p.pumpkin;
      p.pitch = 0.08 * hold(t, 3.15, 3.3, 3.5, 3.9);
      p.idle = 1 - 0.7 * p.pumpkin;
    },
  },
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

/** An ear springing up at `up`, overshooting and wobbling, then flopping back down at `down`. */
function earPop(t: number, up: number, down: number): number {
  return keys(t, [[up, 0], [up + 0.12, 1.12], [up + 0.24, 0.9], [up + 0.36, 1.04], [up + 0.46, 1], [down, 1], [down + 0.25, -0.06], [down + 0.4, 0.04], [down + 0.55, 0]]);
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
