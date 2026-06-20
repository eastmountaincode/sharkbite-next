const RELAY_ORIGIN = process.env.NEXT_PUBLIC_SHARKBITE_RELAY_ORIGIN?.replace(/\/$/, "");

function wsProtocolFor(origin: string) {
  if (origin.startsWith("https://")) return origin.replace(/^https:\/\//, "wss://");
  if (origin.startsWith("http://")) return origin.replace(/^http:\/\//, "ws://");
  return origin;
}

export function describeConnectionMode() {
  if (RELAY_ORIGIN) return "Relay proxy";

  if (typeof window !== "undefined" && window.location.protocol === "http:") {
    return "Direct taps";
  }

  return "Relay required";
}

export function buildTapSocketUrl(ip: string) {
  if (RELAY_ORIGIN) {
    return `${wsProtocolFor(RELAY_ORIGIN)}/relay?ip=${encodeURIComponent(ip)}`;
  }

  if (typeof window !== "undefined" && window.location.protocol === "http:") {
    return `ws://${ip}:8081/`;
  }

  return null;
}
