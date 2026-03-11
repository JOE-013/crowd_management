"""Clean UI overlay rendering for the crowd monitor."""

import cv2
import numpy as np

from config import DENSITY_ALERT_THRESHOLD


def _draw_transparent_rect(
    frame: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    color: tuple[int, int, int],
    alpha: float,
) -> np.ndarray:
    """Draw a semi-transparent filled rectangle using addWeighted."""
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
    return cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)


def render_ui(
    frame: np.ndarray,
    total_count: int,
    density_map: dict[str, dict],
    alerts: list[str],
    alert_manager,
    rois: list[dict],
) -> np.ndarray:
    """Render the full monitoring UI overlay onto the frame."""
    h, w = frame.shape[:2]
    display = frame.copy()

    # ── Section grid overlay ────────────────────────────────────
    for roi in rois:
        name = roi["name"]
        rx1, ry1, rx2, ry2 = roi["x1"], roi["y1"], roi["x2"], roi["y2"]
        is_alert = alert_manager.is_section_alert(name)

        # Section border
        if is_alert:
            border_color = (0, 60, 220)   # Red
            thickness = 3
        else:
            border_color = (100, 200, 100)  # Soft green
            thickness = 2
        cv2.rectangle(display, (rx1, ry1), (rx2, ry2), border_color, thickness)

        # Section label — top-left with semi-transparent background
        section_data = density_map.get(name, {"count": 0, "density": 0.0})
        label_text = f"{name}  |  {section_data['count']}P"
        (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        pad = 6
        lx1 = rx1 + 2
        ly1 = ry1 + 2
        lx2 = lx1 + tw + pad * 2
        ly2 = ly1 + th + pad * 2
        display = _draw_transparent_rect(display, lx1, ly1, lx2, ly2, (0, 0, 0), 0.5)
        cv2.putText(
            display, label_text,
            (lx1 + pad, ly2 - pad),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA,
        )

        # Density badge — bottom-right corner
        density_val = section_data["density"]
        badge_text = f"D: {density_val:.2f}"
        if density_val >= DENSITY_ALERT_THRESHOLD:
            badge_color = (0, 60, 220)     # Red
        else:
            badge_color = (0, 200, 80)     # Green
        (bw, bh), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        bx = rx2 - bw - 10
        by = ry2 - 10
        display = _draw_transparent_rect(display, bx - 4, by - bh - 4, bx + bw + 4, by + 4, (0, 0, 0), 0.5)
        cv2.putText(
            display, badge_text,
            (bx, by),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, badge_color, 1, cv2.LINE_AA,
        )

    # ── Top status bar ──────────────────────────────────────────
    display = _draw_transparent_rect(display, 0, 0, w, 52, (0, 0, 0), 0.65)

    cv2.putText(
        display, "Crowd Monitor",
        (12, 36),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA,
    )

    count_text = f"Total People: {total_count}"
    (cw, _), _ = cv2.getTextSize(count_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    cv2.putText(
        display, count_text,
        (w - cw - 12, 36),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 120), 2, cv2.LINE_AA,
    )

    # ── Alert panel (bottom, only when alerts exist) ────────────
    if alerts:
        visible = alerts[:3]  # Max 3 alerts shown
        panel_h = 36 * len(visible)
        panel_y = h - panel_h
        display = _draw_transparent_rect(display, 0, panel_y, w, h, (0, 0, 100), 0.6)

        for i, alert_msg in enumerate(visible):
            text_y = panel_y + 25 + i * 36
            cv2.putText(
                display, f"  {alert_msg}",
                (8, text_y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA,
            )

    return display
