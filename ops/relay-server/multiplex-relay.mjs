import { WebSocket, WebSocketServer } from "ws";

export function createMultiplexRelay(ips, port, maxAgeMs) {
  const stats = { groupsReceived: 0, tapFramesForwarded: 0 };
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 1 } },
  });
  wss.on("connection", (client) => {
    const taps = new Map();
    let stopped = false;
    const send = (data, binary) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (client.bufferedAmount > 4 * 1024 * 1024) {
        stop();
        return;
      }
      client.send(data, { binary }, (error) => {
        if (error) stop();
      });
    };
    const remove = (channel, notify = true) => {
      const tap = taps.get(channel);
      if (!tap) return;
      taps.delete(channel);
      tap.socket.terminate();
      if (notify && !stopped)
        send(JSON.stringify({ type: "error", ip: ips[channel] }), false);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(watchdog);
      for (const channel of taps.keys()) remove(channel, false);
      client.terminate();
    };
    const watchdog = setInterval(() => {
      for (const [channel, tap] of taps) {
        const oldest = tap.pending.values().next().value;
        if (oldest !== undefined && Date.now() - oldest > maxAgeMs)
          remove(channel);
      }
    }, 250);
    client.on("message", (data, binary) => {
      if (stopped) return;
      if (!binary) {
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch {
          stop();
          return;
        }
        if (!message || typeof message.ip !== "string") {
          stop();
          return;
        }
        const channel = ips.indexOf(message.ip);
        if (channel < 0) {
          stop();
          return;
        }
        if (message.type === "unsubscribe") {
          remove(channel, false);
          return;
        }
        if (message.type !== "subscribe" || taps.has(channel)) return;
        const socket = new WebSocket(`ws://${ips[channel]}:${port}/`, {
          handshakeTimeout: 8000,
        });
        const tap = { socket, pending: new Map() };
        taps.set(channel, tap);
        socket.on("open", () => {
          if (taps.get(channel) === tap)
            send(
              JSON.stringify({ type: "ready", ip: ips[channel], channel }),
              false,
            );
        });
        socket.on("message", (frame, isBinary) => {
          if (!isBinary || frame.byteLength < 12 || taps.get(channel) !== tap)
            return;
          const seq = frame.readUInt32LE(0),
            sent = tap.pending.get(seq);
          if (sent === undefined) return;
          if (Date.now() - sent > maxAgeMs) {
            remove(channel);
            return;
          }
          tap.pending.delete(seq);
          send(Buffer.concat([Buffer.from([channel]), frame]), true);
        });
        socket.on("close", () => {
          if (taps.get(channel) === tap) remove(channel);
        });
        socket.on("error", () => {
          if (taps.get(channel) === tap) remove(channel);
        });
        return;
      }
      if (data.byteLength < 3) {
        stop();
        return;
      }
      const count = data[0],
        length = data.readUInt16LE(1),
        payloadAt = 3 + count * 13;
      if (
        count < 1 ||
        count > 4 ||
        length < 2 ||
        length % 2 ||
        data.byteLength !== payloadAt + length
      ) {
        stop();
        return;
      }
      stats.groupsReceived++;
      for (let i = 0; i < count; i++) {
        const at = 3 + i * 13,
          channel = data[at],
          tap = taps.get(channel);
        if (!tap || tap.socket.readyState !== WebSocket.OPEN) continue;
        if (
          tap.pending.size >= 4096 ||
          tap.socket.bufferedAmount > 4 * 1024 * 1024
        ) {
          remove(channel);
          continue;
        }
        const frame = Buffer.concat([
          data.subarray(at + 1, at + 13),
          data.subarray(payloadAt),
        ]);
        tap.pending.set(frame.readUInt32LE(0), Date.now());
        tap.socket.send(frame, { binary: true }, (error) => {
          if (error) remove(channel);
        });
        stats.tapFramesForwarded++;
      }
    });
    client.on("close", stop);
    client.on("error", stop);
  });
  const upgrade = (req, socket, head) =>
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  upgrade.stats = stats;
  return upgrade;
}
