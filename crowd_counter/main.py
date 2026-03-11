"""Entry point — video loop with UI overlay."""

import cv2

from config import (
    MODEL_PATH,
    VIDEO_SOURCE,
    PROCESS_EVERY_N,
    RESIZE_WIDTH,
    FRAME_HEIGHT,
    ROI_DEFINITIONS,
)
from counter import load_model, detect_people
from density_check import compute_density
from alerts import AlertManager
from display import render_ui


def process_video() -> None:
    """Main loop: detect people, compute density, render UI, display."""
    model = load_model(MODEL_PATH)
    alert_manager = AlertManager()

    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        print(f"Error: Cannot open video source '{VIDEO_SOURCE}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video opened  |  FPS: {fps:.1f}  |  Total frames: {total_frames}")

    prev_count: int = -1
    frame_idx: int = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % PROCESS_EVERY_N != 0:
                continue

            # Resize to standard dimensions
            frame = cv2.resize(frame, (RESIZE_WIDTH, FRAME_HEIGHT))

            # Detect
            count, boxes, annotated_frame = detect_people(model, frame)

            # Density
            density_map = compute_density(boxes, ROI_DEFINITIONS)

            # Alerts
            alerts = alert_manager.check_alerts(density_map)

            # Render UI
            display_frame = render_ui(
                annotated_frame, count, density_map,
                alerts, alert_manager, ROI_DEFINITIONS,
            )

            cv2.imshow("Crowd Monitor", display_frame)

            # Console output only on change
            if count != prev_count:
                print(f"Count changed: {prev_count} -> {count}")
                prev_count = count

            for a in alerts:
                print(a)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("Stopped by user (q)")
                break

    except KeyboardInterrupt:
        print("\nStopped by user (Ctrl+C)")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print(f"Finished  |  Processed {frame_idx} frames  |  Final count: {prev_count}")


if __name__ == "__main__":
    process_video()
