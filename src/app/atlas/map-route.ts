type Location = { lat: number; lon: number };

// A screen-space arc keeps the whole journey visible on the flat map.
export function mapRoute(origin: Location, destination: Location) {
    const startX = origin.lon + 180;
    const startY = 90 - origin.lat;
    const endX = destination.lon + 180;
    const endY = 90 - destination.lat;
    const lift = Math.min(24, Math.hypot(endX - startX, endY - startY) * 0.2);
    const controlX = (startX + endX) / 2;
    const controlY = Math.max(0, (startY + endY) / 2 - lift);

    return { path: `M${startX} ${startY} Q${controlX} ${controlY} ${endX} ${endY}` };
}
