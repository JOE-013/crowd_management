import cv2  # For video capture and image processing
from ultralytics import YOLO  # For YOLOv8 model
import numpy as np  # For numerical operations

# Load the YOLOv8 model
model_path = 'models/yolov8s.pt'  # Path to the downloaded model
model = YOLO(model_path)

def count_people(frame, model, conf_threshold=0.2):
    
    results = model(frame, verbose=False)  # Run inference
    
    # Filter for 'person' class (ID 0)
    person_detections = [det for det in results[0].boxes if int(det.cls) == 0 and det.conf > conf_threshold]
    
    count = len(person_detections)
    return count, person_detections, results

if __name__ == "__main__":
    # Test with webcam (0) or replace with 'test_video.mp4' or RTSP URL
    cap = cv2.VideoCapture("14665827_3840_2160_30fps.mp4")
    ret, frame = cap.read()
    if ret:
        count, detections, results = count_people(frame, model)
        print(f"Detected {count} people")
        
        # Optional visualization
        annotated_frame = results[0].plot()  # Draw boxes on frame
        cv2.imshow('Detections', annotated_frame)
        cv2.waitKey(0)  # Press any key to close
        cv2.destroyAllWindows()
    else:
        print("Failed to read frame")
    cap.release()