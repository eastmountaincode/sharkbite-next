import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import webAudioEngine from "web-audio-engine";

const encode = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = file => ts.transpileModule(fs.readFileSync(new URL(`../src/app/atlas/${file}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const config = encode(compile("destinations"));
const { destinations } = await import(config);
const { createAtlasReturns } = await import(encode(compile("routes").replace('"./destinations"', JSON.stringify(config))));
const rate = 48000;

async function render(selected, feedback, measurements, duration = 1) {
    const ctx = new webAudioEngine.OfflineAudioContext(1, rate * duration, rate);
    const source = ctx.createGain();
    const wet = ctx.createGain();
    wet.connect(ctx.destination);
    createAtlasReturns(ctx, source, wet)(new Set(selected), feedback, measurements);
    const pulse = ctx.createBufferSource();
    pulse.buffer = ctx.createBuffer(1, 480, rate);
    pulse.buffer.getChannelData(0).fill(0.1);
    pulse.connect(source);
    pulse.start(0.1);
    return (await ctx.startRendering()).getChannelData(0);
}
const peak = data => data.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
const windowPeak = (data, at) => peak(data.slice(Math.round(at * rate), Math.round((at + 0.02) * rate)));

for (const city of destinations) {
    const audio = await render([city.code], 0, { [city.code]: { ms: 150, unavailable: false } });
    assert(peak(audio.slice(0, 0.248 * rate)) < 1e-6, `${city.code} echoed too early`);
    assert(windowPeak(audio, 0.25) > 0.09, `${city.code} missing measured echo`);
    assert(peak(audio.slice(0.28 * rate)) < 1e-6, `${city.code} repeats at zero feedback`);
}
console.log(`PASS: all ${destinations.length} destinations echo at the measured time`);

const none = await render(["TYO"], 150, {});
assert.equal(peak(none), 0, "Unmeasured destinations must not use invented timings");
const disabled = await render([], 150, { TYO: { ms: 150, unavailable: false } });
assert.equal(peak(disabled), 0, "Deselected destinations must be silent");
const growing = await render(["TYO"], 150, { TYO: { ms: 150, unavailable: false } }, 4);
assert(windowPeak(growing, 0.4) > windowPeak(growing, 0.25) * 1.3, "Feedback above 100% must grow");
assert(growing.every(Number.isFinite) && peak(growing) <= 1, "Feedback must stay bounded");
const decaying = await render(["TYO"], 50, { TYO: { ms: 150, unavailable: false } });
assert(windowPeak(decaying, 0.4) < windowPeak(decaying, 0.25) * 0.6, "Feedback below 100% must decay");
console.log("PASS: silence without measurements, deselection, decay, and bounded feedback at 150%");

const { measureDestination } = await import(encode(compile("measurements").replace('"./destinations"', JSON.stringify(config))));
const originalFetch = globalThis.fetch;
const originalPerformance = globalThis.performance;
const originalTimeout = globalThis.setTimeout;
let clock = 0;
let request = 0;
const controller = new AbortController();
const published = [];
try {
    Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
    globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, Math.min(ms, 1), ...args);
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://ec2.ap-northeast-1.amazonaws.com/ping");
        assert.equal(options.cache, "no-store");
        assert.equal(options.mode, "no-cors");
        assert.equal(options.redirect, "follow", "Opaque browser requests require follow redirects");
        const delays = [900, 120, 200, 100];
        if (request === delays.length) throw new TypeError("Network unavailable");
        clock += delays[request++];
        return { type: "opaque", status: 0 };
    };
    await measureDestination(destinations.find(city => city.code === "TYO"), controller.signal, result => {
        published.push(result);
        if (result.unavailable) controller.abort();
    });
    assert.deepEqual(published[0], { ms: null, unavailable: false });
    assert.equal(published[1].ms, 120, "Connection warmup must not become the delay");
    assert.deepEqual(published.at(-1), { ms: 120, unavailable: true }, "Network loss must preserve the last measured delay");
    const requestsAfterAbort = request;
    await measureDestination(destinations[0], controller.signal, () => {});
    assert.equal(request, requestsAfterAbort, "Aborted selections must not make requests");
    console.log("PASS: direct uncached requests, warmup discarded, outage preserves delay, cancellation stops requests");
} finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "performance", { configurable: true, value: originalPerformance });
    globalThis.setTimeout = originalTimeout;
}
