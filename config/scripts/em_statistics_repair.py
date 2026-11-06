
#!/usr/bin/env python3
"""Conservatively repair legacy grid-price statistics units.

Runs from the Energy Manager post-reboot updater.
"""

import base64
import hashlib
import json
import os
import socket
import struct
import urllib.request

TARGETS = (
    "sensor.grid_buy_price",
    "sensor.grid_sell_price",
)
TARGET_UNIT = "$/kWh"
SAFE_OLD_UNITS = ("AUD/kWh",)


class HomeAssistantWS:

    def __init__(self, token):
        self.sock = socket.create_connection(("supervisor", 80), timeout=15)
        self.sock.settimeout(15)

        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request = (
            "GET /core/websocket HTTP/1.1\r\n"
            "Host: supervisor\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            f"Authorization: Bearer {token}\r\n"
            "\r\n"
        )
        self.sock.sendall(request.encode("ascii"))

        header = bytearray()
        while not header.endswith(b"\r\n\r\n"):
            if len(header) > 16384:
                raise RuntimeError("WebSocket handshake too large")
            chunk = self.sock.recv(1)
            if not chunk:
                raise RuntimeError("WebSocket handshake closed")
            header.extend(chunk)

        first_line = header.split(b"\r\n", 1)[0]
        if b" 101 " not in first_line:
            raise RuntimeError(
                f"WebSocket upgrade failed: {first_line.decode(errors='replace')}"
            )

        expected = base64.b64encode(
            hashlib.sha1(
                (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()
            ).digest()
        ).decode("ascii")

        if f"sec-websocket-accept: {expected}".lower().encode() not in header.lower():
            raise RuntimeError("Invalid WebSocket handshake")

        if self.receive().get("type") != "auth_required":
            raise RuntimeError("Missing Home Assistant authentication challenge")

        self.send({"type": "auth", "access_token": token})
        auth = self.receive()
        if auth.get("type") != "auth_ok":
            raise RuntimeError("Home Assistant WebSocket authentication failed")

        self.sequence = 0

    def read_exact(self, count):
        data = bytearray()
        while len(data) < count:
            chunk = self.sock.recv(count - len(data))
            if not chunk:
                raise RuntimeError("WebSocket connection closed")
            data.extend(chunk)
        return bytes(data)

    def send_frame(self, payload, opcode=1):
        mask = os.urandom(4)
        length = len(payload)

        if length < 126:
            header = bytes((0x80 | opcode, 0x80 | length))
        elif length < 65536:
            header = bytes((0x80 | opcode, 0xFE)) + struct.pack("!H", length)
        else:
            header = bytes((0x80 | opcode, 0xFF)) + struct.pack("!Q", length)

        masked = bytes(
            value ^ mask[index % 4]
            for index, value in enumerate(payload)
        )
        self.sock.sendall(header + mask + masked)

    def send(self, message):
        self.send_frame(json.dumps(message).encode("utf-8"))

    def receive(self):
        while True:
            first, second = self.read_exact(2)
            opcode = first & 0x0F
            length = second & 0x7F

            if length == 126:
                length = struct.unpack("!H", self.read_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self.read_exact(8))[0]

            if length > 1048576:
                raise RuntimeError("WebSocket response too large")

            mask = self.read_exact(4) if second & 0x80 else None
            payload = self.read_exact(length)

            if mask:
                payload = bytes(
                    value ^ mask[index % 4]
                    for index, value in enumerate(payload)
                )

            if opcode == 9:
                self.send_frame(payload, opcode=10)
                continue

            if opcode == 8:
                raise RuntimeError("WebSocket closed by Home Assistant")

            if opcode != 1 or not first & 0x80:
                raise RuntimeError("Unsupported WebSocket frame")

            return json.loads(payload.decode("utf-8"))

    def call(self, command, **kwargs):
        self.sequence += 1
        request_id = self.sequence
        self.send({"id": request_id, "type": command, **kwargs})

        while True:
            response = self.receive()
            if response.get("id") != request_id:
                continue

            if not response.get("success"):
                raise RuntimeError(
                    f"{command}: {response.get('error')}"
                )
            return response.get("result")

    def close(self):
        self.sock.close()


def live_unit(token, entity_id):
    request = urllib.request.Request(
        f"http://supervisor/core/api/states/{entity_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        state = json.load(response)
    return state.get("attributes", {}).get("unit_of_measurement")


def main():
    token = os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HASSIO_TOKEN")
    if not token:
        raise RuntimeError("Supervisor token unavailable")

    ws = HomeAssistantWS(token)
    changed = False

    try:
        metadata = ws.call(
            "recorder/get_statistics_metadata",
            statistic_ids=list(TARGETS),
        )
        by_id = {item["statistic_id"]: item for item in metadata}

        for entity_id in TARGETS:
            info = by_id.get(entity_id)
            if not info:
                print(f"[EM Statistics] {entity_id}: no recorded metadata")
                continue

            current_unit = live_unit(token, entity_id)
            old_unit = info.get(
                "statistics_unit_of_measurement",
                info.get("unit_of_measurement"),
            )

            if current_unit != TARGET_UNIT:
                print(
                    f"[EM Statistics] {entity_id}: live unit "
                    f"{current_unit!r}; skipped"
                )
                continue

            if old_unit == TARGET_UNIT:
                print(f"[EM Statistics] {entity_id}: already correct")
                continue

            if old_unit not in SAFE_OLD_UNITS:
                print(
                    f"[EM Statistics] {entity_id}: historical unit "
                    f"{old_unit!r} requires manual review; skipped"
                )
                continue

            ws.call(
                "recorder/update_statistics_metadata",
                statistic_id=entity_id,
                unit_class=None,
                unit_of_measurement=TARGET_UNIT,
            )

            print(
                f"[EM Statistics] {entity_id}: "
                f"{old_unit} -> {TARGET_UNIT}"
            )
            changed = True

        if changed:
            ws.call("recorder/update_statistics_issues")
            print("[EM Statistics] Statistics issues refreshed")

    finally:
        ws.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[EM Statistics] Repair failed: {exc}", flush=True)
        raise SystemExit(1)
