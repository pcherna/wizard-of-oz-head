import * as THREE from 'three';

const dropVertex = /* glsl */ `
attribute float aLife;
attribute float aSize;
uniform float uPixelScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aLife > 0.0 ? uPixelScale * aSize / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}
`;

const dropFragment = /* glsl */ `
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  // A bright core with a soft rim, fading as the drop falls away.
  float a = smoothstep(0.5, 0.1, d) * (1.0 - vLife) * smoothstep(0.0, 0.05, vLife);
  gl_FragColor = vec4(uColor * a * 1.5, 1.0);
}
`;

const MAX_DROPS = 300;
/** Drops per second at a full shake. */
const SPRAY_RATE = 260;
const LIFE_SEC = 0.9;
/** World units per second². The head is about 1.1 units wide. */
const GRAVITY = 9;
/** Share of the flinging point's speed a drop leaves with. The full speed throws drops off screen at once. */
const FLING = 0.35;

/** Where droplets leave from: a point on the head and its velocity, both in world space. */
export interface FlingSource {
  /** How hard the head is shaking water off, 0 to 1. */
  readonly spray: number;
  flingPoint(pos: THREE.Vector3, vel: THREE.Vector3): void;
}

/** Small glowing drops: water flung off the head during a wet-dog shake, or bits of a popped gum bubble. */
export class Droplets {
  readonly points: THREE.Points;
  private uniforms = { uPixelScale: { value: 800 }, uColor: { value: new THREE.Color() } };
  private pos = new Float32Array(MAX_DROPS * 3);
  private vel = new Float32Array(MAX_DROPS * 3);
  /** 0 is a free slot. Live drops run from just above 0 to 1. */
  private life = new Float32Array(MAX_DROPS);
  private size = new Float32Array(MAX_DROPS);
  private geo = new THREE.BufferGeometry();
  private next = 0;
  private owed = 0;
  private p = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(color = 0xa6f2ff) {
    this.uniforms.uColor.value.set(color);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(
      this.geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: dropVertex,
        fragmentShader: dropFragment,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  setPixelScale(scale: number) {
    this.uniforms.uPixelScale.value = scale;
  }

  update(dt: number, source: FlingSource | null) {
    if (source && source.spray > 0) {
      this.owed += dt * SPRAY_RATE * source.spray;
      for (; this.owed >= 1; this.owed--) this.spawn(source);
    } else {
      this.owed = 0;
    }
    const drag = Math.exp(-dt * 0.6);
    for (let i = 0; i < MAX_DROPS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] += dt / LIFE_SEC;
      if (this.life[i] >= 1) {
        this.life[i] = 0;
        continue;
      }
      const k = i * 3;
      this.vel[k + 1] -= GRAVITY * dt;
      for (let c = 0; c < 3; c++) {
        this.vel[k + c] *= drag;
        this.pos[k + c] += this.vel[k + c] * dt;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  /** Throws n drops out of one point in all directions, such as a popping bubble. */
  burst(at: THREE.Vector3, n: number, speed: number) {
    for (let k = 0; k < n; k++) {
      this.v.randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.add(at, this.v);
    }
  }

  private add(pos: THREE.Vector3, vel: THREE.Vector3) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_DROPS;
    pos.toArray(this.pos, i * 3);
    vel.toArray(this.vel, i * 3);
    this.life[i] = 0.001;
    this.size[i] = 0.018 + Math.random() * 0.03;
  }

  private spawn(source: FlingSource) {
    // Water lets go where the head moves fastest, so retry slow points a few times.
    for (let tries = 0; tries < 4; tries++) {
      source.flingPoint(this.p, this.v);
      if (this.v.length() > 3) break;
    }
    if (this.v.length() < 1) return;
    this.v.multiplyScalar(FLING * (0.6 + Math.random() * 0.8));
    // A little scatter, and some drops toward the audience.
    this.v.x += (Math.random() - 0.5) * 0.6;
    this.v.y += Math.random() * 0.8;
    this.v.z += Math.random() * 0.9;
    this.add(this.p, this.v);
  }
}
