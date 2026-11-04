import { type CSSProperties, useEffect, useRef } from "react";
import { destinations, type Measurement, type Measurements } from "./destinations";
import styles from "./atlas.module.css";

function formatMeasurement(measurement?: Measurement) {
    if (measurement?.ms == null) return measurement?.unavailable ? "Unavailable" : "…";
    return `${Math.round(measurement.ms)} ms${measurement.unavailable ? " (offline)" : ""}`;
}

function delayColor(measurement?: Measurement) {
    if (measurement?.ms == null || measurement.unavailable) return undefined;
    const amount = Math.max(0, Math.min(measurement.ms / 300, 1));
    const short = [45, 125, 169];
    const long = [218, 134, 45];
    return `rgb(${short.map((channel, index) => Math.round(channel + (long[index] - channel) * amount)).join(" ")})`;
}

export function DestinationMap({ inline = false, selected, measurements, select, onClose, onTest }: {
    inline?: boolean;
    selected: ReadonlySet<string>;
    measurements: Measurements;
    select: (code: string, enable: boolean) => void;
    onClose: () => void;
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
            <div className={styles.mapArea}>
                <div className={styles.map}>
                    <svg viewBox="0 0 360 180" aria-hidden="true">
                        <image href="/world-land.svg" width="360" height="180" />
                    </svg>
                    {destinations.map(city => <button key={city.code} className={styles.pin}
                        aria-label={city.name} aria-pressed={selected.has(city.code)}
                        title={`${city.name}: ${formatMeasurement(measurements[city.code])}`}
                        style={{
                            left: `${(city.lon + 180) / 360 * 100}%`,
                            top: `${(90 - city.lat) / 180 * 100}%`,
                            "--delay-color": delayColor(measurements[city.code]),
                        } as CSSProperties}
                        onClick={() => select(city.code, !selected.has(city.code))} />)}
                </div>
                <div className={styles.legend} aria-label="Delay colors: blue is shorter, orange is longer">
                    <span>0 ms</span>
                    <span className={styles.legendRamp} aria-hidden="true" />
                    <span>300+ ms</span>
                </div>
            </div>
            <div className={styles.cities}>
                {destinations.map(city => {
                    const active = selected.has(city.code);
                    const measurement = measurements[city.code];
                    return <button key={city.code} aria-pressed={active} onClick={() => select(city.code, !active)}>
                        <span>{city.name}</span>
                        <small>{formatMeasurement(measurement)}</small>
                    </button>;
                })}
            </div>
            <footer className={styles.bottom}>
                <button onClick={onTest}>Test sound</button>
            </footer>
        </section>
    );

    if (inline) return <div className={styles.inline}>{content}</div>;

    return <dialog className={styles.dialog} ref={dialog} aria-labelledby="destination-title" onClose={onClose}
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        {content}
    </dialog>;
}
