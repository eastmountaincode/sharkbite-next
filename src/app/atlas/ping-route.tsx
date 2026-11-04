import { useEffect, useRef } from "react";
import type { Destination, Ping } from "./destinations";
import type { MapLocation } from "./use-listener-location";
import styles from "./atlas.module.css";

export function PingRoute({ origin, destination, ping, color }: {
    origin: MapLocation;
    destination: Destination;
    ping?: Ping;
    color?: string;
}) {
    const group = useRef<SVGGElement>(null);
    const startX = origin.lon + 180;
    const startY = 90 - origin.lat;
    const difference = destination.lon - origin.lon;
    const wrap = difference > 180 ? -360 : difference < -180 ? 360 : 0;
    const endX = destination.lon + 180 + wrap;
    const endY = 90 - destination.lat;

    useEffect(() => {
        if (!ping || !group.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const elapsed = Math.max(0, performance.now() - ping.at);
        if (elapsed >= ping.ms) return;
        // Replay a completed round trip outward, using its actual duration.
        const animations = Array.from(group.current.querySelectorAll("circle"), dot => {
            const animation = dot.animate([
                { transform: `translate(${startX}px, ${startY}px)`, opacity: 1 },
                { transform: `translate(${endX}px, ${endY}px)`, opacity: 1 },
            ], { duration: ping.ms, easing: "linear" });
            animation.currentTime = elapsed;
            return animation;
        });
        return () => animations.forEach(animation => animation.cancel());
    }, [ping, startX, startY, endX, endY]);

    return <g ref={group} className={styles.pingRoute} style={{ color }} data-destination={destination.code}>
        {(wrap ? [0, -wrap] : [0]).map(offset => <g key={offset} transform={`translate(${offset} 0)`}>
            <line x1={startX} y1={startY} x2={endX} y2={endY} />
            <circle r="1.8" />
        </g>)}
    </g>;
}
