# Sharkbite Architecture

Sharkbite is now split into three deployable concerns:

1. `src/app` and `src/components` contain the Next.js interface.
2. `ops/tap-server` contains the Python echo service that runs on the four tap droplets.
3. `ops/relay-server` contains the DigitalOcean-hosted WebSocket relay for HTTPS deployments.

## Browser connection modes

The client connection logic is in `src/lib/audio/connection-url.ts`.

- Local `http://localhost` development connects directly to `ws://<tap-ip>:8081`.
- HTTPS deployments need `NEXT_PUBLIC_SHARKBITE_RELAY_ORIGIN=https://relay.example.com`.
- If each tap later gets a real DNS name plus TLS, the relay can be removed and the client can point directly at `wss://tap-domain`.

The relay is needed for Vercel-hosted HTTPS because the page cannot open plaintext `ws://` sockets from an HTTPS origin. Vercel also documents that Vercel Functions do not support acting as a WebSocket server: https://vercel.com/docs/limits#websockets.

## Current DigitalOcean inventory

`doctl` is installed and authenticated with the `default` context on this machine.

Tap droplets:

| Name | Region | Public IPv4 | Ports |
| --- | --- | --- | --- |
| `delay-ric` | `ric1` | `165.245.165.45` | UDP 4000, HTTP 8080, WS 8081 |
| `delay-sfo` | `sfo3` | `24.199.111.237` | UDP 4000, HTTP 8080, WS 8081 |
| `delay-fra` | `fra1` | `64.226.68.99` | UDP 4000, HTTP 8080, WS 8081 |
| `delay-blr` | `blr1` | `64.227.150.22` | UDP 4000, HTTP 8080, WS 8081 |

Relay candidate:

| Name | Region | Public IPv4 |
| --- | --- | --- |
| `ubuntu-s-1vcpu-512mb-10gb-nyc1-01` | `nyc1` | `142.93.200.109` |

## Local commands

```bash
npm run do:droplets
npm run do:verify-taps
```

Deploy the tap echo service after editing `ops/tap-server/internet_delay_echo.py`:

```bash
scripts/do/deploy-tap-service.sh
scripts/do/deploy-tap-service.sh 64.226.68.99
```

## Relay deployment shape

The relay server in `ops/relay-server` has both a Bun implementation and a Node implementation. The NYC droplet currently uses the Node implementation because Node and nginx are already installed there. It accepts:

- `GET /healthz`
- `WS /relay?ip=<allowed tap ip>`

For production, run it on the extra DigitalOcean droplet behind Caddy or nginx so the public origin is HTTPS/WSS. The NYC droplet is configured for nginx with the service at `127.0.0.1:8082`.

DNS needed at the `andrew-boylan.com` DNS provider:

```text
relay.sharkbite.andrew-boylan.com.  A  142.93.200.109
```

After DNS resolves to the droplet, issue TLS on the NYC host:

```bash
certbot --nginx -d relay.sharkbite.andrew-boylan.com --agree-tos -m andreweboylan@gmail.com --redirect
```

Then set the Vercel project environment variable:

```bash
NEXT_PUBLIC_SHARKBITE_RELAY_ORIGIN=https://relay.example.com
```

The relay should remain allowlisted to the four tap IPs. Do not make it a generic open WebSocket proxy.


## Bounded real-time transport (October 2026)

The browser transport (`realtime-tap-connection.ts`) caps unsent audio at 100 ms
and expires outstanding frames after 1,500 ms. An in-flight window also limits
audio already handed to TCP to the measured route RTT plus 100 ms, so reduced
bandwidth drops new frames rather than feeding a hidden network backlog. That budget leaves room for
intercontinental RTT; it is a failure ceiling, not an added musical delay.
A 250 ms watchdog catches silent connections and event-loop/sleep gaps. Failed
connections clear playback and feedback, reject callbacks from old sockets, and
retry with backoff (0.5–10 seconds). When a fallback origin is configured,
retries alternate network routes. The UI shows `Retrying` until a fresh echo
proves the path works. Disabling a tap cancels its retries.

Capture messages carry the original audio-clock timestamp so messages queued on
a busy main thread cannot be sent as fresh audio. The player drops audio-thread
messages older than 100 ms and trims bursts to a small bounded playout queue.
The normal jitter prebuffer remains 50 ms.

The Node relay is the supported production implementation (`npm start` in
`ops/relay-server`). It retains only the newest startup frame while upstream is connecting,
limits each socket's unsent queue to five frames (dropping excess new frames), and terminates stalled
sessions after 1,500 ms instead of draining obsolete audio. `/healthz` reports
`version: 2` and `maxFrameAgeMs: 1500`. The old Bun example is not the production
entrypoint.

`ops/edge-relay` adds an independent client-to-NYC route via Cloudflare. Its
runtime splices the upgraded WebSocket without a JavaScript audio queue. The
only allowed upstream is the existing NYC relay and its four allowlisted taps.
It does not replace the city echo servers. Deploy with `npm run deploy` in that
directory (requires Node 22.18+ and the pinned `cf` CLI); the small build script
emits cf's validated Build Output Specification without a bundler. Logs and
traces are enabled. The account is explicitly pinned in `cloudflare.config.ts`.

Production client configuration:

- Primary: `NEXT_PUBLIC_SHARKBITE_RELAY_ORIGIN=https://sharkbite-edge-relay.andreweboylan.workers.dev`
- Fallback: `NEXT_PUBLIC_SHARKBITE_RELAY_FALLBACK_ORIGIN=https://relay.sharkbite.andrew-boylan.com`

Run `npm ci --prefix ops/relay-server` once, then `npm run test:recovery` for
stall, expiry, reconnection, obsolete callback, fallback route, and worklet
regressions, plus a real local WebSocket relay failure/recovery test.
The same checks run on pushes and pull requests in `audio-checks.yml`.
`npm run test:audio` checks dry/wet output routing separately. These checks do
not substitute for testing the published browser session and physical audio.

To recover an older already-open release, reload once after the update. New
releases recover their own tap connections. Network outages may still interrupt
wet audio; they must never be replayed as minutes of stale sound.
