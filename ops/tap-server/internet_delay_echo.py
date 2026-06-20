#!/usr/bin/env python3
"""
internet-delay-udp-echo  (multi-protocol echo node)

Stateless echo server for the "internet delay pedal" demo.

Listens on three ports, all bound to 0.0.0.0:
  - UDP  4000 : raw UDP echo (unchanged, original behavior)
  - HTTP 8080 : /healthz + /stats JSON
  - WS   8081 : binary WebSocket echo (browser-reachable)

The WebSocket endpoint speaks RFC 6455 well enough for browser clients:
  - performs the Upgrade handshake
  - echoes binary frames straight back (the whole point: a "wet tap")
  - replies to text "ping"/ping-frames so latency probing works
  - handles close + masking

Pure standard library on purpose so it deploys with zero pip installs and
matches the existing cloud-init footprint. Python 3.7+.
"""

import base64
import hashlib
import json
import os
import socket
import struct
import threading
import time

UDP_PORT = int(os.environ.get("ECHO_PORT", os.environ.get("DELAY_UDP_PORT", "4000")))
HTTP_PORT = int(os.environ.get("HEALTH_PORT", os.environ.get("DELAY_HTTP_PORT", "8080")))
WS_PORT = int(os.environ.get("WS_PORT", os.environ.get("DELAY_WS_PORT", "8081")))
REGION = os.environ.get("DELAY_REGION", os.environ.get("HOSTNAME", "unknown"))

START = time.time()

# ---- shared stats -----------------------------------------------------------
_lock = threading.Lock()
STATS = {
    "udp_packets": 0,
    "udp_bytes": 0,
    "ws_connections": 0,
    "ws_frames": 0,
    "ws_bytes": 0,
    "last_packet_at": None,
}


def bump(key, n=1):
    with _lock:
        STATS[key] += n
        STATS["last_packet_at"] = time.time()


# ---- UDP echo (unchanged behavior) ------------------------------------------
def udp_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", UDP_PORT))
    while True:
        data, addr = s.recvfrom(65535)
        s.sendto(data, addr)
        bump("udp_packets")
        bump("udp_bytes", len(data))


# ---- HTTP health/stats ------------------------------------------------------
def http_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", HTTP_PORT))
    srv.listen(64)
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=_http_handle, args=(conn,), daemon=True).start()


def _http_handle(conn):
    try:
        conn.settimeout(5)
        req = conn.recv(4096).decode("latin1", "replace")
        path = "/"
        if req:
            parts = req.split(" ")
            if len(parts) > 1:
                path = parts[1]
        with _lock:
            uptime = time.time() - START
            body = json.dumps({
                "service": "internet-delay-udp-echo",
                "ok": True,
                "region": REGION,
                "udp_port": UDP_PORT,
                "ws_port": WS_PORT,
                "uptime_seconds": round(uptime, 3),
                "stats": {
                    # keep legacy field names so existing tooling/datacenter-map keeps working
                    "packets": STATS["udp_packets"],
                    "bytes": STATS["udp_bytes"],
                    "last_packet_at": STATS["last_packet_at"],
                    "ws_connections": STATS["ws_connections"],
                    "ws_frames": STATS["ws_frames"],
                    "ws_bytes": STATS["ws_bytes"],
                },
            }).encode()
        hdr = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n\r\n"
        ).encode()
        conn.sendall(hdr + body)
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


# ---- WebSocket binary echo --------------------------------------------------
WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def ws_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", WS_PORT))
    srv.listen(128)
    while True:
        conn, addr = srv.accept()
        threading.Thread(target=_ws_handle, args=(conn, addr), daemon=True).start()


def _recv_until(conn, marker=b"\r\n\r\n", limit=65536):
    buf = b""
    while marker not in buf:
        chunk = conn.recv(4096)
        if not chunk:
            break
        buf += chunk
        if len(buf) > limit:
            break
    return buf


def _ws_handshake(conn):
    raw = _recv_until(conn)
    if not raw:
        return False
    headers = {}
    for line in raw.decode("latin1", "replace").split("\r\n")[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    key = headers.get("sec-websocket-key")
    if not key:
        # not a websocket client; reply with a hint and bail
        conn.sendall(b"HTTP/1.1 426 Upgrade Required\r\nContent-Length: 0\r\n\r\n")
        return False
    accept = base64.b64encode(
        hashlib.sha1((key + WS_MAGIC).encode()).digest()
    ).decode()
    resp = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    )
    conn.sendall(resp.encode())
    return True


def _ws_recv_frame(conn):
    """Return (opcode, payload bytes) or (None, None) on close/EOF."""
    hdr = _recv_exact(conn, 2)
    if hdr is None:
        return None, None
    b0, b1 = hdr[0], hdr[1]
    opcode = b0 & 0x0F
    masked = (b1 & 0x80) != 0
    length = b1 & 0x7F
    if length == 126:
        ext = _recv_exact(conn, 2)
        if ext is None:
            return None, None
        length = struct.unpack(">H", ext)[0]
    elif length == 127:
        ext = _recv_exact(conn, 8)
        if ext is None:
            return None, None
        length = struct.unpack(">Q", ext)[0]
    mask = b"\x00\x00\x00\x00"
    if masked:
        mask = _recv_exact(conn, 4)
        if mask is None:
            return None, None
    payload = _recv_exact(conn, length) if length else b""
    if payload is None:
        return None, None
    if masked:
        payload = bytes(payload[i] ^ mask[i % 4] for i in range(len(payload)))
    return opcode, payload


def _recv_exact(conn, n):
    buf = b""
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def _ws_send_frame(conn, payload, opcode=0x2):
    """Server->client frames are never masked."""
    b0 = 0x80 | opcode
    n = len(payload)
    if n < 126:
        header = struct.pack(">BB", b0, n)
    elif n < 65536:
        header = struct.pack(">BBH", b0, 126, n)
    else:
        header = struct.pack(">BBQ", b0, 127, n)
    conn.sendall(header + payload)


def _ws_handle(conn, addr):
    try:
        conn.settimeout(120)
        if not _ws_handshake(conn):
            return
        bump("ws_connections")
        while True:
            opcode, payload = _ws_recv_frame(conn)
            if opcode is None:
                break
            if opcode == 0x8:  # close
                try:
                    _ws_send_frame(conn, b"", opcode=0x8)
                except Exception:
                    pass
                break
            if opcode == 0x9:  # ping -> pong
                _ws_send_frame(conn, payload, opcode=0xA)
                continue
            if opcode == 0xA:  # pong, ignore
                continue
            # 0x1 text or 0x2 binary -> echo straight back, same opcode.
            # This is the wet tap: whatever the browser sent comes home delayed by RTT.
            _ws_send_frame(conn, payload, opcode=opcode)
            bump("ws_frames")
            bump("ws_bytes", len(payload))
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def main():
    threads = [
        threading.Thread(target=udp_server, daemon=True),
        threading.Thread(target=http_server, daemon=True),
        threading.Thread(target=ws_server, daemon=True),
    ]
    for t in threads:
        t.start()
    print(f"[internet-delay-echo] region={REGION} "
          f"udp={UDP_PORT} http={HTTP_PORT} ws={WS_PORT}", flush=True)
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
