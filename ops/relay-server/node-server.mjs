import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8082);
const HOST = process.env.HOST || "127.0.0.1";
const TAP_IPS = new Set(
  (process.env.TAP_IPS || "165.245.165.45,24.199.111.237,64.226.68.99,64.227.150.22")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),
);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, taps: [...TAP_IPS] }));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 16 * 1024 * 1024,
  perMessageDeflate: false,
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const ip = url.searchParams.get("ip") || "";

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
  const upstream = new WebSocket(`ws://${ip}:8081/`);
  const queue = [];

  upstream.binaryType = "arraybuffer";

  upstream.on("open", () => {
    while (queue.length > 0 && upstream.readyState === WebSocket.OPEN) {
      upstream.send(queue.shift());
    }
  });

  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
  });

  upstream.on("close", () => client.close());
  upstream.on("error", () => client.close());

  client.on("message", (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
      return;
    }

    if (isBinary) {
      queue.push(data);
      if (queue.length > 64) queue.shift();
    }
  });

  client.on("close", () => upstream.close());
  client.on("error", () => upstream.close());
});

server.listen(PORT, HOST, () => {
  console.log(`[sharkbite-relay] listening on ${HOST}:${PORT}`);
});
