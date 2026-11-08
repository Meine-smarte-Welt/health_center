# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 2372c781db17758dfc9b027685c2e57471239774b84ffb05a7fecacb6cc8676b
"""Erkennung der Gesundheitssensoren der Home-Assistant-Companion-App."""
from __future__ import annotations

import re
from dataclasses import dataclass

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .metrics import METRICS

MOBILE_APP = "mobile_app"
_HEX_PREFIX = re.compile(r"^[0-9a-f]{32}[_-]")
_DUP_SUFFIX = re.compile(r"_\d+$")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class Match:
    """Treffer einer Entität auf eine Metrik."""

    metric: str
    alias: str
    rank: int  # Position des Alias in der Prioritätsliste (0 = beste)


def normalize(text: str | None) -> str:
    """Text auf Kleinbuchstaben und Unterstriche normalisieren."""
    if not text:
        return ""
    t = _NON_ALNUM.sub("_", str(text).lower()).strip("_")
    return t


def candidates(unique_id: str | None, entity_id: str, name: str | None) -> list[str]:
    """Namensvarianten einer Entität, gegen die Aliase geprüft werden."""
    out: list[str] = []
    uid = (unique_id or "").lower()
    uid = _HEX_PREFIX.sub("", uid)
    for raw in (uid, entity_id.split(".", 1)[-1], name):
        norm = normalize(raw)
        if not norm:
            continue
        for variant in (norm, _DUP_SUFFIX.sub("", norm)):
            if variant and variant not in out:
                out.append(variant)
    return out


def match_entity(
    unique_id: str | None, entity_id: str, name: str | None
) -> Match | None:
    """Die passendste Metrik zu einer Entität bestimmen.

    Es gewinnt der längste passende Alias (so schlägt `resting_heart_rate`
    den kürzeren Alias `heart_rate`). Bei Gleichstand zählt die Reihenfolge der Metriken.
    """
    best: tuple[int, Match] | None = None
    for cand in candidates(unique_id, entity_id, name):
        for metric in METRICS.values():
            for rank, alias in enumerate(metric.aliases):
                if cand == alias or cand.endswith("_" + alias):
                    if best is None or len(alias) > best[0]:
                        best = (len(alias), Match(metric.key, alias, rank))
    return best[1] if best else None


@dataclass
class DetectedSensor:
    """Ein erkannter Companion-Sensor."""

    entity_id: str
    unique_id: str
    metric: str
    alias: str
    rank: int
    app_entry: str  # Config-Entry-ID der mobile_app
    platform: str  # "android" | "ios" | ""
    disabled: bool
    reboot_counter: bool  # Zähler seit Neustart (Android-Schrittzähler)


def scan_registry(hass: HomeAssistant, platforms: dict[str, str]) -> list[DetectedSensor]:
    """Alle Entitäten der mobile_app prüfen und Gesundheitssensoren herausfiltern.

    `platforms` ordnet der Config-Entry-ID der mobile_app die Plattform zu.
    """
    registry = er.async_get(hass)
    found: list[DetectedSensor] = []
    for entry in registry.entities.values():
        if entry.platform != MOBILE_APP or entry.domain != "sensor":
            continue
        if entry.config_entry_id not in platforms:
            continue
        name = entry.original_name or entry.name
        state = hass.states.get(entry.entity_id)
        if not name and state is not None:
            name = state.name
        match = match_entity(entry.unique_id, entry.entity_id, str(name) if name else None)
        if match is None:
            continue
        metric = METRICS[match.metric]
        platform = platforms[entry.config_entry_id]
        found.append(
            DetectedSensor(
                entity_id=entry.entity_id,
                unique_id=entry.unique_id or "",
                metric=match.metric,
                alias=match.alias,
                rank=match.rank,
                app_entry=entry.config_entry_id,
                platform=platform,
                disabled=entry.disabled_by is not None,
                reboot_counter=(platform == "android" and match.alias in metric.reboot_aliases),
            )
        )
    return found
