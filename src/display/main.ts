import { KEY_MAP, LIPSYNC, REMOTE_SETTING_KEYS, type EffectName, type Settings } from '../config';
import { SettingsStore } from '../settings';
import { RelaySocket } from '../control/socket';
import { Voice } from '../audio/voice';
import { LipSync } from '../audio/lipsync';
import { Sfx } from '../audio/sfx';
import { createStage } from './scene';
import { Head } from './head';
import { Fire } from './fire';
import { Steam, STEAM_BURST_SEC } from './steam';
import { Lightning } from './lightning';
import { SetupPanel } from './setup-panel';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');

const store = new SettingsStore();
const stage = createStage(document.querySelector<HTMLCanvasElement>('#stage')!);
const fire = new Fire();
const steam = new Steam();
stage.scene.add(fire.group, steam.points);

let voice: Voice | null = null;
let sfx: Sfx | null = null;
let lipsync = new LipSync(null);
const lightning = new Lightning(document.querySelector('#flash')!, () => sfx?.thunder());
const panel = new SetupPanel(store);
panel.onTestTone = () => voice?.testTone();
const socket = new RelaySocket();
let socketUp = false;

let head: Head | null = null;
function loadHead(variant: Settings['headVariant']) {
  Head.create(variant).then((next) => {
    if (head) {
      stage.scene.remove(head.group);
      head.dispose();
    }
    head = next;
    head.setPlacement(store.value.headScale, store.value.headY);
    stage.scene.add(head.group);
  }, showError);
}
loadHead(store.value.headVariant);

let clock = 0;
/** Clicker and remote triggers. Shout-driven flares skip this, so they stay silent under the voice. */
function trigger(effect: EffectName) {
  if (effect === 'fire') {
    fire.flareUp();
    sfx?.fire();
  } else if (effect === 'steam') {
    steam.burst();
    sfx?.steam(STEAM_BURST_SEC);
  } else {
    lightning.strike(clock);
  }
}

// --- Settings ---------------------------------------------------------------

store.subscribe((changed) => {
  voice?.apply(changed);
  if (changed.headVariant) loadHead(changed.headVariant);
  if (changed.headScale !== undefined || changed.headY !== undefined) head?.setPlacement(store.value.headScale, store.value.headY);
  if (changed.inputId !== undefined && !demo) voice?.setInput(changed.inputId).catch(showError);
  if (changed.outputId !== undefined) voice?.setOutput(changed.outputId).catch(showError);
  if (REMOTE_SETTING_KEYS.some((k) => changed[k] !== undefined)) broadcastSettings();
});

function broadcastSettings() {
  const settings: Partial<Settings> = {};
  for (const k of REMOTE_SETTING_KEYS) settings[k] = store.value[k];
  socket.send({ type: 'settings', settings });
}

// --- Inputs: clicker / keyboard and the phone remote -------------------------

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  panel.lastKey = e.key;
  if (e.key === 's' || e.key === 'S') {
    panel.toggle();
    return;
  }
  const effect = KEY_MAP[e.key];
  if (effect) {
    e.preventDefault();
    trigger(effect);
  }
});

socket.onStatus = (up) => (socketUp = up);
socket.onMessage = (msg) => {
  if (msg.type === 'effect') trigger(msg.effect);
  else if (msg.type === 'hello') broadcastSettings();
  else if (msg.type === 'settings') {
    const allowed: Partial<Settings> = {};
    for (const k of REMOTE_SETTING_KEYS) {
      const v = msg.settings[k];
      if (typeof v === 'number' && Number.isFinite(v)) allowed[k] = v;
    }
    store.update(allowed);
  }
};

// --- Start: audio needs a user gesture unless Chrome runs with the autoplay flag ---

const startEl = document.querySelector<HTMLElement>('#start')!;
const errorEl = document.querySelector<HTMLElement>('#error')!;

async function start() {
  startEl.hidden = true;
  try {
    voice = await Voice.create(store.value, !demo);
    sfx = new Sfx(voice.ctx, voice.fxBus);
    // Chrome fires this when the output device fails or disappears.
    voice.ctx.addEventListener('error', () => showError(new Error('Speaker output failed. Pick the speakers again in the setup panel (S).')));
    lipsync = new LipSync(demo ? null : voice.analyser);
    if (voice.ctx.state !== 'running') throw new Error('Audio is blocked until you click.');
    errorEl.hidden = true;
  } catch (err) {
    showError(err);
    startEl.hidden = false;
  }
  if (!document.fullscreenElement && !params.has('autostart')) document.documentElement.requestFullscreen?.().catch(() => {});
}

function showError(err: unknown) {
  console.error(err);
  errorEl.textContent = err instanceof Error ? err.message : String(err);
  errorEl.hidden = false;
}

startEl.addEventListener('click', () => {
  if (voice) {
    voice.resume().then((running) => (startEl.hidden = running));
    return;
  }
  start();
});
if (params.has('autostart')) start();

// --- Frame loop ----------------------------------------------------------------

const camera = stage.camera;
function updatePixelScale() {
  const scale = (innerHeight * stage.renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  fire.setPixelScale(scale);
  steam.setPixelScale(scale);
  // Half the visible width at the steam's depth (camera z = 6, steam z = 0.3).
  steam.setHalfWidth(Math.tan((camera.fov * Math.PI) / 360) * 5.7 * camera.aspect);
}
addEventListener('resize', updatePixelScale);
updatePixelScale();

let last = performance.now();
let fps = 60;
let lastAutoFlare = 0;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  const mouth = lipsync.update(dt, store.value.sensitivity, demo ? clock : undefined);
  if (mouth.shout && now - lastAutoFlare > LIPSYNC.autoFlareDebounceMs) {
    lastAutoFlare = now;
    fire.flareUp();
  }

  fire.update(clock, dt, store.value.fireBase);
  steam.update(clock, dt);
  lightning.update(clock);
  head?.update(clock, dt, mouth, fire.intensity, lightning.level);
  stage.render();

  panel.update({
    fps,
    level: mouth.level,
    jaw: mouth.jaw,
    mic: voice?.inputLabel ?? '',
    output: voice ? `${voice.ctx.sampleRate} Hz, ${voice.ctx.state}` : 'not started',
    latencyMs: voice ? (voice.ctx.baseLatency + (voice.ctx.outputLatency || 0)) * 1000 : 0,
    socket: socketUp,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
