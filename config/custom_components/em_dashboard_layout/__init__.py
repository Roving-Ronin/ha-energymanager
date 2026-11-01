"""Shared Energy Manager dashboard layout stored under /config/.energy_manager."""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import tempfile

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

DOMAIN = "em_dashboard_layout"
CONFIG_SCHEMA = vol.Schema({vol.Optional(DOMAIN): vol.Schema({})}, extra=vol.ALLOW_EXTRA)
MAX_BYTES = 150_000


def _read(path: Path) -> dict:
    if not path.exists():
        return {"version": 6, "revision": 0, "cards": {}}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("cards"), dict):
        raise ValueError("Invalid dashboard layout file")
    return data


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".dashboard_layout-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


@websocket_api.websocket_command({vol.Required("type"): "em_dashboard_layout/get"})
@websocket_api.async_response
async def ws_get(hass, connection, msg):
    path = hass.data[DOMAIN]["path"]
    lock = hass.data[DOMAIN]["lock"]
    try:
        async with lock:
            data = await asyncio.to_thread(_read, path)
        connection.send_result(msg["id"], data)
    except (ValueError, OSError, json.JSONDecodeError) as err:
        connection.send_error(msg["id"], "read_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "em_dashboard_layout/save",
    vol.Required("cards"): dict,
    vol.Required("revision"): vol.All(int, vol.Range(min=0)),
})
@websocket_api.async_response
async def ws_save(hass, connection, msg):
    # Shared dashboard preferences: editing requires Home Assistant administrator access.
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Administrator access required to change shared layout")
        return
    cards = msg["cards"]
    if len(cards) > 500 or any(not isinstance(k, str) or len(k) > 120 or not isinstance(v, dict) for k, v in cards.items()):
        connection.send_error(msg["id"], "invalid_layout", "Invalid card entries")
        return
    # v4 uses exact grid coordinates. Older v2/v3 keys remain accepted for migration.
    clean = {}
    for key, value in cards.items():
        try:
            has_xy = "x" in value and "y" in value
            if has_xy:
                x, y, w, h = (value.get(k) for k in ("x", "y", "w", "h"))
                if any(type(n) is not int for n in (x, y, w, h)):
                    raise ValueError()
                if not (0 <= x <= 23 and 0 <= y <= 5000 and 1 <= w <= 24 and 1 <= h <= 80 and x + w <= 24):
                    raise ValueError()
                entry = {"x": x, "y": y, "w": w, "h": h}
            else:
                col, order, width = int(value.get("col", 0)), int(value.get("order", 0)), int(value.get("width", 4))
                old_height = value.get("height", "auto")
                if not (0 <= col <= 2 and 0 <= order <= 1000 and 1 <= width <= 12):
                    raise ValueError()
                if old_height != "auto" and (type(old_height) is not int or not 80 <= old_height <= 1200):
                    raise ValueError()
                entry = {"col": col, "order": order, "width": width, "height": old_height}
            if type(value.get("hidden", False)) is not bool:
                raise ValueError()
            entry["hidden"] = value.get("hidden", False)
        except (ValueError, TypeError):
            connection.send_error(msg["id"], "invalid_layout", f"Invalid layout entry for {key}")
            return
        clean[key] = entry
    payload = {"version": 6, "revision": msg["revision"] + 1, "cards": clean}
    if len(json.dumps(payload).encode("utf-8")) > MAX_BYTES:
        connection.send_error(msg["id"], "too_large", "Layout exceeds size limit")
        return
    path = hass.data[DOMAIN]["path"]
    lock = hass.data[DOMAIN]["lock"]
    try:
        async with lock:
            current = await asyncio.to_thread(_read, path)
            if int(current.get("revision", 0)) != msg["revision"]:
                connection.send_error(msg["id"], "conflict", "Another device changed this layout. Reload and retry.")
                return
            await asyncio.to_thread(_write, path, payload)
        connection.send_result(msg["id"], payload)
    except (ValueError, OSError, json.JSONDecodeError) as err:
        connection.send_error(msg["id"], "write_failed", str(err))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hass.data[DOMAIN] = {"path": Path(hass.config.path(".energy_manager", "dashboard_layout.json")), "lock": asyncio.Lock()}
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_save)
    return True
