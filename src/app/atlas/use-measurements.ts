import { useEffect, useRef, useState } from "react";
import { destinations, type Measurements } from "./destinations";
import { measureDestination } from "./measurements";

export function useMeasurements(selected: ReadonlySet<string>, running: boolean, enabled = true) {
    const [measurements, setMeasurements] = useState<Measurements>({});
    const latest = useRef<Measurements>({});
    const sampled = useRef(new Set<string>());
    const workers = useRef(new Map<string, { controller: AbortController; continuous: boolean }>());

    useEffect(() => {
        const active = workers.current;
        return () => {
            active.forEach(worker => worker.controller.abort());
            active.clear();
        };
    }, []);

    useEffect(() => {
        const active = workers.current;
        for (const [code, worker] of active) {
            if (!enabled || worker.continuous !== (running && selected.has(code))) {
                worker.controller.abort();
                active.delete(code);
            }
        }
        if (!enabled) return;
        for (const destination of destinations) {
            const continuous = running && selected.has(destination.code);
            if (active.has(destination.code) || (!continuous && sampled.current.has(destination.code))) continue;
            const controller = new AbortController();
            active.set(destination.code, { controller, continuous });
            void measureDestination(destination, controller.signal, measurement => {
                if (controller.signal.aborted) return;
                latest.current[destination.code] = measurement;
                if (measurement.ms !== null || measurement.unavailable) sampled.current.add(destination.code);
                setMeasurements(current => ({ ...current, [destination.code]: measurement }));
            }, {
                once: !continuous,
                initial: latest.current[destination.code],
            }).then(() => {
                if (active.get(destination.code)?.controller === controller) {
                    active.delete(destination.code);
                }
            });
        }
    }, [selected, running, enabled]);

    return measurements;
}
