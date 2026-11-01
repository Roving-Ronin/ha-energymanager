"""Shared Energy Manager dashboard layouts with server-side named profiles."""
from __future__ import annotations

import asyncio
import hashlib
import re
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
MAX_BYTES = 300_000
MAX_PROFILES = 20
PROFILE_DIRECTORY = Path(".energy_manager/layout_profiles")



def _default_state() -> dict:
    return {"version": 7, "revision": 0, "active_profile": "everyday",
            "profiles": {"everyday": {"name": "Everyday", "cards": {}}}}


def _load_bundled_profiles(path: Path, data: dict) -> tuple[dict, bool]:
    """Seed bundled JSON profiles once; never replace a user's edited profile.

    JSON files are read from /config/.energy_manager/layout_profiles/. A newly
    deployed file is introduced as a profile. Bundled IDs are stable filenames.
    """
    folder = path.parent / "layout_profiles"
    if not folder.is_dir():
        return data, False
    profiles = data["profiles"]
    seen = data.setdefault("bundled_profile_ids", [])
    if not isinstance(seen, list):
        raise ValueError("Invalid bundled profile tracking")
    changed = False
    added_v2 = False
    for f in sorted(folder.glob("*.json"), key=lambda f: (f.stem != "v2", f.name)):
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", f.stem):
            continue
        key = "bundled-" + f.stem
        if key in seen:
            continue
        if f.stat().st_size > MAX_BYTES:
            raise ValueError(f"Bundled profile too large: {f.name}")
        template = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(template, dict):
            raise ValueError(f"Invalid bundled profile: {f.name}")
        cards = template.get("cards")
        # Accept the existing Export Layout JSON format unchanged.
        if not isinstance(cards, dict):
            raise ValueError(f"No cards object in bundled profile: {f.name}")
        cards = _sanitize_cards(cards)
        name = template.get("name", f.stem)
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 50:
            raise ValueError(f"Invalid profile name in {f.name}")
        if len(profiles) >= MAX_PROFILES and key not in profiles:
            raise ValueError("Too many bundled profiles")
        # Avoid silently overwriting a user-created profile with a matching ID.
        if key not in profiles:
            profiles[key] = {"name": name.strip(), "cards": cards}
            changed = True
            if f.stem == "v2":
                added_v2 = True
        seen.append(key)
        changed = True
    if added_v2:
        data["active_profile"] = "bundled-v2"
    if changed:
        data["revision"] += 1
        _ensure_size(data)
    return data, changed


def _read(path: Path) -> dict:
    if not path.exists():
        data = _default_state()
    else:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("Invalid dashboard layout file")
        if isinstance(data.get("profiles"), dict):
            profiles = data["profiles"]
            active = data.get("active_profile")
            if not profiles or active not in profiles:
                raise ValueError("Invalid dashboard profile data")
            for profile in profiles.values():
                if not isinstance(profile, dict) or not isinstance(profile.get("name"), str) or not isinstance(profile.get("cards"), dict):
                    raise ValueError("Invalid dashboard profile")
        else:
            if not isinstance(data.get("cards"), dict):
                raise ValueError("Invalid legacy dashboard layout")
            data = {"version": 7, "revision": int(data.get("revision", 0)),
                    "active_profile": "everyday",
                    "profiles": {"everyday": {"name": "Everyday", "cards": data["cards"]}}}
    data, updated = _load_bundled_profiles(path, data)
    if updated:
        _write(path, data)
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


def _response(data: dict) -> dict:
    active = data["active_profile"]
    return {"version": 7, "revision": data["revision"],
            "active_profile": active,
            "profiles": [{"id": key, "name": p["name"]} for key, p in data["profiles"].items()],
            "cards": data["profiles"][active]["cards"]}


def _sanitize_cards(cards: dict) -> dict:
    if len(cards) > 500 or any(not isinstance(k, str) or len(k) > 120 or not isinstance(v, dict) for k, v in cards.items()):
        raise ValueError("Invalid card entries")
    clean = {}
    for key, value in cards.items():
        has_xy = "x" in value and "y" in value
        if has_xy:
            x, y, w, h = (value.get(k) for k in ("x", "y", "w", "h"))
            if any(type(n) is not int for n in (x, y, w, h)):
                raise ValueError(f"Invalid layout entry for {key}")
            if not (0 <= x <= 23 and 0 <= y <= 5000 and 1 <= w <= 24 and 1 <= h <= 80 and x + w <= 24):
                raise ValueError(f"Invalid layout entry for {key}")
            entry = {"x": x, "y": y, "w": w, "h": h}
        else:
            # Match previous server validation, retaining backwards compatibility.
            col, order, width = int(value.get("col", 0)), int(value.get("order", 0)), int(value.get("width", 4))
            old_height = value.get("height", "auto")
            if not (0 <= col <= 2 and 0 <= order <= 1000 and 1 <= width <= 12):
                raise ValueError(f"Invalid layout entry for {key}")
            if old_height != "auto" and (type(old_height) is not int or not 80 <= old_height <= 1200):
                raise ValueError(f"Invalid layout entry for {key}")
            entry = {"col": col, "order": order, "width": width, "height": old_height}
        if type(value.get("hidden", False)) is not bool:
            raise ValueError(f"Invalid layout entry for {key}")
        entry["hidden"] = value.get("hidden", False)
        devices = value.get("hidden_devices", [])
        if (not isinstance(devices, list) or
                any(not isinstance(d, str) or d not in ("desktop", "tablet", "mobile") for d in devices)):
            raise ValueError(f"Invalid device visibility for {key}")
        entry["hidden_devices"] = list(dict.fromkeys(devices))
        if type(value.get("locked", False)) is not bool:
            raise ValueError(f"Invalid lock state for {key}")
        entry["locked"] = value.get("locked", False)
        lock_device = value.get("lock_device")
        if lock_device is not None and lock_device not in ("desktop", "tablet", "mobile"):
            raise ValueError(f"Invalid lock device for {key}")
        entry["lock_device"] = lock_device
        clean[key] = entry
    return clean


def _ensure_size(data):
    if len(json.dumps(data).encode("utf-8")) > MAX_BYTES:
        raise ValueError("Dashboard profiles exceed the storage limit")


@websocket_api.websocket_command({vol.Required("type"): "em_dashboard_layout/get"})
@websocket_api.async_response
async def ws_get(hass, connection, msg):
    storage = hass.data[DOMAIN]
    try:
        async with storage["lock"]:
            data = await asyncio.to_thread(_read, storage["path"])
        connection.send_result(msg["id"], _response(data))
    except (ValueError, OSError, json.JSONDecodeError) as err:
        connection.send_error(msg["id"], "read_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "em_dashboard_layout/save",
    vol.Required("cards"): dict,
    vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    vol.Optional("profile_id"): str,
})
@websocket_api.async_response
async def ws_save(hass, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Administrator access required")
        return
    try:
        cards = _sanitize_cards(msg["cards"])
        storage = hass.data[DOMAIN]
        async with storage["lock"]:
            data = await asyncio.to_thread(_read, storage["path"])
            if data["revision"] != msg["revision"]:
                connection.send_error(msg["id"], "conflict", "Another device changed this layout. Reload and retry.")
                return
            if msg.get("profile_id", data["active_profile"]) != data["active_profile"]:
                connection.send_error(msg["id"], "conflict", "Active profile changed. Reload and retry.")
                return
            # Retain orphaned IDs from cards temporarily removed in newer YAML.
            # A card returning later can recover its previous position/visibility.
            previous = data["profiles"][data["active_profile"]]["cards"]
            previous.update(cards)
            data["profiles"][data["active_profile"]]["cards"] = previous
            data["revision"] += 1
            _ensure_size(data)
            await asyncio.to_thread(_write, storage["path"], data)
        connection.send_result(msg["id"], _response(data))
    except (ValueError, OSError, json.JSONDecodeError, TypeError) as err:
        connection.send_error(msg["id"], "save_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "em_dashboard_layout/profile",
    vol.Required("action"): vol.In(["create", "rename", "delete", "activate"]),
    vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    vol.Optional("profile_id"): str,
    vol.Optional("name"): str,
    vol.Optional("cards"): dict,
})
@websocket_api.async_response
async def ws_profile(hass, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Administrator access required")
        return
    storage = hass.data[DOMAIN]
    try:
        async with storage["lock"]:
            data = await asyncio.to_thread(_read, storage["path"])
            if data["revision"] != msg["revision"]:
                connection.send_error(msg["id"], "conflict", "Another device changed the dashboard. Reload and retry.")
                return
            action, pid = msg["action"], msg.get("profile_id", "")
            profiles = data["profiles"]
            if action == "create":
                name = msg.get("name", "").strip()
                if not 1 <= len(name) <= 50:
                    raise ValueError("Profile name must be 1–50 characters")
                if len(profiles) >= MAX_PROFILES:
                    raise ValueError("Maximum number of profiles reached")
                if any(p["name"].casefold() == name.casefold() for p in profiles.values()):
                    raise ValueError("Profile name already exists")
                # The UI supplies the current, fully resolved layout so YAML defaults
                # and unsaved overrides are faithfully copied into the new profile.
                cards = _sanitize_cards(msg.get("cards", profiles[data["active_profile"]]["cards"]))
                idx = 1
                while f"profile-{idx}" in profiles:
                    idx += 1
                pid = f"profile-{idx}"
                profiles[pid] = {"name": name, "cards": cards}
                data["active_profile"] = pid
            elif action == "rename":
                if pid not in profiles:
                    raise ValueError("Unknown profile")
                name = msg.get("name", "").strip()
                if not 1 <= len(name) <= 50:
                    raise ValueError("Profile name must be 1–50 characters")
                if any(k != pid and p["name"].casefold() == name.casefold() for k, p in profiles.items()):
                    raise ValueError("Profile name already exists")
                profiles[pid]["name"] = name
            elif action == "delete":
                if pid in data.get("bundled_profile_ids", []):
                    raise ValueError("Bundled profiles cannot be deleted from the dashboard")
                if pid not in profiles:
                    raise ValueError("Unknown profile")
                if len(profiles) == 1:
                    raise ValueError("Cannot delete the last profile")
                del profiles[pid]
                if data["active_profile"] == pid:
                    data["active_profile"] = next(iter(profiles))
            elif action == "activate":
                if pid not in profiles:
                    raise ValueError("Unknown profile")
                data["active_profile"] = pid
            data["revision"] += 1
            _ensure_size(data)
            await asyncio.to_thread(_write, storage["path"], data)
        connection.send_result(msg["id"], _response(data))
    except (ValueError, OSError, json.JSONDecodeError, TypeError) as err:
        connection.send_error(msg["id"], "profile_failed", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "em_dashboard_layout/sync",
    vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    vol.Required("specs"): list,
})
@websocket_api.async_response
async def ws_sync(hass, connection, msg):
    """Idempotently reconcile YAML card IDs against every saved named profile.

    New cards append to their configured column so existing customised positions
    never shift. Removed cards stay as dormant entries. Renames are explicitly
    opt-in through em_previous_ids / em_previous_id in card view_layout.
    """
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Administrator access required")
        return
    try:
        raw_specs = msg["specs"]
        if len(raw_specs) > 500:
            raise ValueError("Too many card specifications")
        specs, seen, claimed_aliases = [], set(), set()
        for raw in raw_specs:
            if not isinstance(raw, dict):
                raise ValueError("Invalid card specification")
            cid = raw.get("id")
            if not isinstance(cid, str) or not 1 <= len(cid) <= 120 or cid in seen:
                raise ValueError("Invalid or duplicate card ID")
            seen.add(cid)
            if any(type(raw.get(key)) is not int for key in ("col", "order", "width")):
                raise ValueError("Invalid default coordinates")
            if not (0 <= raw["col"] <= 2 and 0 <= raw["order"] <= 1000 and 1 <= raw["width"] <= 12):
                raise ValueError("Invalid default coordinates")
            if type(raw.get("hidden")) is not bool or type(raw.get("required")) is not bool:
                raise ValueError("Invalid default visibility")
            aliases = raw.get("aliases", [])
            if (not isinstance(aliases, list) or len(aliases) > 20 or
                    any(not isinstance(a, str) or not 1 <= len(a) <= 120 or a == cid for a in aliases)):
                raise ValueError("Invalid card rename aliases")
            for alias in aliases:
                if alias in claimed_aliases:
                    raise ValueError("Ambiguous card rename alias")
                claimed_aliases.add(alias)
            devices = raw.get("hidden_devices", [])
            if not isinstance(devices, list) or any(d not in ("desktop", "tablet", "mobile") for d in devices):
                raise ValueError("Invalid default device visibility")
            specs.append({"id": cid, "col": raw["col"], "order": raw["order"],
                          "width": raw["width"], "hidden": raw["hidden"],
                          "required": raw["required"], "locked": raw.get("locked", False), "aliases": aliases,
                          "hidden_devices": list(dict.fromkeys(devices))})
        if seen.intersection(claimed_aliases):
            raise ValueError("Rename aliases overlap active card IDs")
        storage = hass.data[DOMAIN]
        async with storage["lock"]:
            data = await asyncio.to_thread(_read, storage["path"])
            if data["revision"] != msg["revision"]:
                connection.send_error(msg["id"], "conflict", "Dashboard layout changed. Reload and retry.")
                return
            changed = False
            for profile in data["profiles"].values():
                cards = profile["cards"]
                # An untouched profile has no overrides: YAML already supplies all
                # defaults, so avoid writing a partially materialised layout.
                if not cards:
                    continue
                for spec in specs:
                    cid = spec["id"]
                    if cid in cards:
                        continue  # Existing saved settings always win over YAML defaults.
                    old_id = next((a for a in spec["aliases"] if a in cards), None)
                    if old_id:
                        cards[cid] = cards.pop(old_id)
                        # A renamed card keeps its saved position, width and visibility.
                        changed = True
                    else:
                        # Append new cards to avoid moving any existing custom positions.
                        last = max((int(c.get("order", -1)) for c in cards.values()
                                    if isinstance(c, dict) and c.get("col") == spec["col"]
                                    and isinstance(c.get("order"), int)), default=-1)
                        # There is no need to materialise every YAML default on first setup.
                        # Only add a newly appearing card once other saved cards exist.
                        if cards:
                            cards[cid] = {"col": spec["col"], "order": min(1000, last+1),
                                          "width": spec["width"],
                                          "hidden": spec["hidden"] and not spec["required"],
                                          "hidden_devices": [] if spec["required"] else spec["hidden_devices"], "locked": spec.get("locked", False)}
                            changed = True
            if changed:
                data["revision"] += 1
                _ensure_size(data)
                await asyncio.to_thread(_write, storage["path"], data)
        response = _response(data)
        response["migrated"] = changed
        connection.send_result(msg["id"], response)
    except (ValueError, OSError, json.JSONDecodeError, TypeError) as err:
        connection.send_error(msg["id"], "sync_failed", str(err))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    hass.data[DOMAIN] = {"path": Path(hass.config.path(".energy_manager", "dashboard_layout.json")),
                         "lock": asyncio.Lock()}
    websocket_api.async_register_command(hass, ws_get)
    websocket_api.async_register_command(hass, ws_save)
    websocket_api.async_register_command(hass, ws_profile)
    websocket_api.async_register_command(hass, ws_sync)
    return True
