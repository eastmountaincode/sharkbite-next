const TAPS = new Set([
  "165.245.165.45",
  "24.199.111.237",
  "64.226.68.99",
  "64.227.150.22",
]);

const relay = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz")
      return Response.json({ ok: true, version: 4 });
    const ip = url.searchParams.get("ip") ?? "";
    if (url.pathname !== "/stream" && (url.pathname !== "/relay" || !TAPS.has(ip)))
      return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    // Splice the WebSockets in the runtime without a JavaScript audio queue.
    // This provides an independent client-to-NYC network route.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(
        `https://relay.sharkbite.andrew-boylan.com${url.pathname}${url.pathname === "/relay" ? "?ip=" + ip : ""}`,
        {
          headers: { Upgrade: "websocket" },
          signal: controller.signal,
        },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "relay_connect_failed",
          tap: ip,
          error: String(error),
        }),
      );
      return new Response("Tap unavailable", { status: 502 });
    } finally {
      // Only time out the handshake, never an already established audio link.
      clearTimeout(timeout);
    }
  },
};

export default relay;
