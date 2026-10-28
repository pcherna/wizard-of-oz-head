import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { HeadVariant } from '../config';
import type { MouthState } from '../audio/lipsync';
import { FACE_MID_X, OzSculptor, mapFeature, type SculptParams } from './oz-sculpt';

/** Landmarks in the mesh's own coordinates (Lee Perry-Smith frame: +z forward, nose tip ≈ (0, 1.1, 2.56)). */
interface Rig {
  /** Left-right midline of the face. */
  midX: number;
  seamY: number;
  chinY: number;
  neckY: number;
  mouthZ: number;
  mouthHalfW: number;
  hinge: THREE.Vector3;
  eyeL: THREE.Vector3;
  eyeR: THREE.Vector3;
}

const SCAN_RIG: Rig = {
  midX: FACE_MID_X,
  seamY: 0.45,
  chinY: -0.55,
  neckY: -0.85,
  mouthZ: 2.24,
  mouthHalfW: 0.5,
  hinge: new THREE.Vector3(0, 0.95, -0.2),
  // The eyeballs bulge at x -0.71 and 0.52, about 0.6 either side of the midline.
  eyeL: new THREE.Vector3(FACE_MID_X - 0.62, 1.78, 1.75),
  eyeR: new THREE.Vector3(FACE_MID_X + 0.62, 1.78, 1.75),
};

/** The sculpt sinks the eyes, and setSculpt() moves the chin landmark with the chin drop. */
const OZ_RIG: Rig = {
  ...SCAN_RIG,
  // Fade the neck high. The narrowed chin would otherwise sit on a wide neck like a funnel.
  neckY: -0.3,
  // Centered on the scan's closed lid line, which sits a little below the eyeball's middle.
  eyeL: new THREE.Vector3(FACE_MID_X - 0.66, 1.71, 1.65),
  eyeR: new THREE.Vector3(FACE_MID_X + 0.66, 1.71, 1.65),
};

const PROCEDURAL_RIG: Rig = {
  ...SCAN_RIG,
  midX: 0,
  neckY: -0.6,
  mouthZ: 1.95,
  eyeL: new THREE.Vector3(-0.6, 1.78, 1.6),
  eyeR: new THREE.Vector3(0.6, 1.78, 1.6),
};

/** World units per mesh unit at headScale 1, and the neck pivot the head turns around. */
const BASE_SCALE = 0.3;
const PIVOT = new THREE.Vector3(0, 0.2, -0.3);
const JAW_MAX_RAD = 0.24;

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

void main() {
  vec3 p = position;
  vec3 n = normal;
  float m = mouthMask(position);
  float nearSeam = exp(-pow((position.y - uSeamY) / 0.3, 2.0));

  // Wide "ee" or rounded "oo".
  p.x = uMidX + (p.x - uMidX) * (1.0 + uWidth * 0.12 * m * nearSeam * (0.3 + uJaw));
  // The upper lip lifts a little as the mouth opens.
  float upper = m * smoothstep(uSeamY - 0.01, uSeamY + 0.03, position.y) * exp(-pow((position.y - uSeamY) / 0.18, 2.0));
  p.y += upper * uJaw * 0.07;

  float w = jawWeight(position);
  float a = uJaw * uJawMax * w;
  float c = cos(a);
  float s = sin(a);
  vec3 q = p - uHinge;
  p = uHinge + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);

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
uniform float uNeckY;
uniform float uChinY;
uniform float uRimGlow;
uniform float uShine;
uniform float uJaw;
uniform float uSeamY;
uniform float uMouthHalfW;
uniform float uMidX;
uniform vec3 uEyeL;
uniform vec3 uEyeR;
uniform float uEyeOpen;
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
vec4 paintEye(vec3 d) {
  vec2 q = d.xy / uEyeScale;
  float onFace = 1.0 - smoothstep(0.3, 0.5, abs(d.z));
  // The almond's height closes with the lids.
  float almond = length(vec2(q.x / 0.3, q.y / (0.15 * max(uEyeOpen, 0.001))));
  float cover = (1.0 - smoothstep(0.8, 1.0, almond)) * onFace * step(0.02, uEyeOpen);
  float r = length(q - uGaze) / 0.13;
  // Whites stay dimmer than the iris, so bloom doesn't wash the iris out.
  vec3 c = vec3(0.42, 0.58, 0.36);
  c = mix(c, vec3(0.95, 1.15, 0.15), 1.0 - smoothstep(0.85, 1.0, r));
  c = mix(c, vec3(0.0, 0.02, 0.0), 1.0 - smoothstep(0.48, 0.58, r));
  return vec4(c, cover);
}

void main() {
  float neck = smoothstep(uNeckY - 0.5, uNeckY + 0.25, vLocal.y);
  // Keep the front of the chin where the neck fades, so the face ends in a point.
  neck = max(neck, smoothstep(1.2, 1.7, vLocal.z) * smoothstep(uChinY - 0.2, uChinY + 0.1, vLocal.y));
  if (neck <= 0.001) discard;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 lKey = normalize(vec3(-0.3, 0.9, 0.7));
  vec3 lFire = normalize(vec3(0.0, -0.9, 0.5));
  float key = max(dot(N, lKey), 0.0);
  float under = max(dot(N, lFire), 0.0);

  float detail = 1.0;
  if (uUseMap > 0.5) {
    vec3 t = texture2D(uMap, vUv).rgb;
    detail = 0.45 + 1.1 * dot(t, vec3(0.3, 0.59, 0.11));
  }
  vec3 col = uBase * (0.12 + 0.7 * key) * detail;

  float flicker = 0.85 + 0.15 * sin(uTime * 13.0) * sin(uTime * 7.3 + 1.0);
  col += uFireColor * under * 0.3 * uFire * flicker;

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);
  col += uRim * fres * uRimGlow;
  vec3 H = normalize(lKey + V);
  col += vec3(0.6, 1.0, 0.6) * pow(max(dot(N, H), 0.0), 40.0) * 0.25 * uShine;

  vec4 eyeL = paintEye(vLocal - uEyeL);
  vec4 eyeR = paintEye(vLocal - uEyeR);
  col = mix(col, eyeL.rgb * uEyeGlow, eyeL.a);
  col = mix(col, eyeR.rgb * uEyeGlow, eyeR.a);

  // Mouth interior: the faces stretched across the lip seam.
  float inMouth = (1.0 - smoothstep(uMouthHalfW * 0.8, uMouthHalfW * 1.2, abs(vLocal.x - uMidX)))
                * exp(-pow((vLocal.y - uSeamY) / 0.25, 2.0));
  float gap = smoothstep(0.02, 0.2, vJawW) * (1.0 - smoothstep(0.8, 0.98, vJawW));
  col = mix(col, vec3(0.0, 0.025, 0.0), clamp(inMouth * gap * smoothstep(0.02, 0.12, uJaw) * 1.4, 0.0, 1.0));

  col += uFlash * vec3(0.7, 0.85, 1.0) * (0.25 + 0.8 * key);
  col *= 0.96 + 0.04 * sin(vPosW.y * 140.0 - uTime * 6.0);
  gl_FragColor = vec4(col * neck, 1.0);
}
`;

export class Head {
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
  /** Holds the head still at this yaw (radians), for comparing against references. */
  pinnedYaw: number | null = null;
  private sculptor: OzSculptor | null = null;

  private constructor(geometry: THREE.BufferGeometry, rig: Rig, map: THREE.Texture | null) {
    this.uniforms = {
      uJaw: { value: 0 },
      uWidth: { value: 0 },
      uJawMax: { value: JAW_MAX_RAD },
      uSeamY: { value: rig.seamY },
      uChinY: { value: rig.chinY },
      uNeckY: { value: rig.neckY },
      uMouthZ: { value: rig.mouthZ },
      uMouthHalfW: { value: rig.mouthHalfW },
      uMidX: { value: rig.midX },
      uHinge: { value: rig.hinge },
      uEyeL: { value: rig.eyeL },
      uEyeR: { value: rig.eyeR },
      uBase: { value: new THREE.Color(0x2a9a36) },
      uRim: { value: new THREE.Color(0x7dff8a) },
      uFireColor: { value: new THREE.Color(0xff7a1a) },
      uTime: { value: 0 },
      uFire: { value: 1 },
      uFlash: { value: 0 },
      uEyeGlow: { value: 1 },
      uEyeOpen: { value: 1 },
      uEyeScale: { value: 1 },
      uGaze: { value: new THREE.Vector2() },
      uShine: { value: 1 },
      uRimGlow: { value: 0.55 },
      uUseMap: { value: map ? 1 : 0 },
      uMap: { value: map },
    };
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(PIVOT).multiplyScalar(-1);
    this.group.add(this.mesh);
    this.setPlacement(1, 0);
  }

  static async create(variant: HeadVariant, sculpt: SculptParams): Promise<Head> {
    if (variant === 'procedural') return new Head(proceduralGeometry(), PROCEDURAL_RIG, null);
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
    this.group.scale.setScalar(BASE_SCALE * scale);
    this.placeY = y;
  }

  update(t: number, dt: number, mouth: MouthState, fire: number, flash: number) {
    const u = this.uniforms;
    u.uTime.value = t;
    u.uJaw.value = mouth.jaw;
    u.uWidth.value = mouth.width;
    u.uFire.value = fire;
    u.uFlash.value = flash;

    // Blink every 3–6 s.
    if (t > this.blinkAt) {
      this.blink = 1;
      this.blinkAt = t + 3 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt / 0.15);
    u.uEyeOpen.value = 1 - Math.sin(this.blink * Math.PI);
    u.uEyeGlow.value = 1 + Math.min(mouth.level, 1.5) * 0.5;

    // The pupils glance somewhere new every 0.8–3 s, with a quick saccade.
    if (t > this.glanceAt) {
      this.gazeTarget.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.05);
      this.glanceAt = t + 0.8 + Math.random() * 2.2;
    }
    this.gaze.lerp(this.gazeTarget, 1 - Math.exp(-dt / 0.04));
    (u.uGaze.value as THREE.Vector2).copy(this.gaze);

    // Syllable onsets kick a damped spring, so speech reads as emphatic nods.
    this.nodVel += mouth.onset * 0.9;
    this.nodVel += (-60 * this.nod - 7 * this.nodVel) * dt;
    this.nod += this.nodVel * dt;

    const energy = 1 + Math.min(mouth.level, 1.5) * 0.4;
    const g = this.group;
    if (this.pinnedYaw !== null) {
      g.rotation.set(0, this.pinnedYaw, 0);
    } else {
      g.rotation.y = (0.28 * noise1(t * 0.11) + 0.07 * noise1(t * 0.43 + 10)) * energy;
      g.rotation.x = 0.1 * noise1(t * 0.17 + 20) + this.nod - mouth.level * 0.03;
      g.rotation.z = 0.04 * noise1(t * 0.13 + 30);
    }
    g.position.y = -0.02 + this.placeY + 0.025 * Math.sin(t * 0.9);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.uniforms.uMap.value as THREE.Texture | null)?.dispose();
  }
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
