import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { measuredDestinations, type Destination } from "./catalog";
import styles from "./atlas.module.css";

type View = { x: number; y: number; width: number; height: number };
const WORLD: View = { x: 0, y: 0, width: 360, height: 140 };
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function fit(view: View): View {
    return {
        ...view,
        x: Math.max(0, Math.min(360 - view.width, view.x)),
        y: Math.max(0, Math.min(140 - view.height, view.y)),
    };
}

export function DestinationMap({ selected, select, onClose, onTest }: {
    selected: ReadonlySet<string>;
    select: (code: string, enable: boolean) => void;
    onClose: () => void;
    onTest: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const map = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ id: number; x: number; y: number; view: View; enable: boolean; seen: Set<string> } | null>(null);
    const [destinations, setDestinations] = useState(measuredDestinations);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [search, setSearch] = useState("");
    const [selectedOnly, setSelectedOnly] = useState(false);
    const [view, setView] = useState(WORLD);
    const [width, setWidth] = useState(640);
    const [draw, setDraw] = useState(false);

    useEffect(() => {
        dialog.current?.showModal();
        const node = map.current;
        if (!node) return;
        const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/atlas-destinations", { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error("Could not load the full directory.");
                const data = await response.json();
                if (!Array.isArray(data.destinations)) throw new Error("Invalid directory response.");
                setDestinations(data.destinations);
            })
            .catch(error => {
                if (!controller.signal.aborted) setError(error.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [retry]);

    const filtered = useMemo(() => {
        const query = search.toLocaleLowerCase().trim();
        return destinations.filter(city =>
            (!selectedOnly || selected.has(city.code)) &&
            `${city.name} ${city.country} ${countryNames.of(city.country)}`.toLocaleLowerCase().includes(query));
    }, [destinations, search, selectedOnly, selected]);

    const groups = useMemo(() => {
        const result: { x: number; y: number; cities: Destination[] }[] = [];
        for (const city of filtered) {
            const x = (city.lon + 180 - view.x) / view.width * width;
            const y = (80 - city.lat - view.y) / view.width * width;
            if (x < 0 || x > width || y < 0 || y > width * 140 / 360) continue;
            const nearby = result.find(group => Math.hypot(group.x - x, group.y - y) < 26);
            if (nearby) nearby.cities.push(city);
            else result.push({ x, y, cities: [city] });
        }
        return result;
    }, [filtered, view, width]);

    function zoom(factor: number, x = view.x + view.width / 2, y = view.y + view.height / 2) {
        const nextWidth = Math.max(360 / 32, Math.min(360, view.width / factor));
        const height = nextWidth * 140 / 360;
        setView(fit({ x: x - nextWidth / 2, y: y - height / 2, width: nextWidth, height }));
    }

    function paint(event: PointerEvent<HTMLDivElement>, begin: boolean) {
        if (!event.isPrimary || event.button > 0) return;
        if (!draw && (event.target as Element).closest("button")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const hit = groups.find(group => group.cities.length === 1 && Math.hypot(group.x - x, group.y - y) <= 15)?.cities[0];
        if (begin) {
            gesture.current = {
                id: event.pointerId, x, y, view,
                enable: !hit || !selected.has(hit.code), seen: new Set(),
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        const drag = gesture.current;
        if (!drag || drag.id !== event.pointerId) return;
        if (!draw) {
            setView(fit({
                ...drag.view,
                x: drag.view.x - (x - drag.x) / rect.width * drag.view.width,
                y: drag.view.y - (y - drag.y) / rect.width * drag.view.width,
            }));
        } else if (hit && !drag.seen.has(hit.code)) {
            drag.seen.add(hit.code);
            select(hit.code, drag.enable);
        }
    }

    const playing = destinations.filter(city => selected.has(city.code) && city.ms !== null).length;
    const pending = selected.size - playing;

    return <dialog className={styles.dialog} ref={dialog} aria-labelledby="destination-title" onClose={onClose}>
        <section aria-label="Delay destinations">
            <div className={styles.caption}>
                <h2 id="destination-title">Destinations</h2>
                <button autoFocus onClick={() => dialog.current?.close()}>Close</button>
            </div>
            <div className={styles.toolbar}>
                <input type="search" aria-label="Find a city or country" placeholder="City or country" value={search} onChange={event => setSearch(event.target.value)} />
                <button aria-pressed={selectedOnly} onClick={() => setSelectedOnly(!selectedOnly)}>Selected</button>
                <button aria-pressed={draw} onClick={() => setDraw(!draw)}>Draw selection</button>
            </div>
            <div className={styles.map} ref={map} data-draw={draw}
                onPointerDown={e => paint(e, true)} onPointerMove={e => paint(e, false)}
                onLostPointerCapture={() => { gesture.current = null; }}>
                <svg className={styles.routes} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} aria-hidden="true">
                    <image href="/world-land.svg" x="0" y="0" width="360" height="140" />
                    {destinations.filter(city => selected.has(city.code)).map(city => {
                        const x = city.lon + 180;
                        const y = 80 - city.lat;
                        const end = x - 106 > 180 ? x - 360 : x;
                        return [0, 360].map(offset => <path key={city.code + offset} transform={`translate(${offset} 0)`}
                            data-pending={city.ms === null}
                            d={`M106 39.3 Q${(106 + end) / 2} ${Math.min(39.3, y) - Math.abs(end - 106) * 0.16} ${end} ${y}`} />);
                    })}
                </svg>
                {groups.map(group => {
                    const multiple = group.cities.length > 1;
                    const city = group.cities[0];
                    const label = multiple ? `${group.cities.length} destinations — zoom in` : city.name;
                    return <button key={city.code} className={styles.pin} data-cluster={multiple}
                        data-active={group.cities.some(city => selected.has(city.code))}
                        aria-label={label} aria-pressed={multiple ? undefined : selected.has(city.code)} title={multiple ? group.cities.map(city => city.name).join(", ") : city.name}
                        style={{ left: group.x, top: group.y }}
                        onClick={event => {
                            if (draw && !multiple && event.detail !== 0) return;
                            if (multiple) zoom(2, view.x + group.x / width * view.width, view.y + group.y / width * view.width);
                            else select(city.code, !selected.has(city.code));
                        }}>{multiple ? group.cities.length : ""}</button>;
                })}
            </div>
            <div className={styles.navigation}>
                <div>
                    <button aria-label="Zoom in" disabled={view.width <= 360 / 32} onClick={() => zoom(2)}>+</button>
                    <button aria-label="Zoom out" disabled={view.width >= 360} onClick={() => zoom(0.5)}>−</button>
                    <button onClick={() => setView(WORLD)}>World</button>
                </div>
                <span>{draw ? "Drag over cities to select" : "Drag to move · click a cluster to zoom"}</span>
            </div>
            <div className={styles.legend} aria-live="polite">
                <span>{loading ? "Loading RIPE Atlas…" : `${destinations.length} destinations · grouped within 100 km`}</span>
                <span>{playing} playing{pending > 0 ? ` · ${pending} awaiting measurement` : ""}</span>
            </div>
            {error && <p className={styles.error} role="status">{error} <button onClick={() => { setError(""); setLoading(true); setRetry(retry + 1); }}>Retry</button></p>}
            <div className={styles.cities}>
                {filtered.map(city => <button key={city.code} aria-pressed={selected.has(city.code)} onClick={() => select(city.code, !selected.has(city.code))}
                    title={`${city.name}, ${countryNames.of(city.country)} · ${city.anchors.length} anchors`}>
                    <span>{city.name}</span>
                    <small>{countryNames.of(city.country)}</small>
                    <small>{city.ms === null ? "Awaiting measurement" : `${city.ms.toFixed(1)} ms · Brooklyn test`}</small>
                </button>)}
                {filtered.length === 0 && <p>No matching destinations.</p>}
            </div>
        </section>
        <div className={styles.bottom}>
            <button className={styles.hit} onClick={onTest}>Play test hit</button>
            <span>Only measured destinations produce an echo.</span>
        </div>
    </dialog>;
}
