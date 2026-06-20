#!/usr/bin/env bash
set -euo pipefail

if ! command -v doctl >/dev/null 2>&1; then
  echo "doctl is not installed. Install it from https://docs.digitalocean.com/reference/doctl/" >&2
  exit 1
fi

doctl compute droplet list \
  --format ID,Name,PublicIPv4,Region,Status \
  --no-header
