// SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 85bc3b4ea7fa8f8aa4f8653cc204a9f17da5d1a4583441c2487d8349bf200ee9
"use strict";
/* Health Center Karte – Gesundheitsdaten der Home-Assistant-Companion-App.
   Reine Web-Komponente ohne externe Bibliotheken. Alle Texte werden maskiert. */

const CARD_VERSION = "0.0.1";
const DOMAIN = "health_center";
const CARD_TAG = "health-center-card";
const EDITOR_TAG = "health-center-card-editor";

// ---------------------------------------------------------------- Kategorien (Tabs)
const TAB_ORDER = ["overview", "activity", "sleep", "heart", "body", "stats", "settings"];
const TAB_META = {
  overview: { icon: "mdi:view-dashboard-outline", label: "tab_overview" },
  activity: { icon: "mdi:run", label: "tab_activity" },
  sleep: { icon: "mdi:sleep", label: "tab_sleep" },
  heart: { icon: "mdi:heart-pulse", label: "tab_heart" },
  body: { icon: "mdi:human", label: "tab_body", experimental: "extended_metrics" },
  stats: { icon: "mdi:chart-box-outline", label: "tab_stats" },
  settings: { icon: "mdi:cog", label: "tab_settings" },
};
const CATEGORY_ICON_COLOR_KEYS = Object.fromEntries(TAB_ORDER.map((k) => [k, `color_icon_${k}`]));

// ---------------------------------------------------------------- Experimentelle Funktionen
// Schlüsselgleich zu EXPERIMENTAL_FEATURES in const.py
const EXPERIMENTAL = {
  extended_metrics: { since: "0.0.1", icon: "mdi:scale-bathroom", label: "exp_extended_metrics" },
  sleep_score: { since: "0.0.1", icon: "mdi:sleep", label: "exp_sleep_score" },
  profile_compare: { since: "0.0.1", icon: "mdi:account-multiple-check", label: "exp_profile_compare" },
  trend_hints: { since: "0.0.1", icon: "mdi:chart-timeline-variant", label: "exp_trend_hints" },
};

// ---------------------------------------------------------------- Farben
const COLOR_CONFIG_KEYS = {
  tab_active: { cssVar: "--hc-color-tab-active", fallback: "var(--primary-color, #03a9f4)" },
  success: { cssVar: "--hc-color-success", fallback: "var(--success-color, #43a047)" },
  warning: { cssVar: "--hc-color-warning", fallback: "var(--warning-color, #ff9800)" },
  error: { cssVar: "--hc-color-error", fallback: "var(--error-color, #db4437)" },
  info: { cssVar: "--hc-color-info", fallback: "var(--info-color, #039be5)" },
  row_icon: { cssVar: "--hc-color-row-icon", fallback: "var(--secondary-text-color, #727272)" },
  live_banner: { cssVar: "--hc-color-live-banner", fallback: "var(--state-icon-active-color, #03a9f4)" },
  steps: { cssVar: "--hc-color-steps", fallback: "var(--success-color, #43a047)" },
  energy: { cssVar: "--hc-color-energy", fallback: "var(--accent-color, #ff9800)" },
  exercise: { cssVar: "--hc-color-exercise", fallback: "var(--info-color, #039be5)" },
  sleep: { cssVar: "--hc-color-sleep", fallback: "var(--primary-color, #5c6bc0)" },
  heart: { cssVar: "--hc-color-heart", fallback: "var(--error-color, #e53935)" },
};
const SAFE_COLOR_RE = /^[a-zA-Z0-9#(),.%\-\s]+$/;
function sanitizeColor(v) {
  const t = String(v || "").trim();
  return t && SAFE_COLOR_RE.test(t) ? t : "";
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Welche Metrik gehört zu welcher Ringfarbe / welchem Symbolton
const METRIC_COLOR = {
  steps: "steps", distance: "steps", floors: "steps", elevation: "steps", pace: "steps", activity_state: "steps",
  active_energy: "energy", total_energy: "energy", exercise_minutes: "exercise",
  sleep_duration: "sleep", sleep_start: "sleep", sleep_end: "sleep", sleep_deep: "sleep", sleep_light: "sleep",
  sleep_rem: "sleep", sleep_awake: "sleep", in_bed: "sleep",
  heart_rate: "heart", resting_hr: "heart", hrv: "heart", walking_hr: "heart", vo2_max: "heart",
};
const STAGES = ["awake", "rem", "light", "deep"];

// ---------------------------------------------------------------- Sprachen
const I18N = {
  de: {
    tab_overview: "Übersicht", tab_activity: "Aktivität", tab_sleep: "Schlaf", tab_heart: "Herz",
    tab_body: "Körper", tab_stats: "Statistik", tab_settings: "Einstellungen",
    loading: "Lade Daten …", conn_error: "Keine Verbindung zu Health Center.", not_ready: "Health Center startet …",
    no_apps: "Keine Companion-App gefunden. Melde dich in der Home-Assistant-App am Smartphone an.",
    no_visible: "Für dich ist kein Profil sichtbar. Ein Administrator kann Profile in den Optionen freigeben.",
    no_sensors: "Für dieses Profil wurden noch keine Gesundheitssensoren erkannt.",
    no_sensors_hint: "Aktiviere sie in der Companion-App unter Einstellungen → Sensoren (Android: Health Connect, iOS: Health).",
    today: "Heute", of_goal: "von {goal}", goal: "Ziel", goal_reached: "Ziel erreicht",
    q_stale: "kein Wert von heute", q_since_reboot: "seit Neustart", q_no_data: "keine Daten",
    sensors_detected: "{n} Sensoren erkannt", goals_today: "{a} von {b} Zielen erreicht",
    missing_title: "Nicht erkannte Sensoren",
    missing_hint: "Aktiviere diese Sensoren in der Companion-App (Einstellungen → Sensoren). Sie erscheinen dann automatisch.",
    android: "Android", ios: "iOS", unknown_platform: "Unbekannt",
    m_steps: "Schritte", m_distance: "Distanz", m_floors: "Etagen", m_elevation: "Höhenmeter",
    m_active_energy: "Aktive Energie", m_total_energy: "Gesamtenergie", m_exercise_minutes: "Aktivminuten",
    m_pace: "Tempo", m_activity_state: "Aktuelle Aktivität", m_sleep_duration: "Schlafdauer",
    m_sleep_start: "Einschlafzeit", m_sleep_end: "Aufwachzeit", m_sleep_deep: "Tiefschlaf",
    m_sleep_light: "Leichtschlaf", m_sleep_rem: "REM-Schlaf", m_sleep_awake: "Wachphasen", m_in_bed: "Im Bett",
    m_heart_rate: "Herzfrequenz", m_resting_hr: "Ruhepuls", m_hrv: "HRV", m_walking_hr: "Geh-Puls",
    m_vo2_max: "VO₂max", m_weight: "Gewicht", m_spo2: "Sauerstoffsättigung", m_bp_systolic: "Blutdruck oben",
    m_bp_diastolic: "Blutdruck unten", m_respiratory_rate: "Atemfrequenz", m_body_temp: "Körpertemperatur",
    m_body_fat: "Körperfett",
    u_steps: "Schritte", u_floors: "Etagen",
    act_still: "Ruhe", act_walking: "Gehen", act_running: "Laufen", act_cycling: "Radfahren", act_vehicle: "Im Fahrzeug",
    act_on_foot: "Zu Fuß", act_tilting: "Bewegt", act_unknown: "Unbekannt", act_asleep: "Schlaf", act_exercise: "Training",
    act_passive: "Passiv", confidence: "Sicherheit",
    sleep_last: "Letzte Nacht", sleep_goal: "Schlafziel", bedtime: "Ins Bett", waketime: "Aufgewacht",
    st_awake: "Wach", st_light: "Leicht", st_deep: "Tief", st_rem: "REM", sleep_stages: "Schlafphasen",
    sleep_week: "Letzte Nächte", sleep_score: "Schlafwert",
    sleep_score_note: "Berechneter Richtwert aus Dauer, Tief-/REM-Anteil und Wachzeit. Keine medizinische Bewertung.",
    stage_na: "Keine Phasendaten verfügbar",
    hr_now: "Letzte Messung", hr_today: "Heute", hr_min: "Min.", hr_avg: "Ø", hr_max: "Max.",
    hr_24h: "Verlauf (24 Stunden)", hr_resting_trend: "Ruhepuls", hr_none: "Noch keine Messpunkte",
    body_note: "Experimentell: Die Sensornamen für diese Werte sind nicht an echten Geräten geprüft.",
    period_n: "{n} Tage", avg: "Ø", best: "Bester Tag", lowest: "Niedrigster Tag", total: "Summe",
    vs_prev: "zur Vorperiode", goal_days: "Ziel an {a} von {b} Tagen", no_history: "Noch kein Verlauf. Er wächst mit jedem Tag.",
    days_with_data: "{n} Tage mit Daten",
    compare_title: "Profilvergleich (7 Tage)", compare_note: "Durchschnitt der letzten 7 Tage, nur für Profile, die du sehen darfst.",
    cmp_steps: "Ø Schritte", cmp_goal_days: "Zieltage",
    hints_title: "Trend-Hinweise", hints_note: "Auffälligkeiten aus dem Vergleich von Tageswerten. Keine medizinische Beratung.",
    hint_up: "{metric}: Ø der letzten 7 Tage {pct} % höher als in den 3 Wochen davor.",
    hint_down: "{metric}: Ø der letzten 7 Tage {pct} % niedriger als in den 3 Wochen davor.",
    hint_below_goal: "Schlaf: Ø der letzten 7 Tage liegt {pct} % unter deinem Ziel.", hints_none: "Aktuell keine Auffälligkeiten.",
    acc_app: "App-Version", acc_status: "Status", acc_profiles: "Profile und Geräte", acc_goals: "Tagesziele",
    acc_sensors: "Erkannte Sensoren", acc_options: "Optionen", acc_privacy: "Datenschutz", acc_maint: "Wartung",
    acc_events: "Ereignisse",
    app_integration: "Integration", app_card: "Karte", app_latest: "Neueste Version", app_checked: "Zuletzt geprüft",
    app_check_now: "Jetzt prüfen", app_release: "Release ansehen",
    app_update_hint: "Aktualisiere über HACS und starte Home Assistant neu. Danach Browser neu laden (Strg+F5).",
    app_mismatch: "Karte und Integration haben unterschiedliche Versionen. Browser-Cache leeren (Strg+F5).",
    app_check_failed: "Prüfung nicht möglich", app_no_release: "Noch kein Release veröffentlicht", app_up_to_date: "Aktuell",
    st_profiles: "Profile", st_devices: "Geräte", st_sensors: "Sensoren mit Daten",
    dev_auto: "Automatisch", dev_ignore: "Ignorieren", dev_profile: "Zugeordnet zu",
    goal_steps: "Schritte", goal_floors: "Etagen", goal_active_energy: "Aktive Energie (kcal)",
    goal_exercise_minutes: "Aktivminuten", goal_sleep_duration: "Schlaf (Stunden)",
    save: "Speichern", saved: "Gespeichert", rescan: "Sensoren neu suchen", rescan_done: "Suche abgeschlossen",
    admin_only: "Nur Administratoren können das ändern.", read_only_note: "Nur Ansicht (read_only).",
    options_hint: "Optionen ändern: Einstellungen → Geräte & Dienste → Health Center → Konfigurieren.",
    opt_show_all: "Alle Profile für alle sichtbar", opt_events: "Ereignisse senden", opt_history: "Verlauf nachladen (Tage)",
    on: "an", off: "aus",
    privacy_note: "Gesundheitsdaten sind sensibel. Nicht-Administratoren sehen in dieser Karte nur ihr eigenes Profil, außer ein Administrator gibt alle Profile frei. Die Sensoren der Companion-App selbst sind in Home Assistant für alle Benutzer sichtbar.",
    events_empty: "Noch keine Ereignisse seit dem Start.",
    ev_goal_reached: "Ziel erreicht: {profile} – {metric}", ev_sensor_detected: "Sensor erkannt: {metric} ({profile})",
    ev_sensor_lost: "Sensor entfernt: {metric} ({profile})", ev_profile_added: "Profil hinzugefügt: {profile}",
    sensor_ok: "Daten", sensor_no_data: "keine Daten", sensor_disabled: "deaktiviert",
    pop_info: "Informationen", pop_chart: "Verlauf", pop_source: "Quelle", pop_diag: "Diagnose", pop_today: "Heute",
    pop_days: "Letzte {n} Tage", pop_entity: "Entität", pop_alias: "Erkannt als", pop_updated: "Aktualisiert",
    pop_sources: "Quellen", open_entity: "Entität öffnen", copy: "Kopieren", copied: "Kopiert", close: "Schließen",
    exp_badge: "Experimentell",
    exp_off: "Diese Funktion ist im Integrations-Dialog nicht aktiviert (Einstellungen → Geräte & Dienste → Health Center → Konfigurieren).",
    exp_extended_metrics: "Erweiterte Werte", exp_sleep_score: "Schlafwert", exp_profile_compare: "Profilvergleich",
    exp_trend_hints: "Trend-Hinweise",
  },
  en: {
    tab_overview: "Overview", tab_activity: "Activity", tab_sleep: "Sleep", tab_heart: "Heart",
    tab_body: "Body", tab_stats: "Statistics", tab_settings: "Settings",
    loading: "Loading data …", conn_error: "No connection to Health Center.", not_ready: "Health Center is starting …",
    no_apps: "No Companion App found. Sign in to the Home Assistant app on your phone.",
    no_visible: "No profile is visible to you. An administrator can share profiles in the options.",
    no_sensors: "No health sensors have been detected for this profile yet.",
    no_sensors_hint: "Enable them in the Companion App under Settings → Sensors (Android: Health Connect, iOS: Health).",
    today: "Today", of_goal: "of {goal}", goal: "Goal", goal_reached: "Goal reached",
    q_stale: "no value from today", q_since_reboot: "since reboot", q_no_data: "no data",
    sensors_detected: "{n} sensors detected", goals_today: "{a} of {b} goals reached",
    missing_title: "Sensors not detected",
    missing_hint: "Enable these sensors in the Companion App (Settings → Sensors). They will appear automatically.",
    android: "Android", ios: "iOS", unknown_platform: "Unknown",
    m_steps: "Steps", m_distance: "Distance", m_floors: "Floors", m_elevation: "Elevation gained",
    m_active_energy: "Active energy", m_total_energy: "Total energy", m_exercise_minutes: "Active minutes",
    m_pace: "Pace", m_activity_state: "Current activity", m_sleep_duration: "Sleep duration",
    m_sleep_start: "Fell asleep", m_sleep_end: "Woke up", m_sleep_deep: "Deep sleep",
    m_sleep_light: "Light sleep", m_sleep_rem: "REM sleep", m_sleep_awake: "Awake", m_in_bed: "In bed",
    m_heart_rate: "Heart rate", m_resting_hr: "Resting heart rate", m_hrv: "HRV", m_walking_hr: "Walking heart rate",
    m_vo2_max: "VO₂ max", m_weight: "Weight", m_spo2: "Oxygen saturation", m_bp_systolic: "Blood pressure (sys.)",
    m_bp_diastolic: "Blood pressure (dia.)", m_respiratory_rate: "Respiratory rate", m_body_temp: "Body temperature",
    m_body_fat: "Body fat",
    u_steps: "steps", u_floors: "floors",
    act_still: "Still", act_walking: "Walking", act_running: "Running", act_cycling: "Cycling", act_vehicle: "In vehicle",
    act_on_foot: "On foot", act_tilting: "Moving", act_unknown: "Unknown", act_asleep: "Asleep", act_exercise: "Exercise",
    act_passive: "Passive", confidence: "Confidence",
    sleep_last: "Last night", sleep_goal: "Sleep goal", bedtime: "Bedtime", waketime: "Woke up",
    st_awake: "Awake", st_light: "Light", st_deep: "Deep", st_rem: "REM", sleep_stages: "Sleep stages",
    sleep_week: "Recent nights", sleep_score: "Sleep score",
    sleep_score_note: "Calculated guide value from duration, deep/REM share and time awake. Not a medical assessment.",
    stage_na: "No stage data available",
    hr_now: "Latest reading", hr_today: "Today", hr_min: "Min", hr_avg: "Avg", hr_max: "Max",
    hr_24h: "Trend (24 hours)", hr_resting_trend: "Resting heart rate", hr_none: "No readings yet",
    body_note: "Experimental: the sensor names for these values have not been tested on real devices.",
    period_n: "{n} days", avg: "Avg", best: "Best day", lowest: "Lowest day", total: "Total",
    vs_prev: "vs previous period", goal_days: "Goal on {a} of {b} days", no_history: "No history yet. It grows every day.",
    days_with_data: "{n} days with data",
    compare_title: "Profile comparison (7 days)", compare_note: "Average of the last 7 days, only for profiles you may see.",
    cmp_steps: "Avg steps", cmp_goal_days: "Goal days",
    hints_title: "Trend hints", hints_note: "Notable changes found by comparing daily values. Not medical advice.",
    hint_up: "{metric}: 7-day average is {pct}% higher than in the 3 weeks before.",
    hint_down: "{metric}: 7-day average is {pct}% lower than in the 3 weeks before.",
    hint_below_goal: "Sleep: the 7-day average is {pct}% below your goal.", hints_none: "No notable changes right now.",
    acc_app: "App version", acc_status: "Status", acc_profiles: "Profiles and devices", acc_goals: "Daily goals",
    acc_sensors: "Detected sensors", acc_options: "Options", acc_privacy: "Privacy", acc_maint: "Maintenance",
    acc_events: "Events",
    app_integration: "Integration", app_card: "Card", app_latest: "Latest version", app_checked: "Last checked",
    app_check_now: "Check now", app_release: "View release",
    app_update_hint: "Update via HACS and restart Home Assistant. Then reload the browser (Ctrl+F5).",
    app_mismatch: "Card and integration have different versions. Clear the browser cache (Ctrl+F5).",
    app_check_failed: "Check not possible", app_no_release: "No release published yet", app_up_to_date: "Up to date",
    st_profiles: "Profiles", st_devices: "Devices", st_sensors: "Sensors with data",
    dev_auto: "Automatic", dev_ignore: "Ignore", dev_profile: "Assigned to",
    goal_steps: "Steps", goal_floors: "Floors", goal_active_energy: "Active energy (kcal)",
    goal_exercise_minutes: "Active minutes", goal_sleep_duration: "Sleep (hours)",
    save: "Save", saved: "Saved", rescan: "Rescan sensors", rescan_done: "Scan finished",
    admin_only: "Only administrators can change this.", read_only_note: "View only (read_only).",
    options_hint: "Change options: Settings → Devices & services → Health Center → Configure.",
    opt_show_all: "All profiles visible to everyone", opt_events: "Send events", opt_history: "Import history (days)",
    on: "on", off: "off",
    privacy_note: "Health data is sensitive. Non-administrators only see their own profile in this card unless an administrator shares all profiles. The Companion App sensors themselves remain visible to all users in Home Assistant.",
    events_empty: "No events since startup.",
    ev_goal_reached: "Goal reached: {profile} – {metric}", ev_sensor_detected: "Sensor detected: {metric} ({profile})",
    ev_sensor_lost: "Sensor removed: {metric} ({profile})", ev_profile_added: "Profile added: {profile}",
    sensor_ok: "data", sensor_no_data: "no data", sensor_disabled: "disabled",
    pop_info: "Information", pop_chart: "History", pop_source: "Source", pop_diag: "Diagnostics", pop_today: "Today",
    pop_days: "Last {n} days", pop_entity: "Entity", pop_alias: "Detected as", pop_updated: "Updated",
    pop_sources: "Sources", open_entity: "Open entity", copy: "Copy", copied: "Copied", close: "Close",
    exp_badge: "Experimental",
    exp_off: "This feature is not enabled in the integration dialog (Settings → Devices & services → Health Center → Configure).",
    exp_extended_metrics: "Extended values", exp_sleep_score: "Sleep score", exp_profile_compare: "Profile comparison",
    exp_trend_hints: "Trend hints",
  },
  nl: {
    tab_overview: "Overzicht", tab_activity: "Activiteit", tab_sleep: "Slaap", tab_heart: "Hart",
    tab_body: "Lichaam", tab_stats: "Statistieken", tab_settings: "Instellingen",
    loading: "Gegevens laden …", conn_error: "Geen verbinding met Health Center.", not_ready: "Health Center start …",
    no_apps: "Geen Companion-app gevonden. Log in bij de Home Assistant-app op je telefoon.",
    no_visible: "Er is geen profiel voor jou zichtbaar. Een beheerder kan profielen vrijgeven in de opties.",
    no_sensors: "Voor dit profiel zijn nog geen gezondheidssensoren herkend.",
    no_sensors_hint: "Schakel ze in de Companion-app in onder Instellingen → Sensoren (Android: Health Connect, iOS: Health).",
    today: "Vandaag", of_goal: "van {goal}", goal: "Doel", goal_reached: "Doel bereikt",
    q_stale: "geen waarde van vandaag", q_since_reboot: "sinds herstart", q_no_data: "geen gegevens",
    sensors_detected: "{n} sensoren herkend", goals_today: "{a} van {b} doelen bereikt",
    missing_title: "Niet herkende sensoren",
    missing_hint: "Schakel deze sensoren in de Companion-app in (Instellingen → Sensoren). Ze verschijnen dan automatisch.",
    android: "Android", ios: "iOS", unknown_platform: "Onbekend",
    m_steps: "Stappen", m_distance: "Afstand", m_floors: "Verdiepingen", m_elevation: "Hoogtemeters",
    m_active_energy: "Actieve energie", m_total_energy: "Totale energie", m_exercise_minutes: "Actieve minuten",
    m_pace: "Tempo", m_activity_state: "Huidige activiteit", m_sleep_duration: "Slaapduur",
    m_sleep_start: "In slaap gevallen", m_sleep_end: "Wakker geworden", m_sleep_deep: "Diepe slaap",
    m_sleep_light: "Lichte slaap", m_sleep_rem: "REM-slaap", m_sleep_awake: "Wakker", m_in_bed: "In bed",
    m_heart_rate: "Hartslag", m_resting_hr: "Rusthartslag", m_hrv: "HRV", m_walking_hr: "Loophartslag",
    m_vo2_max: "VO₂max", m_weight: "Gewicht", m_spo2: "Zuurstofsaturatie", m_bp_systolic: "Bloeddruk boven",
    m_bp_diastolic: "Bloeddruk onder", m_respiratory_rate: "Ademhalingsfrequentie", m_body_temp: "Lichaamstemperatuur",
    m_body_fat: "Lichaamsvet",
    u_steps: "stappen", u_floors: "verdiepingen",
    act_still: "Stil", act_walking: "Lopen", act_running: "Rennen", act_cycling: "Fietsen", act_vehicle: "In voertuig",
    act_on_foot: "Te voet", act_tilting: "In beweging", act_unknown: "Onbekend", act_asleep: "Slaap", act_exercise: "Training",
    act_passive: "Passief", confidence: "Zekerheid",
    sleep_last: "Afgelopen nacht", sleep_goal: "Slaapdoel", bedtime: "Naar bed", waketime: "Wakker",
    st_awake: "Wakker", st_light: "Licht", st_deep: "Diep", st_rem: "REM", sleep_stages: "Slaapfasen",
    sleep_week: "Laatste nachten", sleep_score: "Slaapscore",
    sleep_score_note: "Berekende richtwaarde uit duur, diepe/REM-aandeel en wakkere tijd. Geen medische beoordeling.",
    stage_na: "Geen fasegegevens beschikbaar",
    hr_now: "Laatste meting", hr_today: "Vandaag", hr_min: "Min.", hr_avg: "Gem.", hr_max: "Max.",
    hr_24h: "Verloop (24 uur)", hr_resting_trend: "Rusthartslag", hr_none: "Nog geen metingen",
    body_note: "Experimenteel: de sensornamen voor deze waarden zijn niet op echte apparaten getest.",
    period_n: "{n} dagen", avg: "Gem.", best: "Beste dag", lowest: "Laagste dag", total: "Totaal",
    vs_prev: "t.o.v. vorige periode", goal_days: "Doel op {a} van {b} dagen", no_history: "Nog geen verloop. Het groeit elke dag.",
    days_with_data: "{n} dagen met gegevens",
    compare_title: "Profielvergelijking (7 dagen)", compare_note: "Gemiddelde van de laatste 7 dagen, alleen voor profielen die je mag zien.",
    cmp_steps: "Gem. stappen", cmp_goal_days: "Doeldagen",
    hints_title: "Trendhints", hints_note: "Opvallende veranderingen uit de vergelijking van dagwaarden. Geen medisch advies.",
    hint_up: "{metric}: gemiddelde van 7 dagen is {pct}% hoger dan in de 3 weken ervoor.",
    hint_down: "{metric}: gemiddelde van 7 dagen is {pct}% lager dan in de 3 weken ervoor.",
    hint_below_goal: "Slaap: het gemiddelde van 7 dagen ligt {pct}% onder je doel.", hints_none: "Momenteel geen opvallende veranderingen.",
    acc_app: "App-versie", acc_status: "Status", acc_profiles: "Profielen en apparaten", acc_goals: "Dagdoelen",
    acc_sensors: "Herkende sensoren", acc_options: "Opties", acc_privacy: "Privacy", acc_maint: "Onderhoud",
    acc_events: "Gebeurtenissen",
    app_integration: "Integratie", app_card: "Kaart", app_latest: "Nieuwste versie", app_checked: "Laatst gecontroleerd",
    app_check_now: "Nu controleren", app_release: "Release bekijken",
    app_update_hint: "Werk bij via HACS en herstart Home Assistant. Laad daarna de browser opnieuw (Ctrl+F5).",
    app_mismatch: "Kaart en integratie hebben verschillende versies. Wis de browsercache (Ctrl+F5).",
    app_check_failed: "Controle niet mogelijk", app_no_release: "Nog geen release gepubliceerd", app_up_to_date: "Actueel",
    st_profiles: "Profielen", st_devices: "Apparaten", st_sensors: "Sensoren met gegevens",
    dev_auto: "Automatisch", dev_ignore: "Negeren", dev_profile: "Toegewezen aan",
    goal_steps: "Stappen", goal_floors: "Verdiepingen", goal_active_energy: "Actieve energie (kcal)",
    goal_exercise_minutes: "Actieve minuten", goal_sleep_duration: "Slaap (uren)",
    save: "Opslaan", saved: "Opgeslagen", rescan: "Sensoren opnieuw zoeken", rescan_done: "Zoeken voltooid",
    admin_only: "Alleen beheerders kunnen dit wijzigen.", read_only_note: "Alleen weergave (read_only).",
    options_hint: "Opties wijzigen: Instellingen → Apparaten en diensten → Health Center → Configureren.",
    opt_show_all: "Alle profielen voor iedereen zichtbaar", opt_events: "Gebeurtenissen verzenden", opt_history: "Geschiedenis importeren (dagen)",
    on: "aan", off: "uit",
    privacy_note: "Gezondheidsgegevens zijn gevoelig. Niet-beheerders zien in deze kaart alleen hun eigen profiel, tenzij een beheerder alle profielen vrijgeeft. De sensoren van de Companion-app zelf blijven in Home Assistant voor alle gebruikers zichtbaar.",
    events_empty: "Nog geen gebeurtenissen sinds het starten.",
    ev_goal_reached: "Doel bereikt: {profile} – {metric}", ev_sensor_detected: "Sensor herkend: {metric} ({profile})",
    ev_sensor_lost: "Sensor verwijderd: {metric} ({profile})", ev_profile_added: "Profiel toegevoegd: {profile}",
    sensor_ok: "gegevens", sensor_no_data: "geen gegevens", sensor_disabled: "uitgeschakeld",
    pop_info: "Informatie", pop_chart: "Verloop", pop_source: "Bron", pop_diag: "Diagnose", pop_today: "Vandaag",
    pop_days: "Laatste {n} dagen", pop_entity: "Entiteit", pop_alias: "Herkend als", pop_updated: "Bijgewerkt",
    pop_sources: "Bronnen", open_entity: "Entiteit openen", copy: "Kopiëren", copied: "Gekopieerd", close: "Sluiten",
    exp_badge: "Experimenteel",
    exp_off: "Deze functie is niet ingeschakeld in het integratiedialoogvenster (Instellingen → Apparaten en diensten → Health Center → Configureren).",
    exp_extended_metrics: "Uitgebreide waarden", exp_sleep_score: "Slaapscore", exp_profile_compare: "Profielvergelijking",
    exp_trend_hints: "Trendhints",
  },
};

// ---------------------------------------------------------------- Stil
const CSS = `
:host{display:block}
*{box-sizing:border-box}
.root{--hc-zoom:1;container-type:inline-size;container-name:hc;font-size:calc(14px*var(--hc-zoom));padding:0;overflow:hidden;position:relative;color:var(--primary-text-color)}
.hdr{padding:.9em 1em .2em;font-size:1.3em;font-weight:500}
.banner{margin:.6em 1em 0;padding:.6em .8em;border-radius:8px;display:flex;gap:.6em;align-items:center;font-size:.95em;background:color-mix(in srgb,var(--c,var(--hc-color-live-banner)) 14%,transparent);border:1px solid color-mix(in srgb,var(--c,var(--hc-color-live-banner)) 55%,transparent)}
.banner.err{--c:var(--hc-color-error)}.banner.warn{--c:var(--hc-color-warning)}
.pbar{display:flex;gap:.5em;padding:.7em 1em 0;overflow-x:auto}
.pchip{display:flex;align-items:center;gap:.5em;padding:.3em .8em .3em .3em;border-radius:2em;border:1px solid var(--divider-color);background:transparent;color:inherit;cursor:pointer;font:inherit;white-space:nowrap}
.pchip.on{border-color:var(--hc-color-tab-active);background:color-mix(in srgb,var(--hc-color-tab-active) 14%,transparent)}
.avatar{width:2em;height:2em;border-radius:50%;background:var(--secondary-background-color);display:flex;align-items:center;justify-content:center;font-size:.9em;font-weight:600;overflow:hidden;background-size:cover;background-position:center}
.tabs{display:flex;border-bottom:1px solid var(--divider-color);margin-top:.6em;overflow-x:auto}
.tab{flex:1;min-width:3.2em;display:flex;align-items:center;justify-content:center;gap:.4em;padding:.7em .5em;border:0;background:transparent;color:var(--secondary-text-color);cursor:pointer;font:inherit;border-bottom:2px solid transparent;position:relative;white-space:nowrap}
.tab ha-icon{--mdc-icon-size:1.4em;color:var(--ic,inherit)}
.tab.on{color:var(--primary-text-color);border-bottom-color:var(--hc-color-tab-active)}
.tab .bdg{position:absolute;top:.2em;right:.1em;min-width:1.3em;height:1.3em;border-radius:1em;background:var(--hc-color-warning);color:#fff;font-size:.7em;display:flex;align-items:center;justify-content:center;padding:0 .3em}
@container hc (max-width:480px){.tab .lbl{display:none}}
.body{padding:.8em 1em 1em}
.chips{display:flex;gap:.5em;flex-wrap:wrap;margin-bottom:.8em}
.chip{display:inline-flex;align-items:center;gap:.4em;padding:.25em .7em;border-radius:2em;border:1px solid var(--divider-color);font-size:.9em;background:transparent;color:inherit;font-family:inherit}
button.chip{cursor:pointer}
.hero{display:flex;flex-wrap:wrap;gap:1em;justify-content:center;align-items:center;padding:.4em 0 1em}
.ringbox{position:relative;display:flex;align-items:center;justify-content:center}
.ringbox svg{display:block}
.ringc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.15}
.ringc .big{font-size:1.9em;font-weight:600}
.ringc .sm{font-size:.8em;color:var(--secondary-text-color)}
.ringc ha-icon{--mdc-icon-size:1.5em}
.ringlbl{text-align:center;font-size:.85em;color:var(--secondary-text-color);margin-top:.2em}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.6em}
@container hc (min-width:600px){.grid{grid-template-columns:repeat(3,1fr)}}
.tile{display:flex;flex-direction:column;gap:.25em;padding:.7em .8em;border-radius:12px;border:1px solid var(--divider-color);background:var(--card-background-color);color:inherit;text-align:left;cursor:pointer;font:inherit;min-width:0}
.tile:hover{border-color:var(--hc-color-tab-active)}
.tile .th{display:flex;align-items:center;gap:.5em;color:var(--secondary-text-color);font-size:.9em}
.tile .th ha-icon{--mdc-icon-size:1.3em;color:var(--ic)}
.tile .tv{font-size:1.5em;font-weight:600;line-height:1.15;overflow-wrap:anywhere}
.tile .tv small{font-size:.55em;font-weight:400;color:var(--secondary-text-color);margin-left:.2em}
.tile .ts{font-size:.8em;color:var(--secondary-text-color)}
.tile.dim .tv{color:var(--secondary-text-color)}
.badge{display:inline-block;padding:.05em .5em;border-radius:1em;font-size:.75em;border:1px solid color-mix(in srgb,var(--c,var(--secondary-text-color)) 60%,transparent);color:var(--c,var(--secondary-text-color));background:color-mix(in srgb,var(--c,var(--secondary-text-color)) 10%,transparent);white-space:nowrap}
.badge.warn{--c:var(--hc-color-warning)}.badge.err{--c:var(--hc-color-error)}.badge.ok{--c:var(--hc-color-success)}.badge.info{--c:var(--hc-color-info)}
.badge.exp{--c:var(--hc-color-warning)}
.pbarline{height:.5em;border-radius:1em;background:color-mix(in srgb,var(--c) 18%,transparent);overflow:hidden;margin-top:.2em}
.pbarline>i{display:block;height:100%;background:var(--c);border-radius:1em}
.sec{margin:1.1em 0 .4em;font-weight:500;display:flex;align-items:center;gap:.5em;flex-wrap:wrap}
.sec small{font-weight:400;color:var(--secondary-text-color)}
.muted{color:var(--secondary-text-color);font-size:.9em}
.empty{padding:1.6em .8em;text-align:center;color:var(--secondary-text-color)}
.empty ha-icon{--mdc-icon-size:2.4em;display:block;margin:0 auto .4em}
.bars{position:relative;display:flex;align-items:flex-end;gap:2px;height:7.5em;padding-top:.3em}
.bars.dense{gap:1px}
.bar{flex:1;height:100%;display:flex;align-items:flex-end;min-width:0}
.bar i{display:block;width:100%;border-radius:3px 3px 0 0;background:var(--c);min-height:2px;opacity:.85}
.bar.today i{opacity:1}.bar.none i{background:var(--divider-color);min-height:2px;height:2px!important}
.goalline{position:absolute;left:0;right:0;border-top:1px dashed var(--secondary-text-color);opacity:.7;pointer-events:none}
.axis{display:flex;gap:2px;font-size:.7em;color:var(--secondary-text-color);margin-top:.2em}
.axis span{flex:1;text-align:center;overflow:hidden;white-space:nowrap}
.chart{position:relative}
.chart svg{width:100%;height:7.5em;display:block}
.chart .yl{position:absolute;left:0;font-size:.7em;color:var(--secondary-text-color)}
.hyp{width:100%;height:6.5em;display:block}
.stack{display:flex;height:.8em;border-radius:1em;overflow:hidden;background:var(--divider-color)}
.stack i{display:block;height:100%}
.legend{display:flex;flex-wrap:wrap;gap:.4em 1em;margin-top:.5em;font-size:.85em}
.legend span{display:inline-flex;align-items:center;gap:.35em}
.legend b{display:inline-block;width:.8em;height:.8em;border-radius:3px}
.st-awake{--s:var(--hc-color-warning)}.st-rem{--s:color-mix(in srgb,var(--hc-color-sleep) 55%,var(--hc-color-info))}
.st-light{--s:color-mix(in srgb,var(--hc-color-sleep) 55%,white)}.st-deep{--s:var(--hc-color-sleep)}
.st-other{--s:var(--divider-color)}
.stat{border:1px solid var(--divider-color);border-radius:12px;padding:.7em .8em;margin-bottom:.6em}
.stat .sh{display:flex;align-items:center;gap:.5em;margin-bottom:.4em}
.stat .sh ha-icon{--mdc-icon-size:1.3em;color:var(--ic)}
.stat .sh .grow{flex:1;font-weight:500}
.kpis{display:flex;flex-wrap:wrap;gap:.3em 1.2em;margin-top:.5em;font-size:.9em}
.kpis div{display:flex;flex-direction:column}
.kpis small{color:var(--secondary-text-color);font-size:.8em}
.up{color:var(--hc-color-success)}.down{color:var(--hc-color-warning)}
.cmp{display:flex;flex-direction:column;gap:.4em}
.cmprow{display:grid;grid-template-columns:7em 1fr auto;gap:.6em;align-items:center}
.cmprow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hint{display:flex;gap:.6em;padding:.5em .7em;border-radius:8px;border:1px solid var(--divider-color);margin-bottom:.4em;font-size:.92em}
.hint.warning{border-color:color-mix(in srgb,var(--hc-color-warning) 60%,transparent)}
.settings-accordion{border:1px solid var(--divider-color);border-radius:8px;margin-bottom:.6em;overflow:hidden}
.settings-accordion.update{border-color:var(--hc-color-warning)}.settings-accordion.danger{border-color:var(--hc-color-error)}
.settings-accordion-summary{display:flex;align-items:center;gap:.6em;padding:.7em .8em;cursor:pointer;list-style:none;user-select:none}
.settings-accordion-summary::-webkit-details-marker{display:none}
.settings-accordion-summary ha-icon{--mdc-icon-size:1.3em;color:var(--hc-color-row-icon)}
.settings-accordion-summary::after{content:"";width:.5em;height:.5em;border-right:2px solid var(--secondary-text-color);border-bottom:2px solid var(--secondary-text-color);transform:rotate(45deg);margin:0 .3em 0 .2em;transition:transform .15s}
details[open]>.settings-accordion-summary::after{transform:rotate(225deg)}
.grow{flex:1;min-width:0}.meta{color:var(--secondary-text-color);font-size:.9em}
.settings-accordion-body{padding:.2em .8em .8em;border-top:1px solid var(--divider-color)}
.settings-line{display:flex;justify-content:space-between;gap:1em;padding:.35em 0;border-bottom:1px solid color-mix(in srgb,var(--divider-color) 50%,transparent)}
.settings-line:last-child{border-bottom:0}.settings-line span:first-child{color:var(--secondary-text-color)}.settings-line span:last-child{font-weight:500;text-align:right;overflow-wrap:anywhere}
.btn{display:inline-flex;align-items:center;gap:.4em;padding:.4em .9em;border-radius:6px;border:1px solid var(--divider-color);background:transparent;color:inherit;cursor:pointer;font:inherit}
.btn.primary{background:var(--hc-color-tab-active);border-color:var(--hc-color-tab-active);color:var(--text-primary-color,#fff)}
.btn.small{padding:.2em .6em;font-size:.9em}.btn.icon{padding:.3em}
.btn:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:.6em;flex-wrap:wrap;align-items:center;margin-top:.6em}
select,input[type=number]{font:inherit;color:inherit;background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:6px;padding:.3em .5em;max-width:100%}
input[type=number]{width:7em}
.frm{display:grid;grid-template-columns:1fr auto;gap:.5em .8em;align-items:center}
.devrow{padding:.5em 0;border-bottom:1px solid color-mix(in srgb,var(--divider-color) 50%,transparent)}
.devrow:last-child{border-bottom:0}.devrow .dn{font-weight:500}
.link{color:var(--hc-color-tab-active);cursor:pointer;background:none;border:0;font:inherit;padding:0;text-align:left}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:20;display:flex;align-items:center;justify-content:center;padding:1em}
.popup{width:100%;max-width:440px;max-height:86vh;display:flex;flex-direction:column;background:var(--card-background-color,#fff);border-radius:14px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35);font-size:calc(14px*var(--hc-zoom,1))}
.phead{display:flex;align-items:center;gap:.6em;padding:.8em 1em;border-bottom:1px solid var(--divider-color)}
.phead ha-icon{color:var(--ic)}.phead .grow{font-weight:500;font-size:1.1em}
.pbody{padding:.8em 1em 1em;overflow-y:auto}
.bigval{font-size:2.4em;font-weight:600;line-height:1.1}.bigval small{font-size:.4em;font-weight:400;color:var(--secondary-text-color);margin-left:.3em}
.toast{position:fixed;left:50%;bottom:1.6em;transform:translateX(-50%);background:var(--primary-text-color);color:var(--card-background-color);padding:.6em 1.1em;border-radius:2em;z-index:30;font-size:.95em;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.toast.err{background:var(--hc-color-error);color:#fff}
.sensorline{display:flex;gap:.6em;align-items:center;padding:.35em 0;border-bottom:1px solid color-mix(in srgb,var(--divider-color) 50%,transparent)}
.sensorline:last-child{border-bottom:0}.sensorline .grow{overflow:hidden}.sensorline .sub{font-size:.8em;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.note{font-size:.88em;color:var(--secondary-text-color);margin:.4em 0}
`;

// ---------------------------------------------------------------- Karte
class HealthCenterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cfg = {};
    this._hass = null;
    this._snap = null;
    this._err = null;
    this._unsub = null;
    this._subscribing = false;
    this._details = {};
    this._lastHtml = "";
    this._st = { tab: null, pid: null, period: 30, popup: null, acc: {}, toast: null, copied: false };
    this._toastTimer = null;
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
    this.shadowRoot.addEventListener("toggle", (e) => this._onToggle(e), true);
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._st.popup) { this._st.popup = null; this._render(); }
    });
  }

  static getConfigElement() { return document.createElement(EDITOR_TAG); }
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._cfg = { ...(config || {}) };
    this._st.period = [7, 30, 90].includes(Number(this._cfg.default_period)) ? Number(this._cfg.default_period) : 30;
    this._st.tab = null;
    this._lastHtml = "";
    this._render();
  }

  set hass(h) {
    this._hass = h;
    if (!this._unsub && !this._subscribing) this._subscribe();
    this._render();
  }

  getCardSize() { return 8; }
  connectedCallback() { if (this._hass && !this._unsub && !this._subscribing) this._subscribe(); }
  disconnectedCallback() {
    if (this._unsub) { try { this._unsub(); } catch (_) { /* ignorieren */ } }
    this._unsub = null;
  }

  async _subscribe() {
    if (!this._hass || !this._hass.connection) return;
    this._subscribing = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (ev) => {
          if (ev && ev.type === "snapshot") { this._snap = ev.data; this._err = null; this._render(); }
        },
        { type: `${DOMAIN}/subscribe` }
      );
    } catch (e) {
      this._err = (e && e.message) || "error";
      this._render();
    } finally {
      this._subscribing = false;
    }
  }

  // ------------------------------------------------------------ Hilfen
  _lang() {
    const l = (this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language))) || "en";
    return /^[a-z]{2,3}-[A-Z][a-z]{3}$/.test(l) ? l : String(l).split("-")[0];
  }
  _t(key, params) {
    const lang = this._lang();
    const dict = I18N[lang] || I18N[lang.split("-")[0]] || I18N.en;
    let s = dict[key] ?? I18N.en[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }
  _num(v, dec = 0) {
    if (typeof v !== "number" || !isFinite(v)) return "–";
    try { return new Intl.NumberFormat(this._lang(), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v); }
    catch (_) { return v.toFixed(dec); }
  }
  _time(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "–";
    try { return new Intl.DateTimeFormat(this._lang(), { hour: "2-digit", minute: "2-digit" }).format(d); }
    catch (_) { return d.toTimeString().slice(0, 5); }
  }
  _ago(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "–";
    const sec = Math.round((d.getTime() - Date.now()) / 1000);
    try {
      const rtf = new Intl.RelativeTimeFormat(this._lang(), { numeric: "auto" });
      const a = Math.abs(sec);
      if (a < 60) return rtf.format(Math.round(sec / 1), "second");
      if (a < 3600) return rtf.format(Math.round(sec / 60), "minute");
      if (a < 86400) return rtf.format(Math.round(sec / 3600), "hour");
      return rtf.format(Math.round(sec / 86400), "day");
    } catch (_) { return this._time(iso); }
  }
  _dur(min) {
    if (typeof min !== "number" || !isFinite(min)) return "–";
    const t = Math.round(min);
    const h = Math.floor(t / 60), m = t % 60;
    return h ? `${h} h ${m} min` : `${m} min`;
  }
  _pace(v) {
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return "–";
    const m = Math.floor(v), s = Math.round((v - m) * 60);
    return `${m}:${String(s === 60 ? 0 : s).padStart(2, "0")}`;
  }
  _cat(key) { return (this._snap && this._snap.catalog || []).find((c) => c.key === key); }
  _label(key) { return this._t(`m_${key}`); }
  _icon(key) { const c = this._cat(key); return (c && c.icon) || "mdi:heart-pulse"; }
  _color(key) { return `var(--hc-color-${METRIC_COLOR[key] || "tab-active"})`; }
  _expOn(f) { return this._cfg.show_experimental === true && this._cfg[`exp_${f}`] === true; }
  _expBackend(f) { return !!(this._snap && this._snap.experimental && this._snap.experimental.features.includes(f)); }
  _isAdmin() { return !!(this._snap && this._snap.admin) && this._cfg.read_only !== true; }
  _tabs() {
    const list = TAB_ORDER.filter((k) => {
      if (this._cfg[`show_${k}`] === false) return false;
      const m = TAB_META[k];
      if (m.experimental && !this._expOn(m.experimental)) return false;
      return true;
    });
    return list.length ? list : ["overview"];
  }
  _tab() {
    const tabs = this._tabs();
    const want = this._st.tab || this._cfg.default_tab || tabs[0];
    return tabs.includes(want) ? want : tabs[0];
  }
  _profile() {
    const ps = (this._snap && this._snap.profiles) || [];
    if (!ps.length) return null;
    const want = this._cfg.profile ? String(this._cfg.profile).toLowerCase() : "";
    if (want) {
      const f = ps.find((p) => [p.id, p.person, p.name].some((x) => String(x || "").toLowerCase() === want));
      if (f) return f;
    }
    return ps.find((p) => p.id === this._st.pid) || ps.find((p) => p.mine) || ps[0];
  }
  _m(key) { const p = this._profile(); return p && p.metrics ? p.metrics[key] : null; }
  _n(key) {
    const m = this._m(key);
    return m && m.q !== "stale" && m.q !== "no_data" && typeof m.v === "number" ? m.v : null;
  }
  _fv(key, v) {
    const dec = (this._cat(key) || {}).decimals || 0;
    switch (key) {
      case "sleep_duration": case "sleep_deep": case "sleep_light": case "sleep_rem": case "sleep_awake": case "in_bed":
        return { v: this._dur(v), u: "" };
      case "exercise_minutes": return { v: this._num(v, 0), u: "min" };
      case "pace": return { v: this._pace(v), u: "min/km" };
      case "steps": return { v: this._num(v, 0), u: "" };
      case "floors": return { v: this._num(v, 0), u: "" };
      default: return { v: this._num(v, dec), u: (this._cat(key) || {}).unit || "" };
    }
  }
  _colorVars() {
    const out = [];
    for (const [k, def] of Object.entries(COLOR_CONFIG_KEYS)) {
      const v = sanitizeColor(this._cfg[`color_${k}`]);
      out.push(`${def.cssVar}:${v || def.fallback}`);
    }
    const rowAll = sanitizeColor(this._cfg.color_row_icon);
    for (const tab of TAB_ORDER) {
      const v = rowAll || sanitizeColor(this._cfg[CATEGORY_ICON_COLOR_KEYS[tab]]);
      if (v) out.push(`--hc-ic-${tab}:${v}`);
    }
    const z = clamp(Number(this._cfg.zoom) || 1, 0.7, 1.6);
    out.push(`--hc-zoom:${z}`);
    return out.join(";");
  }
  _tabIcColor(tab) { return `var(--hc-ic-${tab}, inherit)`; }

  // ------------------------------------------------------------ Diagramme
  _ring(pct, color, size, stroke, inner) {
    const p = clamp(isFinite(pct) ? pct : 0, 0, 100);
    const r = (size - stroke) / 2, c = size / 2;
    return `<div class="ringbox" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".18" stroke-width="${stroke}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" pathLength="100" stroke-dasharray="${p.toFixed(2)} 100" transform="rotate(-90 ${c} ${c})"/>
      </svg><div class="ringc">${inner}</div></div>`;
  }
  _bars(series, opts) {
    const o = opts || {};
    const vals = series.map((s) => (typeof s.v === "number" ? s.v : null));
    const max = Math.max(o.goal || 0, ...vals.filter((v) => v !== null), 1) * 1.08;
    const dense = series.length > 31;
    const lang = this._lang();
    const todayIso = new Date().toISOString().slice(0, 10);
    const bars = series.map((s, i) => {
      const v = vals[i];
      const h = v === null ? 0 : clamp((v / max) * 100, 2, 100);
      const lbl = `${s.d}: ${v === null ? "–" : (o.fmt ? o.fmt(v) : this._num(v, o.dec || 0))}`;
      return `<div class="bar ${v === null ? "none" : ""} ${i === series.length - 1 ? "today" : ""}" title="${esc(lbl)}"><i style="height:${h.toFixed(1)}%"></i></div>`;
    }).join("");
    const goal = o.goal ? `<div class="goalline" style="bottom:${clamp((o.goal / max) * 100, 0, 100).toFixed(1)}%"></div>` : "";
    const every = series.length <= 8 ? 1 : series.length <= 16 ? 2 : series.length <= 35 ? 7 : 14;
    const axis = series.map((s, i) => {
      if ((series.length - 1 - i) % every !== 0 && series.length > 8) return "<span></span>";
      const d = new Date(`${s.d}T12:00:00`);
      let t = "";
      try {
        t = series.length <= 8
          ? new Intl.DateTimeFormat(lang, { weekday: "short" }).format(d)
          : new Intl.DateTimeFormat(lang, { day: "numeric", month: "numeric" }).format(d);
      } catch (_) { t = s.d.slice(5); }
      return `<span>${esc(t)}</span>`;
    }).join("");
    void todayIso;
    return `<div style="--c:${o.color || "var(--hc-color-tab-active)"}"><div class="bars ${dense ? "dense" : ""}">${bars}${goal}</div><div class="axis">${axis}</div></div>`;
  }
  _line(samples, color, opts) {
    const o = opts || {};
    const pts = (samples || []).filter((p) => typeof p[1] === "number");
    if (pts.length < 2) return `<div class="muted">${esc(this._t("hr_none"))}</div>`;
    const now = Date.now(), t0 = now - 86400000;
    const vals = pts.map((p) => p[1]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 10) { lo -= 5; hi += 5; }
    const W = 300, H = 100;
    const xy = pts.map((p) => `${(clamp((p[0] - t0) / 86400000, 0, 1) * W).toFixed(1)},${(H - ((p[1] - lo) / (hi - lo)) * (H - 8) - 4).toFixed(1)}`);
    const area = `${xy[0].split(",")[0]},${H} ${xy.join(" ")} ${xy[xy.length - 1].split(",")[0]},${H}`;
    void o;
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(this._t("hr_24h"))}">
      <polygon points="${area}" fill="${color}" fill-opacity=".12"/>
      <polyline points="${xy.join(" ")}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
      <span class="yl" style="top:0">${esc(this._num(hi, 0))}</span><span class="yl" style="bottom:0">${esc(this._num(lo, 0))}</span></div>
      <div class="axis"><span>-24 h</span><span>-18 h</span><span>-12 h</span><span>-6 h</span><span>${esc(this._t("today"))}</span></div>`;
  }
  _hypnogram(stages) {
    const list = (stages || []).map((s) => ({ a: new Date(s[0]).getTime(), b: new Date(s[1]).getTime(), t: s[2] })).filter((s) => isFinite(s.a) && isFinite(s.b) && s.b > s.a);
    if (!list.length) return "";
    const t0 = Math.min(...list.map((s) => s.a)), t1 = Math.max(...list.map((s) => s.b));
    const W = 300, H = 80, lanes = { awake: 0, rem: 1, light: 2, deep: 3, other: 2 };
    const rects = list.map((s) => {
      const x = ((s.a - t0) / (t1 - t0)) * W, w = Math.max(((s.b - s.a) / (t1 - t0)) * W, 0.6);
      const y = lanes[s.t] * 20 + 2;
      return `<rect x="${x.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="16" rx="2" class="st-${esc(s.t)}" fill="var(--s)"/>`;
    }).join("");
    return `<svg class="hyp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(this._t("sleep_stages"))}">${rects}</svg>
      <div class="axis"><span style="text-align:left">${esc(this._time(new Date(t0).toISOString()))}</span><span style="text-align:right">${esc(this._time(new Date(t1).toISOString()))}</span></div>`;
  }
  _stageStack() {
    const parts = [["awake", "sleep_awake"], ["rem", "sleep_rem"], ["light", "sleep_light"], ["deep", "sleep_deep"]]
      .map(([st, key]) => [st, this._n(key)]).filter((p) => typeof p[1] === "number" && p[1] > 0);
    const total = parts.reduce((a, p) => a + p[1], 0);
    if (!total) return "";
    const seg = parts.map(([st, v]) => `<i class="st-${st}" style="width:${((v / total) * 100).toFixed(1)}%;background:var(--s)" title="${esc(this._t(`st_${st}`))}: ${esc(this._dur(v))}"></i>`).join("");
    const leg = parts.map(([st, v]) => `<span class="st-${st}"><b style="background:var(--s)"></b>${esc(this._t(`st_${st}`))} ${esc(this._dur(v))} (${Math.round((v / total) * 100)} %)</span>`).join("");
    return `<div class="stack">${seg}</div><div class="legend">${leg}</div>`;
  }
  _legendStages() {
    return `<div class="legend">${STAGES.map((st) => `<span class="st-${st}"><b style="background:var(--s)"></b>${esc(this._t(`st_${st}`))}</span>`).join("")}</div>`;
  }

  // ------------------------------------------------------------ Daten nachladen
  _dkey(pid, metric, days) { return `${pid}|${metric || "*"}|${days}`; }
  _getDetails(pid, metric, days) { const c = this._details[this._dkey(pid, metric, days)]; return c && c.data ? c.data : null; }
  _need(pid, metric, days) {
    const key = this._dkey(pid, metric, days);
    const c = this._details[key];
    if (c && (c.pending || Date.now() - c.t < 60000)) return;
    this._fetch(key, pid, metric, days);
  }
  async _fetch(key, pid, metric, days) {
    if (!this._hass || !this._hass.connection) return;
    const prev = this._details[key];
    this._details[key] = { ...(prev || {}), pending: true, t: (prev && prev.t) || 0 };
    try {
      const msg = { type: `${DOMAIN}/details`, profile: pid, days };
      if (metric) msg.metric = metric;
      const data = await this._hass.connection.sendMessagePromise(msg);
      this._details[key] = { t: Date.now(), data };
    } catch (_) {
      this._details[key] = { t: Date.now(), error: true, data: prev && prev.data };
    }
    this._render();
  }
  _ensureData() {
    const p = this._profile();
    if (!p || !this._snap) return;
    const tab = this._tab();
    if (["activity", "sleep", "heart", "body"].includes(tab)) this._need(p.id, null, 30);
    if (tab === "stats") this._need(p.id, null, this._st.period * 2);
    if (tab === "heart") this._need(p.id, "heart_rate", 30);
    if (this._st.popup) this._need(p.id, this._st.popup, 30);
  }
  _series(pid, key, days) {
    const all = this._getDetails(pid, null, days);
    const rows = all && all.daily && all.daily[key];
    if (!rows) return null;
    return rows.map((r) => ({ d: r.d, v: r.v }));
  }
  _seriesAny(pid, key, days) {
    const cached = Object.keys(this._details).filter((k) => k.startsWith(`${pid}|*|`)).map((k) => Number(k.split("|")[2])).sort((a, b) => b - a);
    for (const d of cached) {
      const s = this._series(pid, key, d);
      if (s) return s.slice(-days);
    }
    return null;
  }

  // ------------------------------------------------------------ Teile
  _tile(key, o) {
    const m = this._m(key);
    if (!m) return "";
    const opts = o || {};
    const usable = m.q !== "no_data" && m.q !== "stale" && m.v !== null && m.v !== undefined;
    let value = "–", unit = "";
    if (key === "activity_state") {
      value = this._actLabel(m.v);
    } else if (key === "sleep_start" || key === "sleep_end") {
      value = usable ? this._time(m.v) : "–";
    } else if (usable) {
      const f = this._fv(key, m.v);
      value = f.v; unit = f.u;
    }
    let sub = opts.sub || "";
    if (!sub && m.t) sub = this._ago(m.t);
    const badge = m.q === "stale" ? this._t("q_stale") : m.q === "since_reboot" ? this._t("q_since_reboot") : m.q === "no_data" ? this._t("q_no_data") : "";
    const goalKey = (this._cat(key) || {}).goal;
    const p = this._profile();
    const goal = goalKey && p && p.goals ? p.goals[goalKey] : null;
    const color = this._color(key);
    let prog = "";
    if (goal && usable && typeof m.v === "number") prog = `<div class="pbarline" style="--c:${color}"><i style="width:${clamp((m.v / goal) * 100, 0, 100).toFixed(0)}%"></i></div>`;
    return `<button class="tile ${usable ? "" : "dim"}" data-act="metric" data-m="${esc(key)}" style="--ic:${color}" aria-label="${esc(this._label(key))}">
      <span class="th"><ha-icon icon="${esc(this._icon(key))}"></ha-icon>${esc(this._label(key))}</span>
      <span class="tv">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ""}</span>
      ${prog}<span class="ts">${esc(sub)}${badge ? ` <span class="badge warn">${esc(badge)}</span>` : ""}</span></button>`;
  }
  _actLabel(raw) {
    const s = String(raw || "").toLowerCase().replace(/[\s-]+/g, "_");
    const map = {
      still: "still", stationary: "still", walking: "walking", running: "running", on_bicycle: "cycling", cycling: "cycling",
      in_vehicle: "vehicle", automotive: "vehicle", on_foot: "on_foot", tilting: "tilting", asleep: "asleep",
      exercise: "exercise", passive: "passive",
    };
    return this._t(`act_${map[s] || "unknown"}`);
  }
  _ringMetric(key, size, label) {
    const m = this._m(key);
    const p = this._profile();
    const cat = this._cat(key) || {};
    const goal = cat.goal && p.goals ? p.goals[cat.goal] : null;
    const v = this._n(key);
    const pct = goal && v !== null ? (v / goal) * 100 : 0;
    const f = v !== null ? this._fv(key, v) : { v: "–", u: "" };
    const color = this._color(key);
    const inner = `<ha-icon icon="${esc(this._icon(key))}" style="color:${color}"></ha-icon><span class="big" style="font-size:${size > 120 ? 1.9 : 1.2}em">${esc(f.v)}</span>` +
      (goal ? `<span class="sm">${esc(this._t("of_goal", { goal: key === "sleep_duration" ? this._dur(goal) : this._num(goal, 0) }))}</span>` : (f.u ? `<span class="sm">${esc(f.u)}</span>` : ""));
    return `<button class="tile" style="border:0;background:transparent;align-items:center;cursor:pointer" data-act="metric" data-m="${esc(key)}" aria-label="${esc(label || this._label(key))}">${this._ring(pct, color, size, size > 120 ? 14 : 10, inner)}<span class="ringlbl">${esc(label || this._label(key))}${m && m.q === "stale" ? ` · ${esc(this._t("q_stale"))}` : ""}</span></button>`;
  }
  _acc(k, icon, title, body, o) {
    const opts = o || {};
    const open = this._st.acc[k] !== undefined ? this._st.acc[k] : !!opts.open;
    return `<details class="settings-accordion ${opts.cls || ""}" data-k="${esc(k)}" ${open ? "open" : ""}>
      <summary class="settings-accordion-summary"><ha-icon icon="${esc(icon)}"></ha-icon><span class="grow">${esc(title)}</span>${opts.meta ? `<span class="meta">${esc(opts.meta)}</span>` : ""}</summary>
      <div class="settings-accordion-body">${body}</div></details>`;
  }
  _line(label, value) { return `<div class="settings-line"><span>${esc(label)}</span><span>${esc(value)}</span></div>`; }
  _expBadge() { return `<span class="badge exp">${esc(this._t("exp_badge"))}</span>`; }
  _empty(icon, text, hint) {
    return `<div class="empty"><ha-icon icon="${esc(icon)}"></ha-icon><div>${esc(text)}</div>${hint ? `<div class="note">${esc(hint)}</div>` : ""}</div>`;
  }
  _picture(p) {
    const u = p && p.picture;
    if (u && (String(u).startsWith("/") || String(u).startsWith("https://"))) return `style="background-image:url('${esc(u)}')"`;
    return "";
  }
  _initials(name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase(); }

  // ------------------------------------------------------------ Tabs
  _viewOverview(p) {
    const have = Object.keys(p.metrics || {});
    if (!have.length) return this._noSensors(p);
    const ringKeys = ["steps", "exercise_minutes", "active_energy"].filter((k) => p.metrics[k]);
    const hero = ringKeys.length
      ? `<div class="hero">${ringKeys.map((k, i) => this._ringMetric(k, i === 0 ? 150 : 100)).join("")}</div>` : "";
    const order = ["heart_rate", "sleep_duration", "distance", "floors", "activity_state", "resting_hr", "hrv", "vo2_max", "total_energy", "elevation", "pace", "walking_hr"];
    const tiles = order.filter((k) => p.metrics[k]).map((k) => {
      if (k === "sleep_duration") return this._tile(k, { sub: this._sleepSub() });
      if (k === "heart_rate") return this._tile(k, { sub: this._ago(p.metrics[k].t) });
      return this._tile(k);
    }).join("");
    const reached = this._goalsReached(p);
    const chips = `<div class="chips"><button class="chip" data-act="tab" data-tab="settings"><ha-icon icon="mdi:radar" style="--mdc-icon-size:1.1em"></ha-icon>${esc(this._t("sensors_detected", { n: (this._snap.sensors || []).filter((s) => s.profile === p.id && s.status === "ok").length }))}</button>` +
      (reached.total ? `<span class="chip"><ha-icon icon="mdi:flag-checkered" style="--mdc-icon-size:1.1em"></ha-icon>${esc(this._t("goals_today", { a: reached.hit, b: reached.total }))}</span>` : "") + `</div>`;
    return `${chips}${hero}<div class="grid">${tiles}</div>${this._missing(p)}`;
  }
  _goalsReached(p) {
    let hit = 0, total = 0;
    for (const key of ["steps", "floors", "active_energy", "exercise_minutes"]) {
      const m = p.metrics[key], g = p.goals && p.goals[(this._cat(key) || {}).goal];
      if (!m || !g) continue;
      total += 1;
      if (this._n(key) !== null && this._n(key) >= g) hit += 1;
    }
    return { hit, total };
  }
  _sleepSub() {
    const s = this._m("sleep_start"), e = this._m("sleep_end");
    if (s && e && s.q !== "no_data" && e.q !== "no_data") return `${this._time(s.v)} – ${this._time(e.v)}`;
    return this._ago((this._m("sleep_duration") || {}).t);
  }
  _noSensors(p) {
    const apps = (this._snap.apps || []).filter((a) => p.devices.includes(a.entry));
    void apps;
    return this._empty("mdi:cellphone-link", this._t("no_sensors"), this._t("no_sensors_hint")) + this._missing(p, true);
  }
  _missing(p, openIt) {
    const have = new Set(Object.keys(p.metrics || {}));
    const platforms = new Set((this._snap.apps || []).filter((a) => (p.devices || []).includes(a.entry)).map((a) => a.platform));
    const rows = (this._snap.catalog || []).filter((c) => !have.has(c.key) && !c.experimental && !["activity_state", "sleep_start", "sleep_end"].includes(c.key));
    if (!rows.length) return "";
    const body = `<div class="note">${esc(this._t("missing_hint"))}</div>` + rows.map((c) => {
      const hints = [];
      for (const pl of ["android", "ios"]) {
        if ((platforms.size === 0 || platforms.has(pl)) && c.hint && c.hint[pl]) hints.push(`${this._t(pl)}: ${c.hint[pl]}`);
      }
      return `<div class="sensorline"><ha-icon icon="${esc(c.icon)}" style="--mdc-icon-size:1.3em"></ha-icon><div class="grow"><div>${esc(this._label(c.key))}</div><div class="sub">${esc(hints.join(" · "))}</div></div></div>`;
    }).join("");
    return `<div style="margin-top:.9em">${this._acc("missing", "mdi:radar", this._t("missing_title"), body, { meta: String(rows.length), open: !!openIt })}</div>`;
  }
  _viewActivity(p) {
    if (!["steps", "distance", "floors", "active_energy", "exercise_minutes", "activity_state"].some((k) => p.metrics[k])) return this._noSensors(p);
    const hero = p.metrics.steps ? `<div class="hero">${this._ringMetric("steps", 150)}</div>` : "";
    const ser = p.metrics.steps ? this._seriesAny(p.id, "steps", 7) : null;
    const bars = ser ? `<div class="sec">${esc(this._t("pop_days", { n: 7 }))}<small>${esc(this._label("steps"))}</small></div>${this._bars(ser, { goal: p.goals.steps, color: this._color("steps") })}` : "";
    const tiles = ["distance", "floors", "active_energy", "exercise_minutes", "total_energy", "elevation", "pace", "activity_state"].filter((k) => p.metrics[k]).map((k) => this._tile(k)).join("");
    return `${hero}<div class="grid">${tiles}</div>${bars}`;
  }
  _viewSleep(p) {
    if (!p.metrics.sleep_duration) return this._noSensors(p);
    const m = p.metrics.sleep_duration, goal = p.goals.sleep_duration;
    const usable = m.q !== "no_data" && typeof m.v === "number";
    const color = this._color("sleep_duration");
    const prog = usable && goal ? `<div class="pbarline" style="--c:${color}"><i style="width:${clamp((m.v / goal) * 100, 0, 100).toFixed(0)}%"></i></div><div class="muted">${esc(this._t("sleep_goal"))}: ${esc(this._dur(goal))}</div>` : "";
    const hyp = this._hypnogram(p.stages);
    const stack = this._stageStack();
    const stageBlock = hyp ? `${hyp}${this._legendStages()}` : (stack || `<div class="muted">${esc(this._t("stage_na"))}</div>`);
    const ser = this._seriesAny(p.id, "sleep_duration", 14);
    const week = ser ? `<div class="sec">${esc(this._t("sleep_week"))}</div>${this._bars(ser.slice(-7), { goal, color, fmt: (v) => this._dur(v) })}` : "";
    let score = "";
    if (this._expOn("sleep_score")) {
      if (!this._expBackend("sleep_score")) score = `<div class="sec">${esc(this._t("sleep_score"))} ${this._expBadge()}</div><div class="note">${esc(this._t("exp_off"))}</div>`;
      else if (p.sleep_score) score = `<div class="sec">${esc(this._t("sleep_score"))} ${this._expBadge()}</div><div class="hero">${this._ring(p.sleep_score.score, color, 100, 10, `<span class="big" style="font-size:1.8em">${esc(p.sleep_score.score)}</span><span class="sm">/ 100</span>`)}</div><div class="note">${esc(this._t("sleep_score_note"))}</div>`;
    }
    return `<div class="sec">${esc(this._t("sleep_last"))}</div><div class="bigval">${esc(usable ? this._dur(m.v) : "–")}</div>${prog}
      <div class="row muted"><span>${esc(this._t("bedtime"))}: ${esc(p.metrics.sleep_start ? this._time(p.metrics.sleep_start.v) : "–")}</span><span>${esc(this._t("waketime"))}: ${esc(p.metrics.sleep_end ? this._time(p.metrics.sleep_end.v) : "–")}</span></div>
      <div class="sec">${esc(this._t("sleep_stages"))}</div>${stageBlock}${week}${score}`;
  }
  _viewHeart(p) {
    if (!["heart_rate", "resting_hr", "hrv", "vo2_max", "walking_hr"].some((k) => p.metrics[k])) return this._noSensors(p);
    let top = "";
    const hr = p.metrics.heart_rate;
    if (hr) {
      const det = this._getDetails(p.id, "heart_rate", 30);
      const samples = det ? det.samples : [];
      const vals = (samples || []).map((s) => s[1]).filter((v) => typeof v === "number");
      const stat = vals.length
        ? `<div class="kpis"><div><small>${esc(this._t("hr_min"))}</small><b>${esc(this._num(Math.min(...vals)))}</b></div><div><small>${esc(this._t("hr_avg"))}</small><b>${esc(this._num(vals.reduce((a, b) => a + b, 0) / vals.length))}</b></div><div><small>${esc(this._t("hr_max"))}</small><b>${esc(this._num(Math.max(...vals)))}</b></div></div>` : "";
      top = `<div class="sec">${esc(this._t("hr_now"))}</div><div class="bigval" style="color:${this._color("heart_rate")}">${esc(this._n("heart_rate") !== null ? this._num(hr.v) : "–")}<small>bpm</small></div>
        <div class="muted">${esc(this._ago(hr.t))}</div>${stat}<div class="sec">${esc(this._t("hr_24h"))}</div>${this._line(samples, this._color("heart_rate"))}`;
    }
    const tiles = ["resting_hr", "hrv", "walking_hr", "vo2_max"].filter((k) => p.metrics[k]).map((k) => this._tile(k)).join("");
    const ser = p.metrics.resting_hr ? this._seriesAny(p.id, "resting_hr", 14) : null;
    const trend = ser ? `<div class="sec">${esc(this._t("hr_resting_trend"))}<small>${esc(this._t("pop_days", { n: 14 }))}</small></div>${this._bars(ser, { color: this._color("resting_hr") })}` : "";
    return `${top}<div class="grid" style="margin-top:.8em">${tiles}</div>${trend}`;
  }
  _viewBody(p) {
    let out = `<div class="note">${this._expBadge()} ${esc(this._t("body_note"))}</div>`;
    if (!this._expBackend("extended_metrics")) return `${out}<div class="note">${esc(this._t("exp_off"))}</div>`;
    const keys = ["weight", "body_fat", "spo2", "respiratory_rate", "body_temp"].filter((k) => p.metrics[k]);
    const tiles = keys.map((k) => this._tile(k)).join("");
    let bp = "";
    if (p.metrics.bp_systolic || p.metrics.bp_diastolic) {
      const s = this._n("bp_systolic"), d = this._n("bp_diastolic");
      bp = `<button class="tile" data-act="metric" data-m="${p.metrics.bp_systolic ? "bp_systolic" : "bp_diastolic"}"><span class="th"><ha-icon icon="mdi:heart-flash"></ha-icon>${esc(this._t("m_bp_systolic"))} / ${esc(this._t("m_bp_diastolic"))}</span><span class="tv">${esc(s !== null ? this._num(s) : "–")} / ${esc(d !== null ? this._num(d) : "–")}<small>mmHg</small></span></button>`;
    }
    if (!tiles && !bp) return out + this._noSensors(p);
    const ser = p.metrics.weight ? this._seriesAny(p.id, "weight", 30) : null;
    const wt = ser ? `<div class="sec">${esc(this._label("weight"))}<small>${esc(this._t("pop_days", { n: 30 }))}</small></div>${this._bars(ser, { color: "var(--hc-color-tab-active)", dec: 1 })}` : "";
    return `${out}<div class="grid">${tiles}${bp}</div>${wt}`;
  }
  _periodStats(rows, days) {
    const cur = rows.slice(-days).map((r) => r.v).filter((v) => typeof v === "number");
    const prev = rows.slice(-days * 2, -days).map((r) => r.v).filter((v) => typeof v === "number");
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const a = avg(cur), pa = avg(prev);
    return { cur, avg: a, min: cur.length ? Math.min(...cur) : null, max: cur.length ? Math.max(...cur) : null, sum: cur.reduce((x, y) => x + y, 0), delta: a !== null && pa ? ((a - pa) / pa) * 100 : null };
  }
  _viewStats(p) {
    const days = this._st.period;
    const chips = `<div class="chips">${[7, 30, 90].map((d) => `<button class="chip ${d === days ? "on" : ""}" style="${d === days ? "border-color:var(--hc-color-tab-active)" : ""}" data-act="period" data-d="${d}">${esc(this._t("period_n", { n: d }))}</button>`).join("")}</div>`;
    const data = this._getDetails(p.id, null, days * 2);
    if (!data) return `${chips}<div class="muted">${esc(this._t("loading"))}</div>`;
    const order = ["steps", "distance", "floors", "active_energy", "exercise_minutes", "sleep_duration", "heart_rate", "resting_hr", "hrv", "vo2_max", "weight", "spo2"];
    const cards = order.filter((k) => data.daily[k]).map((k) => {
      const rows = data.daily[k].map((r) => ({ d: r.d, v: r.v }));
      const st = this._periodStats(rows, days);
      if (!st.cur.length) return "";
      const goalKey = (this._cat(k) || {}).goal, goal = goalKey ? p.goals[goalKey] : null;
      const fmt = (v) => { const f = this._fv(k, v); return f.u && !["min", "bpm"].includes(f.u) ? `${f.v} ${f.u}` : f.u ? `${f.v} ${f.u}` : f.v; };
      const dec = (this._cat(k) || {}).decimals || 0;
      const goalDays = goal ? st.cur.filter((v) => v >= goal).length : null;
      const delta = st.delta !== null ? `<span class="${st.delta >= 0 ? "up" : "down"}">${st.delta >= 0 ? "▲" : "▼"} ${esc(this._num(Math.abs(st.delta), 0))} % <small>${esc(this._t("vs_prev"))}</small></span>` : "";
      const total = ["steps", "distance", "floors", "active_energy", "exercise_minutes"].includes(k) ? `<div><small>${esc(this._t("total"))}</small><b>${esc(fmt(st.sum))}</b></div>` : "";
      return `<div class="stat" style="--ic:${this._color(k)}"><div class="sh"><ha-icon icon="${esc(this._icon(k))}"></ha-icon><span class="grow">${esc(this._label(k))}</span>${delta}</div>
        ${this._bars(rows.slice(-days), { goal, color: this._color(k), fmt, dec })}
        <div class="kpis"><div><small>${esc(this._t("avg"))}</small><b>${esc(fmt(st.avg))}</b></div><div><small>${esc(this._t("best"))}</small><b>${esc(fmt(["resting_hr"].includes(k) ? st.min : st.max))}</b></div><div><small>${esc(this._t("lowest"))}</small><b>${esc(fmt(["resting_hr"].includes(k) ? st.max : st.min))}</b></div>${total}
        ${goalDays !== null ? `<div><small>${esc(this._t("goal"))}</small><b>${esc(this._t("goal_days", { a: goalDays, b: st.cur.length }))}</b></div>` : ""}</div></div>`;
    }).join("");
    let extra = "";
    if (this._expOn("profile_compare")) {
      extra += `<div class="sec">${esc(this._t("compare_title"))} ${this._expBadge()}</div>`;
      if (!this._expBackend("profile_compare")) extra += `<div class="note">${esc(this._t("exp_off"))}</div>`;
      else if (this._snap.compare && this._snap.compare.length) {
        const max = Math.max(...this._snap.compare.map((r) => r.steps_avg || 0), 1);
        extra += `<div class="note">${esc(this._t("compare_note"))}</div><div class="cmp">${this._snap.compare.map((r) => `<div class="cmprow"><span class="nm">${esc(r.name)}</span><div class="pbarline" style="--c:var(--hc-color-steps);margin:0"><i style="width:${((r.steps_avg || 0) / max * 100).toFixed(0)}%"></i></div><span>${esc(this._num(r.steps_avg))} · ${esc(this._t("cmp_goal_days"))} ${esc(r.goal_days)}/${esc(r.days)}</span></div>`).join("")}</div>`;
      } else extra += `<div class="note">${esc(this._t("compare_note"))}</div>`;
    }
    if (this._expOn("trend_hints")) {
      extra += `<div class="sec">${esc(this._t("hints_title"))} ${this._expBadge()}</div>`;
      if (!this._expBackend("trend_hints")) extra += `<div class="note">${esc(this._t("exp_off"))}</div>`;
      else {
        const hints = p.hints || [];
        extra += `<div class="note">${esc(this._t("hints_note"))}</div>` + (hints.length ? hints.map((h) => {
          const txt = this._t(h.kind === "below_goal" ? "hint_below_goal" : h.kind === "up" ? "hint_up" : "hint_down", { metric: this._label(h.metric), pct: this._num(Math.abs(h.delta), 0) });
          return `<div class="hint ${esc(h.severity)}"><ha-icon icon="mdi:information-outline"></ha-icon><span>${esc(txt)}</span></div>`;
        }).join("") : `<div class="muted">${esc(this._t("hints_none"))}</div>`);
      }
    }
    return `${chips}${cards || `<div class="muted">${esc(this._t("no_history"))}</div>`}${extra}`;
  }
  _viewSettings(p) {
    const s = this._snap, app = s.app || {};
    const mismatch = s.version !== CARD_VERSION;
    const upd = !!app.update_available;
    const check = app.check_failed ? this._t("app_check_failed") : app.no_release ? this._t("app_no_release") : app.latest_version || "–";
    const rel = app.release_url && String(app.release_url).startsWith("https://github.com/") ? app.release_url : "";
    const admin = this._isAdmin();
    let html = this._acc("app", "mdi:tag-outline", this._t("acc_app"),
      this._line(this._t("app_integration"), s.version) + this._line(this._t("app_card"), CARD_VERSION) +
      this._line(this._t("app_latest"), check) + this._line(this._t("app_checked"), app.checked_at ? this._ago(app.checked_at) : "–") +
      (upd ? `<div class="banner warn" style="margin:.5em 0">${esc(this._t("app_update_hint"))}</div>` : "") +
      (mismatch ? `<div class="banner warn" style="margin:.5em 0">${esc(this._t("app_mismatch"))}</div>` : "") +
      `<div class="row">${admin ? `<button class="btn" data-act="check-update">${esc(this._t("app_check_now"))}</button>` : ""}${rel ? `<a class="btn" href="${esc(rel)}" target="_blank" rel="noopener noreferrer">${esc(this._t("app_release"))}</a>` : ""}</div>`,
      { open: true, cls: upd || mismatch ? "update" : "", meta: upd ? `↑ ${app.latest_version}` : "" });
    const okSensors = (s.sensors || []).filter((x) => x.status === "ok").length;
    html += this._acc("status", "mdi:heart-pulse", this._t("acc_status"),
      this._line(this._t("st_profiles"), s.profiles.length) + this._line(this._t("st_devices"), (s.apps || []).length) +
      this._line(this._t("st_sensors"), `${okSensors} / ${(s.sensors || []).length}`), { open: true });
    // Profile und Geräte
    const persons = s.persons || [];
    const devs = (s.apps || []).map((a) => {
      const prof = s.profiles.find((x) => x.id === a.profile);
      const sel = admin ? `<select data-change="assign" data-dev="${esc(a.entry)}" aria-label="${esc(this._t("dev_profile"))}">
        <option value="" ${a.assigned === "" ? "selected" : ""}>${esc(this._t("dev_auto"))}</option>
        <option value="ignore" ${a.assigned === "ignore" ? "selected" : ""}>${esc(this._t("dev_ignore"))}</option>
        ${persons.map((x) => `<option value="${esc(x.entity_id)}" ${a.assigned === x.entity_id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : `<span class="muted">${esc(prof ? prof.name : this._t("dev_ignore"))}</span>`;
      return `<div class="devrow"><div class="dn">${esc(a.name)} <span class="badge">${esc(this._t(a.platform || "unknown_platform"))}</span></div>
        <div class="muted">${esc([a.model, a.os_version].filter(Boolean).join(" · "))}</div><div class="row">${esc(this._t("dev_profile"))}: ${sel}</div></div>`;
    }).join("");
    html += this._acc("profiles", "mdi:account-multiple", this._t("acc_profiles"), devs || `<div class="muted">${esc(this._t("no_apps"))}</div>`, { meta: String((s.apps || []).length) });
    // Ziele
    if (p) {
      const fields = [["steps", "goal_steps", 1], ["floors", "goal_floors", 1], ["active_energy", "goal_active_energy", 1], ["exercise_minutes", "goal_exercise_minutes", 1], ["sleep_duration", "goal_sleep_duration", 60]];
      const frm = fields.map(([g, lbl, div]) => `<label for="g_${g}">${esc(this._t(lbl))}</label><input id="g_${g}" type="number" min="${div === 60 ? 1 : 1}" step="${div === 60 ? 0.5 : 1}" data-fk="goal_${g}" data-goal="${g}" data-div="${div}" value="${esc(p.goals[g] ? p.goals[g] / div : "")}" ${admin ? "" : "disabled"}>`).join("");
      html += this._acc("goals", "mdi:target", this._t("acc_goals"), `<div class="note">${esc(p.name)}</div><div class="frm">${frm}</div>` + (admin ? `<div class="row"><button class="btn primary" data-act="save-goals" data-p="${esc(p.id)}">${esc(this._t("save"))}</button></div>` : `<div class="note">${esc(this._cfg.read_only ? this._t("read_only_note") : this._t("admin_only"))}</div>`));
    }
    // Sensoren
    const sens = (s.sensors || []).map((x) => {
      const cls = x.status === "ok" ? "ok" : x.status === "disabled" ? "" : "warn";
      const prof = s.profiles.find((pp) => pp.id === x.profile);
      return `<div class="sensorline"><ha-icon icon="${esc(this._icon(x.metric))}" style="--mdc-icon-size:1.3em;color:${this._color(x.metric)}"></ha-icon><div class="grow"><div>${esc(this._label(x.metric))}${x.reboot ? ` <span class="badge warn">${esc(this._t("q_since_reboot"))}</span>` : ""}</div><div class="sub">${esc(prof ? prof.name + " · " : "")}${esc(x.entity_id)}</div></div><span class="badge ${cls}">${esc(this._t(`sensor_${x.status}`))}</span><button class="btn small icon" data-act="entity" data-e="${esc(x.entity_id)}" title="${esc(this._t("open_entity"))}" aria-label="${esc(this._t("open_entity"))}"><ha-icon icon="mdi:open-in-new" style="--mdc-icon-size:1.1em"></ha-icon></button></div>`;
    }).join("");
    html += this._acc("sensors", "mdi:radar", this._t("acc_sensors"), sens || `<div class="muted">${esc(this._t("no_sensors"))}</div>`, { meta: String((s.sensors || []).length) });
    // Optionen
    const o = s.options || {};
    html += this._acc("options", "mdi:tune", this._t("acc_options"),
      this._line(this._t("opt_show_all"), o.show_all_profiles ? this._t("on") : this._t("off")) + this._line(this._t("opt_events"), o.events_enabled ? this._t("on") : this._t("off")) +
      this._line(this._t("opt_history"), o.history_days) + `<div class="note">${esc(this._t("options_hint"))}</div>`);
    html += this._acc("privacy", "mdi:shield-lock-outline", this._t("acc_privacy"), `<div class="note">${esc(this._t("privacy_note"))}</div>`);
    html += this._acc("maint", "mdi:wrench-outline", this._t("acc_maint"), admin ? `<div class="row"><button class="btn" data-act="rescan"><ha-icon icon="mdi:magnify-scan" style="--mdc-icon-size:1.2em"></ha-icon>${esc(this._t("rescan"))}</button></div>` : `<div class="note">${esc(this._cfg.read_only ? this._t("read_only_note") : this._t("admin_only"))}</div>`);
    const evs = (s.events || []).map((e) => {
      const ph = e.d || {};
      return `<div class="settings-line"><span>${esc(this._ago(e.t))}</span><span>${esc(this._t(`ev_${e.k}`, { profile: ph.profile || "", metric: ph.metric ? this._label(ph.metric) : "" }))}</span></div>`;
    }).join("");
    if (s.admin) html += this._acc("events", "mdi:history", this._t("acc_events"), evs || `<div class="muted">${esc(this._t("events_empty"))}</div>`, { meta: String((s.events || []).length) });
    return html;
  }

  // ------------------------------------------------------------ Popup
  _popup(p) {
    const key = this._st.popup;
    const m = p.metrics[key];
    if (!m) return "";
    const color = this._color(key);
    const usable = m.q !== "no_data" && m.v !== null && m.v !== undefined;
    let big = "–", unit = "";
    if (key === "activity_state") big = this._actLabel(m.v);
    else if (key === "sleep_start" || key === "sleep_end") big = usable ? this._time(m.v) : "–";
    else if (usable) { const f = this._fv(key, m.v); big = f.v; unit = f.u; }
    const goalKey = (this._cat(key) || {}).goal, goal = goalKey ? p.goals[goalKey] : null;
    const prog = goal && usable && typeof m.v === "number" ? `<div class="pbarline" style="--c:${color}"><i style="width:${clamp((m.v / goal) * 100, 0, 100).toFixed(0)}%"></i></div><div class="muted">${esc(this._t("goal"))}: ${esc(key === "sleep_duration" ? this._dur(goal) : this._num(goal))}</div>` : "";
    const det = this._getDetails(p.id, key, 30);
    let chart = "";
    if (det) {
      const kind = (this._cat(key) || {}).kind;
      const daily = (det.daily || []).map((d) => ({ d: d.d, v: d.v }));
      const fmt = (v) => { const f = this._fv(key, v); return `${f.v} ${f.u}`.trim(); };
      if (key === "heart_rate" || (kind === "last" && det.samples && det.samples.length > 3 && key !== "weight")) chart += `<div class="sec">${esc(this._t("hr_24h"))}</div>${this._line(det.samples, color)}`;
      if (daily.some((d) => typeof d.v === "number")) chart += `<div class="sec">${esc(this._t("pop_days", { n: 30 }))}</div>${this._bars(daily, { goal, color, fmt, dec: (this._cat(key) || {}).decimals || 0 })}`;
      else chart += `<div class="muted" style="margin-top:.8em">${esc(this._t("no_history"))}</div>`;
    } else chart = `<div class="muted" style="margin-top:.8em">${esc(this._t("loading"))}</div>`;
    const sensor = (this._snap.sensors || []).find((x) => x.entity_id === m.e);
    const info = this._acc("pi", "mdi:information-outline", this._t("pop_info"), `<div class="bigval" style="color:${color}">${esc(big)}${unit ? `<small>${esc(unit)}</small>` : ""}</div>${prog}
      ${this._line(this._t("pop_updated"), m.t ? `${this._time(m.t)} · ${this._ago(m.t)}` : "–")}${m.q !== "ok" ? `<div style="margin-top:.4em"><span class="badge warn">${esc(this._t(`q_${m.q}`))}</span></div>` : ""}`, { open: true });
    const src = this._acc("ps", "mdi:cellphone", this._t("pop_source"),
      this._line(this._t("pop_entity"), m.e) + this._line(this._t("pop_sources"), String(m.src || 1)) +
      `<div class="row"><button class="btn small" data-act="entity" data-e="${esc(m.e)}">${esc(this._t("open_entity"))}</button><button class="btn small" data-act="copy" data-v="${esc(m.e)}">${esc(this._st.copied ? this._t("copied") : this._t("copy"))}</button></div>`);
    const diag = this._acc("pd", "mdi:stethoscope", this._t("pop_diag"), this._line(this._t("pop_alias"), sensor ? sensor.alias : "–") + (sensor && sensor.reboot ? `<div class="note">${esc(this._t("q_since_reboot"))}</div>` : ""));
    return `<div class="backdrop" data-act="close"><div class="popup" role="dialog" aria-modal="true" aria-label="${esc(this._label(key))}" style="--ic:${color}">
      <div class="phead"><ha-icon icon="${esc(this._icon(key))}"></ha-icon><span class="grow">${esc(this._label(key))}</span><button class="btn icon" data-act="close" aria-label="${esc(this._t("close"))}"><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="pbody">${info}<div class="settings-accordion"><div class="settings-accordion-body" style="border:0;padding-top:.6em"><div class="sec" style="margin-top:0">${esc(this._t("pop_chart"))}</div>${chart}</div></div>${src}${diag}</div></div></div>`;
  }

  // ------------------------------------------------------------ Zeichnen
  _html() {
    const c = this._cfg;
    let inner = "";
    if (this._err) {
      inner = `<div class="banner err"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(this._t("conn_error"))}</div>`;
    } else if (!this._snap) {
      inner = `<div class="empty">${esc(this._t("loading"))}</div>`;
    } else {
      const s = this._snap, p = this._profile();
      const banner = !s.ready ? `<div class="banner warn">${esc(this._t("not_ready"))}</div>` : "";
      const profs = s.profiles || [];
      const bar = profs.length > 1 && c.show_profile_bar !== false && !c.profile
        ? `<div class="pbar">${profs.map((x) => `<button class="pchip ${p && x.id === p.id ? "on" : ""}" data-act="profile" data-p="${esc(x.id)}"><span class="avatar" ${this._picture(x)}>${this._picture(x) ? "" : esc(this._initials(x.name))}</span>${esc(x.name)}</button>`).join("")}</div>` : "";
      const tabs = this._tabs();
      const cur = this._tab();
      const upd = (s.app && s.app.update_available) || s.version !== CARD_VERSION;
      const tabBar = tabs.length > 1 ? `<div class="tabs" role="tablist">${tabs.map((k) => {
        const meta = TAB_META[k];
        return `<button class="tab ${k === cur ? "on" : ""}" role="tab" aria-selected="${k === cur}" data-act="tab" data-tab="${k}" title="${esc(this._t(meta.label))}" style="--ic:${this._tabIcColor(k)}"><ha-icon icon="${esc(meta.icon)}"></ha-icon><span class="lbl">${esc(this._t(meta.label))}</span>${k === "settings" && upd ? `<span class="bdg">↑</span>` : ""}</button>`;
      }).join("")}</div>` : "";
      let body = "";
      if (!profs.length) {
        const msg = (s.apps || []).length || s.admin ? this._t("no_apps") : this._t("no_visible");
        body = cur === "settings" && p ? "" : this._empty("mdi:account-heart-outline", (s.apps || []).length ? this._t("no_sensors") : msg);
        if (cur === "settings") body = this._viewSettings(null);
      } else if (p) {
        body = cur === "overview" ? this._viewOverview(p) : cur === "activity" ? this._viewActivity(p) : cur === "sleep" ? this._viewSleep(p)
          : cur === "heart" ? this._viewHeart(p) : cur === "body" ? this._viewBody(p) : cur === "stats" ? this._viewStats(p) : this._viewSettings(p);
      }
      inner = `${banner}${bar}${tabBar}<div class="body">${body}</div>${this._st.popup && p ? this._popup(p) : ""}`;
    }
    const title = c.show_title !== false && c.title !== "" ? `<div class="hdr">${esc(c.title || "Health Center")}</div>` : "";
    const toast = this._st.toast ? `<div class="toast ${this._st.toast.err ? "err" : ""}" role="status">${esc(this._st.toast.msg)}</div>` : "";
    return `<style>${CSS}</style><ha-card class="root" style="${esc(this._colorVars())}">${title}${inner}${toast}</ha-card>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    this._ensureData();
    const html = this._html();
    if (html === this._lastHtml) return;
    const root = this.shadowRoot;
    const act = root.activeElement;
    const fk = act && act.dataset ? act.dataset.fk : null;
    const sel = fk && "selectionStart" in act ? [act.selectionStart, act.selectionEnd] : null;
    const val = fk ? act.value : null;
    const pb = root.querySelector(".pbody");
    const pbTop = pb ? pb.scrollTop : 0;
    this._lastHtml = html;
    root.innerHTML = html;
    if (fk) {
      const el = root.querySelector(`[data-fk="${CSS_escape(fk)}"]`);
      if (el) { if (val !== null) el.value = val; el.focus(); if (sel) { try { el.setSelectionRange(sel[0], sel[1]); } catch (_) { /* number-Felder */ } } }
    }
    const nb = root.querySelector(".pbody");
    if (nb && pbTop) nb.scrollTop = pbTop;
  }

  // ------------------------------------------------------------ Ereignisse
  _onToggle(e) {
    const d = e.target;
    if (d && d.tagName === "DETAILS" && d.dataset && d.dataset.k) this._st.acc[d.dataset.k] = d.open;
  }
  _toast(msg, err) {
    this._st.toast = { msg, err: !!err };
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this._st.toast = null; this._render(); }, 5000);
    this._render();
  }
  async _call(payload) {
    return this._hass.connection.sendMessagePromise({ type: `${DOMAIN}/action`, ...payload });
  }
  _onChange(e) {
    const el = e.target;
    if (!el || !el.dataset || el.dataset.change !== "assign") return;
    this._call({ action: "assign_device", device: el.dataset.dev, profile: el.value })
      .then(() => this._toast(this._t("saved"))).catch((err) => this._toast(err.message || "error", true));
  }
  _onClick(e) {
    const el = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el) return;
    const act = el.dataset.act;
    if (act === "close") {
      if (el.classList.contains("backdrop") && e.target !== el) return;
      this._st.popup = null; this._render(); return;
    }
    e.stopPropagation();
    switch (act) {
      case "tab": this._st.tab = el.dataset.tab; this._render(); break;
      case "profile": this._st.pid = el.dataset.p; this._render(); break;
      case "metric": this._st.popup = el.dataset.m; this._render(); break;
      case "period": this._st.period = Number(el.dataset.d) || 30; this._render(); break;
      case "entity":
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: el.dataset.e } }));
        break;
      case "copy":
        if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.v || "").then(() => { this._st.copied = true; this._render(); setTimeout(() => { this._st.copied = false; this._render(); }, 2000); }).catch(() => {});
        break;
      case "rescan":
        this._call({ action: "rescan" }).then(() => this._toast(this._t("rescan_done"))).catch((err) => this._toast(err.message || "error", true));
        break;
      case "check-update":
        this._call({ action: "check_update" }).then(() => this._toast(this._t("rescan_done"))).catch((err) => this._toast(err.message || "error", true));
        break;
      case "save-goals": {
        const inputs = this.shadowRoot.querySelectorAll("input[data-goal]");
        const jobs = [];
        inputs.forEach((i) => {
          const v = Number(i.value);
          if (!isFinite(v) || v <= 0) return;
          jobs.push(this._call({ action: "set_goal", profile: el.dataset.p, goal: i.dataset.goal, value: v * Number(i.dataset.div || 1) }));
        });
        Promise.all(jobs).then(() => this._toast(this._t("saved"))).catch((err) => this._toast(err.message || "error", true));
        break;
      }
      default: break;
    }
  }
}

function CSS_escape(v) { return String(v).replace(/["\\]/g, "\\$&"); }

// ---------------------------------------------------------------- Editor
const EDITOR_LABELS = {
  title: "Titel", profile: "Profil festlegen (leer = Auswahl in der Karte)", show_title: "Titel anzeigen", zoom: "Zoom",
  show_profile_bar: "Profilauswahl anzeigen", default_period: "Statistik-Zeitraum", default_tab: "Starttab", read_only: "Nur Ansicht (read_only)",
  show_experimental: "Experimentelle Funktionen anzeigen",
  show_overview: "Kategorie „Übersicht“ anzeigen", show_activity: "Kategorie „Aktivität“ anzeigen", show_sleep: "Kategorie „Schlaf“ anzeigen",
  show_heart: "Kategorie „Herz“ anzeigen", show_body: "Kategorie „Körper“ anzeigen (experimentell)", show_stats: "Kategorie „Statistik“ anzeigen",
  show_settings: "Kategorie „Einstellungen“ anzeigen",
  exp_extended_metrics: "Erweiterte Werte (SpO₂, Gewicht, Blutdruck …) und Tab „Körper“", exp_sleep_score: "Berechneter Schlafwert",
  exp_profile_compare: "Profilvergleich", exp_trend_hints: "Trend-Hinweise",
};
const EDITOR_COLORS = [
  ["tab_active", "Aktiver Tab"], ["success", "Erfolg (grün)"], ["warning", "Warnung (orange)"], ["error", "Fehler (rot)"], ["info", "Info (blau)"],
  ["row_icon", "Symbole (alle)"], ["live_banner", "Banner"], ["steps", "Schritte / Distanz"], ["energy", "Energie"], ["exercise", "Aktivminuten"],
  ["sleep", "Schlaf"], ["heart", "Herz"],
];

class HealthCenterCardEditor extends HTMLElement {
  constructor() {
    super();
    this._cfg = {};
    this._hass = null;
    this._info = null;
    this._infoRequested = false;
    this._built = false;
  }
  setConfig(config) { this._cfg = { ...(config || {}) }; this._draw(); }
  set hass(h) {
    this._hass = h;
    if (!this._infoRequested && h && h.connection) { this._infoRequested = true; this._loadInfo(); }
    const form = this.querySelector("ha-form");
    if (form) form.hass = h;
  }
  async _loadInfo() {
    try {
      let un = null;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        this._hass.connection.subscribeMessage((ev) => {
          if (ev && ev.type === "snapshot") { this._info = { version: ev.data.version, app: ev.data.app, features: ev.data.experimental }; clearTimeout(timer); resolve(); }
        }, { type: `${DOMAIN}/subscribe` }).then((u) => { un = u; });
      });
      if (un) un();
      this._draw();
    } catch (_) { /* Infoblock bleibt leer */ }
  }
  _schema() {
    const tabOpts = TAB_ORDER.map((k) => ({ value: k, label: I18N.de[TAB_META[k].label] }));
    const sw = (name) => ({ name, selector: { boolean: {} } });
    return [
      { name: "title", selector: { text: {} } },
      { name: "profile", selector: { entity: { domain: "person" } } },
      { type: "expandable", name: "", title: "Kategorien", flatten: true, expanded: true, schema: [
        ...TAB_ORDER.map((k) => sw(`show_${k}`)),
        { name: "default_tab", selector: { select: { options: tabOpts, mode: "dropdown" } } },
      ] },
      { type: "expandable", name: "", title: "Darstellung", flatten: true, schema: [
        sw("show_title"), sw("show_profile_bar"),
        { name: "zoom", selector: { number: { min: 0.7, max: 1.6, step: 0.05, mode: "slider" } } },
        { name: "default_period", selector: { select: { options: [{ value: "7", label: "7 Tage" }, { value: "30", label: "30 Tage" }, { value: "90", label: "90 Tage" }], mode: "dropdown" } } },
      ] },
      { type: "expandable", name: "", title: "Bearbeiten", flatten: true, schema: [sw("read_only")] },
      { type: "expandable", name: "", title: "Experimentell", flatten: true, schema: [
        sw("show_experimental"), ...Object.keys(EXPERIMENTAL).map((k) => sw(`exp_${k}`)),
      ] },
    ];
  }
  _data() {
    const d = { show_title: true, show_profile_bar: true, zoom: 1, read_only: false, show_experimental: false, ...this._cfg };
    for (const k of TAB_ORDER) if (d[`show_${k}`] === undefined) d[`show_${k}`] = true;
    if (d.default_period !== undefined) d.default_period = String(d.default_period);
    if (!d.default_tab) d.default_tab = "overview";
    return d;
  }
  _fire(cfg) {
    this._cfg = cfg;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
  }
  _draw() {
    const info = this._info;
    const upd = info && info.app && info.app.update_available;
    const mismatch = info && info.version !== CARD_VERSION;
    const status = !info ? "" : upd ? `Neue Version ${esc(info.app.latest_version)} verfügbar. Aktualisiere über HACS und starte Home Assistant neu.` : mismatch ? "Karte und Integration haben unterschiedliche Versionen. Browser-Cache leeren (Strg+F5)." : info.app && info.app.check_failed ? "Prüfung auf neue Versionen nicht möglich." : "Aktuell.";
    const expInfo = info && info.features ? `Im Integrations-Dialog aktiv: ${info.features.features.length ? info.features.features.join(", ") : "keine"}` : "";
    const colors = EDITOR_COLORS.map(([k, label]) => {
      const v = sanitizeColor(this._cfg[`color_${k}`]);
      const hex = /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#808080";
      return `<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="flex:1">${esc(label)}</span><input type="color" data-ck="${k}" value="${hex}" aria-label="${esc(label)}"><input type="text" data-ct="${k}" value="${esc(v)}" placeholder="Theme" style="width:9em"></div>`;
    }).join("");
    const tabIcons = TAB_ORDER.map((k) => {
      const v = sanitizeColor(this._cfg[CATEGORY_ICON_COLOR_KEYS[k]]);
      return `<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="flex:1">Symbolfarbe „${esc(I18N.de[TAB_META[k].label])}“</span><input type="text" data-ct="icon_${k}" value="${esc(v)}" placeholder="Theme" style="width:9em"></div>`;
    }).join("");
    if (!this._built) {
      this.innerHTML = `<div style="padding:0 0 8px">
        <div data-info style="border:1px solid var(--divider-color);border-radius:8px;padding:8px 12px;margin-bottom:12px"></div>
        <ha-form></ha-form>
        <details style="margin-top:12px;border:1px solid var(--divider-color);border-radius:8px;padding:8px 12px"><summary style="cursor:pointer">Farben</summary><div data-colors></div>
        <div style="margin-top:8px"><button type="button" data-reset style="font:inherit;padding:4px 10px">Alle Farben zurücksetzen</button></div></details></div>`;
      const form = this.querySelector("ha-form");
      form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.title || s.name;
      form.addEventListener("value-changed", (ev) => {
        const next = { ...this._cfg, ...ev.detail.value };
        if (next.title === undefined) delete next.title;
        if (next.default_period !== undefined) next.default_period = Number(next.default_period);
        if (!next.profile) delete next.profile;
        this._fire(next);
      });
      this.addEventListener("input", (ev) => this._colorInput(ev));
      this.addEventListener("change", (ev) => this._colorInput(ev));
      this.querySelector("[data-reset]").addEventListener("click", () => {
        const next = { ...this._cfg };
        for (const k of Object.keys(next)) if (k.startsWith("color_")) delete next[k];
        this._fire(next); this._draw();
      });
      this._built = true;
    }
    const box = this.querySelector("[data-info]");
    box.style.borderColor = upd || mismatch ? "var(--warning-color, #ff9800)" : "var(--divider-color)";
    box.innerHTML = `<b>Karte ${esc(CARD_VERSION)}${info ? ` · Integration ${esc(info.version)}` : ""}</b><div style="font-size:.9em;margin-top:2px">${esc(status).replace(/&amp;/g, "&")}</div>${expInfo ? `<div style="font-size:.85em;color:var(--secondary-text-color)">${esc(expInfo)}</div>` : ""}`;
    const form = this.querySelector("ha-form");
    form.hass = this._hass;
    form.schema = this._schema();
    form.data = this._data();
    this.querySelector("[data-colors]").innerHTML = colors + tabIcons;
  }
  _colorInput(ev) {
    const t = ev.target;
    if (!t || !t.dataset) return;
    const key = t.dataset.ck || t.dataset.ct;
    if (!key) return;
    const name = key.startsWith("icon_") ? CATEGORY_ICON_COLOR_KEYS[key.slice(5)] : `color_${key}`;
    const v = sanitizeColor(t.value);
    const next = { ...this._cfg };
    if (v) next[name] = v; else delete next[name];
    this._fire(next);
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, HealthCenterCard);
if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, HealthCenterCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Health Center",
    description: "Gesundheitsdaten der Home-Assistant-Companion-App im Stil von Samsung Health.",
    preview: false,
  });
}
console.info(`%c HEALTH-CENTER %c ${CARD_VERSION} `, "color:#fff;background:#3b6642;font-weight:700", "color:#3b6642;background:#eef5ef");
