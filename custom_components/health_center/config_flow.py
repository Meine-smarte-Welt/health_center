# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): 3b99e76aa41bfe1a636c376f932972e2d74026bdce73f9509d142b574d5c4f98
"""Einrichtung und Optionen von Health Center."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_NAME,
    DEFAULT_GOAL_EXERCISE,
    DEFAULT_GOAL_SLEEP_HOURS,
    DEFAULT_GOAL_STEPS,
    DEFAULT_HISTORY_DAYS,
    DOMAIN,
    EXPERIMENTAL_FEATURES,
    NAME,
    OPT_EVENTS,
    OPT_EXPERIMENTAL,
    OPT_EXPERIMENTAL_FEATURES,
    OPT_GOAL_EXERCISE,
    OPT_GOAL_SLEEP_HOURS,
    OPT_GOAL_STEPS,
    OPT_HISTORY_DAYS,
    OPT_SHOW_ALL,
    VERSION,
)

_UPDATE_TEXT = {
    "de": ("Neue Version {v} verfügbar. Aktualisiere über HACS und starte Home Assistant neu.",
           "Du hast die neueste Version.", "Prüfung auf neue Versionen nicht möglich."),
    "nl": ("Nieuwe versie {v} beschikbaar. Werk bij via HACS en herstart Home Assistant.",
           "Je hebt de nieuwste versie.", "Controle op nieuwe versies niet mogelijk."),
    "en": ("New version {v} available. Update via HACS and restart Home Assistant.",
           "You have the latest version.", "Checking for new versions is not possible."),
}


def update_info(language: str, latest: str | None, available: bool, failed: bool) -> str:
    """Hinweistext zur Version in der Sprache des Nutzers."""
    texts = _UPDATE_TEXT.get(language.split("-")[0].lower(), _UPDATE_TEXT["en"])
    if available and latest:
        return texts[0].format(v=latest)
    if failed:
        return texts[2]
    return texts[1]


class HealthCenterConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung (nur eine Instanz)."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data=user_input)
        return self.async_show_form(
            step_id="user", data_schema=vol.Schema({vol.Required(CONF_NAME, default=NAME): str})
        )

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self._get_reconfigure_entry()
        if user_input is not None:
            return self.async_update_reload_and_abort(
                entry, title=user_input[CONF_NAME], data_updates=user_input
            )
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema(
                {vol.Required(CONF_NAME, default=entry.data.get(CONF_NAME, NAME)): str}
            ),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: Any) -> HealthCenterOptionsFlow:
        return HealthCenterOptionsFlow()


class HealthCenterOptionsFlow(OptionsFlow):
    """Optionen („Konfigurieren“)."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data={**self.config_entry.options, **user_input})
        opts = self.config_entry.options
        manager = getattr(self.config_entry, "runtime_data", None)
        info = update_info(
            self.hass.config.language,
            getattr(getattr(manager, "updates", None), "latest_version", None),
            bool(getattr(getattr(manager, "updates", None), "update_available", False)),
            bool(getattr(getattr(manager, "updates", None), "check_failed", False)),
        )
        schema = vol.Schema(
            {
                vol.Required(OPT_SHOW_ALL, default=opts.get(OPT_SHOW_ALL, False)): bool,
                vol.Required(OPT_EVENTS, default=opts.get(OPT_EVENTS, True)): bool,
                vol.Required(
                    OPT_HISTORY_DAYS, default=opts.get(OPT_HISTORY_DAYS, DEFAULT_HISTORY_DAYS)
                ): NumberSelector(
                    NumberSelectorConfig(min=7, max=90, step=1, mode=NumberSelectorMode.BOX,
                                         unit_of_measurement="d")
                ),
                vol.Required(
                    OPT_GOAL_STEPS, default=opts.get(OPT_GOAL_STEPS, DEFAULT_GOAL_STEPS)
                ): NumberSelector(NumberSelectorConfig(min=1000, max=50000, step=500, mode=NumberSelectorMode.BOX)),
                vol.Required(
                    OPT_GOAL_SLEEP_HOURS, default=opts.get(OPT_GOAL_SLEEP_HOURS, DEFAULT_GOAL_SLEEP_HOURS)
                ): NumberSelector(
                    NumberSelectorConfig(min=4, max=12, step=0.5, mode=NumberSelectorMode.BOX,
                                         unit_of_measurement="h")
                ),
                vol.Required(
                    OPT_GOAL_EXERCISE, default=opts.get(OPT_GOAL_EXERCISE, DEFAULT_GOAL_EXERCISE)
                ): NumberSelector(
                    NumberSelectorConfig(min=5, max=240, step=5, mode=NumberSelectorMode.BOX,
                                         unit_of_measurement="min")
                ),
                vol.Required(OPT_EXPERIMENTAL, default=opts.get(OPT_EXPERIMENTAL, False)): bool,
                vol.Optional(
                    OPT_EXPERIMENTAL_FEATURES, default=opts.get(OPT_EXPERIMENTAL_FEATURES, [])
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=list(EXPERIMENTAL_FEATURES),
                        multiple=True,
                        mode=SelectSelectorMode.LIST,
                        translation_key="experimental_features",
                    )
                ),
            }
        )
        return self.async_show_form(
            step_id="init",
            data_schema=schema,
            description_placeholders={"version": VERSION, "update_info": info},
        )
