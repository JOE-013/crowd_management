from ultralytics import YOLO

try:
    model = YOLO('models/yolov8s.pt')  # Replace with your path
    print("YOLOv8 loaded successfully! Model details:")
    print(model)  # Prints model info
except Exception as e:
    print(f"Error loading YOLOv8: {e}")