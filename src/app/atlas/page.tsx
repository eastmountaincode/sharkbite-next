"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { AtlasAudio, cities, initialMix, type Mixer } from "./routes";
import styles from "./atlas.module.css";

export default function Atlas() {
    const [selected, setSelected] = useState(new Set(["TYO"]));
    const [mix, setMix] = useState(initialMix);
    const [mic, setMic] = useState<"off" | "opening" | "on">("off");
    const [error, setError] = useState("");
    const engine = useRef<AtlasAudio | null>(null);
    const gesture = useRef<{ id: number; enable: boolean; seen: Set<string> } | null>(null);

    useEffect(() => { engine.current?.update(selected, mix); }, [selected, mix]);
    useEffect(() => () => { engine.current?.dispose(); engine.current = null; }, []);

    async function audio() {
        engine.current ??= new AtlasAudio();
        const current = engine.current;
        current.update(selected, mix);
        await current.ctx.resume();
        return current;
    }

    async function testHit() {
        try { (await audio()).strike(); setError(""); }
        catch { setError("Audio could not start."); }
    }

    async function toggleMic() {
        if (mic === "on") {
            engine.current?.stopMic();
            setMic("off");
            return;
        }
        setMic("opening");
        try {
            await (await audio()).startMic();
            setMic("on");
            setError("");
        } catch {
            engine.current?.stopMic();
            setError("Microphone unavailable. Check the browser’s input permission.");
            setMic("off");
        }
    }

    function select(code: string, enable: boolean) {
        setSelected(previous => {
            const next = new Set(previous);
            if (enable) next.add(code);
            else next.delete(code);
            return next;
        });
    }

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

    return <main className={styles.panel}>
        <header className={styles.header}><h1>Sharkbite</h1><span>Delay atlas</span></header>
        <section className={styles.sheet} aria-label="Delay destinations">
            <div className={styles.caption}><strong>Destinations</strong><span>Brooklyn measurements</span></div>
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
            <div className={styles.legend}><span>Tap or drag across cities</span><span>{selected.size} / {cities.length} active</span></div>
            <div className={styles.cities}>
                {cities.map(c => <button key={c.code} aria-pressed={selected.has(c.code)} onClick={() => select(c.code, !selected.has(c.code))}>
                    <b>{c.code}</b><span>{c.name}</span><small>{c.ms.toFixed(1)} ms</small>
                </button>)}
            </div>
        </section>
        <section className={styles.controls} aria-label="Mixer">
            {(Object.keys(initialMix) as (keyof Mixer)[]).map(key => <label key={key}>
                <span>{key}<output>{mix[key]}%</output></span>
                <input type="range" max={key === "feedback" ? 90 : 100} value={mix[key]}
                    onChange={e => setMix({ ...mix, [key]: Number(e.target.value) })} />
            </label>)}
        </section>
        <footer className={styles.footer}>
            <button className={styles.strike} onClick={testHit}>Play test hit</button>
            <button aria-pressed={mic === "on"} disabled={mic === "opening"} onClick={toggleMic}>
                {mic === "opening" ? "Opening mic…" : mic === "on" ? "Mic on" : "Mic off"}
            </button>
            <span>{error}</span>
        </footer>
    </main>;
}
