#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_SRC="${SERVICE_SRC:-$PROJECT_ROOT/ops/tap-server/internet_delay_echo.py}"

region_for() {
  case "$1" in
    165.245.165.45) echo "Richmond" ;;
    24.199.111.237) echo "SanFrancisco" ;;
    64.226.68.99) echo "Frankfurt" ;;
    64.227.150.22) echo "Bangalore" ;;
    *) echo "tap" ;;
  esac
}

TAPS=("$@")
if [ ${#TAPS[@]} -eq 0 ]; then
  TAPS=(165.245.165.45 24.199.111.237 64.226.68.99 64.227.150.22)
fi

if [ ! -f "$SERVICE_SRC" ]; then
  echo "service source not found at $SERVICE_SRC" >&2
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

for ip in "${TAPS[@]}"; do
  region="$(region_for "$ip")"
  echo ">>> $region ($ip)"

  scp $SSH_OPTS "$SERVICE_SRC" "root@$ip:/usr/local/bin/internet-delay-echo.py"
  ssh $SSH_OPTS "root@$ip" REGION="$region" 'bash -s' <<'REMOTE'
set -euo pipefail
chmod +x /usr/local/bin/internet-delay-echo.py

cat > /etc/systemd/system/internet-delay-udp-echo.service <<UNIT
[Unit]
Description=Internet Delay Pedal multi-protocol echo
After=network-online.target
Wants=network-online.target

[Service]
Environment=DELAY_REGION=${REGION}
Environment=DELAY_UDP_PORT=4000
Environment=DELAY_HTTP_PORT=8080
Environment=DELAY_WS_PORT=8081
ExecStart=/usr/bin/python3 /usr/local/bin/internet-delay-echo.py
Restart=always
RestartSec=2
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 8081/tcp >/dev/null 2>&1 || true
fi

systemctl daemon-reload
systemctl enable internet-delay-udp-echo.service >/dev/null 2>&1 || true
systemctl restart internet-delay-udp-echo.service
sleep 1
systemctl is-active internet-delay-udp-echo.service
REMOTE

  curl -s -m 8 "http://$ip:8080/healthz" && echo
done
