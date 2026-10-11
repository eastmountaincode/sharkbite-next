import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const values = new Map();
const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
};
let devices = [];
const mediaDevices = {
    enumerateDevices: async () => devices,
    addEventListener() {},
    removeEventListener() {},
};

function load(relativePath, dependencies = {}) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const result = { exports: {} };
    new Function("require", "module", "exports", "window", "navigator", code)(
        name => dependencies[name] ?? require(name), result, result.exports,
        { localStorage: storage, setTimeout, clearTimeout }, { mediaDevices },
    );
    return result.exports;
}

const inputPreferences = load("../src/lib/audio/audioInput.ts");
const outputPreferences = load("../src/lib/audio/audioOutput.ts");

async function mountHook(file, name) {
    let cursor = 0;
    const cells = [];
    const pending = [];
    const cleanups = [];
    const react = {
        useState(initial) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
            return [cells[index], value => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
        },
        useRef(value) {
            const index = cursor++;
            if (!(index in cells)) cells[index] = { current: value };
            return cells[index];
        },
        useEffect(effect, dependencies) {
            const index = cursor++;
            const previous = cells[index];
            if (!previous || dependencies.some((value, offset) => !Object.is(value, previous[offset]))) {
                pending.push(() => {
                    cleanups[index]?.();
                    cleanups[index] = effect();
                });
                cells[index] = dependencies;
            }
        },
        useCallback(callback, dependencies) {
            const index = cursor++;
            const previous = cells[index];
            if (!previous || dependencies.some((value, offset) => !Object.is(value, previous.dependencies[offset]))) {
                cells[index] = { callback, dependencies };
            }
            return cells[index].callback;
        },
    };
    const hook = load(file, { react, "@/lib/audio/audioInput": inputPreferences, "@/lib/audio/audioOutput": outputPreferences })[name];
    const getEngine = () => { throw new Error("Mounting preferences must not start audio"); };
    const render = () => {
        cursor = 0;
        const value = hook({ getEngine, statusRunning: false });
        pending.splice(0).forEach(effect => effect());
        return value;
    };
    const initial = render();
    await new Promise(resolve => setTimeout(resolve, 5));
    return { initial, render, dispose: () => cleanups.forEach(cleanup => cleanup?.()) };
}

const inputFile = "../src/components/sharkbite/use-audio-inputs.ts";
const outputFile = "../src/components/sharkbite/use-audio-outputs.ts";
devices = [
    { kind: "audioinput", deviceId: "clarett", label: "Clarett 4Pre" },
    { kind: "audiooutput", deviceId: "blackhole16", label: "BlackHole 16ch" },
];
let input = await mountHook(inputFile, "useAudioInputs");
let output = await mountHook(outputFile, "useAudioOutputs");
assert.equal(input.initial.inputsReady, false);
assert.equal(output.initial.outputsReady, false);
input.render().updateInputDevice("clarett");
output.render().updateOutputDevice("blackhole16");
output.render().updateOutputChannel("pair-5");
input.dispose();
output.dispose();

// Reload before permission/device enumeration reveals anything.
devices = [];
input = await mountHook(inputFile, "useAudioInputs");
output = await mountHook(outputFile, "useAudioOutputs");
assert.equal(input.render().inputDeviceId, "clarett");
assert.equal(input.render().inputLabel, "Clarett 4Pre");
assert.equal(input.render().inputsReady, true);
assert.equal(output.render().outputDeviceId, "blackhole16");
assert.equal(output.render().outputChannel, "pair-5");
await input.render().refreshAudioInputs();
assert.equal(input.render().inputDeviceId, "clarett");
input.render().updateInputDevice("");
input.dispose();
output.dispose();
input = await mountHook(inputFile, "useAudioInputs");
assert.equal(input.render().inputDeviceId, "");
input.dispose();

values.set("sharkbite.audio-input.v1", "invalid JSON");
input = await mountHook(inputFile, "useAudioInputs");
assert.equal(input.render().inputDeviceId, "");
assert.equal(input.render().inputsReady, true);
input.dispose();

console.log("PASS: input/output/pair survive reload, empty enumeration preserves selections, System Default persists, malformed storage recovers, startup waits for hydration.");
