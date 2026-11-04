import { MAX_DELAY_MS, type Destination, type Measurement } from "./destinations";

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
) {
    const samples: number[] = [];
    let warmed = false;
    let last: number | null = null;
    publish({ ms: null, unavailable: false });
    while (!signal.aborted) {
        if (typeof document !== "undefined" && document.hidden) {
            await wait(15000, signal);
            continue;
        }
        try {
            const started = performance.now();
            // /ping must have no query string. no-store bypasses the browser cache.
            // Opaque replies are expected: these endpoints do not expose CORS headers.
            await fetch(`https://ec2.${destination.region}.amazonaws.com/ping`, {
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
            if (!warmed) {
                // Discard DNS/TLS connection setup before using the first delay.
                warmed = true;
            } else {
                samples.push(ms);
                if (samples.length > 3) samples.shift();
                const sorted = [...samples].sort((a, b) => a - b);
                const middle = Math.floor(sorted.length / 2);
                last = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
                publish({ ms: last, unavailable: false });
            }
            await wait(samples.length < 3 ? 200 : 15000, signal);
        } catch {
            if (signal.aborted) return;
            // A transient outage keeps the last measured delay playing.
            publish({ ms: last, unavailable: true });
            warmed = false;
            samples.length = 0;
            await wait(15000, signal);
        }
    }
}
