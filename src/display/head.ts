import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { HeadVariant } from '../config';
import type { MouthState } from '../audio/lipsync';
import { FACE_MID_X, OzSculptor, mapFeature, type SculptParams } from './oz-sculpt';
import { blendToRest, restPose, type Trick } from './tricks';
import type { FlingSource } from './droplets';

/** Landmarks in the mesh's own coordinates. Every model faces +z with +y up. */
interface Rig {
  /** World units per mesh unit at headScale 1. */
  scale: number;
  /** The neck point the head turns around. */
  pivot: THREE.Vector3;
  /** Jaw angle (radians) from fully closed to fully open. */
  jawMax: number;
  /** How far the model's own jaw already hangs open. Silence rotates it shut by this much. */
  jawRest: number;
  /** Fade the neck across a plane: xyz is its normal toward the head, w its offset. */
  cut: THREE.Vector4;
  /** A closed lip seam that opens by stretching (human scans). False for a modeled open mouth. */
  seamMouth: boolean;
  /** Paint eyes over closed lids. False glows the model's own eyes instead. */
  paintEyes: boolean;
  /** Radius of the eye glow, used when paintEyes is false. */
  eyeRadius: number;
  /** Left-right midline of the face. */
  midX: number;
  seamY: number;
  chinY: number;
  mouthZ: number;
  mouthHalfW: number;
  hinge: THREE.Vector3;
  eyeL: THREE.Vector3;
  eyeR: THREE.Vector3;
  /** Height and depth of the front of the mouth, where a tongue comes out. */
  tongueLip: THREE.Vector2;
  /** Just in front of the closed lips, where a gum bubble grows from. */
  mouthFront: THREE.Vector3;
  /** Where a biscuit sits on top of the nose. Only measured for the Labrador. */
  noseTop?: THREE.Vector3;
}

const SCAN_RIG: Rig = {
  scale: 0.3,
  pivot: new THREE.Vector3(0, 0.2, -0.3),
  jawMax: 0.24,
  jawRest: 0,
  cut: neckCut(-0.85),
  seamMouth: true,
  paintEyes: true,
  eyeRadius: 0,
  midX: FACE_MID_X,
  seamY: 0.45,
  chinY: -0.55,
  mouthZ: 2.24,
  mouthHalfW: 0.5,
  hinge: new THREE.Vector3(0, 0.95, -0.2),
  // The eyeballs bulge at x -0.71 and 0.52, about 0.6 either side of the midline.
  eyeL: new THREE.Vector3(FACE_MID_X - 0.62, 1.78, 1.75),
  eyeR: new THREE.Vector3(FACE_MID_X + 0.62, 1.78, 1.75),
  // The scans have no separate tongue.
  tongueLip: new THREE.Vector2(0.45, 2.24),
  mouthFront: new THREE.Vector3(FACE_MID_X, 0.45, 2.3),
};

/** The sculpt sinks the eyes, and setSculpt() moves the chin landmark with the chin drop. */
const OZ_RIG: Rig = {
  ...SCAN_RIG,
  // Fade the neck high. The narrowed chin would otherwise sit on a wide neck like a funnel.
  cut: neckCut(-0.3),
  // Centered on the scan's closed lid line, which sits a little below the eyeball's middle.
  eyeL: new THREE.Vector3(FACE_MID_X - 0.66, 1.71, 1.65),
  eyeR: new THREE.Vector3(FACE_MID_X + 0.66, 1.71, 1.65),
};

const PROCEDURAL_RIG: Rig = {
  ...SCAN_RIG,
  midX: 0,
  cut: neckCut(-0.6),
  mouthZ: 1.95,
  mouthFront: new THREE.Vector3(0, 0.45, 2.0),
  eyeL: new THREE.Vector3(-0.6, 1.78, 1.6),
  eyeR: new THREE.Vector3(0.6, 1.78, 1.6),
};

/** Eye brightness while the mic is muted, as a fraction of normal. */
const MUTED_EYE_GLOW = 0.5;

/**
 * "Dog" by all of life (CC BY 4.0): a full-body Lab standing on y = 0, nose at +z, mouth
 * modeled open. Landmarks measured from side, front and midline-section renders.
 */
const LABRADOR_RIG: Rig = {
  scale: 0.68,
  pivot: new THREE.Vector3(0, 4.15, 3.5),
  // Closed to a 24° gape. The model's own pose hangs about 16° open.
  jawMax: 0.42,
  jawRest: 0.27,
  hinge: new THREE.Vector3(0, 4.22, 3.62),
  // Behind the skull, tilted with the neck: top of the neck (y 5.3, z 2.85) down to the throat.
  cut: new THREE.Vector4(0, 0.424, 0.905, 0.424 * 5.3 + 0.905 * 2.85),
  seamMouth: false,
  paintEyes: false,
  eyeRadius: 0.07,
  eyeL: new THREE.Vector3(-0.27, 4.85, 4.05),
  eyeR: new THREE.Vector3(0.27, 4.85, 4.05),
  // The gap between the lower lip (y 4.03) and upper lip (y 4.15), just in front of the lower front teeth.
  tongueLip: new THREE.Vector2(4.05, 4.45),
  // Under the nose, in front of the upper lip (z 4.67 at y 4.15).
  mouthFront: new THREE.Vector3(0, 4.03, 4.62),
  // The top of the nose leather is at y 4.58 here. Raised by half a biscuit.
  noseTop: new THREE.Vector3(0, 4.64, 4.75),
  // Unused without a seam mouth, but kept consistent with the measurements.
  midX: 0,
  seamY: 4.1,
  chinY: 3.8,
  mouthZ: 4.5,
  mouthHalfW: 0.38,
};

/** A horizontal neck fade at height y, for the upright human scans. */
function neckCut(y: number): THREE.Vector4 {
  return new THREE.Vector4(0, 1, 0, y);
}

const vertexShader = /* glsl */ `
uniform float uJaw;
uniform float uWidth;
uniform float uSeamY;
uniform float uChinY;
uniform float uMouthZ;
uniform float uMouthHalfW;
uniform float uMidX;
uniform vec3 uHinge;
uniform float uJawMax;
uniform float uJawRest;
uniform float uSeamMouth;
uniform vec4 uTongue;
uniform vec2 uTongueLip;
uniform float uTime;
uniform float uMelt;
uniform vec3 uPivot;
uniform float uFloorY;
uniform float uMeshUnit;
uniform mat3 uNeckFix;
// Pulls the neck base back while the head leans forward, in mesh units, so the neck stretches.
uniform vec3 uNeckPull;
attribute float aJaw;
attribute float aTongue;
attribute vec2 aTongueTip;
// The upper canines: xyz is the tooth's root, w is 1. All zero off the canines.
attribute vec4 aFang;
// How far this mouth-floor vertex sinks while the tongue is out. See labradorMouthFloor().
attribute float aFloorDrop;
// How much of its ear's lift this vertex takes: + on the right ear, - on the left, 0 off the ears. See labradorEars().
attribute float aEar;
// Each ear's lift angle in radians, left then right, the hinge it swings on, and the way it hangs.
uniform vec2 uEarLift;
uniform vec3 uEarPivotL;
uniform vec3 uEarAxisL;
uniform vec3 uEarDownL;
uniform vec3 uEarPivotR;
uniform vec3 uEarAxisR;
uniform vec3 uEarDownR;
// Radians a fully lifted ear turns about its own length, so its inside faces the audience instead of its edge.
uniform float uEarTwist;
uniform float uEarLiftMax;
uniform float uFangs;
varying float vFang;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying float vJawW;
varying vec2 vUv;

float mouthMask(vec3 p) {
  return (1.0 - smoothstep(uMouthHalfW * 0.75, uMouthHalfW * 1.25, abs(p.x - uMidX)))
       * smoothstep(uMouthZ - 0.7, uMouthZ - 0.25, p.z);
}

// 1 for vertices that ride on the jaw. The step is sharp across the lips, so opening
// stretches the faces that span the seam. The fragment shader paints those faces dark.
float jawWeight(vec3 p) {
  float band = mix(0.3, 0.015, mouthMask(p));
  float below = 1.0 - smoothstep(uSeamY - band, uSeamY + band, p.y);
  float front = smoothstep(uHinge.z - 0.4, uHinge.z + 1.0, p.z);
  float throat = smoothstep(uChinY - 0.8, uChinY + 0.1, p.y);
  return below * front * throat;
}

// Slides the tongue out over the lower teeth, hangs it past the lip, and curls the tip up.
// uTongue is (slide, curl, side, droop). w runs from 0 at the root to 1 at the tip.
void moveTongue(inout vec3 p, inout vec3 n, float w) {
  float slide = uTongue.x;
  // The model's tongue ends in a thick, blunt tip that only looks right inside the mouth.
  // Out in the open, round it and thin it toward an edge.
  p.xy += smoothstep(0.0, 0.35, slide) * aTongueTip;
  p.z += slide * w * 0.45;
  // Rise over the lower front teeth on the way out.
  p.y += slide * w * 0.1;
  p.x += uTongue.z * w * w;
  float past = max(p.z - uTongueLip.y, 0.0);
  p.y -= uTongue.w * past * past * 1.2;
  // Bend the part in front of a pivot just ahead of the upper lip, so a curl clears it.
  float pivotY = uTongueLip.x + slide * 0.1;
  float pivotZ = uTongueLip.y + 0.3;
  // Spread over a good length of tongue, so it curls in an arc instead of folding at a corner.
  // It starts at the pivot, not behind it: rotating anything behind the pivot swings it down and
  // back, which dragged the underside of the tongue toward the lips.
  float bend = uTongue.y * smoothstep(pivotZ, pivotZ + 0.35, p.z);
  float c = cos(bend);
  float s = sin(bend);
  vec2 q = vec2(p.z - pivotZ, p.y - pivotY);
  p.z = pivotZ + q.x * c - q.y * s;
  p.y = pivotY + q.x * s + q.y * c;
  n = vec3(n.x, n.z * s + n.y * c, n.z * c - n.y * s);
}

// Slumps the head down onto a puddle just under the chin (uFloorY) and spreads what reaches it
// outward. Some columns sag faster and drip below. Works in world units (uMeshUnit mesh units
// each), so every head melts alike.
vec3 meltHead(vec3 p) {
  float m = uMelt;
  vec2 c = (p.xz - uPivot.xz) / uMeshUnit;
  // A soft ripple, not sharp ridges, so it sags in waves instead of splitting into columns.
  float drip = pow(0.5 + 0.5 * sin(c.x * 31.0 + 1.7 * sin(c.y * 13.0)), 2.0);
  float h = (p.y - uFloorY) / uMeshUnit;
  // Drips are strongest mid-melt and gone at the end, so it settles into one pile, not columns.
  float drippy = 4.0 * m * (1.0 - m);
  float sag = clamp(m * (1.0 + 0.15 * drip * drippy), 0.0, 1.0);
  // Everything collapses toward the floor, the neck below it included.
  h *= mix(1.0, 0.12, sag);
  h -= drippy * 0.04 * drip;
  c *= 1.0 + 0.9 * m * (1.0 - smoothstep(0.0, 0.35, max(h, 0.0)));
  c.x += sin(h * 14.0 + uTime * 4.0) * 0.025 * m;
  return vec3(uPivot.x + c.x * uMeshUnit, uFloorY + h * uMeshUnit, uPivot.z + c.y * uMeshUnit);
}

// Rodrigues' rotation of v by angle a about the unit axis k.
vec3 rotateAbout(vec3 v, vec3 k, float a) {
  return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  if (aTongue > 0.0) moveTongue(p, n, aTongue);
  // Swing an ear flap up on its hinge, then turn it about its own length to face forward. The
  // flap bends near the root, where its weight eases in.
  if (aEar != 0.0) {
    bool right = aEar > 0.0;
    float a = (right ? uEarLift.y : uEarLift.x) * abs(aEar);
    vec3 pivot = right ? uEarPivotR : uEarPivotL;
    vec3 axis = right ? uEarAxisR : uEarAxisL;
    p = pivot + rotateAbout(p - pivot, axis, a);
    n = rotateAbout(n, axis, a);
    // The left ear is a mirror image, so it turns the other way.
    vec3 along = rotateAbout(right ? uEarDownR : uEarDownL, axis, a);
    float twist = sign(aEar) * uEarTwist * a / uEarLiftMax;
    p = pivot + rotateAbout(p - pivot, along, twist);
    n = rotateAbout(n, along, twist);
  }
  // The model's mouth floor is sculpted as a second tongue, under the real one. Sink it flat
  // while the tongue is out, so no tongue stays behind.
  p.y -= aFloorDrop * smoothstep(0.0, 0.3, uTongue.x);
  // Vampire: stretch each upper canine down from its root into a long fang.
  if (aFang.w > 0.0) p = aFang.xyz + (p - aFang.xyz) * vec3(1.0 + 0.3 * uFangs, 1.0 + 1.5 * uFangs, 1.0 + 0.3 * uFangs);
  vFang = aFang.w * uFangs;
  float m = mouthMask(position) * uSeamMouth;
  float nearSeam = exp(-pow((position.y - uSeamY) / 0.3, 2.0));

  // Wide "ee" or rounded "oo".
  p.x = uMidX + (p.x - uMidX) * (1.0 + uWidth * 0.12 * m * nearSeam * (0.3 + uJaw));
  // The upper lip lifts a little as the mouth opens.
  float upper = m * smoothstep(uSeamY - 0.01, uSeamY + 0.03, position.y) * exp(-pow((position.y - uSeamY) / 0.18, 2.0));
  p.y += upper * uJaw * 0.07;

  // A modeled open mouth carries precomputed weights in aJaw.
  float w = mix(aJaw, jawWeight(position), uSeamMouth);
  float a = (uJaw * uJawMax - uJawRest) * w;
  float c = cos(a);
  float s = sin(a);
  vec3 q = p - uHinge;
  p = uHinge + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
  if (uMelt > 0.0) p = meltHead(p);
  // The neck lags a trick's tilt and nod. Below the chin, uNeckFix undoes part of the trick's
  // share of the head's rotation: fully 0.3 world units down, not at all at the chin.
  float lag = 1.0 - smoothstep(uChinY - 0.3 * uMeshUnit, uChinY, position.y);
  vec3 fromPivot = p - uPivot;
  p = uPivot + mix(fromPivot, uNeckFix * fromPivot, lag) + uNeckPull * lag;
  n = mix(n, uNeckFix * n, lag);

  vJawW = w;
  vLocal = position;
  vUv = uv;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uRim;
uniform vec3 uFireColor;
uniform float uTime;
uniform float uFire;
uniform float uFlash;
uniform float uEyeGlow;
uniform float uUseMap;
uniform float uAlphaCut;
uniform vec4 uCut;
uniform float uSeamMouth;
uniform float uPaintEyes;
uniform float uEyeRadius;
uniform float uChinY;
uniform float uRimGlow;
uniform float uShine;
uniform float uGhost;
uniform float uMelt;
uniform float uEyeRed;
uniform float uCap;
uniform float uPumpkin;
uniform float uMouthGlow;
// The middle of the mouth, where a glow inside it centers, in mesh units.
uniform vec3 uGlowAt;
uniform vec3 uPivot;
uniform float uMeshUnit;
/** Which way the face points, in world space. */
uniform vec3 uFacing;
varying float vFang;
uniform float uJaw;
uniform float uSeamY;
uniform float uMouthHalfW;
uniform float uMidX;
uniform vec3 uEyeL;
uniform vec3 uEyeR;
uniform float uEyeOpen;
uniform vec2 uWink;
uniform float uEyeScale;
uniform vec2 uGaze;
uniform sampler2D uMap;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vLocal;
varying float vJawW;
varying vec2 vUv;

// A painted eye: an almond of glowing white, a bright iris and a dark pupil, drawn over the
// scan's closed lids. d is the offset from the eye center. Returns color and coverage.
vec4 paintEye(vec3 d, float open) {
  vec2 q = d.xy / uEyeScale;
  float onFace = 1.0 - smoothstep(0.3, 0.5, abs(d.z));
  // The almond's height closes with the lids.
  float almond = length(vec2(q.x / 0.3, q.y / (0.15 * max(open, 0.001))));
  float cover = (1.0 - smoothstep(0.8, 1.0, almond)) * onFace * step(0.02, open);
  float r = length(q - uGaze) / 0.13;
  // Whites stay dimmer than the iris, so bloom doesn't wash the iris out.
  vec3 c = vec3(0.42, 0.58, 0.36);
  c = mix(c, vec3(0.95, 1.15, 0.15), 1.0 - smoothstep(0.85, 1.0, r));
  c = mix(c, vec3(0.0, 0.02, 0.0), 1.0 - smoothstep(0.48, 0.58, r));
  c = mix(c, c.g * vec3(1.6, 0.15, 0.1), uEyeRed);
  return vec4(c, cover);
}

void main() {
  float cutD = dot(vLocal, uCut.xyz) - uCut.w;
  float neck = smoothstep(-0.5, 0.25, cutD);
  // Human scans: keep the front of the chin where the neck fades, so the face ends in a point.
  neck = max(neck, uSeamMouth * smoothstep(1.2, 1.7, vLocal.z) * smoothstep(uChinY - 0.2, uChinY + 0.1, vLocal.y));
  if (neck <= 0.001) discard;

  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 lKey = normalize(vec3(-0.3, 0.9, 0.7));
  vec3 lFire = normalize(vec3(0.0, -0.9, 0.5));
  float key = max(dot(N, lKey), 0.0);
  float under = max(dot(N, lFire), 0.0);

  float detail = 1.0;
  if (uUseMap > 0.5) {
    vec4 t = texture2D(uMap, vUv);
    // Melting fades out the whiskers (thin alpha-masked strands) early, before they twist into odd shapes.
    if (t.a < mix(uAlphaCut, 0.99, smoothstep(0.03, 0.3, uMelt))) discard;
    detail = 0.45 + 1.1 * dot(t.rgb, vec3(0.3, 0.59, 0.11));
  }
  vec3 col = uBase * (0.12 + 0.7 * key) * detail;

  float flicker = 0.85 + 0.15 * sin(uTime * 13.0) * sin(uTime * 7.3 + 1.0);
  col += uFireColor * under * 0.3 * uFire * flicker;

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
  col += uRim * fres * uRimGlow;
  vec3 H = normalize(lKey + V);
  col += vec3(0.6, 1.0, 0.6) * pow(max(dot(N, H), 0.0), 40.0) * 0.25 * uShine;

  // Ghost: a pale shell, brightest at the edges, with the eyes still glowing. The material adds it over the scene behind.
  // The face stays dim, under the bloom threshold, so only the outline glows and the backdrop shows through.
  vec3 ghost = vec3(0.8, 0.92, 1.0) * (0.008 + 0.012 * key + 0.17 * fres);
  col = mix(col, ghost, uGhost);

  if (uPaintEyes > 0.5) {
    vec4 eyeL = paintEye(vLocal - uEyeL, uEyeOpen * (1.0 - uWink.x));
    vec4 eyeR = paintEye(vLocal - uEyeR, uEyeOpen * (1.0 - uWink.y));
    col = mix(col, eyeL.rgb * uEyeGlow, eyeL.a);
    col = mix(col, eyeR.rgb * uEyeGlow, eyeR.a);
  } else {
    // The model has real eyes: light them from within, and let blinks dim them.
    vec3 dl = vLocal - uEyeL;
    vec3 dr = vLocal - uEyeR;
    float r2 = uEyeRadius * uEyeRadius;
    float glow = exp(-dot(dl, dl) / r2) * (1.0 - uWink.x) + exp(-dot(dr, dr) / r2) * (1.0 - uWink.y);
    vec3 eyeColor = mix(mix(vec3(0.75, 1.0, 0.45), vec3(1.0, 0.1, 0.06), uEyeRed), vec3(1.0, 0.6, 0.15), uPumpkin);
    col += eyeColor * glow * 0.7 * uEyeGlow * uEyeOpen;
  }

  // Jack-o'-lantern grooves: dark lines running over the head from front to back, like a pumpkin's ribs.
  float around = atan(vLocal.x - uMidX, vLocal.z - uPivot.z);
  col *= 1.0 - 0.45 * uPumpkin * (1.0 - smoothstep(0.0, 0.3, abs(sin(around * 4.5))));
  // A light inside the mouth: brightest deep inside, and soft through the muzzle, like a lantern.
  vec3 dg = (vLocal - uGlowAt) / (vec3(0.3, 0.2, 0.32) * uMeshUnit);
  float candle = 0.75 + 0.25 * sin(uTime * 23.0) * sin(uTime * 13.7 + 2.0);
  vec3 glowColor = mix(vec3(0.75, 1.0, 0.25), vec3(1.0, 0.55, 0.12) * candle, uPumpkin);
  col += glowColor * exp(-dot(dg, dg)) * uMouthGlow * 1.2;

  // Mouth interior: the faces stretched across the lip seam.
  float inMouth = (1.0 - smoothstep(uMouthHalfW * 0.8, uMouthHalfW * 1.2, abs(vLocal.x - uMidX)))
                * exp(-pow((vLocal.y - uSeamY) / 0.25, 2.0));
  float gap = smoothstep(0.02, 0.2, vJawW) * (1.0 - smoothstep(0.8, 0.98, vJawW));
  col = mix(col, vec3(0.0, 0.025, 0.0), clamp(uSeamMouth * inMouth * gap * smoothstep(0.02, 0.12, uJaw) * 1.4, 0.0, 1.0));

  // The model has no back of the head, so from behind you look into the shell. While uCap is on
  // (the spin), paint the inside a smooth, featureless green, shaded top to bottom, so it reads as solid.
  // From behind, the tongue and teeth show through the opening too, so paint them the same.
  float behind = smoothstep(0.1, -0.2, dot(V, uFacing));
  float inMouth2 = step(abs(vLocal.x - uMidX), uMouthHalfW * 1.3) * step(uChinY - 0.1, vLocal.y) * step(vLocal.y, uEyeL.y - 0.2);
  float capped = gl_FrontFacing ? behind * inMouth2 : 1.0;
  col = mix(col, uBase * (0.12 + 0.3 * smoothstep(uChinY, uEyeL.y + 0.6, vLocal.y)), uCap * capped);
  col *= 1.0 - 0.3 * uMelt;
  // Fangs gleam pale as they grow.
  col = mix(col, vec3(0.85, 1.0, 0.85), vFang * 0.45);
  col += uFlash * vec3(0.7, 0.85, 1.0) * (0.25 + 0.8 * key);
  col *= 0.96 + 0.04 * sin(vPosW.y * 140.0 - uTime * 6.0);
  gl_FragColor = vec4(col * neck, 1.0);
}
`;

/** Emerald City colors for the color trick, as [base, rim]: green, purple, yellow, red, and green again. */
const PALETTE = [
  [0x2a9a36, 0x7dff8a],
  [0x7a2aa0, 0xd890ff],
  // Yellow is far brighter than purple or red at the same strength, so it's darker here to keep the bloom from blowing it out.
  [0x7a6812, 0xd6be4c],
  [0xa82222, 0xff8070],
  [0x2a9a36, 0x7dff8a],
].map(([base, rim]) => [new THREE.Color(base), new THREE.Color(rim)]);

/** Jack-o'-lantern orange, as [base, rim]. */
const PUMPKIN = [new THREE.Color(0xc0500e), new THREE.Color(0xffa040)];

/** How far an ear swings up on its hinge at full lift, in radians. About 150°, so a hanging ear stands up. */
const EAR_LIFT = 2.6;
/** How far a fully lifted ear turns about its own length, in radians, so its inside faces the audience. */
const EAR_TWIST = 1.2;

/** How much of a trick's tilt and nod the base of the neck follows. */
const NECK_FOLLOW = 1 / 3;

/** How long a cancelled trick takes to return to rest. */
const CANCEL_SEC = 0.3;

/** Gum bubble radius at full size, in world units at head scale 1. */
const BUBBLE_RADIUS = 0.28;
/** How much higher a tiny bubble starts than a full one, in world units at head scale 1. */
const BUBBLE_START_LIFT = 0.06;

const bubbleVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// A thin pink film: nearly clear face-on, thicker and brighter at the edges.
const bubbleFragment = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  gl_FragColor = vec4(vec3(1.0, 0.42, 0.75) * (0.35 + 0.9 * f), 0.3 + 0.6 * f);
}
`;

export class Head implements FlingSource {
  /** Turns around the neck pivot. Position it in world space. */
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;
  private nodVel = 0;
  private nod = 0;
  private blinkAt = 2;
  private blink = 0;
  private gaze = new THREE.Vector2();
  private gazeTarget = new THREE.Vector2();
  private glanceAt = 1;
  private placeY = 0;
  private eyeDim = 1;
  /** Holds the head still at this yaw (radians), for comparing against references. */
  pinnedYaw: number | null = null;
  /** Holds any trick at this many seconds in, for checking its poses. */
  pinnedTrickAt: number | null = null;
  private sculptor: OzSculptor | null = null;
  private trick: Trick | null = null;
  private trickStart = 0;
  private trickDir = 1;
  private fullTurn = new THREE.Matrix4();
  private neckTurn = new THREE.Matrix4();
  private neckEuler = new THREE.Euler();
  private facing = new THREE.Vector3();
  /** When cancelTrick() froze the running trick, to blend it back to rest. */
  private cancelAt: number | null = null;
  /** Only the Labrador has a separate tongue, so only it can do the tongue tricks. */
  readonly hasTongue: boolean;
  /** Only the Labrador has separate canine teeth to grow into fangs. */
  readonly hasFangs: boolean;
  /** Only the Labrador has floppy ears that lift. */
  readonly hasEars: boolean;
  /** Only the Labrador has the top of its nose measured, for the biscuit. */
  readonly hasNoseTop: boolean;
  spray = 0;
  /** Vertices far from the roll axis (ears, cheeks, crown), where a shake flings water from. */
  private flingVerts: number[];
  private prevWorld = new THREE.Matrix4();
  private frameDt = 1 / 60;
  /** Draws depth only, before the ghost, so the ghost shows just its front surface. */
  private depthMesh: THREE.Mesh;
  private bubble: THREE.Mesh;
  /** Top of the head, in mesh units. */
  private crown: THREE.Vector3;
  /** Floats "Z"s while above 0.5. */
  zzz = 0;
  /** How far the head has turned into a see-through ghost, 0 to 1. */
  ghost = 0;
  /** How bright the firefly glows, 0 (gone) to 1. fireflyWorld() says where it is. */
  firefly = 0;
  private fireflyAt = new THREE.Vector3();
  private fireflyFree = new THREE.Vector3();
  /** Size of the dog biscuit, 0 (none) to 1 at head scale 1. treatWorld() says where it is. */
  treat = 0;
  /** Radians the biscuit has spun in the air. */
  treatSpin = 0;
  private treatAt = new THREE.Vector3();
  /** Where the biscuit left the nose. */
  private treatLaunch = new THREE.Vector3();
  private treatTossed = false;
  private treatMouth = new THREE.Vector3();
  private treatFlight = new THREE.Vector3();
  /** Brightness of the rainbow behind the head, 0 to 1, and how much of its arc is drawn, signed by its starting side. */
  rainbow = 0;
  rainbowArc = 0;

  private constructor(
    geometry: THREE.BufferGeometry,
    private rig: Rig,
    map: THREE.Texture | null,
    opts: { alphaCut?: number; doubleSided?: boolean; ears?: EarHinge[] } = {},
  ) {
    this.hasTongue = geometry.hasAttribute('aTongue');
    this.hasFangs = geometry.hasAttribute('aFang');
    this.hasEars = !!opts.ears;
    this.hasNoseTop = !!rig.noseTop;
    const [earL, earR] = opts.ears ?? [];
    this.uniforms = {
      uJaw: { value: 0 },
      uWidth: { value: 0 },
      uJawMax: { value: rig.jawMax },
      uJawRest: { value: rig.jawRest },
      uSeamMouth: { value: rig.seamMouth ? 1 : 0 },
      uPaintEyes: { value: rig.paintEyes ? 1 : 0 },
      uEyeRadius: { value: rig.eyeRadius },
      uCut: { value: rig.cut },
      uAlphaCut: { value: opts.alphaCut ?? 0 },
      uSeamY: { value: rig.seamY },
      uChinY: { value: rig.chinY },
      uMouthZ: { value: rig.mouthZ },
      uMouthHalfW: { value: rig.mouthHalfW },
      uMidX: { value: rig.midX },
      uHinge: { value: rig.hinge },
      uEyeL: { value: rig.eyeL },
      uEyeR: { value: rig.eyeR },
      uBase: { value: PALETTE[0][0].clone() },
      uRim: { value: PALETTE[0][1].clone() },
      uFireColor: { value: new THREE.Color(0xff7a1a) },
      uTime: { value: 0 },
      uFire: { value: 1 },
      uFlash: { value: 0 },
      uEyeGlow: { value: 1 },
      uEyeOpen: { value: 1 },
      uWink: { value: new THREE.Vector2() },
      uTongue: { value: new THREE.Vector4() },
      uTongueLip: { value: rig.tongueLip },
      uEyeScale: { value: 1 },
      uGaze: { value: new THREE.Vector2() },
      uShine: { value: 1 },
      uGhost: { value: 0 },
      uMelt: { value: 0 },
      uFangs: { value: 0 },
      uEyeRed: { value: 0 },
      uPivot: { value: rig.pivot },
      // A little under the chin, so the jaw melts too.
      uFloorY: { value: rig.chinY - 0.15 / rig.scale },
      uMeshUnit: { value: 1 / rig.scale },
      uNeckFix: { value: new THREE.Matrix3() },
      uNeckPull: { value: new THREE.Vector3() },
      uCap: { value: 0 },
      uEarLift: { value: new THREE.Vector2() },
      uEarPivotL: { value: earL?.pivot ?? new THREE.Vector3() },
      uEarAxisL: { value: earL?.axis ?? new THREE.Vector3(0, 0, 1) },
      uEarDownL: { value: earL?.down ?? new THREE.Vector3(0, -1, 0) },
      uEarPivotR: { value: earR?.pivot ?? new THREE.Vector3() },
      uEarAxisR: { value: earR?.axis ?? new THREE.Vector3(0, 0, 1) },
      uEarDownR: { value: earR?.down ?? new THREE.Vector3(0, -1, 0) },
      uEarTwist: { value: EAR_TWIST },
      uEarLiftMax: { value: EAR_LIFT },
      uPumpkin: { value: 0 },
      uMouthGlow: { value: 0 },
      uGlowAt: { value: rig.mouthFront.clone().add(new THREE.Vector3(0, 0.05, -0.3).divideScalar(rig.scale)) },
      uFacing: { value: new THREE.Vector3(0, 0, 1) },
      uRimGlow: { value: 0.55 },
      uUseMap: { value: map ? 1 : 0 },
      uMap: { value: map },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(rig.pivot).multiplyScalar(-1);
    this.group.add(this.mesh);
    // Same shader and uniforms, so it deforms exactly like the head.
    const depthOnly = material.clone();
    depthOnly.uniforms = this.uniforms;
    depthOnly.colorWrite = false;
    this.depthMesh = new THREE.Mesh(geometry, depthOnly);
    this.depthMesh.position.copy(this.mesh.position);
    // After every opaque object, the backdrop included. Earlier, its depth hides the backdrop behind the ghost.
    this.depthMesh.renderOrder = 1;
    this.depthMesh.visible = false;
    this.group.add(this.depthMesh);
    this.flingVerts = outerVertices(geometry, rig);
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 20),
      new THREE.ShaderMaterial({ vertexShader: bubbleVertex, fragmentShader: bubbleFragment, transparent: true, depthWrite: false }),
    );
    this.bubble.visible = false;
    this.mesh.add(this.bubble);
    geometry.computeBoundingBox();
    this.crown = new THREE.Vector3(rig.midX, geometry.boundingBox!.max.y, rig.pivot.z);
    // Nod inside the turn, so a head turned to the side still tips its own nose up or down.
    this.group.rotation.order = 'YXZ';
    this.setPlacement(1, 0);
  }

  static async create(variant: HeadVariant, sculpt: SculptParams): Promise<Head> {
    if (variant === 'procedural') return new Head(proceduralGeometry(), PROCEDURAL_RIG, null);
    if (variant === 'labrador') return Head.createLabrador();
    const [gltf, map] = await Promise.all([
      new GLTFLoader().loadAsync('/models/LeePerrySmith.glb'),
      new THREE.TextureLoader().loadAsync('/models/Map-COL.jpg'),
    ]);
    map.flipY = false;
    let geometry: THREE.BufferGeometry | null = null;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && !geometry) geometry = o.geometry;
    });
    if (!geometry) throw new Error('No mesh in LeePerrySmith.glb');
    if (variant !== 'oz') return new Head(geometry, SCAN_RIG, map);
    const sculptor = new OzSculptor(geometry);
    const head = new Head(sculptor.geometry, OZ_RIG, map);
    head.sculptor = sculptor;
    head.setSculpt(sculpt);
    return head;
  }

  private static async createLabrador(): Promise<Head> {
    const gltf = await new GLTFLoader().loadAsync('/models/dog.glb');
    let source: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh && !source) source = o;
    });
    if (!source) throw new Error('No mesh in dog.glb');
    const std = (source as THREE.Mesh).material as THREE.MeshStandardMaterial;
    let geometry = (source as THREE.Mesh).geometry;
    let parts = meshParts(geometry);
    const jaw = labradorJawWeights(geometry, LABRADOR_RIG.hinge, parts);
    geometry.setAttribute('aJaw', jaw);
    const tongue = labradorTongueWeights(geometry, parts, jaw);
    if (tongue) {
      geometry.setAttribute('aTongue', tongue);
      ({ geometry, parts } = withTongueUnderside(geometry, parts));
      geometry.setAttribute('aFloorDrop', labradorMouthFloor(geometry, parts));
    }
    const fangs = labradorFangs(geometry, parts, geometry.attributes.aJaw as THREE.BufferAttribute);
    if (fangs) geometry.setAttribute('aFang', fangs);
    const ears = labradorEars(geometry, parts);
    if (ears) geometry.setAttribute('aEar', ears.weights);
    return new Head(geometry, LABRADOR_RIG, std.map, { alphaCut: std.alphaTest, doubleSided: std.side === THREE.DoubleSide, ears: ears?.hinges });
  }

  /** Green edge glow strength: 0 is none. */
  setRimGlow(strength: number) {
    this.uniforms.uRimGlow.value = strength;
  }

  /** Specular highlight strength: 0 is matte, 1 is glossy. */
  setShine(shine: number) {
    this.uniforms.uShine.value = shine;
  }

  /** Reshape the Oz head live. Ignored by the other variants. */
  setSculpt(params: SculptParams) {
    if (!this.sculptor) return;
    this.sculptor.apply(params);
    const u = this.uniforms;
    u.uChinY.value = SCAN_RIG.chinY - params.ozChin;
    // The lip line must match the sculpted mesh exactly, or the jaw splits the face in the wrong place.
    const seam = mapFeature(new THREE.Vector3(OZ_RIG.midX, OZ_RIG.seamY, OZ_RIG.mouthZ), params);
    u.uSeamY.value = seam.y;
    u.uMouthZ.value = seam.z;
    u.uMouthHalfW.value = OZ_RIG.mouthHalfW * params.ozFeatures;
    u.uEyeScale.value = params.ozFeatures;
    u.uEyeL.value = mapFeature(OZ_RIG.eyeL, params);
    u.uEyeR.value = mapFeature(OZ_RIG.eyeR, params);
  }

  setPlacement(scale: number, y: number) {
    this.group.scale.setScalar(this.rig.scale * scale);
    this.placeY = y;
  }

  /**
   * Starts a trick at time t, replacing any trick still running. A later t holds the head still
   * until then. dir (+1 or -1) picks the side for moves that go one way.
   */
  perform(trick: Trick, t: number, dir: number) {
    this.trick = trick;
    this.trickStart = t;
    this.trickDir = dir;
    this.cancelAt = null;
  }

  /** Brings a running trick quickly back to rest, from wherever it is. */
  cancelTrick(t: number) {
    if (this.trick && this.cancelAt === null) this.cancelAt = t;
  }

  /** The top of the head, in world space. */
  crownWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.crown).applyMatrix4(this.mesh.matrixWorld);
  }

  /** Where a full gum bubble sits, in world space. */
  bubbleWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.rig.mouthFront).setZ(this.rig.mouthFront.z + BUBBLE_RADIUS / this.rig.scale).applyMatrix4(this.mesh.matrixWorld);
  }

  /** Where the firefly is, in world space. */
  fireflyWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.fireflyAt);
  }

  /** Where the dog biscuit is, in world space. */
  treatWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.treatAt);
  }

  /** The middle of the mouth, in world space, for sparks a burp lets out. */
  mouthWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.rig.mouthFront).applyMatrix4(this.mesh.matrixWorld);
  }

  /** A random point on the outer head and its velocity, in world space, for a flung drop. */
  flingPoint(pos: THREE.Vector3, vel: THREE.Vector3) {
    const i = this.flingVerts[Math.floor(Math.random() * this.flingVerts.length)];
    const local = new THREE.Vector3().fromBufferAttribute(this.mesh.geometry.attributes.position, i);
    pos.copy(local).applyMatrix4(this.mesh.matrixWorld);
    vel.copy(local).applyMatrix4(this.prevWorld);
    vel.subVectors(pos, vel).divideScalar(this.frameDt);
  }

  /** micLive false dims the eyes, so the performer can see the mute state. */
  update(t: number, dt: number, mouth: MouthState, fire: number, flash: number, micLive = true) {
    const u = this.uniforms;
    this.prevWorld.copy(this.mesh.matrixWorld);
    this.frameDt = Math.max(dt, 1e-3);
    const pose = restPose();
    if (this.trick) {
      // A cancelled trick holds where it was and blends back to rest.
      const at = this.pinnedTrickAt ?? (this.cancelAt ?? t) - this.trickStart;
      if (at < this.trick.seconds) this.trick.pose(at, pose, this.trickDir);
      else this.trick = null;
      if (this.cancelAt !== null) {
        const k = 1 - (t - this.cancelAt) / CANCEL_SEC;
        blendToRest(pose, Math.max(0, k * k * (3 - 2 * k)));
        if (k <= 0) this.trick = this.cancelAt = null;
      }
    }
    u.uTime.value = t;
    u.uJaw.value = mouth.jaw + (pose.jaw - mouth.jaw) * pose.jawMix;
    (u.uTongue.value as THREE.Vector4).set(pose.tongueOut, pose.tongueCurl, pose.tongueSide, pose.tongueDroop);
    (u.uWink.value as THREE.Vector2).set(pose.winkL, pose.winkR);
    this.spray = pose.spray;
    this.zzz = pose.zzz;
    this.ghost = pose.ghost;
    this.setGhost(pose.ghost);
    u.uMelt.value = pose.melt;
    u.uFangs.value = pose.fangs;
    u.uEyeRed.value = pose.eyeRed;
    (u.uEarLift.value as THREE.Vector2).set(pose.earL, pose.earR).multiplyScalar(EAR_LIFT);
    u.uPumpkin.value = pose.pumpkin;
    u.uMouthGlow.value = pose.mouthGlow;
    this.setColors(pose.colors, pose.pumpkin);
    this.setBubble(pose.bubble, t);
    u.uWidth.value = mouth.width;
    u.uFire.value = fire;
    u.uFlash.value = flash;

    // Blink every 3–6 s.
    if (t > this.blinkAt) {
      this.blink = 1;
      this.blinkAt = t + 3 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt / 0.15);
    u.uEyeOpen.value = (1 - Math.sin(this.blink * Math.PI)) * pose.eyeOpen;
    this.eyeDim += ((micLive ? 1 : MUTED_EYE_GLOW) - this.eyeDim) * (1 - Math.exp(-dt / 0.12));
    u.uEyeGlow.value = (1 + Math.min(mouth.level, 1.5) * 0.5) * this.eyeDim * pose.eyeGlow;

    // The pupils glance somewhere new every 0.8–3 s, with a quick saccade.
    if (t > this.glanceAt) {
      this.gazeTarget.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.05);
      this.glanceAt = t + 0.8 + Math.random() * 2.2;
    }
    this.gaze.lerp(this.gazeTarget, 1 - Math.exp(-dt / 0.04));
    (u.uGaze.value as THREE.Vector2).set(this.gaze.x + pose.gazeX, this.gaze.y);

    // Syllable onsets kick a damped spring, so speech reads as emphatic nods.
    this.nodVel += mouth.onset * 0.9;
    this.nodVel += (-60 * this.nod - 7 * this.nodVel) * dt;
    this.nod += this.nodVel * dt;

    const energy = 1 + Math.min(mouth.level, 1.5) * 0.4;
    const g = this.group;
    if (this.pinnedYaw !== null) {
      g.rotation.set(pose.pitch, this.pinnedYaw + pose.yaw, pose.roll);
    } else {
      const idle = pose.idle;
      g.rotation.y = (0.28 * noise1(t * 0.11) + 0.07 * noise1(t * 0.43 + 10)) * energy * idle + pose.yaw;
      g.rotation.x = 0.1 * noise1(t * 0.17 + 20) * idle + this.nod - mouth.level * 0.03 + pose.pitch;
      g.rotation.z = 0.04 * noise1(t * 0.13 + 30) * idle + pose.roll;
    }
    g.position.y = -0.02 + this.placeY + 0.025 * Math.sin(t * 0.9) + pose.rise;
    // A lean pushes the head along its nose, toward whatever it's looking at.
    const facing = this.facing.set(0, 0, 1).applyQuaternion(g.quaternion);
    g.position.x = facing.x * pose.lean;
    g.position.y += facing.y * pose.lean;
    g.position.z = pose.lunge + facing.z * pose.lean;
    // Now, not at render, so flingPoint() sees this frame's pose.
    g.updateMatrixWorld(true);
    // The head turns with the trick's yaw, but the neck base follows only NECK_FOLLOW of its
    // pitch and roll: hand the shader the rotation that takes the full turn back to that. Yaw
    // stays, so the spin turns the neck too instead of twisting it.
    const full = this.fullTurn.makeRotationFromEuler(g.rotation);
    const lag = 1 - NECK_FOLLOW;
    this.neckEuler.set(g.rotation.x - pose.pitch * lag, g.rotation.y, g.rotation.z - pose.roll * lag, 'YXZ');
    const neck = this.neckTurn.makeRotationFromEuler(this.neckEuler);
    (u.uNeckFix.value as THREE.Matrix3).setFromMatrix4(full.invert().multiply(neck));
    // A lean moves the whole head along its nose. Pull the neck base back by the same amount,
    // in the mesh's own frame (where the nose points along +z), so the neck stretches instead of sliding.
    (u.uNeckPull.value as THREE.Vector3).set(0, 0, -pose.lean / g.scale.x);
    u.uCap.value = pose.cap;
    (u.uFacing.value as THREE.Vector3).copy(facing);
    // The firefly flies free around the head, then gets pulled into the mouth for the catch.
    this.firefly = pose.firefly;
    if (pose.firefly > 0) {
      const free = this.fireflyFree.set(pose.flyX, pose.flyY, pose.flyZ).multiplyScalar(g.scale.x / this.rig.scale).add(g.position);
      this.mouthWorld(this.fireflyAt).lerp(free, 1 - pose.flyCatch);
    }
    // The biscuit rides on the nose until tossed, flies from where it left, then drops into the mouth.
    const headScale = g.scale.x / this.rig.scale;
    this.treat = pose.treat * headScale;
    this.treatSpin = pose.treatSpin;
    if (pose.treat > 0 && this.rig.noseTop) {
      if (!pose.treatFree || !this.treatTossed) this.treatLaunch.copy(this.rig.noseTop).applyMatrix4(this.mesh.matrixWorld);
      this.treatAt.copy(this.treatLaunch);
      if (pose.treatFree) this.treatAt.add(this.treatFlight.set(pose.treatX, pose.treatY, pose.treatZ).multiplyScalar(headScale));
      this.treatAt.lerp(this.mouthWorld(this.treatMouth), pose.treatCatch);
    }
    this.treatTossed = pose.treatFree > 0;
    this.rainbow = pose.rainbow;
    this.rainbowArc = pose.rainbowArc;
  }

  /** Blends between the palette entries on either side of `at`, then toward pumpkin orange. */
  private setColors(at: number, pumpkin: number) {
    const i = Math.min(Math.floor(at), PALETTE.length - 2);
    const f = at - i;
    (this.uniforms.uBase.value as THREE.Color).lerpColors(PALETTE[i][0], PALETTE[i + 1][0], f).lerp(PUMPKIN[0], pumpkin);
    (this.uniforms.uRim.value as THREE.Color).lerpColors(PALETTE[i][1], PALETTE[i + 1][1], f).lerp(PUMPKIN[1], pumpkin);
  }

  /**
   * Sizes the gum bubble, 0 to 1, growing forward from the lips with a slight wobble. It starts
   * between the lips and sinks to the mouth front as it grows.
   */
  private setBubble(size: number, t: number) {
    this.bubble.visible = size > 0.001;
    if (!this.bubble.visible) return;
    const r = (size * BUBBLE_RADIUS) / this.rig.scale;
    const wobble = 0.04 * Math.sin(t * 17);
    this.bubble.scale.set(r * (1 + wobble), r * (1 - wobble), r);
    const lift = ((1 - size) * BUBBLE_START_LIFT) / this.rig.scale;
    this.bubble.position.set(this.rig.mouthFront.x, this.rig.mouthFront.y + lift, this.rig.mouthFront.z + r * 0.9);
  }

  /** A ghost adds its light over the scene behind it, so the fire and backdrop show through. */
  private setGhost(amount: number) {
    this.uniforms.uGhost.value = amount;
    const ghostly = amount > 0.001;
    const material = this.mesh.material as THREE.ShaderMaterial;
    material.blending = ghostly ? THREE.AdditiveBlending : THREE.NormalBlending;
    material.transparent = ghostly;
    this.depthMesh.visible = ghostly;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.depthMesh.material as THREE.Material).dispose();
    this.bubble.geometry.dispose();
    (this.bubble.material as THREE.Material).dispose();
    (this.uniforms.uMap.value as THREE.Texture | null)?.dispose();
  }
}

/**
 * The parts of a mesh that don't touch each other: each vertex's part id. Welds vertices at the
 * same position first, since UV seams split them.
 */
function meshParts(geometry: THREE.BufferGeometry): Int32Array {
  const pos = geometry.attributes.position;
  const parent = Int32Array.from({ length: pos.count }, (_, i) => i);
  const find = (a: number) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const welded = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const other = welded.get(key);
    if (other === undefined) welded.set(key, i);
    else union(i, other);
  }
  const index = geometry.index;
  for (let t = 0; index && t < index.count; t += 3) {
    union(index.getX(t), index.getX(t + 1));
    union(index.getX(t), index.getX(t + 2));
  }
  return parent.map((_, i) => find(i));
}

/**
 * 1 for the Lab's lower jaw, tongue and lower teeth, 0 for the rest. The split follows the gap
 * between upper and lower parts of the mouth, which sits at a different height at the midline,
 * along the tooth row, and at the lips. It fades out behind the mouth corner, out toward the
 * ears, and down the throat.
 *
 * The teeth and whiskers are separate small parts, and each moves whole, at the weight of its
 * middle. On the main mesh, the split blends softly where it drops from the midline to the tooth
 * row. A sharp step there tore the gum lining into a spike behind the upper canine when the
 * mouth opened wide.
 */
function labradorJawWeights(geometry: THREE.BufferGeometry, hinge: THREE.Vector3, parts: Int32Array): THREE.BufferAttribute {
  const pos = geometry.attributes.position;
  const weight = (px: number, y: number, z: number, soft: boolean) => {
    const x = Math.abs(px);
    // Three split lines, measured from cross-sections: palate over tongue at the midline,
    // under the upper tooth tips along the tooth row (those teeth hang lower), and the lips.
    const inner = 4.105 + (4.45 - z) * 0.325;
    const teeth = 3.99 + (4.32 - z) * 0.21;
    const lips = 4.05 + (4.47 - z) * 0.11;
    const toothRow = soft ? smoothstep(0.12, 0.24, x) : smoothstep(0.14, 0.19, x);
    const outside = smoothstep(0.33, 0.39, x);
    const split = mix(mix(inner, teeth, toothRow), lips, outside);
    // Sharp inside the mouth. Soft at the lips, so the hanging upper lips stretch with the jaw
    // instead of dangling like fangs, and soft where the split drops to the tooth row.
    const drop = soft ? toothRow * (1 - toothRow) * 4 : 0;
    const band = 0.01 + 0.06 * drop + 0.07 * outside;
    const below = 1 - smoothstep(split - band, split + band, y);
    const front = smoothstep(hinge.z - 0.05, hinge.z + 0.33, z);
    const muzzle = 1 - smoothstep(0.55, 0.75, x);
    const throat = smoothstep(3.55, 3.75, y);
    return below * front * muzzle * throat;
  };
  // The main mesh is by far the largest part.
  const size = new Map<number, number>();
  for (const part of parts) size.set(part, (size.get(part) ?? 0) + 1);
  const main = [...size].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const middle = new Map<number, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] === main) continue;
    const m = middle.get(parts[i]) ?? middle.set(parts[i], new THREE.Vector3()).get(parts[i])!;
    m.x += pos.getX(i) / size.get(parts[i])!;
    m.y += pos.getY(i) / size.get(parts[i])!;
    m.z += pos.getZ(i) / size.get(parts[i])!;
  }
  const weights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const m = middle.get(parts[i]);
    weights[i] = m ? weight(m.x, m.y, m.z, false) : weight(pos.getX(i), pos.getY(i), pos.getZ(i), true);
  }
  return new THREE.BufferAttribute(weights, 1);
}

/** Indices of visible vertices in the outer 20% by distance from the roll axis through the neck pivot. */
function outerVertices(geometry: THREE.BufferGeometry, rig: Rig): number[] {
  const pos = geometry.attributes.position;
  const p = new THREE.Vector3();
  const normal = new THREE.Vector3(rig.cut.x, rig.cut.y, rig.cut.z);
  const kept: [number, number][] = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    // Skip what the neck fade hides.
    if (p.dot(normal) - rig.cut.w < 0.25) continue;
    kept.push([i, Math.hypot(p.x - rig.pivot.x, p.y - rig.pivot.y)]);
  }
  kept.sort((a, b) => b[1] - a[1]);
  return kept.slice(0, Math.max(1, Math.floor(kept.length * 0.2))).map(([i]) => i);
}

/**
 * The Lab's tongue is its own part of the mesh, sitting between the lower tooth rows. Returns
 * 0 at its root to 1 at its tip, 0 off the tongue, or null if no such part turns up.
 * Also sets the whole tongue's jaw weight to 1, so it rides the jaw as one piece.
 */
function labradorTongueWeights(geometry: THREE.BufferGeometry, parts: Int32Array, jaw: THREE.BufferAttribute): THREE.BufferAttribute | null {
  const pos = geometry.attributes.position;
  // The tongue is the largest part that lies wholly inside the mouth. Teeth fit too, but they're smaller.
  const inMouth = (i: number) => Math.abs(pos.getX(i)) < 0.35 && pos.getY(i) > 3.8 && pos.getY(i) < 4.35 && pos.getZ(i) > 3.7 && pos.getZ(i) < 4.45;
  const size = new Map<number, number>();
  const outside = new Set<number>();
  for (let i = 0; i < pos.count; i++) {
    size.set(parts[i], (size.get(parts[i]) ?? 0) + 1);
    if (!inMouth(i)) outside.add(parts[i]);
  }
  let tongue = -1;
  for (const [part, n] of size) if (!outside.has(part) && n > (size.get(tongue) ?? 0)) tongue = part;
  if (tongue < 0) return null;
  const weights = new Float32Array(pos.count);
  // The front half slides out whole and keeps its shape. The back half stretches.
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== tongue) continue;
    weights[i] = smoothstep(3.85, 4.15, pos.getZ(i));
    jaw.setX(i, 1);
  }
  geometry.setAttribute('aTongueTip', tongueTipShape(geometry, parts, tongue));
  return new THREE.BufferAttribute(weights, 1);
}

/**
 * The upper canines, for the vampire trick: the two longest upper teeth near the front of the
 * mouth. Each is a separate part. Returns each canine vertex's root (the top middle of its tooth)
 * and a 1, or null if there aren't two.
 */
function labradorFangs(geometry: THREE.BufferGeometry, parts: Int32Array, jaw: THREE.BufferAttribute): THREE.BufferAttribute | null {
  const pos = geometry.attributes.position;
  const teeth = new Map<number, { n: number; x: number; z: number; low: number; high: number; zLow: number; zHigh: number; upper: boolean }>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = teeth.get(parts[i]) ?? { n: 0, x: 0, z: 0, low: Infinity, high: -Infinity, zLow: Infinity, zHigh: -Infinity, upper: jaw.getX(i) < 0.5 };
    t.n++;
    t.x += x;
    t.z += z;
    t.low = Math.min(t.low, y);
    t.high = Math.max(t.high, y);
    t.zLow = Math.min(t.zLow, z);
    t.zHigh = Math.max(t.zHigh, z);
    teeth.set(parts[i], t);
  }
  // Upper teeth near the front, a real 3D tooth (the flat whisker cards are thin in z), longest first.
  const canines = [...teeth]
    .filter(([, t]) => {
      const x = Math.abs(t.x / t.n);
      const z = t.z / t.n;
      return t.n < 300 && t.upper && x > 0.1 && x < 0.25 && z > 4.3 && z < 4.52 && t.zHigh - t.zLow > 0.05;
    })
    .sort((a, b) => b[1].high - b[1].low - (a[1].high - a[1].low))
    .slice(0, 2);
  if (canines.length < 2) return null;
  const fang = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const c = canines.find(([part]) => part === parts[i]);
    if (!c) continue;
    const t = c[1];
    fang.set([t.x / t.n, t.high, t.z / t.n, 1], i * 4);
  }
  return new THREE.BufferAttribute(fang, 4);
}

/** The line an ear flap swings up on, in mesh units. A positive angle about the axis lifts the ear outward and up. */
interface EarHinge {
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
  /** From the pivot toward the hanging tip, unit length. */
  down: THREE.Vector3;
}

/** The Lab's ear flaps hang free below this height, and join the skull along it. */
const EAR_ROOT_Y = 4.9;
/** How far below the root the flap bends, in mesh units. Below that it swings as one piece. */
const EAR_BEND = 0.3;

/**
 * The Lab's floppy ears are part of the main mesh. Each flap touches the rest of the head only
 * along its root, at about EAR_ROOT_Y, so a flood fill from the ear tip that stays below the root
 * finds the flap and nothing else. Returns each vertex's lift weight, positive on the +x ear and
 * negative on the -x ear, easing in over EAR_BEND below the root, plus each ear's hinge along its
 * root, left ear first. Null if either ear doesn't turn up.
 */
function labradorEars(geometry: THREE.BufferGeometry, parts: Int32Array): { weights: THREE.BufferAttribute; hinges: EarHinge[] } | null {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  if (!index) return null;
  // Weld the copies that UV seams make, so the fill can cross the seams.
  const welded = new Map<string, number>();
  const weld = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    weld[i] = welded.get(key) ?? welded.set(key, i).get(key)!;
  }
  const near = new Map<number, number[]>();
  const link = (a: number, b: number) => (near.get(a) ?? near.set(a, []).get(a)!).push(b);
  for (let t = 0; t < index.count; t += 3) {
    const [a, b, c] = [weld[index.getX(t)], weld[index.getX(t + 1)], weld[index.getX(t + 2)]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      link(p, q);
      link(q, p);
    }
  }
  const weights = new Float32Array(pos.count);
  const hinges: EarHinge[] = [];
  for (const side of [-1, 1]) {
    // The tip: the lowest point of the hanging ear, beside the cheek and behind the eye.
    let tip = -1;
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i) * side, pos.getY(i), pos.getZ(i)];
      if (x > 0.5 && y > 4.0 && y < 4.5 && z > 3.2 && z < 3.8 && (tip < 0 || y < pos.getY(tip))) tip = weld[i];
    }
    if (tip < 0) return null;
    const flap = new Set([tip]);
    const queue = [tip];
    while (queue.length) {
      for (const v of near.get(queue.pop()!) ?? []) {
        if (flap.has(v) || pos.getY(v) >= EAR_ROOT_Y) continue;
        flap.add(v);
        queue.push(v);
      }
    }
    // A leak into the skull would take most of the head along. A flap is a few hundred points.
    if (flap.size > 2000) return null;
    // The hinge runs along the root, from its back end to its front end.
    let back = -1;
    let front = -1;
    for (const v of flap) {
      if (pos.getY(v) < EAR_ROOT_Y - 0.06) continue;
      if (back < 0 || pos.getZ(v) < pos.getZ(back)) back = v;
      if (front < 0 || pos.getZ(v) > pos.getZ(front)) front = v;
    }
    const b = new THREE.Vector3().fromBufferAttribute(pos, back);
    const f = new THREE.Vector3().fromBufferAttribute(pos, front);
    const pivot = b.clone().lerp(f, 0.5);
    const down = new THREE.Vector3().fromBufferAttribute(pos, tip).sub(pivot).normalize();
    // The axis is mirrored for the left ear, so a positive angle lifts both ears outward.
    hinges.push({ pivot, axis: f.sub(b).normalize().multiplyScalar(side), down });
    for (let i = 0; i < pos.count; i++) {
      if (flap.has(weld[i]) && parts[i] === parts[tip]) weights[i] = side * smoothstep(EAR_ROOT_Y, EAR_ROOT_Y - EAR_BEND, pos.getY(i));
    }
  }
  return { weights: new THREE.BufferAttribute(weights, 1), hinges };
}

/**
 * The model sculpts the floor of the mouth as a second tongue, lying right under the separate
 * tongue part, so at rest the two overlap. When the real tongue goes out, the copy stayed behind
 * and the outgoing tongue cut through it. This returns, for each main-mesh vertex inside the
 * tongue's footprint, how far it must sink to reach the flat floor of the mouth (y 3.8 or so).
 */
function labradorMouthFloor(geometry: THREE.BufferGeometry, parts: Int32Array): THREE.BufferAttribute {
  const BIN = 0.05;
  const pos = geometry.attributes.position;
  const tongueW = geometry.attributes.aTongue;
  const jaw = geometry.attributes.aJaw;
  const size = new Map<number, number>();
  for (const part of parts) size.set(part, (size.get(part) ?? 0) + 1);
  const main = [...size].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  let tongue = -1;
  for (let i = 0; i < pos.count && tongue < 0; i++) if (tongueW.getX(i) > 0) tongue = parts[i];
  // The real tongue's half-width and top along its length.
  const halfW = new Map<number, number>();
  const top = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== tongue) continue;
    const b = Math.floor(pos.getZ(i) / BIN);
    halfW.set(b, Math.max(halfW.get(b) ?? 0, Math.abs(pos.getX(i))));
    top.set(b, Math.max(top.get(b) ?? -Infinity, pos.getY(i)));
  }
  // The floor: the lowest main-mesh point near the midline, on the jaw, in each bin.
  const floor = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== main || jaw.getX(i) < 0.99 || Math.abs(pos.getX(i)) > 0.12) continue;
    const b = Math.floor(pos.getZ(i) / BIN);
    if (!halfW.has(b) || pos.getY(i) < 3.7) continue;
    floor.set(b, Math.min(floor.get(b) ?? Infinity, pos.getY(i)));
  }
  const drop = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== main || jaw.getX(i) < 0.99) continue;
    const z = pos.getZ(i);
    const b = Math.floor(z / BIN);
    const w = halfW.get(b);
    const f = floor.get(b);
    if (w === undefined || f === undefined || z < 3.95) continue;
    const y = pos.getY(i);
    if (y > (top.get(b) ?? y) + 0.02 || y <= f) continue;
    // Full drop inside the footprint, easing off at its edge so the gums don't move.
    const x = Math.abs(pos.getX(i));
    drop[i] = (y - f - 0.005) * (1 - smoothstep(w - 0.06, w - 0.01, x));
  }
  return new THREE.BufferAttribute(drop, 1);
}

/**
 * The Lab's tongue is a shell open underneath, where it rests on the floor of the mouth. Stuck
 * out, you could see up into it, and through it to the mouth floor left behind. This returns a
 * copy of the geometry with an underside added: the tongue's upper surface, flattened onto the
 * rim of the shell and facing down. It copies every attribute, so it moves with the tongue.
 */
function withTongueUnderside(geometry: THREE.BufferGeometry, parts: Int32Array): { geometry: THREE.BufferGeometry; parts: Int32Array } {
  const BIN = 0.02;
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const tongueW = geometry.attributes.aTongue;
  const index = geometry.index!;
  let tongue = -1;
  for (let i = 0; i < pos.count && tongue < 0; i++) if (tongueW.getX(i) > 0) tongue = parts[i];
  // The bottom of the shell along its length, in bins of BIN.
  const low = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== tongue) continue;
    const b = Math.floor(pos.getZ(i) / BIN);
    low.set(b, Math.min(low.get(b) ?? Infinity, pos.getY(i)));
  }
  // Copy the upper surface: tongue vertices facing up, and the triangles made only of them.
  const copy = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) if (parts[i] === tongue && normal.getY(i) > 0.3) copy.set(i, pos.count + copy.size);
  const tris: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    // Reversed, so the copy faces down.
    if (copy.has(a) && copy.has(b) && copy.has(c)) tris.push(copy.get(a)!, copy.get(c)!, copy.get(b)!);
  }
  const total = pos.count + copy.size;
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const size = attr.itemSize;
    const data = new Float32Array(total * size);
    const get = (i: number, c: number) => [attr.getX(i), attr.getY(i), attr.getZ(i), attr.getW(i)][c];
    for (let i = 0; i < pos.count; i++) for (let c = 0; c < size; c++) data[i * size + c] = get(i, c);
    for (const [from, to] of copy) for (let c = 0; c < size; c++) data[to * size + c] = get(from, c);
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  const p = out.attributes.position;
  const n = out.attributes.normal;
  const tip = out.attributes.aTongueTip;
  for (const [from, to] of copy) {
    // Flatten onto the rim, a little narrower to match the shell's sides there.
    p.setXYZ(to, pos.getX(from) * 0.8, (low.get(Math.floor(pos.getZ(from) / BIN)) ?? pos.getY(from)) + 0.004, pos.getZ(from));
    n.setXYZ(to, 0, -1, 0);
    // Thinning the tip squeezes the upper surface down. Squeeze the underside up to meet it.
    if (tip) tip.setXY(to, tip.getX(to) * 0.8, -tip.getY(to));
  }
  const indices = new Uint32Array(index.count + tris.length);
  for (let i = 0; i < index.count; i++) indices[i] = index.getX(i);
  indices.set(tris, index.count);
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  const outParts = new Int32Array(total);
  outParts.set(parts);
  outParts.fill(tongue, pos.count);
  return { geometry: out, parts: outParts };
}

/**
 * How far to move each tongue vertex, in x and y, to reshape the tip for showing outside the
 * mouth. The model's tip is a block about 0.12 thick that rounds off only in its last 0.07,
 * so a tongue sticking out looked square. This rounds the last TIP_ROUND of the outline into a
 * U, and thins the front toward an edge.
 */
function tongueTipShape(geometry: THREE.BufferGeometry, parts: Int32Array, tongue: number): THREE.BufferAttribute {
  const TIP_ROUND = 0.2;
  const BIN = 0.02;
  const pos = geometry.attributes.position;
  // The tongue's half-width and middle height along its length, in bins of BIN.
  const halfW = new Map<number, number>();
  const low = new Map<number, number>();
  const high = new Map<number, number>();
  let tipZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== tongue) continue;
    const b = Math.floor(pos.getZ(i) / BIN);
    halfW.set(b, Math.max(halfW.get(b) ?? 0, Math.abs(pos.getX(i))));
    low.set(b, Math.min(low.get(b) ?? Infinity, pos.getY(i)));
    high.set(b, Math.max(high.get(b) ?? -Infinity, pos.getY(i)));
    tipZ = Math.max(tipZ, pos.getZ(i));
  }
  const start = tipZ - TIP_ROUND;
  const startHalfW = halfW.get(Math.floor(start / BIN)) ?? 0.2;
  const shape = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    if (parts[i] !== tongue) continue;
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const b = Math.floor(z / BIN);
    // A semicircle from the start of the rounding to the tip.
    const u = Math.min(1, Math.max(0, (z - start) / TIP_ROUND));
    const target = startHalfW * Math.sqrt(1 - u * u);
    const scale = Math.min(1, target / Math.max(halfW.get(b) ?? 1, 1e-3));
    shape[i * 2] = x * (scale - 1);
    // Squeeze toward the middle height, down to a third of the thickness at the tip.
    const mid = ((low.get(b) ?? y) + (high.get(b) ?? y)) / 2;
    const thin = 1 - 0.65 * smoothstep(tipZ - 0.3, tipZ, z);
    shape[i * 2 + 1] = (y - mid) * (thin - 1);
  }
  return new THREE.BufferAttribute(shape, 2);
}

/** Smooth value noise in [-1, 1]. */
function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Gaussian bump centered at (cx, cy) with radii (sx, sy). */
function bump(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy));
}

function pair(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  return bump(x, y, -cx, cy, sx, sy) + bump(x, y, cx, cy, sx, sy);
}

/** A bald, heavy-browed head sculpted from a sphere, in the same frame as the scan. */
function proceduralGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 200, 150);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x * 1.55;
    const y = v.y * 2.25 + 1.65;
    // Flatten the face so the lower face and chin do not recede like an egg.
    const fz = v.z > 0 ? Math.pow(v.z, 0.55) : v.z;
    let z = fz * 1.9;

    const jaw = smoothstep(1.3, -0.6, y);
    x *= 1 - 0.32 * jaw;
    if (z < 0) z *= 1 - 0.35 * jaw;

    const front = smoothstep(0.1, 0.8, v.z);
    let d = 0;
    d += 0.4 * bump(x, y, 0, 1.15, 0.17, 0.26);
    d += 0.22 * bump(x, y, 0, 1.5, 0.13, 0.38);
    d += 0.12 * pair(x, y, 0.24, 0.98, 0.13, 0.1);
    d += 0.18 * pair(x, y, 0.55, 2.12, 0.42, 0.13);
    d -= 0.3 * pair(x, y, 0.6, 1.8, 0.28, 0.19);
    d += 0.12 * pair(x, y, 0.62, 1.76, 0.16, 0.11);
    d += 0.12 * pair(x, y, 0.95, 1.3, 0.35, 0.3);
    d -= 0.08 * pair(x, y, 0.72, 0.62, 0.25, 0.3);
    d += 0.13 * bump(x, y, 0, 0.57, 0.42, 0.09);
    d -= 0.07 * bump(x, y, 0, 0.45, 0.5, 0.025);
    d += 0.12 * bump(x, y, 0, 0.32, 0.38, 0.09);
    d -= 0.05 * bump(x, y, 0, 0.12, 0.35, 0.07);
    d += 0.16 * bump(x, y, 0, -0.2, 0.4, 0.2);
    z += d * front;

    // Ears.
    const side = smoothstep(0.7, 0.95, Math.abs(v.x));
    x += Math.sign(x) * 0.3 * side * Math.exp(-(((y - 1.45) / 0.45) ** 2) - (((z + 0.1) / 0.35) ** 2));

    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
