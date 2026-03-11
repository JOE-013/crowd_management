"""Alert manager with per-section cooldowns."""

import time

from config import DENSITY_ALERT_THRESHOLD, ALERT_COOLDOWN_SECONDS


class AlertManager:
    """Stateful alert engine with per-section cooldown tracking."""

    def __init__(self) -> None:
        self._last_alert_time: dict[str, float] = {}
        self.active_alerts: list[str] = []
        self._active_sections: set[str] = set()

    def check_alerts(self, density_map: dict[str, dict]) -> list[str]:
        """Check each section against the density threshold and return new alerts."""
        now = time.time()
        new_alerts: list[str] = []
        current_active: set[str] = set()

        for section_name, data in density_map.items():
            density = data["density"]
            if density >= DENSITY_ALERT_THRESHOLD:
                current_active.add(section_name)
                last = self._last_alert_time.get(section_name, 0.0)
                if now - last >= ALERT_COOLDOWN_SECONDS:
                    msg = f"Heavy Crowd in {section_name}"
                    new_alerts.append(msg)
                    self._last_alert_time[section_name] = now

        self._active_sections = current_active
        self.active_alerts = new_alerts
        return new_alerts

    def is_section_alert(self, section_name: str) -> bool:
        """Return True if this section currently exceeds the alert threshold."""
        return section_name in self._active_sections
