"""Centralised configuration for the crowd-counter application."""

from pathlib import Path

# Resolve file paths relative to the project root (one level up from this package)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── Model ───────────────────────────────────────────────────────
MODEL_PATH: str = str(_PROJECT_ROOT / "models" / "yolov8s.pt")

# ── Video source ────────────────────────────────────────────────
VIDEO_SOURCE ="ir2.mp4"  # 0 for webcam, or file path

# ── Inference tuning ───────────────────────────────────────────
CONF_THRESHOLD: float = 0.3
PERSON_CLASS_ID: int = 0
PROCESS_EVERY_N: int = 2
RESIZE_WIDTH: int = 640
FRAME_HEIGHT: int = 480

# ── 4-Section ROI grid (auto-calculated from frame size) ───────
ROI_DEFINITIONS: list[dict] = [
    {"name": "Section A", "x1": 0,   "y1": 0,   "x2": 640, "y2": 160},
    {"name": "Section B", "x1": 0, "y1": 160,   "x2": 640, "y2": 320},
    {"name": "Section C", "x1": 0,   "y1": 320, "x2": 640, "y2": 480},
    {"name": "Section D", "x1": 0, "y1": 480, "x2": 640, "y2": 640},
]

# ── Alert thresholds ───────────────────────────────────────────
DENSITY_ALERT_THRESHOLD: float = 0.5   # people per 10k px² — triggers heavy crowd alert
ALERT_COOLDOWN_SECONDS: int = 8        # min seconds between repeat alerts per section
