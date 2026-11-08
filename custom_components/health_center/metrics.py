# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): ce26607927b680efafce003ff12cd5c2af46b8a278c1a607585d3fa887e925a9
"""Metrik-Registry und Einheitenumrechnung für Health Center.

Die Alias-Listen beschreiben, unter welchen Namen die Home-Assistant-Companion-App
(Android, iOS, Wear OS) die jeweiligen Werte meldet. Je weiter vorn ein Alias steht,
desto höher die Priorität. Die Namen stammen aus der Companion-Dokumentation;
nicht alle sind an echten Geräten geprüft (siehe EXPERIMENTELL.md).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Art der Auswertung
KIND_TOTAL_DAY = "total_day"  # Zähler seit Mitternacht (Schritte, Distanz ...)
KIND_LAST = "last"  # letzter Messwert (Puls, HRV ...)
KIND_SLEEP = "sleep"  # Wert der letzten Nacht
KIND_STATE = "state"  # Textzustand (Aktivität)
KIND_TIMESTAMP = "timestamp"  # Zeitstempel (Schlafbeginn/-ende)

CAT_ACTIVITY = "activity"
CAT_SLEEP = "sleep"
CAT_HEART = "heart"
CAT_BODY = "body"


@dataclass(frozen=True)
class MetricDef:
    """Beschreibung einer Gesundheitsmetrik."""

    key: str
    category: str
    kind: str
    dim: str  # Einheitengruppe für die Umrechnung
    unit: str  # Zieleinheit
    icon: str
    aliases: tuple[str, ...]
    decimals: int = 0
    goal: str | None = None  # Schlüssel in GOAL_KEYS
    experimental: str | None = None  # Schlüssel in EXPERIMENTAL_FEATURES
    reboot_aliases: tuple[str, ...] = field(default_factory=tuple)  # nur Android
    min_interval: int = 300  # Sekunden zwischen gespeicherten Messpunkten


def _m(**kw: Any) -> MetricDef:
    return MetricDef(**kw)


METRICS: dict[str, MetricDef] = {
    m.key: m
    for m in (
        # --- Aktivität -----------------------------------------------------
        _m(key="steps", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="count", unit="steps",
           icon="mdi:shoe-print", goal="steps", reboot_aliases=("steps",),
           aliases=("health_connect_daily_steps", "health_connect_steps", "health_steps",
                    "daily_steps", "steps")),
        _m(key="distance", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="distance", unit="km",
           icon="mdi:map-marker-distance", decimals=2,
           aliases=("health_connect_daily_distance", "health_connect_distance",
                    "walking_running_distance", "daily_distance", "distance")),
        _m(key="floors", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="count", unit="floors",
           icon="mdi:stairs-up", goal="floors",
           aliases=("health_connect_daily_floors", "health_connect_floors_climbed",
                    "flights_climbed", "daily_floors", "floors_ascended")),
        _m(key="elevation", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="length", unit="m",
           icon="mdi:elevation-rise",
           aliases=("health_connect_daily_elevation_gained", "health_connect_elevation_gained")),
        _m(key="active_energy", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="energy",
           unit="kcal", icon="mdi:fire", goal="active_energy",
           aliases=("health_connect_active_calories_burned", "active_energy")),
        _m(key="total_energy", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="energy",
           unit="kcal", icon="mdi:fire-circle",
           aliases=("health_connect_total_calories_burned", "daily_calories")),
        _m(key="exercise_minutes", category=CAT_ACTIVITY, kind=KIND_TOTAL_DAY, dim="time",
           unit="min", icon="mdi:timer-outline", goal="exercise_minutes",
           aliases=("health_connect_exercise_duration", "exercise_time")),
        _m(key="pace", category=CAT_ACTIVITY, kind=KIND_LAST, dim="pace", unit="min/km",
           icon="mdi:speedometer", decimals=2, aliases=("average_active_pace",)),
        _m(key="activity_state", category=CAT_ACTIVITY, kind=KIND_STATE, dim="text", unit="",
           icon="mdi:run", aliases=("detected_activity", "activity_state", "activity")),
        # --- Schlaf ----------------------------------------------------------
        _m(key="sleep_duration", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:sleep", goal="sleep_duration",
           aliases=("health_connect_sleep_duration", "sleep_duration")),
        _m(key="sleep_start", category=CAT_SLEEP, kind=KIND_TIMESTAMP, dim="timestamp", unit="",
           icon="mdi:bed-clock", aliases=("health_connect_sleep_start",)),
        _m(key="sleep_end", category=CAT_SLEEP, kind=KIND_TIMESTAMP, dim="timestamp", unit="",
           icon="mdi:alarm", aliases=("health_connect_sleep_end",)),
        _m(key="sleep_deep", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:sleep", aliases=("health_connect_sleep_deep_duration",
                                      "health_connect_sleep_deep", "deep_sleep")),
        _m(key="sleep_light", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:sleep", aliases=("health_connect_sleep_light_duration",
                                      "health_connect_sleep_light", "core_sleep")),
        _m(key="sleep_rem", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:eye-outline", aliases=("health_connect_sleep_rem_duration",
                                            "health_connect_sleep_rem", "rem_sleep")),
        _m(key="sleep_awake", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:alarm-light-outline", aliases=("health_connect_sleep_awake_duration",
                                                    "health_connect_sleep_awake", "awake")),
        _m(key="in_bed", category=CAT_SLEEP, kind=KIND_SLEEP, dim="time", unit="min",
           icon="mdi:bed", aliases=("in_bed",)),
        # --- Herz --------------------------------------------------------------
        _m(key="heart_rate", category=CAT_HEART, kind=KIND_LAST, dim="bpm", unit="bpm",
           icon="mdi:heart-pulse", min_interval=60,
           aliases=("health_connect_heart_rate", "heart_rate")),
        _m(key="resting_hr", category=CAT_HEART, kind=KIND_LAST, dim="bpm", unit="bpm",
           icon="mdi:heart-outline",
           aliases=("health_connect_resting_heart_rate", "resting_heart_rate")),
        _m(key="hrv", category=CAT_HEART, kind=KIND_LAST, dim="ms", unit="ms",
           icon="mdi:heart-flash",
           aliases=("health_connect_heart_rate_variability", "heart_rate_variability")),
        _m(key="walking_hr", category=CAT_HEART, kind=KIND_LAST, dim="bpm", unit="bpm",
           icon="mdi:walk", aliases=("walking_heart_rate_average",)),
        _m(key="vo2_max", category=CAT_HEART, kind=KIND_LAST, dim="vo2", unit="ml/min/kg",
           icon="mdi:lungs", decimals=1, aliases=("health_connect_vo2_max", "vo2_max")),
        # --- Körper (experimentell: extended_metrics; Namen ungeprüft) ----------
        _m(key="weight", category=CAT_BODY, kind=KIND_LAST, dim="mass", unit="kg",
           icon="mdi:scale-bathroom", decimals=1, experimental="extended_metrics",
           aliases=("health_connect_weight", "body_mass", "weight")),
        _m(key="spo2", category=CAT_BODY, kind=KIND_LAST, dim="pct", unit="%",
           icon="mdi:water-percent", experimental="extended_metrics",
           aliases=("health_connect_oxygen_saturation", "oxygen_saturation",
                    "blood_oxygen", "spo2")),
        _m(key="bp_systolic", category=CAT_BODY, kind=KIND_LAST, dim="pressure", unit="mmHg",
           icon="mdi:heart-flash", experimental="extended_metrics",
           aliases=("health_connect_blood_pressure_systolic", "blood_pressure_systolic",
                    "systolic_blood_pressure")),
        _m(key="bp_diastolic", category=CAT_BODY, kind=KIND_LAST, dim="pressure", unit="mmHg",
           icon="mdi:heart-flash", experimental="extended_metrics",
           aliases=("health_connect_blood_pressure_diastolic", "blood_pressure_diastolic",
                    "diastolic_blood_pressure")),
        _m(key="respiratory_rate", category=CAT_BODY, kind=KIND_LAST, dim="rate", unit="/min",
           icon="mdi:lungs", decimals=1, experimental="extended_metrics",
           aliases=("health_connect_respiratory_rate", "respiratory_rate")),
        _m(key="body_temp", category=CAT_BODY, kind=KIND_LAST, dim="temp", unit="°C",
           icon="mdi:thermometer", decimals=1, experimental="extended_metrics",
           aliases=("health_connect_body_temperature", "body_temperature")),
        _m(key="body_fat", category=CAT_BODY, kind=KIND_LAST, dim="pct", unit="%",
           icon="mdi:human", decimals=1, experimental="extended_metrics",
           aliases=("health_connect_body_fat", "body_fat_percentage")),
    )
}

# --- Einheiten ------------------------------------------------------------------
_TO_KM = {"m": 0.001, "km": 1.0, "mi": 1.609344, "ft": 0.0003048, "yd": 0.0009144, "cm": 0.00001}
_TO_M = {"m": 1.0, "cm": 0.01, "km": 1000.0, "ft": 0.3048, "in": 0.0254, "mi": 1609.344}
_TO_KCAL = {"kcal": 1.0, "cal": 0.001, "kj": 1 / 4.184, "j": 1 / 4184.0}
_TO_MIN = {"min": 1.0, "h": 60.0, "s": 1 / 60.0, "ms": 1 / 60000.0, "d": 1440.0}
_TO_KG = {"kg": 1.0, "g": 0.001, "lb": 0.45359237, "lbs": 0.45359237, "oz": 0.0283495, "st": 6.35029}
_TO_MMHG = {"mmhg": 1.0, "kpa": 7.50062, "hpa": 0.750062}


def convert_value(metric: MetricDef, value: float, unit: str | None) -> float:
    """Wert in die Zieleinheit der Metrik umrechnen. Unbekannte Einheit = unverändert."""
    u = (unit or "").strip().lower().replace(" ", "")
    dim = metric.dim
    try:
        if dim == "distance":
            return value * _TO_KM.get(u, 1.0 if u in ("", "km") else 1.0)
        if dim == "length":
            return value * _TO_M.get(u, 1.0)
        if dim == "energy":
            return value * _TO_KCAL.get(u, 1.0)
        if dim == "time":
            return value * _TO_MIN.get(u, 1.0)
        if dim == "mass":
            return value * _TO_KG.get(u, 1.0)
        if dim == "pressure":
            return value * _TO_MMHG.get(u, 1.0)
        if dim == "temp":
            if u in ("°f", "f"):
                return (value - 32.0) * 5.0 / 9.0
            return value
        if dim == "pace":
            # Ziel: min/km. Eingaben: m/s (iOS), s/m, min/km
            if u in ("m/s",):
                return 1000.0 / (value * 60.0) if value > 0 else 0.0
            if u in ("s/m",):
                return value * 1000.0 / 60.0
            return value
    except (TypeError, ZeroDivisionError):
        return value
    return value


def metric_for_feature(feature_active: set[str], metric: MetricDef) -> bool:
    """True, wenn die Metrik angezeigt werden darf (experimentelle nur bei aktiver Funktion)."""
    return metric.experimental is None or metric.experimental in feature_active


def platform_hint(metric: MetricDef) -> dict[str, str]:
    """Technischer Name je Plattform, den der Nutzer in der Companion-App aktiviert."""
    hint: dict[str, str] = {}
    for alias in metric.aliases:
        if alias.startswith("health_connect_") and "android" not in hint:
            hint["android"] = alias
        elif not alias.startswith("health_connect_") and alias not in ("steps", "distance", "activity", "weight", "awake", "heart_rate"):
            hint.setdefault("ios", alias)
    if metric.key == "steps":
        hint["ios"] = "health_steps"
    if metric.key == "distance":
        hint["ios"] = "walking_running_distance"
    if metric.key == "heart_rate":
        hint["ios"] = "heart_rate"
    if metric.key == "activity_state":
        hint["ios"] = "activity"
    return hint
