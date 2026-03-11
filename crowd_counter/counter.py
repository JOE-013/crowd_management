"""YOLO model loading and person detection."""

import numpy as np
from ultralytics import YOLO

from config import CONF_THRESHOLD, PERSON_CLASS_ID


def load_model(model_path: str) -> YOLO:
    """Load YOLOv8 weights from disk and return the model."""
    return YOLO(model_path)


def detect_people(
    model: YOLO,
    frame: np.ndarray,
    conf_threshold: float = CONF_THRESHOLD,
) -> tuple[int, list[dict], np.ndarray]:
    """Run inference and return (count, boxes, annotated_frame)."""
    results = model(frame, verbose=False, classes=[PERSON_CLASS_ID])

    detections = results[0].boxes
    annotated_frame = results[0].plot()

    boxes: list[dict] = []
    for det in detections:
        conf = float(det.conf)
        if conf < conf_threshold:
            continue
        x1, y1, x2, y2 = [int(v) for v in det.xyxy[0].tolist()]
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)
        boxes.append({
            "cx": cx, "cy": cy,
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "conf": conf,
        })

    return len(boxes), boxes, annotated_frame
