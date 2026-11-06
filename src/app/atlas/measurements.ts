import { MAX_DELAY_MS, type Destination, type Measurement } from "./destinations";

const POLL_INTERVAL_MS = 250;
const INITIAL_RETRY_MS = 15000;
const MAX_RETRY_MS = 60000;

function wait(ms: number, signal: AbortSignal) {
    return new Promise<void>(resolve => {
        if (signal.aborted) return resolve();
        const finish = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", finish);
            resolve();
        };
        const timer = setTimeout(finish, ms);
        signal.addEventListener("abort", finish, { once: true });
    });
}

export async function measureDestination(
    destination: Destination,
    signal: AbortSignal,
    publish: (measurement: Measurement) => void,
    options: { once?: boolean; initial?: Measurement } = {},
) {
    const samples: number[] = [];
    let warmed = false;
    let failures = 0;
    let last: number | null = options.initial?.ms ?? null;
    // A saved reading stays a snapshot until this session returns a fresh sample.
    publish({ ...(options.initial ?? { ms: null, unavailable: false }), live: false });
    while (!signal.aborted) {
        if (typeof document !== "undefined" && document.hidden) {
            await wait(15000, signal);
            continue;
        }
        try {
            const started = performance.now();
            // AWS /ping must have no query string. no-store bypasses the browser cache.
            // Opaque replies are expected: these endpoints do not expose CORS headers.
            const endpoint = "endpoint" in destination ? destination.endpoint : `https://ec2.${destination.region}.amazonaws.com/ping`;
            await fetch(endpoint, {
                mode: "no-cors",
                credentials: "omit",
                cache: "no-store",
                redirect: "follow",
                signal: AbortSignal.any([signal, AbortSignal.timeout(MAX_DELAY_MS)]),
            });
            const ms = performance.now() - started;
            if (signal.aborted) return;
            if (typeof document !== "undefined" && document.hidden) continue;
            if (ms <= 0 || ms >= MAX_DELAY_MS) throw new Error("Measurement timed out");
            failures = 0;
            if (!warmed) {
                // Discard DNS/TLS connection setup before using the first delay.
                warmed = true;
            } else {
                samples.push(ms);
                if (samples.length > 3) samples.shift();
                const sorted = [...samples].sort((a, b) => a - b);
                const middle = Math.floor(sorted.length / 2);
                last = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
                publish({ ms: last, unavailable: false, live: !options.once });
                if (options.once && samples.length === 3) return;
            }
            // Aim for four requests per second, including the round trip.
            // Awaiting each reply keeps at most one request in flight per city.
            await wait(samples.length < 3 ? 200 : Math.max(0, POLL_INTERVAL_MS - (performance.now() - started)), signal);
        } catch {
            if (signal.aborted) return;
            // A transient outage keeps the last measured delay playing.
            publish({ ms: last, unavailable: true, live: false });
            if (options.once) return;
            warmed = false;
            samples.length = 0;
            await wait(Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** Math.min(failures++, 2)), signal);
        }
    }
}
