import { useEffect, useRef, type PointerEvent } from "react";
import { cities } from "./routes";
import styles from "./atlas.module.css";

export function DestinationMap({ selected, select, onClose, onTest }: {
    selected: ReadonlySet<string>;
    select: (code: string, enable: boolean) => void;
    onClose: () => void;
    onTest: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const gesture = useRef<{ id: number; enable: boolean; seen: Set<string> } | null>(null);

    useEffect(() => { dialog.current?.showModal(); }, []);

    function paint(event: PointerEvent<HTMLDivElement>, begin: boolean) {
        if (!event.isPrimary || event.button > 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const nearest = cities.map(city => ({
            city,
            d: Math.hypot((city.lon + 180) / 360 * rect.width - x, (80 - city.lat) / 140 * rect.height - y),
        })).sort((a, b) => a.d - b.d)[0];
        const hit = nearest.d <= 20 ? nearest.city : undefined;
        if (begin) {
            gesture.current = { id: event.pointerId, enable: !hit || !selected.has(hit.code), seen: new Set() };
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        const drag = gesture.current;
        if (!drag || drag.id !== event.pointerId || !hit || drag.seen.has(hit.code)) return;
        drag.seen.add(hit.code);
        select(hit.code, drag.enable);
    }

    return <dialog className={styles.dialog} ref={dialog} aria-labelledby="destination-title" onClose={onClose}>
        <section className={styles.sheet} aria-label="Delay destinations">
            <div className={styles.caption}><h2 id="destination-title">Destinations</h2><button autoFocus onClick={() => dialog.current?.close()}>Close</button></div>
            <div className={styles.map} role="group" aria-label="Destination map"
                onPointerDown={e => paint(e, true)} onPointerMove={e => paint(e, false)}
                onLostPointerCapture={() => { gesture.current = null; }}>
                <svg className={styles.routes} viewBox="0 0 360 140" aria-hidden="true">
                    {cities.filter(c => selected.has(c.code)).map(c => {
                        const x = c.lon + 180, y = 80 - c.lat;
                        // Take the short longitude direction across the date line.
                        const end = x - 106 > 180 ? x - 360 : x;
                        return [0, 360].map(offset => <path key={c.code + offset} transform={`translate(${offset} 0)`}
                            d={`M106 39.3 Q${(106+end)/2} ${Math.min(39.3,y)-Math.abs(end-106)*0.16} ${end} ${y}`} />);
                    })}
                </svg>
                {cities.map(c => <span key={c.code} aria-hidden="true" data-active={selected.has(c.code)}
                    data-code={c.code} className={styles.pin} style={{left: (c.lon + 180) / 3.6 + "%", top: (80 - c.lat) / 1.4 + "%"}}><i>{c.code}</i></span>)}
            </div>
            <div className={styles.legend}><span>Brooklyn measurements</span><span>{selected.size} / {cities.length} active</span></div>
            <div className={styles.cities}>
                {cities.map(c => <button key={c.code} aria-pressed={selected.has(c.code)} onClick={() => select(c.code, !selected.has(c.code))}>
                    <b>{c.code}</b><span>{c.name}</span><small>{c.ms.toFixed(1)} ms</small>
                </button>)}
            </div>
        </section>
        <button className={styles.hit} onClick={onTest}>Play test hit</button>
    </dialog>;
}
