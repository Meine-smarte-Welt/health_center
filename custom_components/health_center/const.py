# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): e906acdc1584e048021ed6002ef601ee6b02ea033b865100f69a6c8c29fd8cb7
"""Konstanten für Health Center."""
from __future__ import annotations

DOMAIN = "health_center"
NAME = "Health Center"
VERSION = "0.0.1"
GITHUB_REPO = "meine-smarte-welt/health_center"
CARD_FILE = "health-center-card.js"
CARD_URL_BASE = f"/{DOMAIN}_files"

# --- Einrichtung / Optionen ------------------------------------------------
CONF_NAME = "name"
OPT_EXPERIMENTAL = "experimental_enabled"
OPT_EXPERIMENTAL_FEATURES = "experimental_features"
OPT_SHOW_ALL = "show_all_profiles"
OPT_HISTORY_DAYS = "history_days"
OPT_EVENTS = "events_enabled"
OPT_GOAL_STEPS = "goal_steps"
OPT_GOAL_SLEEP_HOURS = "goal_sleep_hours"
OPT_GOAL_EXERCISE = "goal_exercise_minutes"
OPT_ASSIGN = "assign"  # {mobile_app_entry_id: person_entity_id | "" | "ignore"}
OPT_PROFILE_GOALS = "profile_goals"  # {profile_id: {goal_key: wert}}

DEFAULT_HISTORY_DAYS = 30
DEFAULT_GOAL_STEPS = 10000
DEFAULT_GOAL_SLEEP_HOURS = 8.0
DEFAULT_GOAL_EXERCISE = 30
DEFAULT_GOAL_FLOORS = 10
DEFAULT_GOAL_ENERGY = 500

STORE_VERSION = 1
STORE_KEY = f"{DOMAIN}.daily"
STORE_SAVE_DELAY = 30
KEEP_DAYS = 400
FLUSH_DELAY = 1.0
UPDATE_CHECK_INTERVAL_HOURS = 12
EVENT_LOG_SIZE = 50

# --- Ereignisse ---------------------------------------------------------------
EVENT_GOAL_REACHED = f"{DOMAIN}_goal_reached"
EVENT_SENSOR_DETECTED = f"{DOMAIN}_sensor_detected"
EVENT_SENSOR_LOST = f"{DOMAIN}_sensor_lost"
EVENT_PROFILE_ADDED = f"{DOMAIN}_profile_added"

# --- WebSocket-Aktionen -------------------------------------------------------
ACTION_RESCAN = "rescan"
ACTION_SET_GOAL = "set_goal"
ACTION_ASSIGN_DEVICE = "assign_device"
ACTION_CHECK_UPDATE = "check_update"
ACTIONS = (ACTION_RESCAN, ACTION_SET_GOAL, ACTION_ASSIGN_DEVICE, ACTION_CHECK_UPDATE)

# --- Experimentelle Funktionen (Regeln 07) ---------------------------------------
# Schlüsselgleich zur Karte (EXPERIMENTAL in health-center-card.js).
EXPERIMENTAL_FEATURES: dict[str, dict[str, str]] = {
    "extended_metrics": {"since": "0.0.1", "icon": "mdi:scale-bathroom"},
    "sleep_score": {"since": "0.0.1", "icon": "mdi:sleep"},
    "profile_compare": {"since": "0.0.1", "icon": "mdi:account-multiple-check"},
    "trend_hints": {"since": "0.0.1", "icon": "mdi:chart-timeline-variant"},
}

# Ziele, die pro Profil einstellbar sind: Schlüssel -> (Metrik, Standardwert)
GOAL_KEYS = ("steps", "floors", "active_energy", "exercise_minutes", "sleep_duration")
