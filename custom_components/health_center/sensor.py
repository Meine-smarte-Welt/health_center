# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): b128995c42c96be7930284681ac56c911092dbc032ffd6b97cc76f17b2ba4d7b
"""Übersichts-Sensoren von Health Center."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.const import PERCENTAGE
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, NAME, VERSION
from .manager import HealthCenterManager

PARALLEL_UPDATES = 0


def _device(entry_id: str) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, entry_id)},
        name=NAME,
        manufacturer="Meine smarte Welt",
        model=NAME,
        sw_version=VERSION,
        entry_type=DeviceEntryType.SERVICE,
    )


class _Base(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, manager: HealthCenterManager, entry_id: str) -> None:
        self._manager = manager
        self._attr_device_info = _device(entry_id)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._manager.add_listener(self._changed))

    @callback
    def _changed(self) -> None:
        self.async_write_ha_state()


class ProfilesSensor(_Base):
    """Anzahl erkannter Profile."""

    _attr_translation_key = "profiles"
    _attr_icon = "mdi:account-heart"

    def __init__(self, manager: HealthCenterManager, entry_id: str) -> None:
        super().__init__(manager, entry_id)
        self._attr_unique_id = f"{entry_id}_profiles"

    @property
    def native_value(self) -> int:
        return len(self._manager.profile_ids())


class DetectedSensorsSensor(_Base):
    """Anzahl erkannter Gesundheitssensoren."""

    _attr_translation_key = "detected_sensors"
    _attr_icon = "mdi:heart-pulse"

    def __init__(self, manager: HealthCenterManager, entry_id: str) -> None:
        super().__init__(manager, entry_id)
        self._attr_unique_id = f"{entry_id}_detected_sensors"

    @property
    def native_value(self) -> int:
        return self._manager.detected_count()


class GoalProgressSensor(_Base):
    """Mittlerer Zielfortschritt eines Profils."""

    _attr_translation_key = "goal_progress"
    _attr_icon = "mdi:flag-checkered"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, manager: HealthCenterManager, entry_id: str, pid: str) -> None:
        super().__init__(manager, entry_id)
        self._pid = pid
        self._attr_unique_id = f"{entry_id}_{pid}_goal_progress"
        profile = manager.profile(pid)
        self._attr_translation_placeholders = {"profile": profile.name if profile else pid}

    @property
    def available(self) -> bool:
        return self._manager.profile(self._pid) is not None

    @property
    def native_value(self) -> int | None:
        return self._manager.goal_progress(self._pid)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        profile = self._manager.profile(self._pid)
        return {"profile": profile.name if profile else None}


async def async_setup_entry(
    hass: HomeAssistant, entry: Any, async_add_entities: AddEntitiesCallback
) -> None:
    """Sensoren anlegen und neue Profile nachträglich ergänzen."""
    manager: HealthCenterManager = entry.runtime_data
    async_add_entities([ProfilesSensor(manager, entry.entry_id), DetectedSensorsSensor(manager, entry.entry_id)])
    known: set[str] = set()

    @callback
    def _add_profiles() -> None:
        new = [pid for pid in manager.profile_ids() if pid not in known]
        if new:
            known.update(new)
            async_add_entities([GoalProgressSensor(manager, entry.entry_id, pid) for pid in new])

    _add_profiles()
    entry.async_on_unload(manager.add_profile_listener(_add_profiles))
