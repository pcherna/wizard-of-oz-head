import * as THREE from 'three';
import { KEY_MAP, LIPSYNC, MIC_TOGGLE_KEYS, VOICE, OZ_SCULPT_DEFAULTS, REMOTE_SETTING_KEYS, STEAM_TAPS_FOR_LIGHTNING, STEAM_TAP_GAP_SEC, TRICK_NO_REPEAT, type EffectName, type Settings } from '../config';
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
import { Backdrop } from './backdrop';
import { SteamPipes } from './pipes';
import { CueTones } from '../audio/cue';
import { Projection } from './projection';
import { TRICKS, type Cue, type Trick } from './tricks';
import { Droplets } from './droplets';
import { Monkeys } from './monkeys';
import { Snooze } from './zzz';
import { Firefly } from './firefly';
import { Treat } from './treat';
import { Rainbow } from './rainbow';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
/** `?yaw=0.5` holds the head still at that angle, for checking its shape. */
const pinnedYaw = params.has('yaw') ? Number(params.get('yaw')) : null;
/** `?jaw=0.6` holds the mouth open that far (0 shut, 1 wide), for checking the jaw split. */
const pinnedJaw = params.has('jaw') ? Number(params.get('jaw')) : null;
/** `?trick=lick&at=0.8` holds that trick at 0.8 s in, for checking its pose. */
const pinnedTrick = TRICKS.find((tr) => tr.name === params.get('trick')) ?? null;

const store = new SettingsStore();
const stage = createStage(document.querySelector<HTMLCanvasElement>('#stage')!);
const fire = new Fire();
const steam = new Steam();
const backdrop = new Backdrop();
backdrop.setBrightness(store.value.backdrop);
stage.scene.add(backdrop.mesh);
const pipes = new SteamPipes();
pipes.setBrightness(store.value.backdrop);
stage.scene.add(pipes.group);
stage.scene.add(fire.group, steam.composite);
const droplets = new Droplets();
/** Bits of a popped gum bubble. */
const gum = new Droplets(0xff6ec0);
const monkeys = new Monkeys(stage.camera);
const snooze = new Snooze();
const firefly = new Firefly();
/** Firefly sparks that a burp lets out. */
const sparks = new Droplets(0xc8ff50);
/** Biscuit crumbs from the crunching. */
const crumbs = new Droplets(0xe0a050);
const treat = new Treat();
const rainbow = new Rainbow();
stage.scene.add(droplets.points, gum.points, monkeys.group, snooze.group, firefly.group, sparks.points, crumbs.points, treat.sprite, rainbow.mesh);

let voice: Voice | null = null;
let sfx: Sfx | null = null;
let lipsync = new LipSync(null);
const lightning = new Lightning(document.querySelector('#flash')!, () => sfx?.thunder());
function applyBrightness(brightness: number) {
  stage.setBrightness(brightness);
  lightning.brightness = brightness;
}
applyBrightness(store.value.brightness);
const panel = new SetupPanel(store);
const projection = new Projection(document.querySelector('#picture')!, document.querySelector('#keystone')!, store);
panel.onTestTone = () => voice?.testTone();
const socket = new RelaySocket();
let socketUp = false;

let head: Head | null = null;
function loadHead(variant: Settings['headVariant']) {
  Head.create(variant, store.value).then((next) => {
    if (head) {
      stage.scene.remove(head.group);
      head.dispose();
    }
    head = next;
    head.setPlacement(store.value.headScale, store.value.headY);
    head.pinnedYaw = pinnedYaw;
    head.setShine(store.value.headShine);
    head.setRimGlow(store.value.headRim);
    if (pinnedTrick) {
      head.pinnedTrickAt = Number(params.get('at') ?? 0.5);
      head.perform(pinnedTrick, clock, 1);
    }
    stage.scene.add(head.group);
  }, showError);
}
loadHead(store.value.headVariant);

// Dev-only handle for poking at the live head from the browser console.
if (import.meta.env.DEV) Object.assign(window, { wizard: { get head() { return head; } } });

let clock = 0;
let steamTaps = 0;
let lastSteamTap = -Infinity;
/** The trick button's last few picks, oldest first. A new pick skips these. */
let recentTricks: Trick[] = [];

/** Clicker and remote triggers. Shout-driven flares skip this, so they stay silent under the voice. */
function trigger(effect: EffectName) {
  noteActivity();
  if (effect === 'fire') {
    fire.flareUp();
    sfx?.fire();
  } else if (effect === 'steam') {
    steamTaps = clock - lastSteamTap <= STEAM_TAP_GAP_SEC ? steamTaps + 1 : 1;
    lastSteamTap = clock;
    // The last quick tap strikes lightning instead. The earlier taps' steam is still blowing.
    if (steamTaps >= STEAM_TAPS_FOR_LIGHTNING) {
      steamTaps = 0;
      lightning.strike(clock);
      return;
    }
    steam.burst();
    sfx?.steam(STEAM_BURST_SEC);
  } else if (effect === 'lightning') {
    lightning.strike(clock);
  } else if (head) {
    // Each press plays a random trick, skipping recent picks, autopilot-only and benched tricks, and tricks this head can't do.
    const choices = TRICKS.filter((tr) => !tr.autopilot && !tr.benched && canDo(tr) && !recentTricks.includes(tr));
    const pick = choices[Math.floor(Math.random() * choices.length)];
    recentTricks = [...recentTricks, pick].slice(-TRICK_NO_REPEAT);
    playTrick(pick);
  }
}

/** Cues still waiting from the current trick. A new trick cancels them, so cutting a trick short doesn't fire its leftover cues. */
let cueTimers: number[] = [];

/** Only the Labrador has a separate tongue, canines, lifting ears and a measured nose, for the tricks that need them. */
function canDo(trick: Trick): boolean {
  return !!head && (head.hasTongue || !trick.tongue) && (head.hasFangs || !trick.fangs) && (head.hasEars || !trick.ears) && (head.hasNoseTop || !trick.nose);
}

/** The trick that played last, for the A key to repeat. */
let lastTrick: Trick | null = null;

function playTrick(trick: Trick) {
  if (!head) return;
  lastTrick = trick;
  const dir = Math.random() < 0.5 ? -1 : 1;
  // A clip such as "Squirrel!" may play first. Then the head moves when it ends.
  const lead = sfx?.trick(trick.name, dir) ?? 0;
  head.perform(trick, clock + lead, dir);
  cueTimers.forEach(clearTimeout);
  cueTimers = (trick.cues ?? []).map(([at, cue]) => window.setTimeout(() => runCue(cue, dir), (lead + at) * 1000));
}

/** Steam and fire stay silent, so they don't cover the trick's own sound. Trick steam doesn't count toward lightning taps. */
function runCue(cue: Cue, dir: number) {
  if (cue === 'steam') steam.burst();
  else if (cue === 'wideSteam') steam.burst(2.5);
  else if (cue === 'flare') fire.flareUp();
  else if (cue === 'douse') fire.douse();
  else if (cue === 'lightning') lightning.strike(clock);
  else if (cue === 'monkeys') monkeys.launch(clock, dir);
  else if (cue === 'sparks') {
    if (head) sparks.burst(head.mouthWorld(new THREE.Vector3()), 30, 1.6);
  } else if (cue === 'crumbs') {
    if (head) crumbs.burst(head.mouthWorld(new THREE.Vector3()), 20, 1.2);
  } else if (head) gum.burst(head.bubbleWorld(new THREE.Vector3()), 40, 2.2);
}

// --- Autopilot: a small trick now and then, when nobody presses anything or speaks ---

let lastActivity = 0;
/** Scales the wait, so autopilot tricks don't come like clockwork. */
let autoJitter = 1;
let lastAuto: Trick | null = null;
/** The N key's place in the autopilot tricks. */
let nextAuto = 0;

function noteActivity() {
  lastActivity = clock;
  autoJitter = 0.7 + 0.6 * Math.random();
}

function autopilot() {
  const wait = store.value.autopilotSec;
  if (wait <= 0 || !head || clock - lastActivity < wait * autoJitter) return;
  const choices = TRICKS.filter((tr) => tr.autopilot && !tr.benched && tr !== lastAuto && canDo(tr));
  lastAuto = choices[Math.floor(Math.random() * choices.length)];
  playTrick(lastAuto);
  noteActivity();
}

// --- Settings ---------------------------------------------------------------

store.subscribe((changed) => {
  voice?.apply(changed);
  if (changed.sfxVolume !== undefined) sfx?.setVolume(changed.sfxVolume);
  if (changed.headVariant) loadHead(changed.headVariant);
  if (changed.headShine !== undefined) head?.setShine(changed.headShine);
  if (changed.headRim !== undefined) head?.setRimGlow(changed.headRim);
  if (changed.backdrop !== undefined) {
    backdrop.setBrightness(changed.backdrop);
    pipes.setBrightness(changed.backdrop);
  }
  if (changed.brightness !== undefined) applyBrightness(changed.brightness);
  if (Object.keys(changed).some((k) => k in OZ_SCULPT_DEFAULTS)) head?.setSculpt(store.value);
  if (changed.headScale !== undefined || changed.headY !== undefined) head?.setPlacement(store.value.headScale, store.value.headY);
  if (changed.inputId !== undefined && !demo) voice?.setInput(changed.inputId).catch(showError);
  if (changed.outputId !== undefined) voice?.setOutput(changed.outputId).catch(showError);
  if (changed.cueOutputId !== undefined) cue.setOutput(changed.cueOutputId).catch(showError);
  if (REMOTE_SETTING_KEYS.some((k) => changed[k] !== undefined)) broadcastSettings();
});

function broadcastSettings() {
  const settings: Partial<Settings> = {};
  for (const k of REMOTE_SETTING_KEYS) settings[k] = store.value[k];
  socket.send({ type: 'settings', settings });
}

// --- Inputs: clicker / keyboard and the phone remote -------------------------

// The mic starts muted on every load, so nothing goes out until the performer unmutes.
// Mute is never saved: a reload always comes back muted.
let micMuted = true;

/** When the mic actually opens after an unmute. The eyes brighten then, not at the key press. */
let micOpensAt = 0;

const cue = new CueTones();

function setMicMuted(muted: boolean) {
  noteActivity();
  micMuted = muted;
  cue.play(muted);
  if (!muted) {
    micOpensAt = clock + VOICE.unmuteHoldSec;
    // The performer is about to speak, so any trick gets out of the way. Fire, steam and lightning carry on.
    head?.cancelTrick(clock);
    sfx?.stopTricks();
    cueTimers.forEach(clearTimeout);
    cueTimers = [];
    monkeys.dismiss(clock);
  }
  voice?.setMuted(muted);
  socket.send({ type: 'mic', muted });
}

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  panel.lastKey = e.key;
  if (e.key === 's' || e.key === 'S') {
    panel.toggle();
    return;
  }
  if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    panel.toggleCentered();
    return;
  }
  if (e.key === 'f' || e.key === 'F') {
    enterFullscreen().catch(() => {});
    return;
  }
  // Testing: play the last trick again. It doesn't count as a trick-button pick.
  if ((e.key === 'a' || e.key === 'A') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    noteActivity();
    if (lastTrick) playTrick(lastTrick);
    return;
  }
  // Testing: play the next autopilot trick, in order, without waiting for autopilot.
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    noteActivity();
    const autos = TRICKS.filter((tr) => tr.autopilot && !tr.benched && canDo(tr));
    if (autos.length) playTrick(autos[nextAuto++ % autos.length]);
    return;
  }
  // Projector fit. Skip Cmd-R and friends, so a reload doesn't also reset the corners.
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.key === 'u' || e.key === 'U') return projection.toggleFlipped();
    if (e.key === 'k' || e.key === 'K') return projection.toggleHandles();
    if ((e.key === 'r' || e.key === 'R') && projection.handlesVisible) return projection.resetKeystone();
    if ((e.key === 'c' || e.key === 'C') && projection.handlesVisible) return projection.insetKeystone();
  }
  if (MIC_TOGGLE_KEYS.includes(e.key)) {
    // F5 would reload the page and Esc would leave fullscreen, so always swallow them.
    e.preventDefault();
    if (!e.repeat) setMicMuted(!micMuted);
    return;
  }
  const effect = KEY_MAP[e.key];
  if (effect && !startEl.hidden) {
    // Chrome won't start audio, the mic or fullscreen until someone clicks or presses a key.
    // A clicker press counts, so the first one starts the show instead of firing its effect.
    e.preventDefault();
    if (!e.repeat) start(true);
    return;
  }
  if (effect) {
    e.preventDefault();
    trigger(effect);
  }
});

/**
 * Fullscreen with Esc and F5 locked to the page (Chrome's Keyboard Lock API). Chrome then leaves
 * fullscreen only when Esc is held for about 2 seconds, so a clicker's quick Esc can't.
 */
async function enterFullscreen() {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  const keyboard = (navigator as Navigator & { keyboard?: { lock(codes?: string[]): Promise<void> } }).keyboard;
  await keyboard?.lock(['Escape', 'F5']);
}

socket.onStatus = (up) => (socketUp = up);
socket.onMessage = (msg) => {
  if (msg.type === 'effect') trigger(msg.effect);
  else if (msg.type === 'hello') {
    broadcastSettings();
    socket.send({ type: 'mic', muted: micMuted });
  } else if (msg.type === 'mic') {
    // Ignore no-op changes, or two open displays would bounce the message back and forth forever.
    if (msg.muted !== micMuted) setMicMuted(msg.muted === true);
  } else if (msg.type === 'dump') {
    socket.send({ type: 'settings', settings: store.value });
  } else if (msg.type === 'settings') {
    // Only real changes, so two open displays don't re-broadcast each other's settings forever.
    const changed: Partial<Settings> = {};
    for (const k of REMOTE_SETTING_KEYS) {
      const v = msg.settings[k];
      if (typeof v === 'number' && Number.isFinite(v) && v !== store.value[k]) changed[k] = v;
    }
    if (Object.keys(changed).length > 0) store.update(changed);
  }
};

// --- Start: audio needs a user gesture unless Chrome runs with the autoplay flag ---

const startEl = document.querySelector<HTMLElement>('#start')!;
const errorEl = document.querySelector<HTMLElement>('#error')!;

let starting = false;

async function start(byClick: boolean) {
  if (starting) return;
  starting = true;
  startEl.hidden = true;
  let next: Voice | null = null;
  try {
    next = await Voice.create(store.value, !demo);
    if (next.ctx.state !== 'running') {
      throw new Error(byClick ? "The speakers didn't start. Press S and pick the speakers, or check the Mac's sound output." : '');
    }
    voice = next;
    voice.setMuted(micMuted);
    sfx = new Sfx(voice.ctx, voice.fxBus);
    sfx.setVolume(store.value.sfxVolume);
    // Inside the start click, so the cue context is allowed to play.
    cue.setOutput(store.value.cueOutputId).catch(showError);
    // Chrome fires this when the output device fails or disappears.
    voice.ctx.addEventListener('error', () => showError(new Error('Speaker output failed. Pick the speakers again in the setup panel (S).')));
    lipsync = new LipSync(demo ? null : voice.analyser);
    errorEl.hidden = true;
    startReason.textContent = '';
  } catch (err) {
    // A context that won't run stays stuck, so throw it away and build a fresh one next click.
    next?.close();
    console.error(err);
    startReason.textContent = explainStartError(err);
    startEl.hidden = false;
  } finally {
    starting = false;
  }
  if (!params.has('autostart')) enterFullscreen().catch(() => {});
}

/** Turns a start failure into something the operator can act on. Empty means "just click". */
function explainStartError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  switch (err.name) {
    case 'NotAllowedError':
      return /system/i.test(err.message)
        ? "macOS is blocking Chrome's microphone. Turn Chrome on in System Settings > Privacy & Security > Microphone, then restart Chrome."
        : 'Chrome blocked the microphone for this page. Click the icon left of the address, allow Microphone, then click here again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "The chosen mic isn't connected. Press S and pick another mic.";
    case 'NotReadableError':
      return 'The mic is busy or failed to start. Reconnect the AirPods, or press S and pick another mic.';
    default:
      return err.message;
  }
}

/** How long an error stays on screen. The show goes on, so it shouldn't linger over it. */
const ERROR_SHOW_MS = 10_000;
let errorTimer = 0;

function showError(err: unknown) {
  console.error(err);
  errorEl.textContent = err instanceof Error ? err.message : String(err);
  errorEl.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => (errorEl.hidden = true), ERROR_SHOW_MS);
}

const startReason = document.createElement('small');
startEl.append(startReason);
startEl.addEventListener('click', () => start(true));
if (params.has('autostart')) start(false);

// --- Frame loop ----------------------------------------------------------------

const camera = stage.camera;
function updatePixelScale() {
  const scale = (innerHeight * stage.renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  fire.setPixelScale(scale);
  steam.setPixelScale(scale);
  droplets.setPixelScale(scale);
  gum.setPixelScale(scale);
  sparks.setPixelScale(scale);
  crumbs.setPixelScale(scale);
  const buffer = stage.renderer.getDrawingBufferSize(new THREE.Vector2());
  steam.setSize(buffer.x, buffer.y);
  // Half the visible width at the steam's depth (camera z = 6, steam z = 0.3).
  steam.setHalfWidth(Math.tan((camera.fov * Math.PI) / 360) * 5.7 * camera.aspect);
  pipes.setVentX(steam.ventX);
  backdrop.fit(camera);
  rainbow.fit(camera);
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
  if (pinnedJaw !== null) mouth.jaw = pinnedJaw;
  if (mouth.shout && now - lastAutoFlare > LIPSYNC.autoFlareDebounceMs) {
    lastAutoFlare = now;
    fire.flareUp();
  }

  fire.update(clock, dt, store.value.fireBase);
  steam.update(clock, dt);
  lightning.update(clock);
  backdrop.update(clock, fire.intensity, lightning.level, head?.ghost ?? 0);
  pipes.update(clock, fire.intensity);
  const micLive = !micMuted && clock >= micOpensAt;
  head?.update(clock, dt, mouth, fire.intensity, lightning.level, micLive);
  droplets.update(dt, head);
  gum.update(dt, null);
  sparks.update(dt, null);
  crumbs.update(dt, null);
  firefly.update(head);
  treat.update(head);
  rainbow.update(clock, head?.rainbow ?? 0, head?.rainbowArc ?? 0, head?.rainbowSide ?? 1);
  snooze.update(dt, head);
  monkeys.update(clock);
  if (mouth.level > 0.15) noteActivity();
  autopilot();
  steam.renderDensity(stage.renderer, stage.camera);
  stage.render();

  panel.update({
    fps,
    level: mouth.level,
    jaw: mouth.jaw,
    mic: voice?.inputLabel ?? '',
    output: voice ? `${voice.ctx.sampleRate} Hz, ${voice.ctx.state}` : 'not started',
    latencyMs: voice ? (voice.ctx.baseLatency + (voice.ctx.outputLatency || 0)) * 1000 : 0,
    socket: socketUp,
    micMuted,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
