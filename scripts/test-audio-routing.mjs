import { Buffer } from "node:buffer";
import { URL } from "node:url";
import console from "node:console";
import process from "node:process";
// Sample-level regression tests in a software Web Audio renderer.
// Hardware mapping must additionally be verified in a browser and the DAW.
import fs from "node:fs";
import ts from "typescript";
import webAudioEngine from "web-audio-engine";
const { OfflineAudioContext } = webAudioEngine;
// The renderer exposes EventTarget dispatch through its implementation.
OfflineAudioContext.prototype.dispatchEvent = function (event) {
  this._impl.dispatchEvent(event);
};
const sourceRoot = new URL("../src/lib/audio/", import.meta.url);
const codeURL = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (name) =>
  ts.transpileModule(fs.readFileSync(new URL(name, sourceRoot), "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  }).outputText;
const outputURL = codeURL(compile("audioOutput.ts"));
const routerURL = codeURL(
  compile("audioOutputRouter.ts").replace(
    '"./audioOutput"',
    JSON.stringify(outputURL),
  ),
);

const results = { textContent: "" };
let passed = 0,
  failed = 0;
function check(value, message) {
  if (!value) throw Error(message);
}
{
  const app = "audio router";
  const { createAudioOutputRouter } = await import(routerURL);
  const {
    AUDIO_OUTPUT_CHANNELS,
    readAudioOutputChannelPreference,
    writeAudioOutputChannelPreference,
  } = await import(outputURL);
  async function test(name, run) {
    try {
      await run();
      results.textContent += `PASS ${app}: ${name}\n`;
      passed++;
    } catch (e) {
      results.textContent += `FAIL ${app}: ${name}: ${e.stack}\n`;
      failed++;
    }
  }
  for (const option of AUDIO_OUTPUT_CHANNELS.slice(0, 8)) {
    for (const mono of [false, true])
      await test(`${option.label}, ${mono ? "mono duplication" : "stereo separation"}`, async () => {
        const ctx = new OfflineAudioContext(16, 512, 48000),
          router = createAudioOutputRouter(ctx);
        const source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(mono ? 1 : 2, 512, 48000);
        source.buffer.getChannelData(0).fill(0.125);
        if (!mono) source.buffer.getChannelData(1).fill(-0.25);
        source.connect(router.input);
        router.setChannel(option.value);
        source.start();
        const rendered = await ctx.startRendering();
        const left =
          option.value === "stereo" ? 0 : Number(option.value.slice(5)) - 1;
        for (let ch = 0; ch < 16; ch++)
          for (const value of rendered.getChannelData(ch))
            check(
              Math.abs(
                value -
                  (ch === left
                    ? 0.125
                    : ch === left + 1
                      ? mono
                        ? 0.125
                        : -0.25
                      : 0),
              ) < 1e-6,
              `wrong signal on channel ${ch + 1}: ${value}`,
            );
        router.dispose();
      });
  }
  await test("changing pair removes old route", async () => {
    const ctx = new OfflineAudioContext(16, 512, 48000),
      router = createAudioOutputRouter(ctx),
      src = ctx.createConstantSource();
    src.offset.value = 0.125;
    src.connect(router.input);
    router.setChannel("pair-3");
    router.setChannel("pair-15");
    router.setChannel("pair-3");
    src.start();
    const b = await ctx.startRendering();
    for (let ch = 0; ch < 16; ch++)
      check(
        b
          .getChannelData(ch)
          .every(
            (x) => Math.abs(x - (ch === 2 || ch === 3 ? 0.125 : 0)) < 1e-6,
          ),
        `leaked/doubled channel ${ch + 1}`,
      );
  });
  await test("unsupported pair mutes; explicit stereo selection recovers", async () => {
    const ctx = new OfflineAudioContext(2, 512, 48000),
      router = createAudioOutputRouter(ctx),
      src = ctx.createConstantSource();
    src.connect(router.input);
    let rejected = false;
    try {
      router.setChannel("pair-3");
    } catch {
      rejected = true;
    }
    check(rejected, "did not reject");
    src.start();
    const b = await ctx.startRendering();
    check(
      b.getChannelData(0).every((x) => x === 0) &&
        b.getChannelData(1).every((x) => x === 0),
      "wrong-channel fallback",
    );
    const second = new OfflineAudioContext(2, 512, 48000),
      r = createAudioOutputRouter(second),
      s = second.createConstantSource();
    s.connect(r.input);
    try {
      r.setChannel("pair-3");
    } catch {
      /* Expected unsupported pair. */
    }
    r.setChannel("stereo");
    s.start();
    const rendered = await second.startRendering();
    check(
      rendered.getChannelData(0)[0] === 1 &&
        rendered.getChannelData(1)[0] === 1,
      "recovery failed",
    );
  });
  await test("legacy mono side routing", async () => {
    for (const side of ["left", "right"]) {
      const ctx = new OfflineAudioContext(16, 512, 48000),
        r = createAudioOutputRouter(ctx),
        s = ctx.createConstantSource();
      s.offset.value = 0.125;
      s.connect(r.input);
      r.setChannel(side);
      s.start();
      const b = await ctx.startRendering();
      for (let ch = 0; ch < 16; ch++)
        check(
          b
            .getChannelData(ch)
            .every((x) =>
              ch === (side === "left" ? 0 : 1) ? Math.abs(x - 0.125) < 1e-6 : Math.abs(x) < 1e-6,
            ),
          `wrong mono side ${ch}`,
        );
    }
  });
  await test("old and new preferences round-trip; malformed preference fallback", () => {
    const values = new Map(),
      storage = {
        getItem: (k) => values.get(k),
        setItem: (k, v) => values.set(k, v),
      };
    for (const { value } of AUDIO_OUTPUT_CHANNELS) {
      writeAudioOutputChannelPreference(storage, value);
      check(
        readAudioOutputChannelPreference(storage) === value,
        "preference lost",
      );
    }
    check(
      readAudioOutputChannelPreference({ getItem: () => "pair-99" }) ===
        "stereo",
      "invalid preference",
    );
  });
  await test("sink change mutes and requires device reselection", async () => {
    const ctx = new OfflineAudioContext(16, 512, 48000),
      r = createAudioOutputRouter(ctx),
      s = ctx.createConstantSource();
    s.connect(r.input);
    ctx.dispatchEvent({ type: "sinkchange" });
    let rejected = false;
    try {
      r.setChannel("stereo");
    } catch {
      rejected = true;
    }
    check(rejected, "re-enabled fallback sink");
    s.start();
    const b = await ctx.startRendering();
    check(
      b.getChannelData(0).every((x) => x === 0),
      "fallback leaked",
    );
  });
  await test("device switch remains muted until pair is reapplied; late sink event is safe", async () => {
    const ctx = new OfflineAudioContext(16, 512, 48000),
      r = createAudioOutputRouter(ctx),
      s = ctx.createConstantSource();
    ctx.setSinkId = async (id) => {
      ctx.sinkId = id;
      ctx.dispatchEvent({ type: "sinkchange" });
    };
    s.offset.value = 0.125;
    s.connect(r.input);
    r.setChannel("pair-3");
    await r.setDevice("blackhole");
    r.setChannel("pair-3");
    ctx.dispatchEvent({ type: "sinkchange" });
    // web-audio-engine caches destination buffers at construction. Refresh the
    // cache after changing width; native AudioContext sink negotiation is still
    // a separate browser/hardware check.
    ctx.destination._impl._destinationChannelData =
      ctx.destination._impl.inputs[0].bus.getChannelData();
    s.start();
    const b = await ctx.startRendering();
    for (let ch = 0; ch < 16; ch++)
      check(
        b
          .getChannelData(ch)
          .every(
            (x) => Math.abs(x - (ch === 2 || ch === 3 ? 0.125 : 0)) < 1e-6,
          ),
        `wrong switch mapping ch ${ch}: ${b.getChannelData(ch)[0]}, width ${ctx.destination.channelCount}, max ${ctx.destination.maxChannelCount}`,
      );
  });
  await test("failed sink cannot be unmuted by changing pair", async () => {
    const ctx = new OfflineAudioContext(16, 512, 48000),
      r = createAudioOutputRouter(ctx),
      s = ctx.createConstantSource();
    s.connect(r.input);
    ctx.setSinkId = async () => {
      throw Error("Missing device");
    };
    let failed = false;
    try {
      await r.setDevice("missing");
    } catch {
      failed = true;
    }
    check(failed, "missing sink accepted");
    let rejected = false;
    try {
      r.setChannel("stereo");
    } catch {
      rejected = true;
    }
    check(rejected, "old sink unmuted");
    s.start();
    const b = await ctx.startRendering();
    for (let ch = 0; ch < 16; ch++)
      check(
        b.getChannelData(ch).every((x) => x === 0),
        "stale sink leaked",
      );
  });
}
// Exercise the application's serialized device/pair updates, including a sink
// change that resolves after a newer selection has already been requested.
const moduleCache = new Map();
function compileModule(file) {
  const key = file.href;
  if (moduleCache.has(key)) return moduleCache.get(key);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  code = code.replace(/from ["']([^"']+)["']/g, (statement, name) => {
    const next = name.startsWith("@/")
      ? new URL("../src/" + name.slice(2) + ".ts", import.meta.url)
      : new URL(name + ".ts", file);
    return "from " + JSON.stringify(compileModule(next));
  });
  const url = codeURL(code);
  moduleCache.set(key, url);
  return url;
}
const { AudioEngine } = await import(compileModule(new URL("../src/lib/audio/audio-engine.ts", import.meta.url)));
async function engineTest(name, run) {
  try { await run(); passed++; results.textContent += "PASS engine: " + name + "\n"; }
  catch (error) { failed++; results.textContent += "FAIL engine: " + name + ": " + error.stack + "\n"; }
}
function fixture(router) {
  const statuses = [];
  const engine = new AudioEngine({
    taps: [], onStatus: (status) => statuses.push(status), onTapEnabledChange() {}, onTapMetrics() {}, onVu() {},
  });
  engine.outputRouter = router;
  return { engine, statuses };
}
await engineTest("latest selection wins during an in-flight sink switch", async () => {
  let release;
  const pairs = [], devices = [];
  const { engine } = fixture({
    mute() {}, setChannel(pair) { pairs.push(pair); },
    async setDevice(id) { devices.push(id); if (id === "first") await new Promise((resolve) => { release = resolve; }); },
  });
  const first = engine.setOutputRoute("first", "pair-3");
  await Promise.resolve();
  const second = engine.setOutputRoute("second", "pair-5");
  release();
  check(await first === false, "stale selection accepted");
  check(await second === true, "latest selection failed");
  check(JSON.stringify(pairs) === '["pair-5"]', "stale pair was briefly connected");
  check(JSON.stringify(devices) === '["first","second"]', "sink order");
});
await engineTest("missing sink reports mute and next selection recovers", async () => {
  const pairs = [];
  const { engine, statuses } = fixture({
    mute() {}, setChannel(pair) { pairs.push(pair); },
    async setDevice(id) { if (id === "missing") throw new Error("Missing device"); },
  });
  check(await engine.setOutputRoute("missing", "pair-5") === false, "failed sink accepted");
  check(statuses.at(-1).message.startsWith("Output muted:"), "mute error missing");
  check(pairs.length === 0, "failed sink connected");
  check(await engine.setOutputRoute("blackhole", "pair-5") === true, "recovery failed");
  check(statuses.at(-1).message === "Audio output changed.", "stale error after recovery");
});
await engineTest("disconnect cancels an in-flight output change", async () => {
  let release;
  const pairs = [];
  const { engine } = fixture({
    mute() {}, setChannel(pair) { pairs.push(pair); },
    async setDevice() { await new Promise((resolve) => { release = resolve; }); },
  });
  const pending = engine.setOutputRoute("blackhole", "pair-5");
  await Promise.resolve();
  engine.muteOutput();
  release();
  check(await pending === false && pairs.length === 0, "disconnect re-enabled output");
});
await engineTest("late matching sink event cannot undo an explicit mute", async () => {
  const { createAudioOutputRouter } = await import(routerURL);
  const ctx = new OfflineAudioContext(16, 512, 48000);
  ctx.sinkId = "";
  const router = createAudioOutputRouter(ctx), source = ctx.createConstantSource();
  source.connect(router.input);
  router.setChannel("pair-5");
  router.mute();
  ctx.dispatchEvent({ type: "sinkchange" });
  source.start();
  const rendered = await ctx.startRendering();
  for (let ch = 0; ch < 16; ch++) check(rendered.getChannelData(ch).every((v) => v === 0), "mute bypassed");
});

await engineTest("system default clears a previously selected discrete pair", async () => {
  const pairs = [];
  const { engine } = fixture({ mute() {}, async setDevice() {}, setChannel(pair) { pairs.push(pair); } });
  await engine.setOutputRoute("", "pair-5");
  check(JSON.stringify(pairs) === '["stereo"]', "system default retained hidden pair");
});
await engineTest("channel choices follow selected device capacity", async () => {
  const { availableOutputPairs } = await import(compileModule(new URL("../src/lib/audio/audioOutput.ts", import.meta.url)));
  check(availableOutputPairs("", 16).length === 0, "system default exposes channels");
  check(availableOutputPairs("stereo-device", 2).length === 0, "stereo device exposes channels");
  check(availableOutputPairs("unknown", 0).length === 0, "unknown capacity exposes channels");
  check(availableOutputPairs("eight-channel", 8).length === 4, "eight-channel device pair count");
  check(availableOutputPairs("sixteen-channel", 16).length === 8, "sixteen-channel device pair count");
});

for (const inputChannels of [1, 2]) {
  await engineTest(`mono vocal dry path is centered at unity from ${inputChannels}-channel input`, async () => {
    const { createMonoSourceBus } = await import(compileModule(new URL("../src/lib/audio/mono-source-bus.ts", import.meta.url)));
    const { createAudioOutputRouter } = await import(routerURL);
    const ctx = new OfflineAudioContext(16, 512, 48000);
    const bus = createMonoSourceBus(ctx), router = createAudioOutputRouter(ctx);
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(inputChannels, 512, 48000);
    source.buffer.getChannelData(0).fill(0.125);
    source.connect(bus).connect(router.input);
    router.setChannel("pair-5");
    source.start();
    const rendered = await ctx.startRendering();
    for (let channel = 0; channel < 16; channel++) {
      const expected = channel === 4 || channel === 5 ? 0.125 : 0;
      check(rendered.getChannelData(channel).every((value) => Math.abs(value - expected) < 1e-6), `incorrect vocal level on channel ${channel + 1}`);
    }
  });
}

await engineTest("centered dry signal preserves independently panned wet return", async () => {
  const { createMonoSourceBus } = await import(compileModule(new URL("../src/lib/audio/mono-source-bus.ts", import.meta.url)));
  const { createAudioOutputRouter } = await import(routerURL);
  const ctx = new OfflineAudioContext(16, 512, 48000);
  const bus = createMonoSourceBus(ctx), router = createAudioOutputRouter(ctx);
  const source = ctx.createBufferSource(), master = ctx.createGain(), wetPan = ctx.createStereoPanner();
  source.buffer = ctx.createBuffer(2, 512, 48000);
  source.buffer.getChannelData(0).fill(0.125);
  wetPan.pan.value = 1;
  source.connect(bus);
  bus.connect(master);
  bus.connect(wetPan).connect(master);
  master.connect(router.input);
  router.setChannel("pair-5");
  source.start();
  const rendered = await ctx.startRendering();
  for (let channel = 0; channel < 16; channel++) {
    const expected = channel === 4 ? 0.125 : channel === 5 ? 0.25 : 0;
    check(rendered.getChannelData(channel).every((value) => Math.abs(value - expected) < 1e-6), `dry/wet pan mismatch on channel ${channel + 1}`);
  }
});

results.textContent += `\n${passed} passed; ${failed} failed.`;
console.log(results.textContent);
if (failed) process.exitCode = 1;
