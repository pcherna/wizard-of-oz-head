import * as THREE from 'three';
import type { Settings } from '../config';

// Reshapes the Lee Perry-Smith scan toward the film's Great Oz: a broad bulbous dome,
// two raised forehead ridges, an angry brow, deep-set eyes with bags,
// a bulbous nose, deep nose-to-mouth folds, and a tapered chin.
// All landmarks are in the scan's own frame (+z forward, nose tip ≈ (0, 1.1, 2.56)).

/** Strength of each distortion, in mesh units. Live-tunable from the setup panel. */
export type SculptParams = Pick<
  Settings,
  | 'ozDome'
  | 'ozDomeStart'
  | 'ozCrown'
  | 'ozForehead'
  | 'ozBrow'
  | 'ozEyes'
  | 'ozNose'
  | 'ozFolds'
  | 'ozTaper'
  | 'ozChin'
  | 'ozFeatures'
  | 'ozFeatureY'
>;

/**
 * The face's left-right midline. The scan's face sits off x = 0: the nose tip is at x -0.088,
 * and the nose bridge and lips center near -0.09. Left-right features mirror around this line.
 */
export const FACE_MID_X = -0.09;

/** Vertical axis of the skull, measured from the scan's cross-sections. */
const SKULL_X = -0.05;
const SKULL_Z = 0.1;

/**
 * The feature region: an oval over brows, eyes, nose and mouth. Inside the inner oval the
 * features scale as one rigid unit around FACE_CENTER. The effect fades out by the outer
 * oval, so the head outline stays put and the skin between stretches.
 */
const FACE_CENTER = new THREE.Vector3(FACE_MID_X, 1.15, 2.0);
const FACE_RX = 0.85;
const FACE_RY = 0.95;

/**
 * Scale and shift a point in the feature region. The head also runs its jaw and eye
 * landmarks through this, so lip sync and eye glow follow the moved features.
 */
export function mapFeature(v: THREE.Vector3, s: SculptParams): THREE.Vector3 {
  const e = Math.hypot((v.x - FACE_CENTER.x) / FACE_RX, (v.y - FACE_CENTER.y) / FACE_RY);
  const mask = (1 - smoothstep(1.0, 1.6, e)) * smoothstep(0.6, 1.4, v.z);
  const k = 1 + (s.ozFeatures - 1) * mask;
  return new THREE.Vector3(
    FACE_CENTER.x + (v.x - FACE_CENTER.x) * k,
    FACE_CENTER.y + (v.y - FACE_CENTER.y) * k + s.ozFeatureY * mask,
    FACE_CENTER.z + (v.z - FACE_CENTER.z) * k,
  );
}

/**
 * Keeps the untouched scan and rewrites `geometry` in place for each new set of params.
 * The scan splits vertices along UV seams. Vertices that share a position are grouped,
 * so they move along one shared normal and the surface cannot crack open.
 */
export class OzSculptor {
  readonly geometry: THREE.BufferGeometry;
  private basePos: Float32Array;
  private baseNrm: Float32Array;
  private groupOf: Int32Array;
  private groupCount: number;

  constructor(source: THREE.BufferGeometry) {
    this.geometry = source.clone();
    const pos = source.attributes.position;
    const nrm = source.attributes.normal;
    this.basePos = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) this.basePos.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);

    const groups = new Map<string, number>();
    this.groupOf = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
      let id = groups.get(k);
      if (id === undefined) groups.set(k, (id = groups.size));
      this.groupOf[i] = id;
    }
    this.groupCount = groups.size;

    // One averaged normal per group.
    const sum = new Float32Array(this.groupCount * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = this.groupOf[i] * 3;
      sum[k] += nrm.getX(i);
      sum[k + 1] += nrm.getY(i);
      sum[k + 2] += nrm.getZ(i);
    }
    this.baseNrm = new Float32Array(pos.count * 3);
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const k = this.groupOf[i] * 3;
      n.set(sum[k], sum[k + 1], sum[k + 2]).normalize();
      this.baseNrm.set([n.x, n.y, n.z], i * 3);
    }
  }

  apply(s: SculptParams) {
    const pos = this.geometry.attributes.position;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const base = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      p.fromArray(this.basePos, i * 3);
      n.fromArray(this.baseNrm, i * 3);
      const { x, y } = p;
      // Distance from the face midline, so left-right features mirror correctly.
      const ax = Math.abs(x - FACE_MID_X);
      const front = smoothstep(0.25, 0.75, n.z);

      // 1. Surface detail, pushed along the original normal.
      let d = 0;
      // Forehead ridges: one raised ridge on each side. The forehead between them stays flat.
      // As in the film head, each ridge rises from the inner end of a brow, flares out fast, then
      // runs nearly vertical and fades toward the crown. The path is fitted to the reference after
      // undoing the default dome widening, so it lands right on the finished head. Points in scan
      // units: (0.44, 2.12), (0.80, 2.5), (0.88, 2.74), then held near 0.95 so the ridges stay on
      // the front of the dome. Where the skull turns sideways they would bulge its outline.
      const ridgeX = 0.44 + 0.54 * (1 - Math.exp(-Math.max(0, y - 2.12) / 0.4));
      // Fade out before the crown, where pushing outward would square off the head's silhouette.
      const band = smoothstep(2.0, 2.15, y) * (1 - smoothstep(2.95, 3.55, y));
      const df = s.ozForehead * gauss(ax - ridgeX, 0.07) * band;
      // Angry brow: a heavy ridge that slopes down toward the nose, with a crease between the eyes.
      const browY = 2.05 + 0.28 * Math.max(0, ax - 0.15);
      d += s.ozBrow * gauss(y - browY, 0.09) * gauss(ax - 0.6, 0.42);
      d -= s.ozBrow * 0.5 * gauss(x - FACE_MID_X, 0.07) * gauss(y - 2.0, 0.18);
      // Deep-set eyes: sink a ring around each eye, not the eyeball, so the eyes stay open. Two bags beneath.
      const eyeR = Math.hypot(ax - 0.62, (y - 1.78) * 1.3);
      d -= s.ozEyes * gauss(eyeR - 0.26, 0.09);
      d += s.ozEyes * 0.5 * gauss(ax - 0.62, 0.25) * gauss(y - 1.55, 0.06);
      d += s.ozEyes * 0.33 * gauss(ax - 0.62, 0.3) * gauss(y - 1.43, 0.05);
      // Bulbous nose tip.
      d += s.ozNose * gauss(x - FACE_MID_X, 0.22) * gauss(y - 1.08, 0.17);
      // Nose-to-mouth folds with puffed cheeks outside them.
      d -= s.ozFolds * gauss(segmentDistance(ax, y, 0.33, 0.95, 0.68, 0.25), 0.07);
      d += s.ozFolds * 0.7 * gauss(ax - 0.78, 0.25) * gauss(y - 0.8, 0.25);
      p.addScaledVector(n, d * front + df * smoothstep(0.05, 0.45, n.z));

      // 2. Feature size and height. The mask comes from the untouched scan, so detail stays put on the face.
      const f = mapFeature(base.set(x, y, this.basePos[i * 3 + 2]), s);
      p.x += f.x - base.x;
      p.y += f.y - base.y;
      p.z += f.z - base.z;

      // 3. Ears: fold them flat against the head. The dome's sides cover where they were.
      const earZone = smoothstep(0.25, 0.55, y) * (1 - smoothstep(1.9, 2.2, y)) * (1 - smoothstep(0.4, 0.9, p.z));
      const earOut = Math.max(0, Math.abs(p.x - SKULL_X) - 1.3);
      p.x -= Math.sign(p.x - SKULL_X) * earOut * earZone;

      // 4. Dome: widen the skull around its vertical axis, ramping in over 1.4 units from ozDomeStart,
      // easing off toward the crown. Then raise the crown.
      const widen = smoothstep(s.ozDomeStart, s.ozDomeStart + 1.4, y) * (1 - 0.5 * smoothstep(2.7, 4.0, y));
      p.x = SKULL_X + (p.x - SKULL_X) * (1 + s.ozDome * widen);
      const dz = p.z - SKULL_Z;
      p.z = SKULL_Z + dz * (1 + (dz < 0 ? 0.36 : 0.11) * s.ozDome * widen);
      p.y += s.ozCrown * smoothstep(2.0, 4.0, y);

      // 5. Lower face: keep the cheeks full to mouth level, then taper toward the chin and drop it.
      const taper = smoothstep(0.7, -0.7, y);
      p.x = SKULL_X + (p.x - SKULL_X) * (1 - s.ozTaper * taper);
      p.y -= s.ozChin * gauss(x - FACE_MID_X, 0.7) * smoothstep(0.2, -0.5, y) * smoothstep(0.5, 1.5, p.z);

      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    this.recomputeNormals();
    this.geometry.computeBoundingSphere();
  }

  /** Area-weighted normals, averaged across each position group. */
  private recomputeNormals() {
    const g = this.geometry;
    const pos = g.attributes.position;
    const index = g.index!;
    const acc = new Float32Array(this.groupCount * 3);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < index.count; t += 3) {
      const i0 = index.getX(t);
      const i1 = index.getX(t + 1);
      const i2 = index.getX(t + 2);
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1).sub(a);
      c.fromBufferAttribute(pos, i2).sub(a);
      b.cross(c);
      for (const i of [i0, i1, i2]) {
        const k = this.groupOf[i] * 3;
        acc[k] += b.x;
        acc[k + 1] += b.y;
        acc[k + 2] += b.z;
      }
    }
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const k = this.groupOf[i] * 3;
      a.set(acc[k], acc[k + 1], acc[k + 2]).normalize();
      nrm.setXYZ(i, a.x, a.y, a.z);
    }
    nrm.needsUpdate = true;
  }
}

function gauss(v: number, width: number): number {
  return Math.exp(-((v / width) ** 2));
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Distance from (px, py) to the segment (ax, ay)–(bx, by). */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}
