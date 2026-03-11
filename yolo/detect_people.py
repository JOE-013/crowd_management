import cv2
from ultralytics import YOLO
import time

# ── Configuration ──────────────────────────────────────────────
MODEL_PATH = "models/yolov8s.pt"
VIDEO_SOURCE = 0  # or 0 for webcam, or RTSP URL
CONF_THRESHOLD = 0.2
PERSON_CLASS_ID = 0
PROCESS_EVERY_N = 3          # Process every Nth frame (skip others)
RESIZE_WIDTH = 640           # Resize long edge before inference for speed
SHOW_DISPLAY = True          # Set False for headless / pure counting mode


def load_model(model_path: str) -> YOLO:
    """Load YOLOv8 model once at startup."""
    model = YOLO(model_path)
    return model


def count_people(model: YOLO, frame, conf_threshold: float = CONF_THRESHOLD) -> int:
    """Run inference and return person count."""
    results = model(frame, verbose=False, classes=[PERSON_CLASS_ID])
    detections = results[0].boxes
    count = sum(1 for d in detections if float(d.conf) >= conf_threshold)
    return count, results


def resize_frame(frame, target_width: int = RESIZE_WIDTH):
    """Resize frame keeping aspect ratio; skip if already small enough."""
    h, w = frame.shape[:2]
    if w <= target_width:
        return frame
    scale = target_width / w
    return cv2.resize(frame, (target_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def process_video(video_source, model: YOLO):
    """Main loop: process video, print count only when it changes."""
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"Error: Cannot open video source '{video_source}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video opened — FPS: {fps:.1f}, Total frames: {total_frames}")

    prev_count = -1          # Impossible initial value so first frame always prints
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break  # End of video

            frame_idx += 1

            # Skip frames we don't need to process
            if frame_idx % PROCESS_EVERY_N != 0:
                continue

            # Resize for faster inference
            small_frame = resize_frame(frame)

            # Count people
            count, results = count_people(model, small_frame)

            # Print only when count changes
            if count != prev_count:
                timestamp = frame_idx / fps
                mins, secs = divmod(timestamp, 60)
                print(f"[{int(mins):02d}:{secs:05.2f}] Person count changed: {prev_count if prev_count >= 0 else '—'} → {count}")
                prev_count = count

            # Optional live display
            if SHOW_DISPLAY:
                annotated = results[0].plot()
                # Show count overlay
                cv2.putText(
                    annotated,
                    f"People: {count}",
                    (10, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.2,
                    (0, 255, 0),
                    3,
                )
                cv2.imshow("Crowd Detection", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    print("Stopped by user (q pressed)")
                    break

    except KeyboardInterrupt:
        print("\nStopped by user (Ctrl+C)")
    finally:
        cap.release()
        if SHOW_DISPLAY:
            cv2.destroyAllWindows()
        print(f"Finished — processed {frame_idx} frames, final count: {prev_count}")


if __name__ == "__main__":
    model = load_model(MODEL_PATH)
    process_video(VIDEO_SOURCE, model)