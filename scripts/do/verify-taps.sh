#!/usr/bin/env bash
set -uo pipefail

region_for() {
  case "$1" in
    165.245.165.45) echo "Richmond" ;;
    24.199.111.237) echo "SanFrancisco" ;;
    64.226.68.99) echo "Frankfurt" ;;
    64.227.150.22) echo "Bangalore" ;;
    *) echo "tap" ;;
  esac
}

for ip in 165.245.165.45 24.199.111.237 64.226.68.99 64.227.150.22; do
  printf '%-13s %-15s ' "$(region_for "$ip")" "$ip"
  health="$(curl -s -m 8 "http://$ip:8080/healthz" || true)"
  if [ -n "$health" ]; then
    printf 'health_ok '
  else
    printf 'health_fail '
  fi

  if bash -c "exec 3<>/dev/tcp/$ip/8081" 2>/dev/null; then
    printf 'ws8081_ok'
  else
    printf 'ws8081_fail'
  fi
  echo
done
