import { useEffect, useRef, useState } from "react";
import { destinations, type Measurements } from "./destinations";
import { measureDestination } from "./measurements";

export function useMeasurements(selected: ReadonlySet<string>, running: boolean) {
    const [measurements, setMeasurements] = useState<Measurements>({});
    const workers = useRef(new Map<string, AbortController>());

    useEffect(() => {
        const active = workers.current;
        return () => {
            active.forEach(controller => controller.abort());
            active.clear();
        };
    }, []);

    useEffect(() => {
        const active = workers.current;
        for (const [code, controller] of active) {
            if (!running || !selected.has(code)) {
                controller.abort();
                active.delete(code);
            }
        }
        if (!running) return;
        for (const destination of destinations) {
            if (!selected.has(destination.code) || active.has(destination.code)) continue;
            const controller = new AbortController();
            active.set(destination.code, controller);
            void measureDestination(destination, controller.signal, measurement => {
                if (controller.signal.aborted) return;
                setMeasurements(current => ({ ...current, [destination.code]: measurement }));
            });
        }
    }, [selected, running]);

    return measurements;
}
