import { useEffect, useRef } from "react";
import { destinations, type Measurements } from "./destinations";
import styles from "./atlas.module.css";

export function DestinationMap({ inline = false, selected, measurements, select, onClose, onInfo, onTest }: {
    inline?: boolean;
    selected: ReadonlySet<string>;
    measurements: Measurements;
    select: (code: string, enable: boolean) => void;
    onClose: () => void;
    onInfo: () => void;
    onTest: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (!inline) dialog.current?.showModal();
    }, [inline]);

    const content = (
        <section aria-label="Delay destinations">
            <header className={styles.caption}>
                <h2 id="destination-title">Destinations</h2>
                {!inline && <button autoFocus onClick={() => dialog.current?.close()}>Close</button>}
            </header>
            <div className={styles.map}>
                <svg viewBox="0 0 360 140" aria-hidden="true">
                    <image href="/world-land.svg" width="360" height="140" />
                </svg>
                {destinations.map(city => <button key={city.code} className={styles.pin}
                    aria-label={city.name} aria-pressed={selected.has(city.code)} title={city.name}
                    style={{ left: `${(city.lon + 180) / 360 * 100}%`, top: `${(80 - city.lat) / 140 * 100}%` }}
                    onClick={() => select(city.code, !selected.has(city.code))} />)}
            </div>
            <div className={styles.cities}>
                {destinations.map(city => {
                    const active = selected.has(city.code);
                    const measurement = measurements[city.code];
                    const timing = measurement?.ms != null ? `${Math.round(measurement.ms)} ms` : measurement?.unavailable ? "Unavailable" : "…";
                    return <button key={city.code} aria-pressed={active} onClick={() => select(city.code, !active)}>
                        <span>{city.name}</span>
                        <small>{active ? `${timing}${measurement?.unavailable && measurement.ms != null ? " (offline)" : ""}` : ""}</small>
                    </button>;
                })}
            </div>
            <footer className={styles.bottom}>
                <button onClick={onTest}>Test sound</button>
                <button onClick={() => { dialog.current?.close(); onInfo(); }}>More info</button>
            </footer>
        </section>
    );

    if (inline) return <div className={styles.inline}>{content}</div>;

    return <dialog className={styles.dialog} ref={dialog} aria-labelledby="destination-title" onClose={onClose}
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        {content}
    </dialog>;
}
