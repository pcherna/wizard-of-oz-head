import { parseMessage, type Message } from './commands';

/** WebSocket client for /ws that reconnects forever. Shared by the display and the remote. */
export class RelaySocket {
  private ws: WebSocket | null = null;
  onMessage: (msg: Message) => void = () => {};
  onStatus: (connected: boolean) => void = () => {};
  onOpen: () => void = () => {};

  constructor(private url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) {
    this.connect();
  }

  send(msg: Message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatus(true);
      this.onOpen();
    };
    ws.onmessage = (e) => {
      const msg = parseMessage(String(e.data));
      if (msg) this.onMessage(msg);
    };
    ws.onclose = () => {
      this.onStatus(false);
      setTimeout(() => this.connect(), 1000);
    };
  }
}
