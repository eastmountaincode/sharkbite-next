import { cities } from "./routes";

export type Anchor = {
    id: number;
    name: string;
    country: string;
    lon: number;
    lat: number;
    hostname: string;
    ip: string;
};

export type Destination = {
    code: string;
    name: string;
    country: string;
    lon: number;
    lat: number;
    ms: number | null;
    anchors: Anchor[];
};

export const GROUP_RADIUS_KM = 100;
const countries = ["US", "US", "US", "GB", "BR", "JP", "AU"];

// Preserve the exact locations and timing of the seven recorded tests.
export function measuredDestinations(): Destination[] {
    return cities.map((city, index) => ({
        ...city,
        name: city.code === "SJC" ? "San Francisco Bay Area" : city.name,
        country: countries[index],
        anchors: [],
    }));
}

export function distanceKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }) {
    const radians = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * radians / 2) ** 2 +
        Math.cos(a.lat * radians) * Math.cos(b.lat * radians) *
        Math.sin((b.lon - a.lon) * radians / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Fixed centers avoid a chain of nearby anchors merging an entire continent.
// Stable anchor IDs make grouping independent of the API's pagination order.
export function groupAnchors(anchors: Anchor[]): Destination[] {
    const destinations = measuredDestinations();
    for (const anchor of [...anchors].sort((a, b) => a.id - b.id)) {
        const nearest = destinations
            .filter(destination => destination.country === anchor.country)
            .map(destination => ({ destination, km: distanceKm(destination, anchor) }))
            .sort((a, b) => a.km - b.km)[0];
        if (nearest && nearest.km <= GROUP_RADIUS_KM) {
            nearest.destination.anchors.push(anchor);
        } else {
            destinations.push({
                code: `anchor-${anchor.id}`,
                name: anchor.name,
                country: anchor.country,
                lon: anchor.lon,
                lat: anchor.lat,
                ms: null,
                anchors: [anchor],
            });
        }
    }
    return destinations.sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

export function parseAnchor(value: unknown): Anchor | null {
    if (!value || typeof value !== "object") return null;
    const a = value as Record<string, unknown>;
    const geometry = a.geometry as { coordinates?: unknown } | null;
    const coordinates = geometry?.coordinates;
    if (!Number.isInteger(a.id) || a.is_disabled === true ||
        a.as_v4 === 14061 || typeof a.company !== "string" || /digital\s*ocean/i.test(a.company) ||
        typeof a.city !== "string" || !a.city.trim() || typeof a.country !== "string" || !/^[A-Z]{2}$/.test(a.country) ||
        typeof a.ip_v4 !== "string" || !a.ip_v4 || typeof a.fqdn !== "string" ||
        !Array.isArray(coordinates) || coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return null;
    return {
        id: a.id as number, name: a.city.trim(), country: a.country,
        lon: coordinates[0], lat: coordinates[1], ip: a.ip_v4, hostname: a.fqdn,
    };
}
