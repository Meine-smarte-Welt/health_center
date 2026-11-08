# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 42f0dfe44f4d336eb7f082f20d3433812bd2ec096aff0c1470a5998aa4ca6125
"""Anonymisierter Diagnose-Download."""
from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    OPT_EVENTS,
    OPT_EXPERIMENTAL,
    OPT_EXPERIMENTAL_FEATURES,
    OPT_GOAL_EXERCISE,
    OPT_GOAL_SLEEP_HOURS,
    OPT_GOAL_STEPS,
    OPT_HISTORY_DAYS,
    OPT_SHOW_ALL,
)

_SAFE_OPTIONS = (
    OPT_EVENTS,
    OPT_EXPERIMENTAL,
    OPT_EXPERIMENTAL_FEATURES,
    OPT_GOAL_EXERCISE,
    OPT_GOAL_SLEEP_HOURS,
    OPT_GOAL_STEPS,
    OPT_HISTORY_DAYS,
    OPT_SHOW_ALL,
)


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    """Nur Kennzahlen: keine Namen, Entitäts-IDs, Zuordnungen oder Gesundheitswerte."""
    return {
        "options": {k: entry.options[k] for k in _SAFE_OPTIONS if k in entry.options},
        "state": entry.runtime_data.diagnostics(),
    }
