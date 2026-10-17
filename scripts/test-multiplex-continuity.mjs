import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import ts from "typescript";
import {
  WebSocket,
  WebSocketServer,
} from "../ops/relay-server/node_modules/ws/wrapper.mjs";
let connections = 0;
class BrowserSocket extends WebSocket {
  constructor(url) {
    super(url);
    connections++;
  }
}
globalThis.WebSocket = BrowserSocket;
globalThis.CloseEvent ??= class extends Event {};
const compiled = ts.transpileModule(
  fs.readFileSync(
    new URL("../src/lib/audio/multiplex-socket.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const { createTapSocket } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const ips = ["127.0.0.1", "127.1", "2130706433", "0x7f000001"];
const servers = [];
let tapPort;
for (const ip of ["127.0.0.1"]) {
  const server = new WebSocketServer({ host: ip, port: tapPort ?? 0 });
  await once(server, "listening");
  tapPort = server.address().port;
  server.on("connection", (ws) => ws.on("message", (data) => ws.send(data)));
  servers.push(server);
}
const relay = spawn(process.execPath, ["ops/relay-server/node-server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: "0",
    TAP_IPS: ips.join(","),
    TAP_WS_PORT: String(tapPort),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
const port = await new Promise((resolve, reject) => {
  relay.stdout.on("data", (b) => {
    logs += b;
    const m = logs.match(/listening on .*:(\d+)/);
    if (m) resolve(Number(m[1]));
  });
  relay.on("exit", (c) => reject(Error("relay exited " + c)));
});
const children = [];
const deadline = setTimeout(() => {
  console.error("continuity test timed out");
  process.exit(1);
}, 10000);
function frame(seq, channel, distinct = false) {
  const b = new ArrayBuffer(1932),
    v = new DataView(b);
  v.setUint32(0, seq + channel * 1000, true);
  v.setFloat64(4, performance.now(), true);
  for (let j = 0; j < 960; j++)
    v.setInt16(
      12 + j * 2,
      Math.round(12000 * Math.sin((seq * 960 + j) * 0.07)) +
        (distinct ? channel : 0),
      true,
    );
  return b;
}
try {
  await Promise.all(
    ips.map(
      (ip) =>
        new Promise((resolve) => {
          const child = createTapSocket(
            `ws://127.0.0.1:${port}/stream?ip=${ip}`,
          );
          children.push(child);
          child.onopen = resolve;
        }),
    ),
  );
  assert.equal(connections, 1);
  console.log("PASS four city taps share one browser upload socket");
  const expected = ips.map(() => []),
    received = ips.map(() => []);
  let finish;
  const complete = new Promise((resolve) => {
    finish = resolve;
  });
  children.forEach((child, i) => {
    child.onmessage = (e) => {
      received[i].push(Buffer.from(e.data));
      if (received.every((a) => a.length === 50)) finish();
    };
  });
  for (let seq = 0; seq < 50; seq++) {
    children.forEach((child, i) => {
      const b = frame(seq, i, seq >= 25);
      expected[i].push(Buffer.from(b));
      child.send(b);
    });
    await new Promise((resolve) => setImmediate(resolve));
  }
  await complete;
  for (let i = 0; i < 4; i++) assert.deepEqual(received[i], expected[i]);
  console.log(
    "PASS shared input and independent feedback preserve every PCM sample and tap header",
  );
  const health = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json();
  assert.equal(health.multiplex.groupsReceived, 25 + 25 * 4);
  assert.equal(health.multiplex.tapFramesForwarded, 200);
  console.log(
    "PASS identical input is uploaded once; differing tap audio stays independent",
  );
  const firstClosed = new Promise((resolve) =>
    children.forEach((child, index) => {
      child.onclose = () => resolve(index);
    }),
  );
  servers[0].clients.values().next().value.terminate();
  const closedIndex = await firstClosed;
  for (let i = 0; i < 4; i++)
    if (i !== closedIndex) assert.equal(children[i].readyState, 1);
  const alive = (closedIndex + 1) % 4;
  const expectedFresh = frame(51, alive),
    fresh = new Promise((resolve) => {
      children[alive].onmessage = (e) => resolve(e.data);
    });
  children[alive].send(expectedFresh);
  assert.deepEqual(Buffer.from(await fresh), Buffer.from(expectedFresh));
  console.log(
    "PASS a failed city leaves the other continuous streams connected",
  );
} finally {
  clearTimeout(deadline);
  for (const child of children) child.close();
  relay.kill("SIGTERM");
  for (const server of servers) {
    for (const ws of server.clients) ws.terminate();
    server.close();
  }
}
