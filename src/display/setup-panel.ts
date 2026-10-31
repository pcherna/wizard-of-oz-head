import { OZ_SCULPT_DEFAULTS, type Settings } from '../config';
import { listAudioDevices } from '../audio/voice';
import type { SettingsStore } from '../settings';
import { CUE_OFF } from '../audio/cue';

type NumericKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const SLIDERS: [NumericKey, string, number, number, number][] = [
  ['brightness', 'Overall brightness', 0.1, 1, 0.01],
  ['volume', 'Volume', 0, 2, 0.01],
  ['sfxVolume', 'Effects volume', 0, 1, 0.01],
  ['autopilotSec', 'Autopilot after (s, 0 = off)', 0, 120, 5],
  ['pitch', 'Pitch', 0.5, 1, 0.01],
  ['reverbWet', 'Reverb', 0, 1, 0.01],
  ['gate', 'Gate', 0, 0.05, 0.001],
  ['sensitivity', 'Mouth sensitivity', 0.02, 0.3, 0.005],
  ['fireBase', 'Fire level', 0, 2, 0.01],
  ['headScale', 'Head scale', 0.5, 1.8, 0.01],
  ['headY', 'Head height', -1, 1, 0.01],
  ['headShine', 'Shine', 0, 1, 0.01],
  ['headRim', 'Rim glow', 0, 1.5, 0.01],
  ['backdrop', 'Organ backdrop', 0, 1.5, 0.01],
];

/** One slider per Oz distortion. */
const SCULPT_SLIDERS: [NumericKey, string, number, number, number][] = [
  ['ozDome', 'Dome width', 0, 1.2, 0.01],
  ['ozDomeStart', 'Dome start', -0.6, 2.2, 0.01],
  ['ozCrown', 'Dome height', 0, 1.5, 0.01],
  ['ozForehead', 'Forehead ridges', 0, 0.5, 0.01],
  ['ozBrow', 'Brow', 0, 0.45, 0.01],
  ['ozEyes', 'Eye sockets', 0, 0.3, 0.01],
  ['ozNose', 'Nose', 0, 0.35, 0.01],
  ['ozFolds', 'Cheek folds', 0, 0.25, 0.01],
  ['ozTaper', 'Jaw taper', 0, 0.6, 0.01],
  ['ozChin', 'Chin drop', 0, 0.5, 0.01],
  ['ozFeatures', 'Feature size', 0.6, 1.3, 0.01],
  ['ozFeatureY', 'Feature height', -0.5, 0.5, 0.01],
];

/** Operator panel, toggled with S. Device pickers, tuning sliders, and live readouts. */
export class SetupPanel {
  private el: HTMLElement;
  private meter: HTMLElement;
  private readout: HTMLElement;
  private inputSel: HTMLSelectElement;
  private outputSel: HTMLSelectElement;
  private cueSel: HTMLSelectElement;
  private sliders = new Map<NumericKey, HTMLInputElement>();
  lastKey = '—';
  onTestTone: () => void = () => {};
  private remoteUrl = '(server offline)';

  /** `parent` is where the panel goes. */
  constructor(private store: SettingsStore, parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'setup';
    this.el.hidden = true;
    this.el.innerHTML = `
      <h2>Wizard setup <small>(S to close)</small></h2>
      <label>Mic <select data-k="inputId"></select></label>
      <label>Speakers <select data-k="outputId"></select></label>
      <button class="test-tone">Test speakers</button>
      <label>Cue tones <select data-k="cueOutputId"></select></label>
      <label>Head <select data-k="headVariant">
        <option value="oz">Oz (sculpted scan)</option>
        <option value="scan">Scan (Lee Perry-Smith)</option>
        <option value="procedural">Procedural</option>
        <option value="labrador">Labrador</option>
      </select></label>
      <div class="sliders"></div>
      <section class="oz-sculpt">
        <h3>Oz sculpt <button class="reset-sculpt">Reset</button></h3>
        <div class="sculpt"></div>
      </section>
      <div class="meter"><div></div></div>
      <pre class="readout"></pre>
      <p class="credit">Head scan: "Infinite" by Lee Perry-Smith, CC BY 3.0, via three.js.<br>
        Labrador: "Dog" by all of life, CC BY 4.0, via Sketchfab.</p>`;
    parent.append(this.el);

    this.inputSel = this.el.querySelector('[data-k=inputId]')!;
    this.outputSel = this.el.querySelector('[data-k=outputId]')!;
    const variantSel = this.el.querySelector<HTMLSelectElement>('[data-k=headVariant]')!;
    variantSel.value = store.value.headVariant;
    variantSel.onchange = () => store.update({ headVariant: variantSel.value as Settings['headVariant'] });
    this.inputSel.onchange = () => store.update({ inputId: this.inputSel.value });
    this.outputSel.onchange = () => store.update({ outputId: this.outputSel.value });
    this.cueSel = this.el.querySelector('[data-k=cueOutputId]')!;
    this.cueSel.onchange = () => store.update({ cueOutputId: this.cueSel.value });
    this.el.querySelector<HTMLButtonElement>('.test-tone')!.onclick = () => this.onTestTone();

    this.addSliders(this.el.querySelector('.sliders')!, SLIDERS);
    this.addSliders(this.el.querySelector('.sculpt')!, SCULPT_SLIDERS);
    this.el.querySelector<HTMLButtonElement>('.reset-sculpt')!.onclick = () => store.update({ ...OZ_SCULPT_DEFAULTS });
    this.meter = this.el.querySelector('.meter > div')!;
    this.readout = this.el.querySelector('.readout')!;

    // The sculpt only reshapes the Oz head, so hide its sliders for the others.
    const sculptSection = this.el.querySelector<HTMLElement>('.oz-sculpt')!;
    const showSculpt = () => (sculptSection.hidden = store.value.headVariant !== 'oz');
    showSculpt();

    store.subscribe((changed) => {
      if (changed.headVariant !== undefined) showSculpt();
      for (const [key, input] of this.sliders) {
        if (changed[key] !== undefined) {
          input.value = String(changed[key]);
          input.nextElementSibling!.textContent = input.value;
        }
      }
    });
    navigator.mediaDevices?.addEventListener('devicechange', () => this.refreshDevices());
    fetch('/api/info')
      .then((r) => r.json() as Promise<{ remoteUrls: string[] }>)
      .then((info) => (this.remoteUrl = info.remoteUrls[0] ?? this.remoteUrl))
      .catch(() => {});
  }

  private addSliders(box: Element, defs: [NumericKey, string, number, number, number][]) {
    const store = this.store;
    for (const [key, label, min, max, step] of defs) {
      const row = document.createElement('label');
      row.innerHTML = `${label} <input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.value = String(store.value[key]);
      out.textContent = input.value;
      input.oninput = () => {
        out.textContent = input.value;
        store.update({ [key]: Number(input.value) });
      };
      this.sliders.set(key, input);
      box.append(row);
    }
  }

  toggle() {
    this.el.hidden = !this.el.hidden;
    document.body.classList.toggle('show-cursor', !this.el.hidden);
    if (!this.el.hidden) this.refreshDevices();
  }

  /** Moves the panel between its corner and dead center, for a screen that crops its edges. */
  toggleCentered() {
    this.el.classList.toggle('centered');
  }

  get visible() {
    return !this.el.hidden;
  }

  async refreshDevices() {
    const { inputs, outputs } = await listAudioDevices();
    fill(this.inputSel, inputs, this.store.value.inputId);
    fill(this.outputSel, outputs, this.store.value.outputId);
    fill(this.cueSel, outputs, this.store.value.cueOutputId, new Option('Off', CUE_OFF));
  }

  update(info: { fps: number; level: number; jaw: number; mic: string; output: string; latencyMs: number; socket: boolean; micMuted: boolean }) {
    if (this.el.hidden) return;
    this.meter.style.width = `${Math.min(100, info.level * 50)}%`;
    this.readout.textContent = [
      `FPS          ${info.fps.toFixed(0)}`,
      `Mic          ${info.mic || '(demo / none)'}${info.micMuted ? '  · MUTED (F5/Esc to unmute)' : ''}`,
      `Output       ${this.outputSel.selectedOptions[0]?.text ?? 'System default'} · ${info.output}`,
      `Level        ${info.level.toFixed(2)}  (1.0 = full jaw)`,
      `Jaw          ${info.jaw.toFixed(2)}`,
      `Out latency  ${info.latencyMs.toFixed(0)} ms (excludes Bluetooth input)`,
      `Last key     ${this.lastKey}`,
      `Relay        ${info.socket ? 'connected' : 'offline'}`,
      `Remote URL   ${this.remoteUrl}`,
    ].join('\n');
  }
}

function fill(sel: HTMLSelectElement, devices: MediaDeviceInfo[], current: string, first = new Option('System default', '')) {
  sel.innerHTML = '';
  sel.append(first);
  for (const d of devices) {
    if (d.deviceId === 'default' || !d.deviceId) continue;
    sel.append(new Option(d.label || d.deviceId.slice(0, 8), d.deviceId));
  }
  sel.value = current;
}
