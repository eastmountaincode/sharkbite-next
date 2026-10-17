import http from "node:http";
import { createMultiplexRelay } from "./multiplex-relay.mjs";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8082);
const HOST = process.env.HOST || "127.0.0.1";
const TAP_WS_PORT = Number(process.env.TAP_WS_PORT || 8081);
const MAX_FRAME_AGE_MS = 10000;
const MAX_SEND_BUFFER_BYTES = 4 * 1024 * 1024;
const MAX_PENDING_FRAMES = 4096;
const CONNECT_TIMEOUT_MS = 8000;
const TAP_IPS = new Set(
  (
    process.env.TAP_IPS ||
    "165.245.165.45,24.199.111.237,64.226.68.99,64.227.150.22"
  )
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),
);

const server = http.createServer((req, res) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        version: 4,
        multiplex: upgradeStream.stats,
        maxFrameAgeMs: MAX_FRAME_AGE_MS,
        taps: [...TAP_IPS],
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

const upgradeStream = createMultiplexRelay(
  [...TAP_IPS],
  TAP_WS_PORT,
  MAX_FRAME_AGE_MS,
);

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024,
  // Lossless compression reduces PCM bandwidth without omitting audio frames.
  perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 1 } },
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );
  const ip = url.searchParams.get("ip") || "";

  if (url.pathname === "/stream") {
    upgradeStream(req, socket, head);
    return;
  }
  if (url.pathname !== "/relay" || !TAP_IPS.has(ip)) {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit("connection", client, req, ip);
  });
});

wss.on("connection", (client, _req, ip) => {
  const upstream = new WebSocket(`ws://${ip}:${TAP_WS_PORT}/`, {
    handshakeTimeout: CONNECT_TIMEOUT_MS,
  });
  const pending = new Map();
  let stopped = false;
  const startupFrames = [];
  const stop = (reason) => {
    if (stopped) return;
    stopped = true;
    clearInterval(watchdog);
    pending.clear();
    startupFrames.length = 0;
    console.log(JSON.stringify({ event: "tap_closed", tap: ip, reason }));
    // terminate discards unsent audio; a graceful close would drain the backlog.
    client.terminate();
    upstream.terminate();
  };
  const watchdog = setInterval(() => {
    const oldest = pending.values().next().value;
    if (oldest !== undefined && Date.now() - oldest > MAX_FRAME_AGE_MS)
      stop("stale_audio");
  }, 250);

  const forward = (target, data) => {
    if (target.readyState !== WebSocket.OPEN) return false;
    if (target.bufferedAmount + data.byteLength > MAX_SEND_BUFFER_BYTES) {
      stop("unusable_send_backlog");
      return false;
    }
    target.send(data, { binary: true }, (error) => {
      if (error) stop("send_error");
    });
    return true;
  };

  upstream.on("open", () => {
    for (const frame of startupFrames) {
      if (stopped) break;
      if (Date.now() - frame.receivedAt > MAX_FRAME_AGE_MS) {
        stop("startup_timeout");
        break;
      }
      pending.set(frame.data.readUInt32LE(0), frame.receivedAt);
      forward(upstream, frame.data);
    }
    startupFrames.length = 0;
  });

  upstream.on("message", (data, isBinary) => {
    if (stopped || !isBinary || data.byteLength < 12) return;
    const seq = data.readUInt32LE(0);
    const sent = pending.get(seq);
    if (sent === undefined) return;
    if (Date.now() - sent > MAX_FRAME_AGE_MS) {
      stop("stale_audio");
      return;
    }
    pending.delete(seq);
    forward(client, data);
  });

  client.on("message", (data, isBinary) => {
    if (
      stopped ||
      !isBinary ||
      data.byteLength < 12 ||
      (data.byteLength - 12) % 2
    ) {
      stop("invalid_frame");
      return;
    }
    // Keep startup audio in order while the city handshake completes.
    if (upstream.readyState !== WebSocket.OPEN) {
      if (startupFrames.length >= MAX_PENDING_FRAMES) stop("startup_backlog");
      else startupFrames.push({ data, receivedAt: Date.now() });
      return;
    }
    if (pending.size >= MAX_PENDING_FRAMES) {
      stop("inflight_window_full");
      return;
    }
    const seq = data.readUInt32LE(0);
    pending.set(seq, Date.now());
    if (!forward(upstream, data)) pending.delete(seq);
  });
  client.on("close", () => stop("client_closed"));
  client.on("error", () => stop("client_error"));
  upstream.on("close", () => stop("upstream_closed"));
  upstream.on("error", () => stop("upstream_error"));
});

server.listen(PORT, HOST, () => {
  console.log(
    `[sharkbite-relay] listening on ${HOST}:${server.address().port}`,
  );
});
