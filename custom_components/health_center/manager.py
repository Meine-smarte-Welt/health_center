# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): f9cf0a4c43476f9df14c7db90fbd86b32abfe17fff78aa9a63c2057bd0b2a146
"""Zentrale Datenhaltung von Health Center: Erkennung, Profile, Verlauf, Auswertung."""
from __future__ import annotations

import logging
import math
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import partial
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, State, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import analysis
from .const import (
    ACTION_ASSIGN_DEVICE,
    ACTION_CHECK_UPDATE,
    ACTION_RESCAN,
    ACTION_SET_GOAL,
    DEFAULT_GOAL_ENERGY,
    DEFAULT_GOAL_EXERCISE,
    DEFAULT_GOAL_FLOORS,
    DEFAULT_GOAL_SLEEP_HOURS,
    DEFAULT_GOAL_STEPS,
    DEFAULT_HISTORY_DAYS,
    EVENT_GOAL_REACHED,
    EVENT_LOG_SIZE,
    EVENT_PROFILE_ADDED,
    EVENT_SENSOR_DETECTED,
    EVENT_SENSOR_LOST,
    EXPERIMENTAL_FEATURES,
    FLUSH_DELAY,
    GOAL_KEYS,
    KEEP_DAYS,
    NAME,
    OPT_ASSIGN,
    OPT_EVENTS,
    OPT_EXPERIMENTAL,
    OPT_EXPERIMENTAL_FEATURES,
    OPT_GOAL_EXERCISE,
    OPT_GOAL_SLEEP_HOURS,
    OPT_GOAL_STEPS,
    OPT_HISTORY_DAYS,
    OPT_PROFILE_GOALS,
    OPT_SHOW_ALL,
    STORE_KEY,
    STORE_SAVE_DELAY,
    STORE_VERSION,
    UPDATE_CHECK_INTERVAL_HOURS,
    VERSION,
)
from .detector import DetectedSensor, scan_registry
from .metrics import (
    KIND_LAST,
    KIND_SLEEP,
    KIND_STATE,
    KIND_TIMESTAMP,
    KIND_TOTAL_DAY,
    METRICS,
    MetricDef,
    convert_value,
    platform_hint,
)
from .update_check import UpdateChecker

_LOGGER = logging.getLogger(__name__)

_INVALID = ("unknown", "unavailable", "none", "")
_STAGE_INT = {1: "awake", 2: "light", 3: "awake", 4: "light", 5: "deep", 6: "rem", 7: "awake"}
_SAMPLE_CAP = 720
IDX_MIN, IDX_MAX, IDX_SUM, IDX_N, IDX_LAST = range(5)


@dataclass
class App:
    """Ein Gerät mit installierter Companion-App."""

    entry_id: str
    name: str
    platform: str
    model: str
    manufacturer: str
    os_version: str
    user_id: str | None
    profile_id: str | None  # None = ignoriert
    assigned: str  # "" = automatisch, "ignore" oder person-Entity


@dataclass
class Profile:
    """Ein Benutzerprofil."""

    id: str
    name: str
    picture: str | None
    person: str | None
    user_id: str | None


def _platform_of(os_name: str | None) -> str:
    n = (os_name or "").lower()
    if n.startswith("ios") or n.startswith("ipados") or "watchos" in n:
        return "ios"
    if "android" in n or "wear" in n:
        return "android"
    return ""


def _coerce_ts(value: Any) -> datetime | None:
    """Zeitangabe aus Recorder-Daten (State, ISO-Text, Sekunden) in datetime umwandeln."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return dt_util.utc_from_timestamp(float(value))
    if isinstance(value, str):
        return dt_util.parse_datetime(value)
    return None


def _valid_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def day_value(metric: MetricDef, rec: list[float] | None) -> float | None:
    """Tageswert einer Metrik aus dem Tagesdatensatz."""
    if not rec:
        return None
    if metric.kind == KIND_TOTAL_DAY:
        return rec[IDX_MAX]
    if metric.kind == KIND_SLEEP:
        return rec[IDX_LAST]
    if rec[IDX_N]:
        return rec[IDX_SUM] / rec[IDX_N]
    return None


class HealthCenterManager:
    """Hält Geräte, Profile, Messwerte und Verlauf."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.updates = UpdateChecker(hass)
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self._daily: dict[str, dict[str, dict[str, list[float]]]] = {}
        self._samples: dict[tuple[str, str], deque[tuple[float, float]]] = defaultdict(
            lambda: deque(maxlen=_SAMPLE_CAP)
        )
        self._apps: dict[str, App] = {}
        self._profiles: dict[str, Profile] = {}
        self._sensors: dict[str, DetectedSensor] = {}
        self._by_pm: dict[tuple[str, str], list[DetectedSensor]] = {}
        self._goal_hit: set[tuple[str, str, str]] = set()
        self._events: deque[dict[str, Any]] = deque(maxlen=EVENT_LOG_SIZE)
        self._listeners: list[Callable[[], None]] = []
        self._profile_listeners: list[Callable[[], None]] = []
        self._unsubs: list[CALLBACK_TYPE] = []
        self._state_unsub: CALLBACK_TYPE | None = None
        self._flush_unsub: CALLBACK_TYPE | None = None
        self._rescan_unsub: CALLBACK_TYPE | None = None
        self._ready = False
        self.event_counts: dict[str, int] = defaultdict(int)

    # ------------------------------------------------------------------ Optionen
    @property
    def options(self) -> dict[str, Any]:
        return dict(self.entry.options)

    def active_features(self) -> set[str]:
        """Aktive experimentelle Funktionen (Hauptschalter UND Einzelschalter)."""
        if not self.options.get(OPT_EXPERIMENTAL, False):
            return set()
        chosen = self.options.get(OPT_EXPERIMENTAL_FEATURES, []) or []
        return {k for k in chosen if k in EXPERIMENTAL_FEATURES}

    def goal(self, profile_id: str, key: str) -> float | None:
        """Ziel eines Profils (eigener Wert vor Standardwert)."""
        own = (self.options.get(OPT_PROFILE_GOALS, {}) or {}).get(profile_id, {})
        if key in own and _valid_number(own[key]):
            return float(own[key])
        opts = self.options
        defaults = {
            "steps": float(opts.get(OPT_GOAL_STEPS, DEFAULT_GOAL_STEPS)),
            "floors": float(DEFAULT_GOAL_FLOORS),
            "active_energy": float(DEFAULT_GOAL_ENERGY),
            "exercise_minutes": float(opts.get(OPT_GOAL_EXERCISE, DEFAULT_GOAL_EXERCISE)),
            "sleep_duration": float(opts.get(OPT_GOAL_SLEEP_HOURS, DEFAULT_GOAL_SLEEP_HOURS)) * 60.0,
        }
        return defaults.get(key)

    # ------------------------------------------------------------------ Lebenszyklus
    async def async_setup(self) -> None:
        """Daten laden, Sensoren erkennen und Beobachter starten."""
        loaded = await self._store.async_load() or {}
        self._daily = loaded.get("daily", {}) if isinstance(loaded, dict) else {}
        self._prune()
        await self._async_scan(initial=True)
        self._unsubs.append(
            self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._on_registry_event)
        )
        self._unsubs.append(
            async_track_time_interval(self.hass, self._on_tick, timedelta(minutes=1))
        )
        self._unsubs.append(
            async_track_time_interval(
                self.hass, self._on_update_tick, timedelta(hours=UPDATE_CHECK_INTERVAL_HOURS)
            )
        )
        self._ready = True
        self.hass.async_create_background_task(self._async_late_start(), f"{NAME} Start")

    async def _async_late_start(self) -> None:
        await self.updates.async_check()
        self._notify()
        await self._async_backfill()
        self._notify()

    async def async_unload(self) -> None:
        """Beobachter beenden und Daten sichern."""
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for attr in ("_state_unsub", "_flush_unsub", "_rescan_unsub"):
            unsub = getattr(self, attr)
            if unsub:
                unsub()
                setattr(self, attr, None)
        await self._store.async_save(self._store_data())

    def _store_data(self) -> dict[str, Any]:
        return {"daily": self._daily}

    def _prune(self) -> None:
        cutoff = (dt_util.now().date() - timedelta(days=KEEP_DAYS)).isoformat()
        for metrics in self._daily.values():
            for days in metrics.values():
                for day in [d for d in days if d < cutoff]:
                    del days[day]

    # ------------------------------------------------------------------ Listener
    def add_listener(self, cb: Callable[[], None]) -> CALLBACK_TYPE:
        self._listeners.append(cb)

        def _remove() -> None:
            if cb in self._listeners:
                self._listeners.remove(cb)

        return _remove

    def add_profile_listener(self, cb: Callable[[], None]) -> CALLBACK_TYPE:
        self._profile_listeners.append(cb)

        def _remove() -> None:
            if cb in self._profile_listeners:
                self._profile_listeners.remove(cb)

        return _remove

    @callback
    def _notify(self) -> None:
        """Änderungen gebündelt an alle Abonnenten melden."""
        if self._flush_unsub is not None:
            return

        @callback
        def _flush(_now: datetime) -> None:
            self._flush_unsub = None
            for cb in list(self._listeners):
                try:
                    cb()
                except Exception:  # noqa: BLE001
                    _LOGGER.exception("Fehler in Health-Center-Listener")

        self._flush_unsub = async_call_later(self.hass, FLUSH_DELAY, _flush)

    # ------------------------------------------------------------------ Erkennung
    async def async_rescan(self) -> None:
        await self._async_scan(initial=False)
        self._notify()

    async def async_options_updated(self) -> None:
        """Optionen wurden geändert (Zuordnung, Ziele, Experimentell)."""
        await self._async_scan(initial=False)
        self._notify()

    @callback
    def _on_registry_event(self, event: Event) -> None:
        entity_id = str(event.data.get("entity_id", ""))
        if not entity_id:
            return
        reg = er.async_get(self.hass).async_get(entity_id)
        relevant = entity_id.startswith("person.") or (
            reg is not None and reg.platform == "mobile_app"
        )
        if not relevant or self._rescan_unsub is not None:
            return

        async def _run(_now: datetime) -> None:
            self._rescan_unsub = None
            await self.async_rescan()

        self._rescan_unsub = async_call_later(self.hass, 5, _run)

    def _persons(self) -> list[State]:
        return list(self.hass.states.async_all("person"))

    async def _async_resolve_apps(self) -> dict[str, tuple[App, Profile | None]]:
        """Companion-Geräte erfassen und Profilen zuordnen."""
        persons = self._persons()
        by_user = {
            p.attributes.get("user_id"): p for p in persons if p.attributes.get("user_id")
        }
        registry = er.async_get(self.hass)
        assigns: dict[str, str] = dict(self.options.get(OPT_ASSIGN, {}) or {})
        result: dict[str, tuple[App, Profile | None]] = {}
        for cfg in self.hass.config_entries.async_entries("mobile_app"):
            data = cfg.data
            user_id = data.get("user_id")
            assigned = str(assigns.get(cfg.entry_id, "") or "")
            app_name = str(data.get("device_name") or cfg.title or "Gerät")
            profile: Profile | None
            if assigned == "ignore":
                profile = None
            elif assigned.startswith("person.") and self.hass.states.get(assigned):
                profile = self._profile_from_person(self.hass.states.get(assigned))  # type: ignore[arg-type]
            else:
                profile = None
                if user_id and user_id in by_user:
                    profile = self._profile_from_person(by_user[user_id])
                if profile is None:
                    trackers = {
                        e.entity_id
                        for e in registry.entities.values()
                        if e.config_entry_id == cfg.entry_id and e.domain == "device_tracker"
                    }
                    for p in persons:
                        if trackers & set(p.attributes.get("device_trackers") or []):
                            profile = self._profile_from_person(p)
                            break
                if profile is None and user_id:
                    user = await self.hass.auth.async_get_user(user_id)
                    if user is not None:
                        profile = Profile(f"u_{user_id}", user.name or app_name, None, None, user_id)
                if profile is None:
                    profile = Profile(f"d_{cfg.entry_id[:8]}", app_name, None, None, user_id)
            app = App(
                entry_id=cfg.entry_id,
                name=app_name,
                platform=_platform_of(data.get("os_name")),
                model=str(data.get("device_model") or data.get("model") or ""),
                manufacturer=str(data.get("manufacturer") or ""),
                os_version=str(data.get("os_version") or ""),
                user_id=user_id,
                profile_id=profile.id if profile else None,
                assigned=assigned,
            )
            result[cfg.entry_id] = (app, profile)
        return result

    @staticmethod
    def _profile_from_person(state: State) -> Profile:
        attrs = state.attributes
        pid = attrs.get("id") or state.entity_id.split(".", 1)[1]
        return Profile(
            id=f"p_{pid}",
            name=str(attrs.get("friendly_name") or pid),
            picture=attrs.get("entity_picture"),
            person=state.entity_id,
            user_id=attrs.get("user_id"),
        )

    async def _async_scan(self, initial: bool) -> None:
        """Geräte, Profile und Sensoren neu bestimmen und Änderungen melden."""
        resolved = await self._async_resolve_apps()
        old_profiles = set(self._profiles)
        old_sensors = dict(self._sensors)
        self._apps = {k: a for k, (a, _p) in resolved.items()}
        self._profiles = {}
        for _app, prof in resolved.values():
            if prof is not None:
                self._profiles.setdefault(prof.id, prof)
        platforms = {k: a.platform for k, a in self._apps.items() if a.profile_id}
        detected = scan_registry(self.hass, platforms)
        self._sensors = {s.entity_id: s for s in detected}
        by_pm: dict[tuple[str, str], list[DetectedSensor]] = defaultdict(list)
        for s in detected:
            pid = self._apps[s.app_entry].profile_id
            if pid:
                by_pm[(pid, s.metric)].append(s)
        for lst in by_pm.values():
            lst.sort(key=lambda s: (s.reboot_counter, s.rank, s.entity_id))
        self._by_pm = dict(by_pm)

        if self._state_unsub:
            self._state_unsub()
        ids = list(self._sensors)
        self._state_unsub = (
            async_track_state_change_event(self.hass, ids, self._on_state) if ids else None
        )
        # Ausgangswerte übernehmen (ohne Ereignisse, ohne doppelte Zählung)
        today = dt_util.now().date().isoformat()
        for (pid, key), lst in self._by_pm.items():
            best = self._best(pid, key)
            if best is None:
                continue
            value, state = self._read(best)
            if value is None or state is None:
                continue
            if today in self._daily.get(pid, {}).get(key, {}):
                continue
            self._ingest(best, value, state.last_updated, announce=False)

        if not initial:
            self._announce_diff(old_profiles, old_sensors)
        for cb in list(self._profile_listeners):
            cb()

    def _announce_diff(self, old_profiles: set[str], old_sensors: dict[str, DetectedSensor]) -> None:
        feats = self.active_features()
        for pid in set(self._profiles) - old_profiles:
            self._emit(EVENT_PROFILE_ADDED, "profile_added", {"profile": self._profiles[pid].name})
        for eid, s in self._sensors.items():
            if eid not in old_sensors and self._metric_allowed(s.metric, feats):
                self._emit(
                    EVENT_SENSOR_DETECTED,
                    "sensor_detected",
                    {"entity_id": eid, "metric": s.metric, "profile": self._profile_name(s)},
                )
        for eid, s in old_sensors.items():
            if eid not in self._sensors and self._metric_allowed(s.metric, feats):
                self._emit(
                    EVENT_SENSOR_LOST,
                    "sensor_lost",
                    {"entity_id": eid, "metric": s.metric, "profile": self._profile_name(s)},
                )

    def _profile_name(self, sensor: DetectedSensor) -> str:
        app = self._apps.get(sensor.app_entry)
        prof = self._profiles.get(app.profile_id) if app and app.profile_id else None
        return prof.name if prof else ""

    @staticmethod
    def _metric_allowed(metric_key: str, feats: set[str]) -> bool:
        m = METRICS[metric_key]
        return m.experimental is None or m.experimental in feats

    def _emit(self, event: str, kind: str, data: dict[str, Any]) -> None:
        """Ereignis protokollieren und (wenn eingeschaltet) auf den Event-Bus senden."""
        self._events.appendleft({"t": dt_util.utcnow().isoformat(), "k": kind, "d": data})
        self.event_counts[kind] += 1
        if self.options.get(OPT_EVENTS, True):
            self.hass.bus.async_fire(event, data)

    # ------------------------------------------------------------------ Werte
    def _best(self, pid: str, key: str) -> DetectedSensor | None:
        """Beste Quelle: gültiger Wert, dann Priorität, dann Aktualität."""
        lst = [s for s in self._by_pm.get((pid, key), []) if not s.disabled]
        if not lst:
            return None
        valid: list[tuple[tuple[Any, ...], DetectedSensor]] = []
        for s in lst:
            value, state = self._read(s)
            if value is not None and state is not None:
                valid.append(((s.reboot_counter, s.rank, -state.last_updated.timestamp()), s))
        if valid:
            valid.sort(key=lambda t: t[0])
            return valid[0][1]
        return lst[0]

    def _read(self, sensor: DetectedSensor) -> tuple[Any, State | None]:
        state = self.hass.states.get(sensor.entity_id)
        if state is None or str(state.state).lower() in _INVALID:
            return None, state
        metric = METRICS[sensor.metric]
        if metric.kind in (KIND_STATE, KIND_TIMESTAMP):
            return state.state, state
        try:
            value = float(state.state)
        except (TypeError, ValueError):
            return None, state
        if not math.isfinite(value):
            return None, state
        converted = convert_value(metric, value, state.attributes.get("unit_of_measurement"))
        return converted, state

    @callback
    def _on_state(self, event: Event) -> None:
        sensor = self._sensors.get(event.data["entity_id"])
        new: State | None = event.data.get("new_state")
        if sensor is None or new is None:
            return
        value, state = self._read(sensor)
        app = self._apps.get(sensor.app_entry)
        if value is not None and state is not None and app and app.profile_id:
            if self._best(app.profile_id, sensor.metric) is sensor:
                self._ingest(sensor, value, state.last_updated, announce=True)
        self._notify()

    def _ingest(self, sensor: DetectedSensor, value: Any, ts: datetime, announce: bool) -> None:
        """Wert in Tagesverlauf und Messpunkte übernehmen."""
        metric = METRICS[sensor.metric]
        app = self._apps.get(sensor.app_entry)
        if app is None or app.profile_id is None:
            return
        if metric.kind in (KIND_STATE, KIND_TIMESTAMP) or sensor.reboot_counter:
            return
        if not _valid_number(value):
            return
        pid = app.profile_id
        day = dt_util.as_local(ts).date().isoformat()
        days = self._daily.setdefault(pid, {}).setdefault(sensor.metric, {})
        rec = days.get(day)
        v = float(value)
        if rec is None:
            days[day] = [v, v, v, 1, v]
        else:
            rec[IDX_MIN] = min(rec[IDX_MIN], v)
            rec[IDX_MAX] = max(rec[IDX_MAX], v)
            rec[IDX_SUM] += v
            rec[IDX_N] += 1
            rec[IDX_LAST] = v
        self._add_sample(pid, sensor.metric, ts.timestamp(), v, metric)
        self._store.async_delay_save(self._store_data, STORE_SAVE_DELAY)
        self._check_goal(pid, sensor.metric, day, announce)

    def _add_sample(self, pid: str, key: str, ts: float, value: float, metric: MetricDef) -> None:
        dq = self._samples[(pid, key)]
        if dq and ts - dq[-1][0] < metric.min_interval and abs(dq[-1][1] - value) < 1e-9:
            return
        if dq and ts < dq[-1][0]:
            return
        if dq and ts - dq[-1][0] < metric.min_interval:
            dq[-1] = (ts, value)
            return
        dq.append((ts, value))

    def _check_goal(self, pid: str, key: str, day: str, announce: bool) -> None:
        metric = METRICS[key]
        if not metric.goal:
            return
        goal = self.goal(pid, metric.goal)
        rec = self._daily.get(pid, {}).get(key, {}).get(day)
        value = day_value(metric, rec)
        if not goal or value is None or value < goal:
            return
        marker = (pid, key, day)
        if marker in self._goal_hit:
            return
        self._goal_hit.add(marker)
        if announce and day == dt_util.now().date().isoformat():
            profile = self._profiles.get(pid)
            self._emit(
                EVENT_GOAL_REACHED,
                "goal_reached",
                {
                    "profile": profile.name if profile else "",
                    "metric": key,
                    "value": round(value, metric.decimals or 0),
                    "goal": goal,
                },
            )

    # ------------------------------------------------------------------ Verlauf
    def series(self, pid: str, key: str, days: int) -> list[dict[str, Any]]:
        """Tageswerte der letzten `days` Tage (älteste zuerst, letzter = heute)."""
        metric = METRICS[key]
        today = dt_util.now().date()
        recs = self._daily.get(pid, {}).get(key, {})
        out: list[dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            rec = recs.get(d)
            val = day_value(metric, rec)
            out.append({
                "d": d,
                "v": None if val is None else round(val, 3),
                "min": None if not rec else round(rec[IDX_MIN], 3),
                "max": None if not rec else round(rec[IDX_MAX], 3),
                "n": 0 if not rec else int(rec[IDX_N]),
            })
        return out

    def samples(self, pid: str, key: str) -> list[list[float]]:
        """Messpunkte der letzten 24 Stunden als [Zeit in ms, Wert]."""
        cutoff = dt_util.utcnow().timestamp() - 86400
        return [[int(t * 1000), v] for t, v in self._samples.get((pid, key), []) if t >= cutoff]

    async def _async_backfill(self) -> None:
        """Verlauf aus dem Recorder nachladen (best effort)."""
        if "recorder" not in self.hass.config.components:
            return
        days = int(self.options.get(OPT_HISTORY_DAYS, DEFAULT_HISTORY_DAYS))
        targets: dict[str, tuple[str, DetectedSensor]] = {}
        for (pid, key), _lst in self._by_pm.items():
            metric = METRICS[key]
            best = self._best(pid, key)
            if best and metric.kind not in (KIND_STATE, KIND_TIMESTAMP) and not best.reboot_counter:
                targets[best.entity_id] = (pid, best)
        if not targets:
            return
        pre = {pid: {k: set(v) for k, v in m.items()} for pid, m in self._daily.items()}
        try:
            from homeassistant.components.recorder import get_instance, history

            start = dt_util.utcnow() - timedelta(days=days)
            result = await get_instance(self.hass).async_add_executor_job(
                partial(
                    history.get_significant_states,
                    self.hass,
                    start,
                    None,
                    list(targets),
                    include_start_time_state=True,
                    significant_changes_only=False,
                    minimal_response=True,
                    no_attributes=True,
                )
            )
        except Exception as err:  # noqa: BLE001 - Verlauf ist optional
            _LOGGER.debug("Verlauf konnte nicht geladen werden: %s", type(err).__name__)
            return
        today = dt_util.now().date().isoformat()
        for entity_id, items in result.items():
            pid, sensor = targets[entity_id]
            metric = METRICS[sensor.metric]
            unit = (self.hass.states.get(entity_id).attributes.get("unit_of_measurement")
                    if self.hass.states.get(entity_id) else None)
            for item in items:
                raw = item.state if isinstance(item, State) else item.get("state")
                ts_raw = (
                    item.last_updated
                    if isinstance(item, State)
                    else item.get("last_updated") or item.get("last_changed") or item.get("lu") or item.get("lc")
                )
                ts = _coerce_ts(ts_raw)
                if ts is None or str(raw).lower() in _INVALID:
                    continue
                try:
                    value = convert_value(metric, float(raw), unit)
                except (TypeError, ValueError):
                    continue
                if not _valid_number(value):
                    continue
                day = dt_util.as_local(ts).date().isoformat()
                if day in pre.get(pid, {}).get(sensor.metric, set()) and day != today:
                    continue
                if day == today and day in pre.get(pid, {}).get(sensor.metric, set()):
                    self._add_backfill_sample(pid, sensor.metric, ts, value, metric)
                    continue
                self._ingest(sensor, value, ts, announce=False)
        self._sort_samples()

    def _add_backfill_sample(self, pid: str, key: str, ts: datetime, value: float, metric: MetricDef) -> None:
        dq = self._samples[(pid, key)]
        t = ts.timestamp()
        if any(abs(t - x[0]) < 1 for x in dq):
            return
        dq.append((t, value))

    def _sort_samples(self) -> None:
        for key, dq in list(self._samples.items()):
            ordered = sorted(dq, key=lambda x: x[0])
            self._samples[key] = deque(ordered[-_SAMPLE_CAP:], maxlen=_SAMPLE_CAP)

    # ------------------------------------------------------------------ Zeitgeber
    @callback
    def _on_tick(self, _now: datetime) -> None:
        self._notify()

    async def _on_update_tick(self, _now: datetime) -> None:
        await self.updates.async_check()
        self._notify()

    # ------------------------------------------------------------------ Aktionen
    async def async_action(self, action: str, **kw: Any) -> dict[str, Any]:
        """Schreibende Aktionen (die WebSocket-Schicht prüft Admin-Rechte)."""
        if action == ACTION_RESCAN:
            await self.async_rescan()
            return {"profiles": len(self._profiles), "sensors": len(self._sensors)}
        if action == ACTION_CHECK_UPDATE:
            await self.updates.async_check()
            self._notify()
            return self.updates.as_dict()
        if action == ACTION_SET_GOAL:
            return self._set_goal(kw.get("profile"), kw.get("goal"), kw.get("value"))
        if action == ACTION_ASSIGN_DEVICE:
            return self._assign(kw.get("device"), kw.get("profile"))
        raise ValueError("unknown action")

    def _set_goal(self, profile: str | None, goal: str | None, value: Any) -> dict[str, Any]:
        if profile not in self._profiles or goal not in GOAL_KEYS:
            raise ValueError("invalid goal")
        if not _valid_number(value) or not 0 < float(value) <= 1_000_000:
            raise ValueError("invalid value")
        goals = {k: dict(v) for k, v in (self.options.get(OPT_PROFILE_GOALS, {}) or {}).items()}
        goals.setdefault(profile, {})[goal] = float(value)
        self.hass.config_entries.async_update_entry(
            self.entry, options={**self.entry.options, OPT_PROFILE_GOALS: goals}
        )
        return {"profile": profile, "goal": goal, "value": float(value)}

    def _assign(self, device: str | None, profile: str | None) -> dict[str, Any]:
        if device not in self._apps:
            raise ValueError("unknown device")
        target = profile or ""
        if target not in ("", "ignore") and not (
            target.startswith("person.") and self.hass.states.get(target)
        ):
            raise ValueError("invalid profile")
        assigns = dict(self.options.get(OPT_ASSIGN, {}) or {})
        if target:
            assigns[device] = target
        else:
            assigns.pop(device, None)
        self.hass.config_entries.async_update_entry(
            self.entry, options={**self.entry.options, OPT_ASSIGN: assigns}
        )
        return {"device": device, "profile": target}

    # ------------------------------------------------------------------ Auswertung
    def goal_progress(self, pid: str) -> int | None:
        """Mittlerer Zielfortschritt in Prozent (nur vorhandene Ziele)."""
        parts: list[float] = []
        for key, metric in METRICS.items():
            if not metric.goal or metric.experimental:
                continue
            goal = self.goal(pid, metric.goal)
            if not goal:
                continue
            best = self._best(pid, key)
            if best is None:
                continue
            value, state = self._read(best)
            if value is None or best.reboot_counter or not _valid_number(value):
                continue
            if metric.kind == KIND_TOTAL_DAY and state is not None:
                if dt_util.as_local(state.last_updated).date() != dt_util.now().date():
                    value = 0.0
            parts.append(min(float(value) / goal, 1.0) * 100.0)
        return round(sum(parts) / len(parts)) if parts else None

    def profile_ids(self) -> list[str]:
        return sorted(self._profiles)

    def find_profile(self, ref: str | None) -> Profile | None:
        """Profil über ID, Person-Entität oder Namen finden."""
        if not ref:
            return None
        low = ref.strip().lower()
        for p in self._profiles.values():
            if low in (p.id.lower(), (p.person or "").lower(), p.name.lower()):
                return p
        return None

    def profile(self, pid: str) -> Profile | None:
        return self._profiles.get(pid)

    def detected_count(self) -> int:
        feats = self.active_features()
        return sum(1 for s in self._sensors.values() if self._metric_allowed(s.metric, feats))

    # ------------------------------------------------------------------ Sichtbarkeit
    def visible(self, profile: Profile, user_id: str | None, is_admin: bool) -> bool:
        """Admins sehen alle Profile. Andere Benutzer nur ihr eigenes (oder alle, wenn erlaubt)."""
        if is_admin or self.options.get(OPT_SHOW_ALL, False):
            return True
        return bool(user_id and profile.user_id == user_id)

    def visible_profiles(self, user_id: str | None, is_admin: bool) -> list[Profile]:
        return [p for p in self._profiles.values() if self.visible(p, user_id, is_admin)]

    # ------------------------------------------------------------------ Momentaufnahme
    def _sleep_stages(self, state: State | None) -> list[list[str]]:
        """Schlafphasen aus den Attributen des Health-Connect-Sensors (Format ungeprüft)."""
        if state is None:
            return []
        attrs = state.attributes
        types = attrs.get("stageTypes") or attrs.get("stage_types")
        starts = attrs.get("stageStartTimes") or attrs.get("stage_start_times")
        ends = attrs.get("stageEndTimes") or attrs.get("stage_end_times")
        if not (isinstance(types, list) and isinstance(starts, list) and isinstance(ends, list)):
            return []
        out: list[list[str]] = []
        for t, s, e in zip(types, starts, ends, strict=False):
            start, end = self._to_dt(s), self._to_dt(e)
            if start is None or end is None or end <= start:
                continue
            out.append([start.isoformat(), end.isoformat(), self._stage_name(t)])
        return out[:500]

    @staticmethod
    def _to_dt(value: Any) -> datetime | None:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            ts = float(value)
            return dt_util.utc_from_timestamp(ts / 1000 if ts > 1e11 else ts)
        if isinstance(value, str):
            return dt_util.parse_datetime(value)
        return None

    @staticmethod
    def _stage_name(value: Any) -> str:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return _STAGE_INT.get(int(value), "other")
        text = str(value).lower()
        for needle, name in (("deep", "deep"), ("rem", "rem"), ("light", "light"), ("core", "light"),
                             ("awake", "awake"), ("out_of_bed", "awake"), ("sleeping", "light")):
            if needle in text:
                return name
        return "other"

    def _profile_metrics(self, pid: str, feats: set[str]) -> tuple[dict[str, Any], list[list[str]]]:
        today = dt_util.now().date()
        metrics: dict[str, Any] = {}
        stages: list[list[str]] = []
        for key, metric in METRICS.items():
            if not self._metric_allowed(key, feats):
                continue
            best = self._best(pid, key)
            if best is None:
                continue
            value, state = self._read(best)
            quality = "ok"
            if value is None:
                quality = "no_data"
            elif best.reboot_counter:
                quality = "since_reboot"
            elif (
                metric.kind == KIND_TOTAL_DAY
                and state is not None
                and dt_util.as_local(state.last_updated).date() != today
            ):
                quality = "stale"
            entry: dict[str, Any] = {
                "v": value if not _valid_number(value) else round(float(value), 3),
                "u": metric.unit,
                "e": best.entity_id,
                "app": best.app_entry,
                "q": quality,
                "t": state.last_updated.isoformat() if state else None,
                "src": len(self._by_pm.get((pid, key), [])),
            }
            if metric.kind == KIND_STATE and state is not None:
                entry["a"] = {"confidence": state.attributes.get("confidence")}
            if key == "sleep_duration":
                stages = self._sleep_stages(state)
            metrics[key] = entry
        return metrics, stages

    def snapshot(self, user_id: str | None, is_admin: bool) -> dict[str, Any]:
        """Datenstand für einen Benutzer (filtert Profile nach Sichtbarkeit)."""
        feats = self.active_features()
        visible = self.visible_profiles(user_id, is_admin)
        visible_ids = {p.id for p in visible}
        profiles: list[dict[str, Any]] = []
        daily_for_hints: dict[str, dict[str, list[float | None]]] = {}
        for prof in sorted(visible, key=lambda p: p.name.lower()):
            metrics, stages = self._profile_metrics(prof.id, feats)
            goals = {g: self.goal(prof.id, g) for g in GOAL_KEYS}
            item: dict[str, Any] = {
                "id": prof.id,
                "name": prof.name,
                "picture": prof.picture,
                "person": prof.person,
                "mine": bool(user_id and prof.user_id == user_id),
                "devices": [a.entry_id for a in self._apps.values() if a.profile_id == prof.id],
                "metrics": metrics,
                "goals": goals,
                "stages": stages,
                "progress": self.goal_progress(prof.id),
            }
            if "sleep_score" in feats and "sleep_duration" in metrics:
                m = metrics
                dur = m["sleep_duration"]["v"]
                item["sleep_score"] = analysis.sleep_score(
                    dur if _valid_number(dur) else None,
                    goals["sleep_duration"] or 480.0,
                    m.get("sleep_deep", {}).get("v"),
                    m.get("sleep_rem", {}).get("v"),
                    m.get("sleep_awake", {}).get("v"),
                )
            if "trend_hints" in feats:
                series = {
                    k: [d["v"] for d in self.series(prof.id, k, 28)]
                    for k in ("resting_hr", "hrv", "sleep_duration", "steps", "exercise_minutes")
                }
                daily_for_hints[prof.id] = series
                item["hints"] = analysis.trend_hints(
                    series, {"sleep_duration": goals["sleep_duration"] or 480.0}
                )
            profiles.append(item)

        snap: dict[str, Any] = {
            "version": VERSION,
            "ready": self._ready,
            "profiles": profiles,
            "catalog": [
                {
                    "key": m.key,
                    "category": m.category,
                    "icon": m.icon,
                    "unit": m.unit,
                    "decimals": m.decimals,
                    "goal": m.goal,
                    "kind": m.kind,
                    "hint": platform_hint(m),
                    "experimental": m.experimental,
                }
                for m in METRICS.values()
                if self._metric_allowed(m.key, feats)
            ],
            "sensors": [
                {
                    "entity_id": s.entity_id,
                    "metric": s.metric,
                    "profile": self._apps[s.app_entry].profile_id,
                    "app": s.app_entry,
                    "alias": s.alias,
                    "disabled": s.disabled,
                    "reboot": s.reboot_counter,
                    "status": self._sensor_status(s),
                }
                for s in self._sensors.values()
                if self._metric_allowed(s.metric, feats)
                and self._apps.get(s.app_entry)
                and self._apps[s.app_entry].profile_id in visible_ids
            ],
            "apps": [
                {
                    "entry": a.entry_id,
                    "name": a.name,
                    "platform": a.platform,
                    "model": a.model,
                    "os_version": a.os_version,
                    "profile": a.profile_id,
                    "assigned": a.assigned,
                }
                for a in self._apps.values()
                if is_admin or (a.profile_id in visible_ids)
            ],
            "persons": (
                [{"entity_id": p.entity_id, "name": p.name} for p in self._persons()]
                if is_admin else []
            ),
            "experimental": {
                "enabled": bool(self.options.get(OPT_EXPERIMENTAL, False)),
                "features": sorted(feats),
                "available": sorted(EXPERIMENTAL_FEATURES),
            },
            "options": {
                "show_all_profiles": bool(self.options.get(OPT_SHOW_ALL, False)),
                "history_days": int(self.options.get(OPT_HISTORY_DAYS, DEFAULT_HISTORY_DAYS)),
                "events_enabled": bool(self.options.get(OPT_EVENTS, True)),
            },
            "app": self.updates.as_dict(),
            "events": list(self._events) if is_admin else [],
            "admin": bool(is_admin),
        }
        if "profile_compare" in feats and len(visible) >= 2:
            rows = []
            for prof in visible:
                steps = [d["v"] for d in self.series(prof.id, "steps", 7) if d["v"] is not None]
                ex = [d["v"] for d in self.series(prof.id, "exercise_minutes", 7) if d["v"] is not None]
                sl = [d["v"] for d in self.series(prof.id, "sleep_duration", 7) if d["v"] is not None]
                goal = self.goal(prof.id, "steps") or 0
                rows.append({
                    "id": prof.id,
                    "name": prof.name,
                    "steps_avg": round(sum(steps) / len(steps)) if steps else None,
                    "exercise_avg": round(sum(ex) / len(ex)) if ex else None,
                    "sleep_avg": round(sum(sl) / len(sl)) if sl else None,
                    "goal_days": sum(1 for s in steps if goal and s >= goal),
                    "days": len(steps),
                })
            snap["compare"] = analysis.compare_profiles(rows)
        return snap

    def _sensor_status(self, sensor: DetectedSensor) -> str:
        if sensor.disabled:
            return "disabled"
        value, _state = self._read(sensor)
        return "ok" if value is not None else "no_data"

    def details(self, pid: str, key: str | None, days: int) -> dict[str, Any]:
        """Verlaufsdaten eines Profils (eine Metrik oder alle mit Tageswerten)."""
        feats = self.active_features()
        days = max(1, min(int(days), 365))
        if key is not None:
            if key not in METRICS or not self._metric_allowed(key, feats):
                raise ValueError("unknown metric")
            return {
                "metric": key,
                "daily": self.series(pid, key, days),
                "samples": self.samples(pid, key),
            }
        out: dict[str, Any] = {}
        for k, m in METRICS.items():
            if m.kind in (KIND_STATE, KIND_TIMESTAMP) or not self._metric_allowed(k, feats):
                continue
            if (pid, k) in self._by_pm:
                out[k] = self.series(pid, k, days)
        return {"daily": out}

    # ------------------------------------------------------------------ Diagnose
    def diagnostics(self) -> dict[str, Any]:
        """Anonymisierte Kennzahlen."""
        by_metric: dict[str, int] = defaultdict(int)
        for s in self._sensors.values():
            by_metric[s.metric] += 1
        return {
            "version": VERSION,
            "profiles": len(self._profiles),
            "apps": [{"platform": a.platform, "assigned": bool(a.assigned)} for a in self._apps.values()],
            "sensors_by_metric": dict(by_metric),
            "events_sent": dict(self.event_counts),
            "experimental": sorted(self.active_features()),
            "history_days_stored": max(
                (len(days) for m in self._daily.values() for days in m.values()), default=0
            ),
        }
