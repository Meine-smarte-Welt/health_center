# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): a0e1974e3cc29931b44236cfd7c2db9e02a4de34af18ba04aed3d5c0ccad61cc
"""Health Center – Gesundheitsdaten der Home-Assistant-Companion-App als Dashboard-Karte."""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, Unauthorized
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    ACTION_ASSIGN_DEVICE,
    ACTION_RESCAN,
    ACTION_SET_GOAL,
    CARD_FILE,
    CARD_URL_BASE,
    DOMAIN,
    GOAL_KEYS,
    VERSION,
)
from .manager import HealthCenterManager
from .websocket_api import async_register_websocket

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]

type HealthCenterConfigEntry = ConfigEntry[HealthCenterManager]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Statischen Pfad für die Karte, WebSocket-Befehle und Services einmalig anmelden."""
    from homeassistant.components.http import StaticPathConfig

    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL_BASE, str(www), False)])
    async_register_websocket(hass)
    _async_register_services(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HealthCenterConfigEntry) -> bool:
    """Integration einrichten."""
    manager = HealthCenterManager(hass, entry)
    await manager.async_setup()
    entry.runtime_data = manager
    await _async_register_resource(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: HealthCenterConfigEntry) -> bool:
    """Integration entladen."""
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        await entry.runtime_data.async_unload()
    return ok


async def _async_options_updated(hass: HomeAssistant, entry: HealthCenterConfigEntry) -> None:
    """Optionen geändert: ohne Neuladen übernehmen."""
    await entry.runtime_data.async_options_updated()


async def _async_register_resource(hass: HomeAssistant) -> None:
    """Karte als Lovelace-Ressource eintragen (nur im Speichermodus; im YAML-Modus manuell)."""
    try:
        from homeassistant.components.lovelace.const import LOVELACE_DATA
    except ImportError:
        return
    data = hass.data.get(LOVELACE_DATA)
    resources = getattr(data, "resources", None)
    if resources is None or not hasattr(resources, "async_create_item"):
        return
    url = f"{CARD_URL_BASE}/{CARD_FILE}?v={VERSION}"
    try:
        if not getattr(resources, "loaded", True):
            await resources.async_load()
        base = f"{CARD_URL_BASE}/{CARD_FILE}"
        existing = [r for r in resources.async_items() if str(r.get("url", "")).split("?")[0] == base]
        if not existing:
            await resources.async_create_item({"res_type": "module", "url": url})
        elif existing[0].get("url") != url:
            await resources.async_update_item(existing[0]["id"], {"res_type": "module", "url": url})
    except Exception as err:  # noqa: BLE001 - die Karte lässt sich auch manuell eintragen
        _LOGGER.warning("Lovelace-Ressource konnte nicht eingetragen werden: %s", type(err).__name__)


# --- Services -------------------------------------------------------------------------


def _manager(hass: HomeAssistant) -> HealthCenterManager:
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        raise HomeAssistantError("Health Center is not set up")
    return entries[0].runtime_data


async def _require_admin(hass: HomeAssistant, call: ServiceCall) -> None:
    uid = call.context.user_id
    if uid is None:
        return  # Automationen und Skripte
    user = await hass.auth.async_get_user(uid)
    if user is None or not user.is_admin:
        raise Unauthorized(context=call.context)


def _async_register_services(hass: HomeAssistant) -> None:
    async def rescan(call: ServiceCall) -> None:
        await _require_admin(hass, call)
        await _manager(hass).async_action(ACTION_RESCAN)

    async def set_goal(call: ServiceCall) -> None:
        await _require_admin(hass, call)
        manager = _manager(hass)
        profile = manager.find_profile(call.data["profile"])
        if profile is None:
            raise HomeAssistantError("Profile not found")
        try:
            await manager.async_action(
                ACTION_SET_GOAL, profile=profile.id, goal=call.data["goal"], value=call.data["value"]
            )
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err

    async def assign_device(call: ServiceCall) -> None:
        await _require_admin(hass, call)
        manager = _manager(hass)
        try:
            await manager.async_action(
                ACTION_ASSIGN_DEVICE, device=call.data["device"], profile=call.data.get("profile", "")
            )
        except ValueError as err:
            raise HomeAssistantError(str(err)) from err

    optional_entry = {vol.Optional("entry_id"): cv.string}
    hass.services.async_register(DOMAIN, "rescan", rescan, vol.Schema({**optional_entry}))
    hass.services.async_register(
        DOMAIN,
        "set_goal",
        set_goal,
        vol.Schema(
            {
                **optional_entry,
                vol.Required("profile"): cv.string,
                vol.Required("goal"): vol.In(GOAL_KEYS),
                vol.Required("value"): vol.All(vol.Coerce(float), vol.Range(min=1, max=1_000_000)),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        "assign_device",
        assign_device,
        vol.Schema(
            {
                **optional_entry,
                vol.Required("device"): cv.string,
                vol.Optional("profile", default=""): cv.string,
            }
        ),
    )
