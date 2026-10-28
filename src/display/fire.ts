import * as THREE from 'three';

const fireFragment = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float h = uIntensity;
  float height = 0.14 + 0.24 * h;
  float y = uv.y / height;
  // Noise stretched vertically rises faster than it spreads, which makes tall thin tongues.
  vec2 q = vec2(uv.x * 9.0, uv.y * 1.6 - uTime * 1.9);
  // fbm clusters around 0.5. Spread it to 0..1 so tongue heights vary a lot.
  float n = smoothstep(0.3, 0.7, fbm(q + vec2(fbm(q * 0.6 + uTime * 0.15) * 1.5, 0.0)));
  float n2 = smoothstep(0.3, 0.7, fbm(vec2(uv.x * 18.0, uv.y * 3.0 - uTime * 3.4)));
  float edge = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);
  // Noise eats more of the flame toward the top, so each tongue tapers to a point.
  float v = (1.0 - y) * 1.5 - (1.0 - n) * (0.3 + 1.6 * y) - (1.0 - n2) * 0.3 * y;
  float f = clamp(v * edge, 0.0, 1.0);
  // Red at the edges, yellow in the core. The edge mask keeps the tips crisp.
  // Orange-red even in the core. Only a flare pushes it toward yellow.
  vec3 col = vec3(min(1.0, 1.7 * f), 0.32 * pow(f, 2.2), 0.06 * pow(f, 5.0)) * smoothstep(0.0, 0.06, f) * (0.65 + 0.25 * h);
  gl_FragColor = vec4(col, 1.0);
}
`;

const emberVertex = /* glsl */ `
attribute float aLife;
uniform float uPixelScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPixelScale * 0.025 / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const emberFragment = /* glsl */ `
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * sin(vLife * 3.14159);
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * a * 1.6, 1.0);
}
`;

const EMBERS = 160;
const FLARE_PEAK = 1.6;
const FLARE_DECAY_SEC = 0.9;

/** A wide bed of flame under the head, plus rising embers. */
export class Fire {
  readonly group = new THREE.Group();
  /** Current intensity (base × flare). The head uses it for under-lighting. */
  intensity = 1;
  private flareTarget = 0;
  private flare = 0;
  private uniforms = { uTime: { value: 0 }, uIntensity: { value: 1 } };
  private emberUniforms = { uPixelScale: { value: 800 } };
  private emberPos = new Float32Array(EMBERS * 3);
  private emberLife = new Float32Array(EMBERS);
  private emberSpeed = new Float32Array(EMBERS);
  private emberGeo = new THREE.BufferGeometry();

  constructor() {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.8),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: fireFragment,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    plane.position.set(0, -0.25, 0.8);
    this.group.add(plane);

    for (let i = 0; i < EMBERS; i++) this.respawn(i, Math.random());
    this.emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3));
    this.emberGeo.setAttribute('aLife', new THREE.BufferAttribute(this.emberLife, 1));
    const embers = new THREE.Points(
      this.emberGeo,
      new THREE.ShaderMaterial({
        uniforms: this.emberUniforms,
        vertexShader: emberVertex,
        fragmentShader: emberFragment,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    embers.frustumCulled = false;
    this.group.add(embers);
  }

  flareUp() {
    this.flareTarget = FLARE_PEAK;
  }

  setPixelScale(scale: number) {
    this.emberUniforms.uPixelScale.value = scale;
  }

  update(t: number, dt: number, base: number) {
    this.flareTarget *= Math.exp(-dt / FLARE_DECAY_SEC);
    this.flare += (this.flareTarget - this.flare) * (1 - Math.exp(-dt / 0.08));
    this.intensity = base * (1 + this.flare);
    this.uniforms.uTime.value = t;
    this.uniforms.uIntensity.value = this.intensity;

    for (let i = 0; i < EMBERS; i++) {
      this.emberLife[i] += dt * this.emberSpeed[i] * (0.5 + 0.5 * this.intensity);
      if (this.emberLife[i] >= 1) this.respawn(i, 0);
      const k = i * 3;
      this.emberPos[k] += Math.sin(t * 2 + i) * dt * 0.15;
      this.emberPos[k + 1] = -1.7 + this.emberLife[i] * (1.2 + this.intensity * 0.9);
    }
    this.emberGeo.attributes.position.needsUpdate = true;
    this.emberGeo.attributes.aLife.needsUpdate = true;
  }

  private respawn(i: number, life: number) {
    this.emberPos[i * 3] = (Math.random() - 0.5) * 3;
    this.emberPos[i * 3 + 2] = 0.8 + (Math.random() - 0.5) * 0.4;
    this.emberLife[i] = life;
    this.emberSpeed[i] = 0.3 + Math.random() * 0.5;
  }
}
