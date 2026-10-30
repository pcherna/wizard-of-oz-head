import * as THREE from 'three';

/** World z of the rainbow: just in front of the backdrop, well behind the head. */
const DEPTH = -2.8;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Layout in screen-height units, as in the backdrop: q.y runs -1 (floor) to 1 (top).
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAmount;
uniform float uArc;
uniform float uAspect;
varying vec2 vUv;

const vec2 CENTER = vec2(0.0, -1.05);
const float INNER = 1.45;
const float WIDTH = 0.36;

void main() {
  vec2 q = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
  vec2 d = q - CENTER;
  // 0 at the inner violet edge, 1 at the outer red one.
  float band = (length(d) - INNER) / WIDTH;
  float shape = smoothstep(0.0, 0.1, band) * smoothstep(1.0, 0.92, band);
  // 0 at the horizon on the side the arc starts from, pi at the other end.
  float side = uArc < 0.0 ? -1.0 : 1.0;
  float angle = atan(d.y, d.x * side);
  float drawn = abs(uArc) * 3.2;
  float shown = 1.0 - smoothstep(drawn - 0.12, drawn, angle);
  // The ends fade into mist near the floor.
  shown *= smoothstep(-1.0, -0.35, q.y);
  vec3 col = clamp(0.5 + 0.75 * cos(6.2832 * (0.75 * (1.0 - band) + vec3(0.0, 0.67, 0.33))), 0.0, 1.0);
  // A slow shimmer along the arc, and a bright tip while it's being drawn.
  float shimmer = 0.85 + 0.15 * sin(angle * 24.0 - uTime * 3.0);
  float tip = (1.0 - smoothstep(0.0, 0.25, abs(angle - drawn))) * step(abs(uArc), 0.99);
  gl_FragColor = vec4(col * shape * (shown * shimmer + tip) * uAmount * 0.6, 1.0);
}
`;

/** A rainbow arching across the sky behind the head, drawn from one side, for the rainbow trick. */
export class Rainbow {
  readonly mesh: THREE.Mesh;
  private uniforms = {
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uArc: { value: 0 },
    uAspect: { value: 16 / 9 },
  };

  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.position.z = DEPTH;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Fill the camera's view at the rainbow's depth. */
  fit(camera: THREE.PerspectiveCamera) {
    const halfH = (camera.position.z - DEPTH) * Math.tan((camera.fov * Math.PI) / 360);
    this.mesh.scale.set(halfH * camera.aspect, halfH, 1);
    this.uniforms.uAspect.value = camera.aspect;
  }

  /** amount (0 to 1) is its brightness. arc (-1 to 1) is how much is drawn, signed by the side it starts from. */
  update(t: number, amount: number, arc: number) {
    this.mesh.visible = amount > 0.001;
    this.uniforms.uTime.value = t;
    this.uniforms.uAmount.value = amount;
    this.uniforms.uArc.value = arc;
  }
}
