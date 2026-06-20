const PORT = Number(process.env.PORT || 8082);
const TAP_IPS = new Set(
  (process.env.TAP_IPS || "165.245.165.45,24.199.111.237,64.226.68.99,64.227.150.22")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),
);

type RelayData = {
  ip: string;
  upstream: WebSocket | null;
  queue: ArrayBuffer[];
};

const server = Bun.serve<RelayData>({
  port: PORT,

  fetch(req, srv) {
    const url = new URL(req.url);

    if (url.pathname === "/healthz") {
      return Response.json({ ok: true, taps: [...TAP_IPS] });
    }

    if (url.pathname !== "/relay") {
      return new Response("not found", { status: 404 });
    }

    const ip = url.searchParams.get("ip") || "";
    if (!TAP_IPS.has(ip)) {
      return new Response("unknown tap ip", { status: 400 });
    }

    const ok = srv.upgrade(req, {
      data: { ip, upstream: null, queue: [] },
    });

    return ok ? undefined : new Response("upgrade failed", { status: 426 });
  },

  websocket: {
    maxPayloadLength: 16 * 1024 * 1024,
    perMessageDeflate: false,

    open(ws) {
      const upstream = new WebSocket(`ws://${ws.data.ip}:8081/`);
      upstream.binaryType = "arraybuffer";
      ws.data.upstream = upstream;

      upstream.addEventListener("open", () => {
        for (const frame of ws.data.queue) upstream.send(frame);
        ws.data.queue = [];
      });

      upstream.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          ws.send(event.data);
        } else {
          ws.send(new Uint8Array(event.data as ArrayBuffer));
        }
      });

      upstream.addEventListener("close", () => {
        try {
          ws.close();
        } catch {}
      });

      upstream.addEventListener("error", () => {
        try {
          ws.close();
        } catch {}
      });
    },

    message(ws, message) {
      const upstream = ws.data.upstream;
      const payload =
        typeof message === "string"
          ? message
          : message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength);

      if (upstream?.readyState === WebSocket.OPEN) {
        upstream.send(payload);
        return;
      }

      if (typeof payload !== "string") {
        ws.data.queue.push(payload as ArrayBuffer);
        if (ws.data.queue.length > 64) ws.data.queue.shift();
      }
    },

    close(ws) {
      try {
        ws.data.upstream?.close();
      } catch {}
    },
  },
});

console.log(`[sharkbite-relay] listening on :${server.port}`);
