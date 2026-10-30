import * as THREE from 'three';

/** World z of the backdrop plane, well behind the head. */
const DEPTH = -3;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Layout in screen-height units: q.y runs -1 (floor) to 1 (top), q.x is scaled by the aspect.
// Proportions measured from the 1939 throne-room set.
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uFire;
uniform float uFlash;
uniform float uGhost;
uniform float uBrightness;
uniform float uAspect;
varying vec2 vUv;

float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }

// Cylinder shading across a row of columns: bright down each middle, dark at the seams.
// Returns the shade and the column index.
vec2 columns(float x, float width) {
  float f = fract(x / width);
  return vec2(pow(sin(3.14159 * f), 0.7), floor(x / width));
}

// Top edge of the stepped organ case at distance ax from the middle. Below -1 means no case.
float caseTop(float ax) {
  if (ax < 0.44) return 0.72;
  float step = floor((ax - 0.44) / 0.18);
  if (step > 4.0) return -2.0;
  return 0.44 - step * 0.26;
}

void main() {
  vec2 q = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
  float ax = abs(q.x);
  float flicker = 0.9 + 0.1 * sin(uTime * 11.0) * sin(uTime * 6.7 + 2.0);

  // Green pleated columns: everywhere behind the case, strongest toward the sides.
  vec2 pleat = columns(q.x + 10.0, 0.065);
  float pleatVar = 0.75 + 0.25 * hash(pleat.y);
  float floorGlow = smoothstep(0.3, -1.0, q.y);
  vec3 green = mix(vec3(0.03, 0.36, 0.15), vec3(0.32, 0.85, 0.6), floorGlow * floorGlow);
  float side = smoothstep(0.3, 1.2, ax);
  float fadeUp = mix(1.0, 0.2, smoothstep(-0.6, 1.0, q.y));
  vec3 col = green * (0.25 + 0.75 * pleat.x) * pleatVar * side * fadeUp;
  // A slow shimmer drifting up the pleats.
  col *= 0.9 + 0.1 * sin(q.y * 6.0 - uTime * 0.8 + pleat.y * 1.7);

  // The organ case: thin pipes lit by the fire below.
  float top = caseTop(ax);
  float inCase = 1.0 - smoothstep(top - 0.004, top + 0.004, q.y);
  vec2 pipe = columns(q.x + 10.0, 0.045);
  // The fire sits at the bottom middle, so the pipes darken with height and toward the sides.
  float rise = smoothstep(0.8, -1.0, q.y);
  float fireLight = (0.12 + 0.88 * rise * rise) * (0.6 + 0.4 * min(uFire, 2.5)) * flicker;
  vec3 warm = vec3(0.42, 0.25, 0.13) * (0.25 + 0.75 * pipe.x) * (0.85 + 0.15 * hash(pipe.y + 40.0));
  warm *= fireLight * (1.0 - 0.45 * smoothstep(0.0, 1.4, ax));
  // A lit lip along each step's top edge.
  warm += vec3(0.35, 0.24, 0.15) * smoothstep(top - 0.035, top - 0.005, q.y) * inCase * 0.4;
  col = mix(col, warm, inCase);

  // Keep the space behind the head dark, so the head reads against it. A ghost head lifts the
  // shade, so the organ shows through it.
  col *= 1.0 - 0.6 * (1.0 - uGhost) * exp(-dot(q - vec2(0.0, 0.25), q - vec2(0.0, 0.25)) / 0.25);

  col += uFlash * vec3(0.6, 0.7, 0.9) * 0.5;
  gl_FragColor = vec4(col * uBrightness, 1.0);
}
`;

/**
 * The throne-room organ from the film, drawn behind everything: a stepped case of fire-lit
 * pipes between glowing green pleats. Hidden at brightness 0, which keeps the projector's
 * black for a scrim or Pepper's ghost.
 */
export class Backdrop {
  readonly mesh: THREE.Mesh;
  private uniforms = {
    uTime: { value: 0 },
    uFire: { value: 1 },
    uFlash: { value: 0 },
    uGhost: { value: 0 },
    uBrightness: { value: 0 },
    uAspect: { value: 16 / 9 },
  };

  constructor() {
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.position.z = DEPTH;
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Fill the camera's view at the backdrop's depth. */
  fit(camera: THREE.PerspectiveCamera) {
    const halfH = (camera.position.z - DEPTH) * Math.tan((camera.fov * Math.PI) / 360);
    this.mesh.scale.set(halfH * camera.aspect, halfH, 1);
    this.uniforms.uAspect.value = camera.aspect;
  }

  setBrightness(brightness: number) {
    this.uniforms.uBrightness.value = brightness;
    this.mesh.visible = brightness > 0;
  }

  /** ghost (0 to 1) is how far the head has turned into a ghost. */
  update(t: number, fire: number, flash: number, ghost: number) {
    this.uniforms.uTime.value = t;
    this.uniforms.uFire.value = fire;
    this.uniforms.uFlash.value = flash;
    this.uniforms.uGhost.value = ghost;
  }
}
