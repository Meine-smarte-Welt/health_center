# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 61c98f67dbad0fb521114c4b1c06b8116455e4ead6aa63286cd52c3be5cc6664
"""Einfache Auswertungen (experimentell): Schlafwert, Trend-Hinweise, Profilvergleich.

Alle Werte sind Richtwerte aus statistischen Vergleichen und keine medizinische Bewertung.
"""
from __future__ import annotations

from statistics import mean
from typing import Any


def sleep_score(
    duration: float | None,
    goal_min: float,
    deep: float | None = None,
    rem: float | None = None,
    awake: float | None = None,
) -> dict[str, Any] | None:
    """Schlafwert 0..100 aus Dauer, erholsamen Phasen und Wachzeit.

    Dauer zählt bis zu 50 Punkte, erholsame Phasen (Tief + REM, Ziel ab 35 %)
    bis zu 30 Punkte, geringe Wachzeit (unter 15 %) bis zu 20 Punkte.
    Fehlen Phasen, wird nur die Dauer bewertet und auf 100 skaliert.
    """
    if not duration or duration <= 0 or goal_min <= 0:
        return None
    ratio = duration / goal_min
    if ratio <= 1.2:
        dur_pts = 50.0 * min(ratio, 1.0)
    else:
        dur_pts = 50.0 * max(0.7, 1.0 - (ratio - 1.2) * 0.5)
    parts: dict[str, float] = {"duration": dur_pts}
    maximum = 50.0
    if deep is not None or rem is not None:
        restorative = ((deep or 0) + (rem or 0)) / duration
        parts["restorative"] = 30.0 * min(restorative / 0.35, 1.0)
        maximum += 30.0
    if awake is not None:
        share = awake / duration
        parts["awake"] = 20.0 * (1.0 - min(share / 0.15, 1.0))
        maximum += 20.0
    score = round(sum(parts.values()) / maximum * 100.0)
    return {"score": int(max(0, min(100, score))), "parts": {k: round(v, 1) for k, v in parts.items()}}


def _vals(series: list[float | None]) -> list[float]:
    return [v for v in series if v is not None]


def trend_hints(daily: dict[str, list[float | None]], goals: dict[str, float]) -> list[dict[str, Any]]:
    """Auffälligkeiten aus dem Vergleich der letzten 7 Tage mit den 21 Tagen davor.

    `daily` enthält je Metrik die Tageswerte, ältester zuerst, letzter Eintrag = heute.
    Ein Hinweis entsteht nur mit genug Daten (mind. 5 Werte aktuell, 10 Werte Basis).
    """
    hints: list[dict[str, Any]] = []
    rules = (
        # metric, direction, threshold in Prozent, severity
        ("resting_hr", "up", 5.0, "warning"),
        ("hrv", "down", 15.0, "warning"),
        ("sleep_duration", "down", 10.0, "info"),
        ("steps", "down", 20.0, "info"),
        ("steps", "up", 20.0, "info"),
        ("exercise_minutes", "down", 25.0, "info"),
    )
    for metric, direction, threshold, severity in rules:
        series = daily.get(metric) or []
        if len(series) < 14:
            continue
        recent = _vals(series[-7:])
        base = _vals(series[-28:-7])
        if len(recent) < 5 or len(base) < 10:
            continue
        base_avg = mean(base)
        if base_avg <= 0:
            continue
        delta = (mean(recent) - base_avg) / base_avg * 100.0
        if direction == "up" and delta >= threshold:
            hints.append({"metric": metric, "kind": "up", "delta": round(delta, 1), "severity": severity})
        elif direction == "down" and -delta >= threshold:
            hints.append({"metric": metric, "kind": "down", "delta": round(delta, 1), "severity": severity})
    sleep = _vals((daily.get("sleep_duration") or [])[-7:])
    goal = goals.get("sleep_duration")
    if goal and len(sleep) >= 5 and mean(sleep) < goal * 0.85:
        hints.append({
            "metric": "sleep_duration",
            "kind": "below_goal",
            "delta": round((mean(sleep) - goal) / goal * 100.0, 1),
            "severity": "info",
        })
    return hints


def compare_profiles(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Profile nach durchschnittlichen Schritten der letzten 7 Tage sortieren."""
    return sorted(rows, key=lambda r: r.get("steps_avg") or 0, reverse=True)
