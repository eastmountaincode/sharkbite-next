import { groupAnchors, parseAnchor, GROUP_RADIUS_KM, type Anchor } from "@/app/atlas/catalog";

// This endpoint retrieves the catalog only. It never measures delay from Vercel.
export async function GET() {
    try {
        const anchors: Anchor[] = [];
        let url: string | null = "https://atlas.ripe.net/api/v2/anchors/?is_active=true&probe_status=1&page_size=500&format=json";
        const seen = new Set<string>();
        while (url) {
            const parsed = new URL(url);
            if (parsed.origin !== "https://atlas.ripe.net" || parsed.pathname !== "/api/v2/anchors/" || seen.has(url) || seen.size >= 20) {
                throw new Error("Invalid catalog pagination");
            }
            seen.add(url);
            const response = await fetch(url, {
                next: { revalidate: 86400 },
                signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error("RIPE directory unavailable");
            const page: { results?: unknown[]; next?: unknown } = await response.json();
            if (!Array.isArray(page.results) || (page.next !== null && typeof page.next !== "string")) {
                throw new Error("Invalid catalog response");
            }
            for (const record of page.results) {
                const anchor = parseAnchor(record);
                if (anchor) anchors.push(anchor);
            }
            url = page.next;
        }
        if (!anchors.length) throw new Error("Empty anchor catalog");
        const destinations = groupAnchors(anchors);
        return Response.json({ destinations, radiusKm: GROUP_RADIUS_KM, anchorCount: anchors.length }, {
            headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
        });
    } catch {
        return Response.json({ error: "Could not load the RIPE Atlas directory." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
}
