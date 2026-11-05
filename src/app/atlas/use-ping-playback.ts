import { useEffect, useRef, useState } from "react";
import type { Pings } from "./destinations";

export const PING_FADE_MS = 180;
export const pingTravelMs = (ms: number) => Math.max(180, Math.min(2000, ms * 5));

// Present fresh samples at a readable cadence without changing measurement or audio timing.
export function usePingPlayback(pings: Pings, selected: ReadonlySet<string>, enabled: boolean) {
    const [playback, setPlayback] = useState<Pings>({});
    const latest = useRef(pings);
    const played = useRef(new Map<string, { id: number; end: number; next: number }>());
    const cursor = useRef(0);
    const nextLaunch = useRef(0);

    useEffect(() => { latest.current = pings; }, [pings]);

    useEffect(() => {
        for (const code of played.current.keys()) {
            if (!selected.has(code)) played.current.delete(code);
        }
        if (!enabled || selected.size === 0) return;
        const codes = [...selected];
        const timer = window.setInterval(() => {
            if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            const now = performance.now();
            if (now < nextLaunch.current || [...played.current.values()].filter(item => item.end > now).length >= 2) return;
            for (let offset = 0; offset < codes.length; offset++) {
                const index = (cursor.current + offset) % codes.length;
                const code = codes[index];
                const ping = latest.current[code];
                const previous = played.current.get(code);
                if (!ping || ping.id === previous?.id || now < (previous?.next ?? 0) || now - ping.at > 5000) continue;
                // Leave a paint-frame margin before another route takes this slot.
                const end = now + pingTravelMs(ping.ms) + PING_FADE_MS + 50;
                played.current.set(code, { id: ping.id, end, next: end + 500 });
                nextLaunch.current = now + 350;
                cursor.current = index + 1;
                setPlayback(current => ({ ...current, [code]: { ...ping, at: now } }));
                break;
            }
        }, 100);
        return () => window.clearInterval(timer);
    }, [selected, enabled]);

    return playback;
}
