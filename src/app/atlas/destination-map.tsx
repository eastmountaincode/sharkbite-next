import { type CSSProperties, type FocusEvent, type PointerEvent, useState } from "react";
import { destinations, type Destination, type Measurement, type Measurements } from "./destinations";
import type { MapLocation } from "./use-listener-location";
import { mapRoute } from "./map-route";
import styles from "./atlas.module.css";

// Approximate map positions, read across the three-column city grid.
const cityOrder: Record<Destination["code"], number> = {
    YYC: 0, STO: 1, TYO: 2,
    NYC: 3, LON: 4, HKG: 5,
    SFO: 6, BOM: 7, SIN: 8,
    SAO: 9, CPT: 10, SYD: 11,
};
const gridDestinations = [...destinations].sort((a, b) => cityOrder[a.code] - cityOrder[b.code]);

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

export function DestinationMap({ selected, measurements, origin, select }: {
    selected: ReadonlySet<string>;
    measurements: Measurements;
    origin: MapLocation | null;
    select: (code: string, enable: boolean) => void;
}) {
    const [hovered, setHovered] = useState<string | null>(null);
    const [focused, setFocused] = useState<string | null>(null);
    const highlighted = hovered ?? focused;
    const cityInteraction = (code: string) => ({
        "data-highlighted": highlighted === code,
        onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
            if (event.pointerType !== "touch") setHovered(code);
        },
        onPointerLeave: () => setHovered(current => current === code ? null : current),
        onFocus: (event: FocusEvent<HTMLButtonElement>) => {
            if (event.currentTarget.matches(":focus-visible")) setFocused(code);
        },
        onBlur: () => setFocused(current => current === code ? null : current),
    });

    return (
        <section className={styles.destinations} aria-labelledby="destination-title">
            <header className={styles.caption}>
                <h2 id="destination-title">Destinations</h2>
            </header>
            <div className={styles.mapArea}>
                <div className={styles.map}>
                    <svg viewBox="0 0 360 180" aria-hidden="true">
                        <image href="/world-land.svg" width="360" height="180" />
                        {origin && <>
                            {destinations.filter(city => selected.has(city.code)).map(city => (
                                <path key={city.code} className={styles.connection} data-destination={city.code}
                                    d={mapRoute(origin, city).path} />
                            ))}
                            <circle className={styles.origin} cx={origin.lon + 180} cy={90 - origin.lat} r="2.2">
                                <title>Your approximate location</title>
                            </circle>
                        </>}
                    </svg>
                    {destinations.map(city => <button key={city.code} className={styles.pin}
                        {...cityInteraction(city.code)}
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
                {gridDestinations.map(city => {
                    const active = selected.has(city.code);
                    const measurement = measurements[city.code];
                    return <button key={city.code} {...cityInteraction(city.code)} aria-pressed={active}
                        onClick={() => select(city.code, !active)}>
                        <span>{city.name}</span>
                        <small>{formatMeasurement(measurement)}</small>
                    </button>;
                })}
            </div>
        </section>
    );
}
