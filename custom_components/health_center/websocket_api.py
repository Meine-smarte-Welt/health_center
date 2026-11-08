# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 3225707ff020daf8794271ed113c9abdc507c0a2be1de2952d0f0b4aed752b9f
"""WebSocket-API für die Health-Center-Karte (Schreiben nur für Administratoren)."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import ACTIONS, DOMAIN
from .manager import HealthCenterManager


def _manager(hass: HomeAssistant) -> HealthCenterManager | None:
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    return entries[0].runtime_data if entries else None


def async_register_websocket(hass: HomeAssistant) -> None:
    """Befehle registrieren."""
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_action)
    websocket_api.async_register_command(hass, ws_details)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@websocket_api.async_response
async def ws_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Momentaufnahme senden und Änderungen laufend nachliefern."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded", "Health Center is not set up")
        return
    user = connection.user
    user_id, is_admin = user.id, bool(user.is_admin)

    @callback
    def _push() -> None:
        connection.send_message(
            websocket_api.event_message(
                msg["id"], {"type": "snapshot", "data": manager.snapshot(user_id, is_admin)}
            )
        )

    connection.subscriptions[msg["id"]] = manager.add_listener(_push)
    connection.send_result(msg["id"])
    _push()


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/action",
        vol.Required("action"): vol.In(ACTIONS),
        vol.Optional("profile"): vol.All(str, vol.Length(max=128)),
        vol.Optional("goal"): vol.All(str, vol.Length(max=64)),
        vol.Optional("value"): vol.Any(int, float),
        vol.Optional("device"): vol.All(str, vol.Length(max=128)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_action(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Schreibende Aktionen. Nur Administratoren."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded", "Health Center is not set up")
        return
    try:
        result = await manager.async_action(
            msg["action"],
            profile=msg.get("profile"),
            goal=msg.get("goal"),
            value=msg.get("value"),
            device=msg.get("device"),
        )
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/details",
        vol.Required("profile"): vol.All(str, vol.Length(max=128)),
        vol.Optional("metric"): vol.All(str, vol.Length(max=64)),
        vol.Optional("days", default=30): vol.All(int, vol.Range(min=1, max=365)),
    }
)
@websocket_api.async_response
async def ws_details(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Verlaufsdaten. Lesen ist für alle Benutzer erlaubt, aber nur für sichtbare Profile."""
    manager = _manager(hass)
    if manager is None:
        connection.send_error(msg["id"], "not_loaded", "Health Center is not set up")
        return
    profile = manager.profile(msg["profile"])
    user = connection.user
    if profile is None or not manager.visible(profile, user.id, bool(user.is_admin)):
        connection.send_error(msg["id"], "not_found", "Profile not available")
        return
    try:
        data = manager.details(profile.id, msg.get("metric"), msg["days"])
    except ValueError as err:
        connection.send_error(msg["id"], "invalid", str(err))
        return
    connection.send_result(msg["id"], data)
