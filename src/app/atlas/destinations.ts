// Regional HTTPS endpoints, called directly by the listener's browser.
// Locations represent AWS regions, not individual buildings or RIPE anchors.
export const destinations = [
    { code: "SFO", name: "N. California", lon: -121.9, lat: 37.3, region: "us-west-1" },
    { code: "IAD", name: "N. Virginia", lon: -77.5, lat: 39.0, region: "us-east-1" },
    { code: "SAO", name: "São Paulo", lon: -46.6, lat: -23.6, region: "sa-east-1" },
    { code: "LON", name: "London", lon: -0.1, lat: 51.5, region: "eu-west-2" },
    { code: "CPT", name: "Cape Town", lon: 18.4, lat: -33.9, region: "af-south-1" },
    { code: "BOM", name: "Mumbai", lon: 72.9, lat: 19.1, region: "ap-south-1" },
    { code: "SIN", name: "Singapore", lon: 103.8, lat: 1.3, region: "ap-southeast-1" },
    { code: "TYO", name: "Tokyo", lon: 139.7, lat: 35.7, region: "ap-northeast-1" },
    { code: "SYD", name: "Sydney", lon: 151.2, lat: -33.9, region: "ap-southeast-2" },
] as const;

export type Destination = typeof destinations[number];
export type Measurement = { ms: number | null; unavailable: boolean };
export type Measurements = Partial<Record<string, Measurement>>;
export const MAX_FEEDBACK = 150;
export const MAX_DELAY_MS = 3000;
