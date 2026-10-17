import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = ts.transpileModule(
  fs.readFileSync(
    new URL("../src/lib/audio/realtime-tap-connection.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
let passed = 0;
function test(name, fn) {
  fn();
  console.log("PASS " + name);
  passed++;
}
function rig(urls = "ws://test") {
  let wallOffset = 0;
  let now = 0,
    id = 0;
  const timers = new Map(),
    sockets = [],
    states = [],
    frames = [];
  const set = (fn, ms, repeat) => {
    const key = ++id;
    timers.set(key, { fn, at: now + ms, repeat });
    return key;
  };
  class WS {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    bufferedAmount = 0;
    sent = [];
    constructor(url) {
      this.url = url;
      sockets.push(this);
    }
    open() {
      this.readyState = 1;
      this.onopen?.();
    }
    send(data) {
      this.sent.push(data);
    }
    close() {
      this.readyState = 3;
    }
    echo(data) {
      this.onmessage?.({ data });
    }
  }
  const context = {
    exports: {},
    WebSocket: WS,
    performance: { now: () => now },
    Date: { now: () => now + wallOffset },
    ArrayBuffer,
    DataView,
    Map,
    Number,
    setTimeout: (fn, ms) => set(fn, ms, 0),
    clearTimeout: (i) => timers.delete(i),
    setInterval: (fn, ms) => set(fn, ms, ms),
    clearInterval: (i) => timers.delete(i),
  };
  vm.runInNewContext(source, context);
  const conn = new context.exports.RealtimeTapConnection(
    urls,
    (data) => frames.push(data),
    (s) => states.push(s),
  );
  function advance(ms) {
    const until = now + ms;
    while (true) {
      const entry = [...timers]
        .filter(([, t]) => t.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [key, t] = entry;
      now = t.at;
      if (t.repeat) t.at += t.repeat;
      else timers.delete(key);
      t.fn();
    }
    now = until;
  }
  function packet(seq = 0) {
    const b = new ArrayBuffer(1932),
      v = new DataView(b);
    v.setUint32(0, seq, true);
    v.setFloat64(4, now, true);
    return b;
  }
  return {
    wallSleep: (ms) => {
      wallOffset += ms;
    },
    conn,
    sockets,
    states,
    frames,
    timers,
    advance,
    packet,
    sleep: (ms) => {
      now += ms;
    },
  };
}
test("healthy echo retains real network delay", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  const b = r.packet();
  r.conn.send(b, 48000);
  r.advance(300);
  r.sockets[0].echo(b);
  assert.equal(r.frames.length, 1);
  assert.equal(r.states.at(-1), "connected");
  r.conn.stop();
  assert.equal(r.timers.size, 0);
});
test("send congestion drops new frames without filling the queue; persistent stalls recover", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  assert.equal(r.conn.send(r.packet(), 48000), true);
  r.sockets[0].bufferedAmount = 9600;
  assert.equal(r.conn.send(r.packet(1), 48000), false);
  assert.equal(r.sockets[0].readyState, 1);
  assert.equal(r.sockets[0].sent.length, 1);
  r.advance(1750);
  assert.equal(r.sockets[0].readyState, 3);
  assert.equal(r.states.at(-1), "recovering");
  r.advance(500);
  assert.equal(r.sockets.length, 2);
  r.conn.stop();
});
test("in-flight window bounds hidden TCP queues and follows the route RTT", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  for (let i = 0; i < 1000; i++) r.conn.send(r.packet(i), 48000);
  assert.ok(r.sockets[0].sent.length <= 18);
  const latest = r.sockets[0].sent.at(-1);
  r.advance(40);
  r.sockets[0].echo(latest);
  const before = r.sockets[0].sent.length;
  for (let i = 1000; i < 2000; i++) r.conn.send(r.packet(i), 48000);
  assert.ok(r.sockets[0].sent.length - before <= 8);
  r.conn.stop();
});
test("silent connection expires without waiting for another frame", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  r.conn.send(r.packet(), 48000);
  r.advance(1750);
  assert.equal(r.sockets[0].readyState, 3);
  assert.equal(r.frames.length, 0);
  r.conn.stop();
});
test("later ordered echo retires startup frames dropped by a relay", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  r.conn.send(r.packet(0), 48000);
  r.advance(100);
  const b = r.packet(1);
  r.conn.send(b, 48000);
  r.advance(100);
  r.sockets[0].echo(b);
  r.advance(1500);
  assert.equal(r.sockets[0].readyState, 1);
  assert.equal(r.states.at(-1), "connected");
  r.conn.stop();
});
test("minutes-old audio never reaches playback", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  const b = r.packet();
  r.conn.send(b, 48000);
  r.sleep(400000);
  r.sockets[0].echo(b);
  assert.equal(r.frames.length, 0);
  assert.equal(r.states.at(-1), "recovering");
  r.conn.stop();
});
test("sleep is detected even when the performance clock pauses", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  const b = r.packet();
  r.conn.send(b, 48000);
  r.wallSleep(600000);
  r.sockets[0].echo(b);
  assert.equal(r.frames.length, 0);
  assert.equal(r.states.at(-1), "recovering");
  r.conn.stop();
});
test("late callbacks from an obsolete socket cannot enter the new session", () => {
  const r = rig();
  r.conn.start();
  const old = r.sockets[0];
  old.open();
  const b = r.packet();
  r.conn.send(b, 48000);
  const stale = old.onmessage;
  old.onerror();
  r.advance(500);
  r.sockets[1].open();
  stale({ data: b });
  assert.equal(r.frames.length, 0);
  const fresh = r.packet(1);
  r.conn.send(fresh, 48000);
  r.sockets[1].echo(fresh);
  assert.equal(r.frames.length, 1);
  r.conn.stop();
});
test("handshake timeout retries and disabling cancels all future retries", () => {
  const r = rig();
  r.conn.start();
  r.advance(8250);
  assert.equal(r.sockets[0].readyState, 3);
  r.conn.stop();
  r.advance(60000);
  assert.equal(r.sockets.length, 1);
  assert.equal(r.timers.size, 0);
});
test("successful handshakes alone do not reset exponential backoff", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  r.sockets[0].onerror();
  r.advance(500);
  r.sockets[1].open();
  r.sockets[1].onerror();
  r.advance(500);
  assert.equal(r.sockets.length, 2);
  r.advance(500);
  assert.equal(r.sockets.length, 3);
  r.conn.stop();
});
test("failed taps switch to an independent network route", () => {
  const r = rig(["ws://primary", "ws://fallback"]);
  r.conn.start();
  assert.equal(r.sockets[0].url, "ws://primary");
  r.sockets[0].onerror();
  r.advance(500);
  assert.equal(r.sockets[1].url, "ws://fallback");
  r.sockets[1].open();
  const b = r.packet();
  r.conn.send(b, 48000);
  r.sockets[1].echo(b);
  assert.equal(r.states.at(-1), "connected");
  r.conn.stop();
});
test("malformed and unsolicited returns do not enter playback", () => {
  const r = rig();
  r.conn.start();
  r.sockets[0].open();
  r.sockets[0].echo(new ArrayBuffer(3));
  r.sockets[0].echo(r.packet(99));
  assert.equal(r.frames.length, 0);
  r.conn.stop();
});
function processor(name, rate = 48000) {
  let Class;
  const state = { time: 0 };
  class Base {
    port = { onmessage: null, postMessage: () => {} };
  }
  const context = {
    AudioWorkletProcessor: Base,
    Float32Array,
    Number,
    Math,
    sampleRate: rate,
    get currentTime() {
      return state.time;
    },
    registerProcessor: (_, c) => {
      Class = c;
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      new URL("../public/worklets/" + name + "-processor.js", import.meta.url),
      "utf8",
    ),
    context,
  );
  return { p: new Class(), state };
}
for (const rate of [44100, 48000, 96000, 192000])
  test("playback burst stays bounded at " + rate + " Hz", () => {
    const { p } = processor("player", rate);
    p.port.onmessage({ data: { cmd: "prebuffer", value: rate * 0.05 } });
    for (let i = 0; i < 500; i++)
      p.port.onmessage({
        data: { frame: new Float32Array(rate * 0.02).fill(i) },
      });
    assert.ok(p.size <= rate * 0.15);
    p.port.onmessage({ data: { cmd: "flush" } });
    assert.equal(p.size, 0);
    assert.equal(p.playing, false);
  });
test("worklet discards messages delayed on the audio thread", () => {
  const { p, state } = processor("player");
  state.time = 10;
  p.port.onmessage({ data: { frame: new Float32Array(960), receivedAt: 1 } });
  assert.equal(p.size, 0);
});
test("capture preserves the age of the original audio", () => {
  const { p, state } = processor("capture");
  state.time = 10;
  const sent = [];
  p.port.postMessage = (m) => sent.push(m);
  for (let i = 0; i < 8; i++) {
    state.time = 10 + (i * 128) / 48000;
    p.process([[new Float32Array(128)]]);
  }
  assert.equal(sent.length, 1);
  assert.ok(Math.abs(sent[0].capturedAt - 10) < 1e-9);
  assert.equal(sent[0].frame.length, 960);
});
console.log(`${passed} delay recovery checks passed`);
