# SHA256 (Inhalt ab Zeile 2, d.h. dieser Datei ohne diese erste Zeile): d3dc90bc4645cb425901100c9c4d816d52a817ff7ad4b334d6a36f7e34f3e0b5
"""Prüfung auf neue Versionen über die GitHub-API (alle 12 Stunden)."""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import dt as dt_util

from .const import GITHUB_REPO, VERSION

_LOGGER = logging.getLogger(__name__)
_VER = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)(?:(a|b|rc)(\d+))?$")
_STAGE = {"a": 1, "b": 2, "rc": 3, None: 4}


def parse_version(text: str) -> tuple[int, int, int, int, int] | None:
    """Version als vergleichbares Tupel. Vorabversionen sind kleiner als die Release-Version."""
    m = _VER.match((text or "").strip())
    if not m:
        return None
    major, minor, patch, stage, num = m.groups()
    return (int(major), int(minor), int(patch), _STAGE[stage], int(num or 0))


def is_newer(candidate: str, current: str) -> bool:
    """True, wenn `candidate` neuer als `current` ist."""
    a, b = parse_version(candidate), parse_version(current)
    return bool(a and b and a > b)


def safe_release_url(url: str | None) -> str:
    """Release-Link nur zulassen, wenn er auf github.com zeigt."""
    if url and url.startswith("https://github.com/"):
        return url
    return f"https://github.com/{GITHUB_REPO}/releases"


class UpdateChecker:
    """Fragt GitHub nach der neuesten Version."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.latest_version: str | None = None
        self.release_url: str = safe_release_url(None)
        self.update_available = False
        self.checked_at: datetime | None = None
        self.check_failed = False
        self.no_release = False

    @property
    def prerelease_installed(self) -> bool:
        return bool(re.search(r"(a|b|rc)\d+$", VERSION))

    async def async_check(self) -> None:
        """Neueste Version abfragen. Fehler stören den Betrieb nicht."""
        session = async_get_clientsession(self.hass)
        base = f"https://api.github.com/repos/{GITHUB_REPO}"
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "health-center-update-check"}
        self.check_failed = False
        self.no_release = False
        try:
            if self.prerelease_installed:
                data = await self._get(session, f"{base}/releases?per_page=5", headers)
                releases = [r for r in (data or []) if isinstance(r, dict) and not r.get("draft")]
                best = None
                for rel in releases:
                    tag = str(rel.get("tag_name", ""))
                    if parse_version(tag) and (best is None or is_newer(tag, str(best.get("tag_name")))):
                        best = rel
            else:
                best = await self._get(session, f"{base}/releases/latest", headers)
                if best is None:
                    tags = await self._get(session, f"{base}/tags?per_page=20", headers)
                    best = self._best_tag(tags)
            if not best:
                self.no_release = True
                self.latest_version = None
                self.update_available = False
            else:
                tag = str(best.get("tag_name") or best.get("name") or "")
                self.latest_version = tag.lstrip("v") if parse_version(tag) else None
                self.release_url = safe_release_url(best.get("html_url"))
                self.update_available = bool(self.latest_version and is_newer(tag, VERSION))
        except Exception as err:  # noqa: BLE001 - Netzwerkfehler dürfen nichts blockieren
            _LOGGER.debug("Versionsprüfung nicht möglich: %s", type(err).__name__)
            self.check_failed = True
        self.checked_at = dt_util.utcnow()

    @staticmethod
    def _best_tag(tags: Any) -> dict[str, Any] | None:
        best = None
        for tag in tags or []:
            name = str(tag.get("name", "")) if isinstance(tag, dict) else ""
            if parse_version(name) and (best is None or is_newer(name, best["tag_name"])):
                best = {"tag_name": name, "html_url": f"https://github.com/{GITHUB_REPO}/releases/tag/{name}"}
        return best

    @staticmethod
    async def _get(session: Any, url: str, headers: dict[str, str]) -> Any:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 404:
                return None
            resp.raise_for_status()
            return await resp.json()

    def as_dict(self) -> dict[str, Any]:
        return {
            "version": VERSION,
            "latest_version": self.latest_version,
            "release_url": self.release_url,
            "update_available": self.update_available,
            "checked_at": self.checked_at.isoformat() if self.checked_at else None,
            "check_failed": self.check_failed,
            "no_release": self.no_release,
        }
