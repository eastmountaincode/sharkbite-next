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
