export const dynamic = "force-dynamic";

export function GET(request: Request) {
    const latitude = request.headers.get("x-vercel-ip-latitude");
    const longitude = request.headers.get("x-vercel-ip-longitude");
    const lat = latitude?.trim() ? Number(latitude) : NaN;
    const lon = longitude?.trim() ? Number(longitude) : NaN;
    const location = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
        ? { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }
        : null;

    return Response.json(location, { headers: { "Cache-Control": "private, no-store" } });
}
