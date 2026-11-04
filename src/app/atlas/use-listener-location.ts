import { useEffect, useState } from "react";

export type MapLocation = { lat: number; lon: number };

export function useListenerLocation(enabled: boolean) {
    const [location, setLocation] = useState<MapLocation | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void fetch("/api/location", {
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        }).then(response => response.ok ? response.json() : null).then(value => {
            if (!controller.signal.aborted && value && typeof value.lat === "number" && typeof value.lon === "number"
                && Number.isFinite(value.lat) && Number.isFinite(value.lon) && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180) {
                setLocation({ lat: value.lat, lon: value.lon });
            }
        }).catch(() => {
            // Leave the origin absent when location is unavailable.
        });
        return () => controller.abort();
    }, [enabled]);

    return location;
}
