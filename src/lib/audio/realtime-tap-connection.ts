export type TapConnectionState =
  "disconnected" | "connecting" | "connected" | "recovering";

// Network delay is the effect; unbounded queued audio is not. Keep enough room
// for intercontinental RTT without allowing a broken route to accumulate audio.
export const MAX_FRAME_AGE_MS = 10000;
export const MAX_SEND_QUEUE_MS = 5000;
const CONNECT_TIMEOUT_MS = 8000;
const WATCHDOG_MS = 250;
const MAX_RETRY_MS = 10000;

export type TapSocket = {
  readonly readyState: number;
  readonly bufferedAmount: number;
  binaryType: BinaryType;
  onopen: ((event: Event) => unknown) | null;
  onmessage: ((event: MessageEvent) => unknown) | null;
  onclose: ((event: CloseEvent) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  send(data: ArrayBuffer): void;
  close(): void;
};

export class RealtimeTapConnection {
  private socket: TapSocket | null = null;
  private readonly urls: readonly string[];
  private route = 0;
  private state: TapConnectionState = "disconnected";
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<number, number>();
  private attempt = 0;
  private openedAt = 0;
  private connectingAt = 0;
  private lastTick = 0;
  private lastWallTick = 0;

  constructor(
    urls: string | readonly string[],
    private readonly onFrame: (data: ArrayBuffer) => void,
    private readonly onState: (state: TapConnectionState) => void,
    private readonly createSocket: (url: string) => TapSocket = (url) =>
      new WebSocket(url),
  ) {
    this.urls = typeof urls === "string" ? [urls] : urls;
    if (!this.urls.length) throw new Error("A tap connection needs a URL.");
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.open();
    this.lastTick = performance.now();
    this.lastWallTick = Date.now();
    this.watchdog = setInterval(() => this.check(), WATCHDOG_MS);
  }

  stop() {
    this.active = false;
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.watchdog !== null) clearInterval(this.watchdog);
    this.timer = this.watchdog = null;
    this.detach();
    this.setState("disconnected");
  }

  send(data: ArrayBuffer, sampleRate: number): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const now = performance.now();
    const oldest = this.pending.values().next().value;
    if (oldest !== undefined && now - oldest > MAX_FRAME_AGE_MS) {
      this.recover();
      return false;
    }
    // Never punch holes in continuous audio to meet a latency target. Only
    // reset the whole connection if seconds of unsent audio make it unusable.
    if (
      socket.bufferedAmount + data.byteLength >
      (sampleRate * 2 * MAX_SEND_QUEUE_MS) / 1000
    ) {
      this.recover();
      return false;
    }
    try {
      const view = new DataView(data);
      socket.send(data);
      this.pending.set(view.getUint32(0, true), now);
      return true;
    } catch {
      this.recover();
      return false;
    }
  }

  restart() {
    if (this.active) this.recover();
  }

  private open() {
    if (!this.active) return;
    this.timer = null;
    this.setState(this.attempt ? "recovering" : "connecting");
    this.connectingAt = performance.now();
    this.lastWallTick = Date.now();
    let socket: TapSocket;
    try {
      socket = this.createSocket(this.urls[this.route % this.urls.length]);
    } catch {
      this.recover();
      return;
    }
    this.socket = socket;
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.openedAt = performance.now();
      // A successful handshake alone does not prove the audio path works.
      // Report connected only after the first fresh echo.
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket || !(event.data instanceof ArrayBuffer))
        return;
      // On macOS the performance clock may pause during system sleep. Check
      // wall time too, before allowing a pre-sleep packet into playback.
      if (Date.now() - this.lastWallTick > MAX_FRAME_AGE_MS) {
        this.recover();
        return;
      }
      const data = event.data;
      if (data.byteLength < 12 || (data.byteLength - 12) % 2 !== 0) return;
      const view = new DataView(data);
      const seq = view.getUint32(0, true);
      const sent = this.pending.get(seq);
      if (sent === undefined) return;
      const age = performance.now() - view.getFloat64(4, true);
      if (
        !Number.isFinite(age) ||
        age < 0 ||
        age > MAX_FRAME_AGE_MS ||
        performance.now() - sent > MAX_FRAME_AGE_MS
      ) {
        this.recover();
        return;
      }
      // WebSocket echoes are ordered. A later echo also retires earlier
      // frames deliberately dropped during relay startup or congestion.
      for (const pendingSeq of this.pending.keys()) {
        this.pending.delete(pendingSeq);
        if (pendingSeq === seq) break;
      }
      // Background windows may delay interval callbacks while WebSocket audio
      // keeps arriving. Fresh echoes prove the page is awake; the watchdog's
      // scheduling gap alone must not tear down a healthy performance.
      this.lastTick = performance.now();
      this.lastWallTick = Date.now();
      // Reset backoff only after a sustained healthy connection.
      if (performance.now() - this.openedAt > 10000) this.attempt = 0;
      this.setState("connected");
      this.onFrame(data);
    };
    socket.onclose = socket.onerror = () => {
      if (this.socket === socket) this.recover();
    };
  }

  private check() {
    const now = performance.now();
    const gap = Math.max(now - this.lastTick, Date.now() - this.lastWallTick);
    this.lastTick = now;
    this.lastWallTick = Date.now();
    const socket = this.socket;
    if (!socket) return;
    const oldest = this.pending.values().next().value;
    if (
      gap > MAX_FRAME_AGE_MS ||
      (socket.readyState === WebSocket.CONNECTING &&
        now - this.connectingAt > CONNECT_TIMEOUT_MS) ||
      (oldest !== undefined && now - oldest > MAX_FRAME_AGE_MS)
    )
      this.recover();
  }

  private recover() {
    this.detach();
    if (!this.active || this.timer !== null) return;
    this.setState("recovering");
    this.route += 1;
    const delay = Math.min(
      MAX_RETRY_MS,
      500 * 2 ** Math.min(this.attempt++, 5),
    );
    this.timer = setTimeout(() => this.open(), delay);
  }

  private setState(state: TapConnectionState) {
    if (this.state === state) return;
    this.state = state;
    this.onState(state);
  }

  private detach() {
    const socket = this.socket;
    this.socket = null;
    this.pending.clear();
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = null;
      socket.onerror = () => {};
      socket.close();
    }
  }
}
