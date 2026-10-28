import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render: () => void;
  /** Scales the final picture: 1 is full brightness. */
  setBrightness: (brightness: number) => void;
}

/** Renderer, camera, and bloom. The background stays pure black for the projector. */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.32);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Last, after bloom and color conversion, so everything dims together and black stays black.
  const dim = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uBrightness: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uBrightness;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        gl_FragColor = vec4(c.rgb * uBrightness, c.a);
      }`,
  });
  composer.addPass(dim);

  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    render: () => composer.render(),
    setBrightness: (brightness) => (dim.uniforms.uBrightness.value = brightness),
  };
}
