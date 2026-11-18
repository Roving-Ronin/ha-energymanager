"""Per-user tab storage for Energy Manager layouts (schema v1)."""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import tempfile

import voluptuous as vol
from homeassistant.components import websocket_api

MAX_TABS = 8
MAX_BYTES = 300_000


def default_tabs(root: Path | None = None) -> list[dict]:
    inverter_cards = {}
    if root is not None:
        template = root / "layout_profiles" / "v1.json"
        if template.is_file():
            payload = read_json(template)
            if not isinstance(payload, dict) or not isinstance(payload.get("cards"), dict):
                raise ValueError("Invalid bundled v1 layout")
            inverter_cards = payload["cards"]
    return [
        {"id": "primary", "name": "Overview", "cards": {}},
        {{"id": "inverter", "name": "Inverter", "cards": inverter_cards, "selected": None},
    ]


def migrate_profiles(legacy: dict) -> list[dict]:
    profiles = legacy.get("profiles", {})
    if not isinstance(profiles, dict) or not profiles:
        return default_tabs()
    tabs = []
    used = {"primary", "inverter"}
    v2 = profiles.get("bundled-v2") or profiles.get("v2")
    v1 = profiles.get("bundled-v1") or profiles.get("v1")
    if v2 is None:
        key = legacy.get("active_profile")
        v2 = profiles.get(key) if key in profiles else next(iter(profiles.values()))
    tabs.append({"id": "primary", "name": "Overview", "cards": v2.get("cards", {})})
    tabs.append({"id": "inverter", "name": "Inverter", "cards": (v1 or {}).get("cards", {})})
    skip = {id(p) for p in (v1, v2) if p is not None}
    for key, profile in profiles.items():
        if id(profile) in skip or (key == "everyday" and not profile.get("cards")):
            continue
        base = "legacy-" + "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in key)[:50]
        tab_id = base
        suffix = 2
        while tab_id in used:
            tab_id = f"{base}-{suffix}"
            suffix += 1
        used.add(tab_id)
        tabs.append({"id": tab_id, "name": profile.get("name", key), "cards": profile.get("cards", {})})
    return tabs


def validate_tabs(tabs: object, *, migration: bool = False) -> list[dict]:
    if not isinstance(tabs, list) or not tabs or len(tabs) > (25 if migration else MAX_TABS):
        raise ValueError("Invalid tab count")
    ids = set()
    result = []
    for tab in tabs:
        if not isinstance(tab, dict):
            raise ValueError("Invalid tab")
        tid, name, cards = tab.get("id"), tab.get("name"), tab.get("cards")
        if not isinstance(tid, str) or not 1 <= len(tid) <= 64 or not all(c.isalnum() or c in "-_" for c in tid) or tid in ids:
            raise ValueError("Invalid or duplicate tab ID")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 50:
            raise ValueError("Invalid tab name")
        if not isinstance(cards, dict) or len(cards) > 500:
            raise ValueError("Invalid card collection")
        if any(not isinstance(k, str) or len(k) > 120 or not isinstance(v, dict) for k, v in cards.items()):
            raise ValueError("Invalid card layout")
        ids.add(tid)
        result.append({"id": tid, "name": name.strip(), "cards": cards})
    if "primary" not in ids:
        raise ValueError("Primary tab must be retained")
    return result


def atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if len(json.dumps(data).encode("utf-8")) > MAX_BYTES:
        raise ValueError("Tab configuration exceeds storage limit")
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tabs-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


async def user_state(hass, user_id: str) -> dict:
    root = Path(hass.config.path(".energy_manager"))
    target = root / "dashboard_tabs" / f"{user_id}.json"
    if target.is_file():
        state = await asyncio.to_thread(read_json, target)
        state["tabs"] = validate_tabs(state["tabs"], migration=True)
        return state

    tabs = default_tabs()
    owner_path = root / "dashboard_tabs" / "migration_owner.json"
    legacy_path = root / "dashboard_layout.json"
    user = await hass.auth.async_get_user(user_id)
    if user and user.is_admin and not owner_path.exists() and legacy_path.exists():
        legacy = await asyncio.to_thread(read_json, legacy_path)
        tabs = validate_tabs(migrate_profiles(legacy), migration=True)
        state = {"version": 1, "revision": 0, "tabs": tabs}
        await asyncio.to_thread(atomic_write, target, state)
        await asyncio.to_thread(atomic_write, owner_path, {"user_id": user_id})
        return state
    state = {"version": 1, "revision": 0, "tabs": tabs}
    await asyncio.to_thread(atomic_write, target, state)
    return state


@websocket_api.websocket_command({vol.Required("type"): "em_dashboard_tabs/get"})
@websocket_api.async_response
async def ws_get_tabs(hass, connection, msg):
    try:
        async with hass.data["em_dashboard_layout"]["tabs_lock"]:
            state = await user_state(hass, connection.user.id)
        connection.send_result(msg["id"], state)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as err:
        connection.send_error(msg["id"], "read_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "em_dashboard_tabs/save",
    vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("tabs"): list,
})
@websocket_api.async_response
async def ws_save_tabs(hass, connection, msg):
    try:
        async with hass.data["em_dashboard_layout"]["tabs_lock"]:
            state = await user_state(hass, connection.user.id)
            if state["revision"] != msg["revision"]:
                connection.send_error(msg["id"], "conflict", "Tab configuration changed; reload and retry")
                return
            tabs = validate_tabs(msg["tabs"], migration=len(state["tabs"]) > MAX_TABS)
            if len(state["tabs"]) > MAX_TABS and len(tabs) > len(state["tabs"]):
                raise ValueError("Reduce tabs to eight before creating another")
            state = {"version": 1, "revision": state["revision"] + 1, "tabs": tabs}
            root = Path(hass.config.path(".energy_manager", "dashboard_tabs"))
            await asyncio.to_thread(atomic_write, root / f"{connection.user.id}.json", state)
        connection.send_result(msg["id"], state)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as err:
        connection.send_error(msg["id"], "save_failed", str(err))


def register_tabs(hass):
    hass.data["em_dashboard_layout"]["tabs_lock"] = asyncio.Lock()
    websocket_api.async_register_command(hass, ws_get_tabs)
    websocket_api.async_register_command(hass, ws_save_tabs)
