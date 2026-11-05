import { useEffect, useMemo, useRef } from "react";
import type { Destination, Ping } from "./destinations";
import type { MapLocation } from "./use-listener-location";
import { mapRoute } from "./map-route";
import { PING_FADE_MS, pingTravelMs } from "./use-ping-playback";
import styles from "./atlas.module.css";

export function PingRoute({ origin, destination, ping }: {
    origin: MapLocation;
    destination: Destination;
    ping?: Ping;
}) {
    const group = useRef<SVGGElement>(null);
    const animations = useRef<Animation[]>([]);
    const route = useMemo(() => mapRoute(origin, destination), [origin, destination]);

    useEffect(() => {
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const cancel = () => {
            animations.current.forEach(animation => animation.cancel());
            animations.current = [];
        };
        motion.addEventListener("change", cancel);
        return () => {
            motion.removeEventListener("change", cancel);
            cancel();
        };
    }, [route]);

    useEffect(() => {
        if (!ping || !group.current || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        // Slow only the visual playback so its direction is readable. Neither
        // the audio delay nor the displayed RTT uses this presentation duration.
        const travelMs = pingTravelMs(ping.ms);
        const elapsed = Math.max(0, performance.now() - ping.at);
        if (elapsed >= travelMs) return;
        animations.current.forEach(animation => animation.cancel());
        animations.current = Array.from(group.current.querySelectorAll("path"), path => {
            const trace = path.dataset.trace !== undefined;
            const arrival = travelMs / (travelMs + PING_FADE_MS);
            const tail = Math.min(0.15, 7 / Math.max(1, path.getTotalLength()));
            if (!trace) path.style.strokeDasharray = `${tail} 1`;
            const animation = path.animate(trace ? [
                { strokeDashoffset: 1, opacity: 0.18, offset: 0 },
                { strokeDashoffset: 0, opacity: 0.18, offset: arrival },
                { strokeDashoffset: 0, opacity: 0, offset: 1 },
            ] : [
                { strokeDashoffset: tail, opacity: 0.75, offset: 0 },
                { strokeDashoffset: tail - 1, opacity: 0.75, offset: arrival },
                { strokeDashoffset: tail - 1, opacity: 0, offset: 1 },
            ], { duration: travelMs + PING_FADE_MS, easing: "linear" });
            animation.currentTime = elapsed;
            return animation;
        });
    }, [ping, route]);

    return <g ref={group} className={styles.pingRoute} data-destination={destination.code}>
        {route.offsets.map(offset => <g key={offset} transform={`translate(${offset} 0)`}>
            <path className={styles.pingTrace} data-trace d={route.path} pathLength="1" />
            <path className={styles.pingStroke} d={route.path} pathLength="1" />
        </g>)}
    </g>;
}
