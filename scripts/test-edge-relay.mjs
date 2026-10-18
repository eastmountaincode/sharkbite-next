import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../ops/edge-relay/src/index.js', import.meta.url), 'utf8').replace('export default relay;', 'globalThis.relay = relay;');
const timers = new Map(), calls = []; let id = 0;
const upstream = { status: 101 };
const context = { URL, Response, AbortController, console, setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: i => timers.delete(i), fetch: async (url, opts) => { calls.push({ url, ...opts }); return upstream; } };
vm.runInNewContext(source, context);
for (const path of ['/stream', '/relay?ip=165.245.165.45']) {
 const result = await context.relay.fetch(new Request('https://relay.test'+path, { headers: { Upgrade: 'websocket' } }));
 assert.equal(result, upstream);
 assert.equal(calls.at(-1).url, 'https://relay.sharkbite.andrew-boylan.com'+path);
 assert.equal(timers.size, 0, 'successful handshake has no pending abort timer');
 assert.equal(calls.at(-1).signal.aborted, false);
}
assert.equal((await context.relay.fetch(new Request('https://relay.test/relay?ip=127.0.0.1'))).status, 404);
assert.equal((await context.relay.fetch(new Request('https://relay.test/stream'))).status, 426);
console.log('PASS edge relay preserves shared upload and legacy routes, validates requests, and clears handshake deadlines');
