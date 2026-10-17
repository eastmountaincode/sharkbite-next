import type { TapSocket } from "./realtime-tap-connection";

// One input frame can feed several cities. Headers remain per tap, so sequence
// numbers, timing and feedback stay independent. No sample data is discarded.
const hubs = new Map<string, TapHub>();
const OPEN = 1,
  CONNECTING = 0,
  CLOSED = 3;

class TapHub {
  socket: WebSocket;
  clients = new Map<string, SharedTapSocket>();
  queued: Array<{ child: SharedTapSocket; data: ArrayBuffer }> = [];
  scheduled = false;
  constructor(readonly key: string) {
    this.socket = new WebSocket(key);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = () => {
      for (const ip of this.clients.keys()) this.command("subscribe", ip);
    };
    this.socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data);
          const child = this.clients.get(message.ip);
          if (message.type === "ready" && child) child.open(message.channel);
          else if (message.type === "error" && child) child.fail();
        } catch {
          this.fail();
        }
      } else if (
        event.data instanceof ArrayBuffer &&
        event.data.byteLength >= 13
      ) {
        const channel = new Uint8Array(event.data)[0];
        for (const child of this.clients.values()) {
          if (child.channel === channel && child.readyState === OPEN) {
            child.onmessage?.(
              new MessageEvent("message", { data: event.data.slice(1) }),
            );
            break;
          }
        }
      }
    };
    this.socket.onclose = this.socket.onerror = () => this.fail();
  }
  command(type: string, ip: string) {
    if (this.socket.readyState === OPEN)
      this.socket.send(JSON.stringify({ type, ip }));
  }
  add(child: SharedTapSocket) {
    this.clients.set(child.ip, child);
    if (this.socket.readyState === OPEN) this.command("subscribe", child.ip);
  }
  remove(child: SharedTapSocket) {
    if (this.clients.get(child.ip) !== child) return;
    this.clients.delete(child.ip);
    this.command("unsubscribe", child.ip);
    if (!this.clients.size) {
      hubs.delete(this.key);
      this.socket.onopen = this.socket.onmessage = this.socket.onclose = null;
      this.socket.onerror = () => {};
      this.socket.close();
    }
  }
  fail() {
    hubs.delete(this.key);
    const children = [...this.clients.values()];
    for (const child of children) child.fail();
    this.queued = [];
  }
  send(child: SharedTapSocket, data: ArrayBuffer) {
    if (this.socket.readyState !== OPEN) throw new Error("Tap stream closed");
    this.queued.push({ child, data });
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
  }
  flush() {
    this.scheduled = false;
    const queued = this.queued;
    this.queued = [];
    if (!queued.length) return;
    if (this.socket.readyState !== OPEN) {
      this.fail();
      return;
    }
    const groups: Array<{ payload: Uint8Array; frames: typeof queued }> = [];
    for (const item of queued) {
      if (item.child.readyState !== OPEN) continue;
      const payload = new Uint8Array(item.data, 12);
      const group = groups.find(
        (g) =>
          g.frames.length < 4 &&
          g.payload.length === payload.length &&
          g.payload.every((v, i) => v === payload[i]),
      );
      if (group) group.frames.push(item);
      else groups.push({ payload, frames: [item] });
    }
    for (const group of groups) {
      // count:u8, payload-length:u16, [channel:u8, original-header:12][], PCM
      const packet = new Uint8Array(
        3 + group.frames.length * 13 + group.payload.length,
      );
      packet[0] = group.frames.length;
      new DataView(packet.buffer).setUint16(1, group.payload.length, true);
      let offset = 3;
      for (const item of group.frames) {
        packet[offset] = item.child.channel;
        packet.set(new Uint8Array(item.data, 0, 12), offset + 1);
        offset += 13;
      }
      packet.set(group.payload, offset);
      try {
        this.socket.send(packet);
      } catch {
        this.fail();
        return;
      }
    }
  }
}

class SharedTapSocket implements TapSocket {
  readyState = CONNECTING;
  binaryType: BinaryType = "arraybuffer";
  onopen: TapSocket["onopen"] = null;
  onmessage: TapSocket["onmessage"] = null;
  onclose: TapSocket["onclose"] = null;
  onerror: TapSocket["onerror"] = null;
  channel = -1;
  constructor(
    readonly hub: TapHub,
    readonly ip: string,
  ) {
    hub.add(this);
  }
  get bufferedAmount() {
    return (
      this.hub.socket.bufferedAmount +
      this.hub.queued.reduce((n, item) => n + item.data.byteLength, 0)
    );
  }
  open(channel: number) {
    if (this.readyState !== CONNECTING) return;
    this.channel = channel;
    this.readyState = OPEN;
    this.onopen?.call(this, new Event("open"));
  }
  send(data: ArrayBuffer) {
    if (this.readyState !== OPEN) throw new Error("Tap stream is not open");
    this.hub.send(this, data);
  }
  fail() {
    if (this.readyState === CLOSED) return;
    this.readyState = CLOSED;
    this.hub.remove(this);
    this.onclose?.call(this, new CloseEvent("close"));
  }
  close() {
    this.readyState = CLOSED;
    this.hub.remove(this);
  }
}

export function createTapSocket(url: string): TapSocket {
  const parsed = new URL(url);
  if (parsed.pathname !== "/stream") return new WebSocket(url);
  const ip = parsed.searchParams.get("ip") ?? "";
  parsed.search = "";
  const key = parsed.toString();
  let hub = hubs.get(key);
  if (hub?.clients.has(ip)) {
    parsed.pathname = "/relay";
    parsed.searchParams.set("ip", ip);
    return new WebSocket(parsed);
  }
  if (!hub) {
    hub = new TapHub(key);
    hubs.set(key, hub);
  }
  return new SharedTapSocket(hub, ip);
}
