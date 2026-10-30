import * as THREE from 'three';

const vertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aSeed;
uniform float uPixelScale;
varying float vAlpha;
varying float vSeed;
void main() {
  vAlpha = aAlpha;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPixelScale * aSize / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// Pass 1: each puff adds its density to an offscreen buffer.
const fragment = /* glsl */ `
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  // Lumpy edge so puffs do not read as perfect discs.
  float ang = atan(p.y, p.x);
  float lump = 0.42 + 0.06 * sin(ang * 3.0 + vSeed * 6.28) + 0.04 * sin(ang * 5.0 - vSeed * 12.0);
  float density = smoothstep(lump, 0.0, d) * vAlpha;
  gl_FragColor = vec4(vec3(density), 1.0);
}
`;

// Pass 2: turn total density into opacity on a curve that levels off. One wisp keeps its
// look, but any pile-up, from one burst or several, stops at MAX_OPACITY instead of white.
const compositeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const compositeFragment = /* glsl */ `
uniform sampler2D uDensity;
uniform vec3 uTint;
uniform float uMaxOpacity;
uniform float uHalfDensity;
varying vec2 vUv;
void main() {
  // Approaches the cap slowly, so even thick steam keeps some light and shade.
  float density = texture2D(uDensity, vUv).r;
  gl_FragColor = vec4(uTint, uMaxOpacity * density / (density + uHalfDensity));
}
`;

/**
 * Densest steam's opacity. With the tint, that peaks just under the bloom threshold (0.32),
 * so a pile-up can't bloom into a white blob.
 */
const MAX_OPACITY = 0.6;
/** Density that reaches half of MAX_OPACITY. Chosen so a single idle wisp (0.16) looks as it did before the cap. */
const HALF_DENSITY = 0.44;
/** The density buffer renders at half size: cheaper, and the softness suits steam. */
const DENSITY_RES = 0.5;

/** Where steam leaves each vent. The steam pipes end here. */
export const VENT_Y = -1.2;
export const VENT_Z = 0.3;

const PER_SIDE = 400;
const IDLE_RATE = 14;
const BURST_RATE = 150;
export const STEAM_BURST_SEC = 1.1;
/** Idle wisps live longer so they drift up past the head. */
const IDLE_LIFE_SEC = 5.5;
const BURST_LIFE_SEC = 3.2;
const BUOYANCY = 0.45;

interface Vent {
  x: number;
  dir: number;
}

/**
 * Steam venting on both sides of the head. `burst()` blasts both vents. Add `composite` to the
 * scene, and call `renderDensity()` each frame before rendering it.
 */
export class Steam {
  readonly composite: THREE.Mesh;
  private points: THREE.Points;
  private densityScene = new THREE.Scene();
  private density = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  private count = PER_SIDE * 2;
  private pos = new Float32Array(this.count * 3);
  private vel = new Float32Array(this.count * 3);
  private age = new Float32Array(this.count).fill(BURST_LIFE_SEC);
  private lifeSec = new Float32Array(this.count).fill(BURST_LIFE_SEC);
  /** Burst puffs grow larger than idle wisps. */
  private grow = new Float32Array(this.count);
  private size = new Float32Array(this.count);
  private alpha = new Float32Array(this.count);
  private seed = new Float32Array(this.count);
  /** Burst puffs are thinner, since many overlap. */
  private opacity = new Float32Array(this.count);
  private geo = new THREE.BufferGeometry();
  private uniforms = { uPixelScale: { value: 800 } };
  private vents: Vent[] = [
    { x: -1.75, dir: -1 },
    { x: 1.75, dir: 1 },
  ];
  private next = [0, 0];
  private spawnDebt = [0, 0];
  private burstLeft = 0;
  /** How wide the current burst spreads: 1 is a normal column. */
  private burstWidth = 1;

  constructor() {
    for (let i = 0; i < this.count; i++) this.seed[i] = Math.random();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.points = new THREE.Points(
      this.geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.densityScene.add(this.points);

    this.composite = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uDensity: { value: this.density.texture },
          uTint: { value: new THREE.Color(0.42, 0.47, 0.45) },
          uMaxOpacity: { value: MAX_OPACITY },
          uHalfDensity: { value: HALF_DENSITY },
        },
        vertexShader: compositeVertex,
        fragmentShader: compositeFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.composite.frustumCulled = false;
    // Before the fire, so flames still glow over the steam at the vents.
    this.composite.renderOrder = -1;
  }

  /** Match the density buffer to the screen. Pass the renderer's drawing-buffer size. */
  setSize(width: number, height: number) {
    this.density.setSize(Math.max(1, Math.round(width * DENSITY_RES)), Math.max(1, Math.round(height * DENSITY_RES)));
  }

  renderDensity(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.density);
    renderer.render(this.densityScene, camera);
    renderer.setRenderTarget(previous);
  }

  /** width above 1 billows wider than a normal column, such as for a sneeze. */
  burst(width = 1) {
    this.burstLeft = STEAM_BURST_SEC;
    this.burstWidth = width;
  }

  setPixelScale(scale: number) {
    // Point sizes are in pixels of the half-size density buffer.
    this.uniforms.uPixelScale.value = scale * DENSITY_RES;
  }

  /** Distance of each vent from the middle. */
  get ventX(): number {
    return this.vents[1].x;
  }

  /** Keep the vents inside the frame on any projector aspect ratio. */
  setHalfWidth(halfWidth: number) {
    const x = Math.min(2.1, halfWidth * 0.72);
    this.vents[0].x = -x;
    this.vents[1].x = x;
  }

  update(t: number, dt: number) {
    const bursting = this.burstLeft > 0;
    this.burstLeft -= dt;
    // A wider cloud needs more puffs, or it thins out.
    const rate = bursting ? BURST_RATE * (0.5 + 0.5 * this.burstWidth) : IDLE_RATE;

    for (let side = 0; side < 2; side++) {
      this.spawnDebt[side] += rate * dt;
      while (this.spawnDebt[side] >= 1) {
        this.spawnDebt[side] -= 1;
        this.spawn(side, bursting);
      }
    }

    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      this.age[i] += dt;
      const life = this.age[i] / this.lifeSec[i];
      if (life >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      // Drag, buoyancy, and a cheap swirl.
      const drag = Math.exp(-dt * 1.4);
      this.vel[k] = this.vel[k] * drag + Math.sin(t * 1.3 + this.seed[i] * 20 + this.pos[k + 1] * 2) * dt * 0.5;
      this.vel[k + 1] = this.vel[k + 1] * drag + dt * BUOYANCY;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] = 0.25 + life * this.grow[i];
      this.alpha[i] = Math.min(1, life * 4) * Math.pow(1 - life, 1.5) * this.opacity[i];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  private spawn(side: number, bursting: boolean) {
    // Each side owns half the pool and recycles it round-robin.
    const i = side * PER_SIDE + this.next[side];
    this.next[side] = (this.next[side] + 1) % PER_SIDE;
    const vent = this.vents[side];
    const k = i * 3;
    // A wide speed spread stretches the burst into a column. A narrow one piles puffs into a white cap.
    const speed = bursting ? 2.0 + Math.random() * 2.8 : 0.7 + Math.random() * 0.3;
    this.pos[k] = vent.x + (Math.random() - 0.5) * 0.1;
    this.pos[k + 1] = VENT_Y;
    this.pos[k + 2] = VENT_Z;
    const width = bursting ? this.burstWidth : 1;
    this.vel[k] = vent.dir * (bursting ? 0.3 : 0.08) * width + (Math.random() - 0.5) * (bursting ? 0.4 : 0.25) * width;
    this.vel[k + 1] = speed;
    this.vel[k + 2] = (Math.random() - 0.5) * 0.2;
    this.opacity[i] = bursting ? 0.085 : 0.16;
    this.lifeSec[i] = bursting ? BURST_LIFE_SEC : IDLE_LIFE_SEC;
    this.grow[i] = bursting ? 1.7 * (0.6 + 0.4 * width) : 1.3;
    this.age[i] = 0;
  }
}
