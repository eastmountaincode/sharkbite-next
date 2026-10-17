import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  WebSocket,
  WebSocketServer,
} from "../ops/relay-server/node_modules/ws/wrapper.mjs";
let startupDelay = 0;
const tap = new WebSocketServer({
  port: 0,
  host: "127.0.0.1",
  verifyClient: (_info, done) => setTimeout(() => done(true), startupDelay),
});
await once(tap, "listening");
const tapPort = tap.address().port;
let echo = true;
tap.on("connection", (ws) =>
  ws.on("message", (data) => {
    if (echo) ws.send(data);
  }),
);
const relay = spawn(process.execPath, ["ops/relay-server/node-server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: "0",
    TAP_IPS: "127.0.0.1",
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
  relay.on("exit", (code) => reject(Error("relay exited " + code)));
});
const connect = async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/relay?ip=127.0.0.1`);
  await once(ws, "open");
  await new Promise((r) => setTimeout(r, 50));
  return ws;
};
const frame = (seq) => {
  const b = Buffer.alloc(1932);
  b.writeUInt32LE(seq, 0);
  b.writeDoubleLE(performance.now(), 4);
  return b;
};
try {
  let ws = await connect();
  const b = frame(1);
  const response = once(ws, "message");
  ws.send(b);
  const [got] = await response;
  assert.deepEqual(got, b);
  ws.terminate();
  console.log("PASS relay echoes audio unchanged");
  echo = false;
  ws = await connect();
  const closed = once(ws, "close");
  const start = Date.now();
  ws.send(frame(2));
  await Promise.race([
    closed,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(Error("relay did not expire stalled audio")),
        12000,
      ),
    ),
  ]);
  assert.ok(Date.now() - start < 11000);
  console.log(
    "PASS stalled upstream is terminated before stale audio can accumulate",
  );
  echo = true;
  ws = await connect();
  const recovered = once(ws, "message");
  const fresh = frame(3);
  ws.send(fresh);
  assert.deepEqual((await recovered)[0], fresh);
  ws.terminate();
  console.log("PASS independent connection recovers after a stalled session");
  startupDelay = 250;
  ws = await connect();
  const received = [];
  const expected = [];
  const complete = new Promise((resolve) =>
    ws.on("message", (data) => {
      received.push(data);
      if (received.length === 20) resolve();
    }),
  );
  for (let i = 4; i < 24; i++) {
    const b = frame(i);
    expected.push(b);
    ws.send(b);
  }
  await complete;
  assert.deepEqual(received, expected);
  assert.ok(ws.extensions.includes("permessage-deflate"));
  ws.terminate();
  console.log(
    "PASS compressed slow-start stream preserves every audio frame in order",
  );
  startupDelay = 0;
  ws = await connect();
  const invalid = once(ws, "close");
  ws.send(Buffer.alloc(3));
  await invalid;
  console.log("PASS malformed audio is rejected");
} finally {
  relay.kill("SIGTERM");
  for (const c of tap.clients) c.terminate();
  tap.close();
}
