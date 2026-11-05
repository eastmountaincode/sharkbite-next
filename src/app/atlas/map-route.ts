type Location = { lat: number; lon: number };

// Project the shortest spherical arc, keeping longitude continuous at the map seam.
export function mapRoute(origin: Location, destination: Location) {
    const radians = Math.PI / 180;
    const vector = ({ lat, lon }: Location) => [
        Math.cos(lat * radians) * Math.cos(lon * radians),
        Math.cos(lat * radians) * Math.sin(lon * radians),
        Math.sin(lat * radians),
    ];
    const start = vector(origin);
    const end = vector(destination);
    const angle = Math.acos(Math.max(-1, Math.min(1, start.reduce((sum, value, index) => sum + value * end[index], 0))));
    const sine = Math.sin(angle);
    const delta = ((destination.lon - origin.lon + 540) % 360) - 180;
    let longitude = origin.lon;
    let minX = longitude + 180;
    let maxX = minX;
    const points: string[] = [];

    for (let step = 0; step <= 64; step++) {
        const t = step / 64;
        let lat = origin.lat + (destination.lat - origin.lat) * t;
        let lon = origin.lon + delta * t;
        if (Math.abs(sine) > 0.000001) {
            const a = Math.sin((1 - t) * angle) / sine;
            const b = Math.sin(t * angle) / sine;
            const point = start.map((value, index) => a * value + b * end[index]);
            lat = Math.atan2(point[2], Math.hypot(point[0], point[1])) / radians;
            lon = Math.atan2(point[1], point[0]) / radians;
        }
        while (lon - longitude > 180) lon -= 360;
        while (lon - longitude < -180) lon += 360;
        longitude = lon;
        const x = lon + 180;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        points.push(`${step === 0 ? "M" : "L"}${x.toFixed(3)} ${(90 - lat).toFixed(3)}`);
    }

    return { path: points.join(" "), offsets: [0, ...(minX < 0 ? [360] : []), ...(maxX > 360 ? [-360] : [])] };
}
