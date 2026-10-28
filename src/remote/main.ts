import type { EffectName, Settings } from '../config';
import { RelaySocket } from '../control/socket';

const socket = new RelaySocket();
const status = document.querySelector<HTMLElement>('#status')!;

socket.onStatus = (up) => {
  status.textContent = up ? 'connected' : 'offline';
  status.classList.toggle('up', up);
};
socket.onOpen = () => socket.send({ type: 'hello' });

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-effect]')) {
  // pointerdown fires faster than click on iOS.
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    socket.send({ type: 'effect', effect: btn.dataset.effect as EffectName });
  });
}

const sliders = [...document.querySelectorAll<HTMLInputElement>('input[data-k]')];
for (const input of sliders) {
  const out = input.nextElementSibling as HTMLOutputElement;
  input.addEventListener('input', () => {
    out.textContent = input.value;
    socket.send({ type: 'settings', settings: { [input.dataset.k!]: Number(input.value) } });
  });
}

socket.onMessage = (msg) => {
  if (msg.type !== 'settings') return;
  for (const input of sliders) {
    const v = msg.settings[input.dataset.k as keyof Settings];
    if (typeof v === 'number' && document.activeElement !== input) {
      input.value = String(v);
      (input.nextElementSibling as HTMLOutputElement).textContent = input.value;
    }
  }
};
