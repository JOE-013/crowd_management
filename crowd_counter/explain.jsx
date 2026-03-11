import { useState } from "react";

const FILES = {
    "config.py": {
        icon: "⚙️",
        color: "#F59E0B",
        dark: "#78350F",
        role: "Configuration Hub",
        tagline: "Central settings file. No logic — only constants used by every other file.",
        sections: [
            {
                title: "Path Resolution",
                code: `_PROJECT_ROOT = Path(__file__).resolve().parent.parent`,
                explanation: "Uses Python's pathlib to find the root folder of the project — goes 2 levels up from this file's location. This makes all other paths portable regardless of where you run the project from.",
            },
            {
                title: "Model Path",
                code: `MODEL_PATH: str = str(_PROJECT_ROOT / "models" / "yolov8s.pt")`,
                explanation: "Builds the full path to the YOLOv8 small model weights file. Used by counter.py → load_model() to load the neural network from disk.",
            },
            {
                title: "Video Source",
                code: `VIDEO_SOURCE = 0  # 0 = webcam, or a file path string`,
                explanation: "Passed to OpenCV's VideoCapture() in main.py. Set to 0 for webcam. Change to a string like 'video.mp4' to process a file instead.",
            },
            {
                title: "Inference Tuning",
                code: `CONF_THRESHOLD: float = 0.4\nPERSON_CLASS_ID: int = 0\nPROCESS_EVERY_N: int = 2\nRESIZE_WIDTH: int = 640\nFRAME_HEIGHT: int = 480`,
                explanation: "CONF_THRESHOLD (0.4): Only accept detections with ≥40% confidence. PERSON_CLASS_ID (0): YOLO's class index for 'person'. PROCESS_EVERY_N (2): Skip every other frame for performance — process frame 2, 4, 6... RESIZE_WIDTH/FRAME_HEIGHT: Standardize all frames to 640×480.",
            },
            {
                title: "ROI Section Grid",
                code: `ROI_DEFINITIONS: list[dict] = [\n  {"name": "Section A", "x1": 0,   "y1": 0,   "x2": 320, "y2": 240},\n  {"name": "Section B", "x1": 320, "y1": 0,   "x2": 640, "y2": 240},\n  {"name": "Section C", "x1": 0,   "y1": 240, "x2": 320, "y2": 480},\n  {"name": "Section D", "x1": 320, "y1": 240, "x2": 640, "y2": 480},\n]`,
                explanation: "Divides the 640×480 frame into 4 equal quadrants. A=top-left, B=top-right, C=bottom-left, D=bottom-right. Used by density_check.py to assign each detected person to a section. Also used by display.py to draw borders around each section.",
            },
            {
                title: "Alert Thresholds",
                code: `DENSITY_ALERT_THRESHOLD: float = 0.25\nALERT_COOLDOWN_SECONDS: int = 8`,
                explanation: "DENSITY_ALERT_THRESHOLD (0.25): If a section has ≥0.25 people per 10,000px², trigger a 'Heavy Crowd' alert. ALERT_COOLDOWN_SECONDS (8): Don't repeat an alert for the same section within 8 seconds — prevents spam.",
            },
        ],
        usedBy: ["counter.py", "density_check.py", "alerts.py", "display.py", "main.py"],
        imports: [],
    },

    "counter.py": {
        icon: "🎯",
        color: "#3B82F6",
        dark: "#1E3A5F",
        role: "Detection Engine",
        tagline: "Loads YOLOv8 model. Runs inference on frames. Returns bounding boxes with center points.",
        sections: [
            {
                title: "Imports",
                code: `from ultralytics import YOLO\nfrom config import CONF_THRESHOLD, PERSON_CLASS_ID`,
                explanation: "Imports the YOLO class from the ultralytics library (the official YOLOv8 package). Also pulls confidence threshold and person class ID from config.py.",
            },
            {
                title: "load_model()",
                code: `def load_model(model_path: str) -> YOLO:\n    return YOLO(model_path)`,
                explanation: "Simple wrapper that loads YOLOv8 weights from disk. Called ONCE at startup in main.py. The model object is then reused every frame. Calling this every frame would be extremely slow.",
            },
            {
                title: "detect_people() — Run Inference",
                code: `results = model(frame, verbose=False, classes=[PERSON_CLASS_ID])\ndetections = results[0].boxes\nannotated_frame = results[0].plot()`,
                explanation: "Passes the frame through YOLOv8. verbose=False suppresses console output. classes=[0] restricts detection to only 'person' class — ignores cars, dogs, etc. results[0].plot() returns the frame with YOLO's built-in bounding box drawings on it.",
            },
            {
                title: "detect_people() — Parse Boxes",
                code: `for det in detections:\n    conf = float(det.conf)\n    if conf < conf_threshold:\n        continue\n    x1, y1, x2, y2 = [int(v) for v in det.xyxy[0].tolist()]\n    cx = int((x1 + x2) / 2)\n    cy = int((y1 + y2) / 2)\n    boxes.append({"cx": cx, "cy": cy, "x1": x1, "y1": y1, "x2": x2, "y2": y2, "conf": conf})`,
                explanation: "For each detection: skip it if confidence is below threshold. det.xyxy gives the box as [x1,y1,x2,y2] pixel coords. cx/cy are the CENTER of the bounding box — these are used by density_check.py to figure out which section the person is standing in.",
            },
            {
                title: "Return Values",
                code: `return len(boxes), boxes, annotated_frame`,
                explanation: "Returns 3 things to main.py: (1) total count as int, (2) list of box dicts each with cx,cy,x1,y1,x2,y2,conf, (3) the frame with YOLO annotations drawn on it. main.py unpacks these as: count, boxes, annotated_frame.",
            },
        ],
        usedBy: ["main.py"],
        imports: ["config.py → CONF_THRESHOLD, PERSON_CLASS_ID"],
    },

    "density_check.py": {
        icon: "📊",
        color: "#8B5CF6",
        dark: "#3B1F6E",
        role: "Density Calculator",
        tagline: "Takes bounding boxes → assigns each person to a section → calculates crowd density.",
        sections: [
            {
                title: "Imports",
                code: `from config import ROI_DEFINITIONS`,
                explanation: "Only needs the ROI section definitions from config.py. These define the pixel boundaries of each section (A/B/C/D).",
            },
            {
                title: "assign_to_roi()",
                code: `def assign_to_roi(cx: int, cy: int, rois: list[dict]) -> str | None:\n    for roi in rois:\n        if roi["x1"] <= cx <= roi["x2"] and roi["y1"] <= cy <= roi["y2"]:\n            return roi["name"]\n    return None`,
                explanation: "Given a person's center point (cx, cy), checks which section rectangle contains it. Loops through all 4 ROIs and returns the first match. Returns None if somehow the point is outside all sections (edge case). This is called internally by compute_density() for every detected person.",
            },
            {
                title: "compute_density() — Setup",
                code: `roi_counts = {roi["name"]: 0 for roi in rois}\nroi_areas = {\n    roi["name"]: (roi["x2"] - roi["x1"]) * (roi["y2"] - roi["y1"])\n    for roi in rois\n}`,
                explanation: "Initializes two dicts: roi_counts starts all sections at 0 people. roi_areas pre-calculates the pixel area of each section (320×240 = 76,800 px² per section). Area is calculated once, not every frame.",
            },
            {
                title: "compute_density() — Assign & Count",
                code: `for box in boxes:\n    name = assign_to_roi(box["cx"], box["cy"], rois)\n    if name is not None:\n        roi_counts[name] += 1`,
                explanation: "For each detected person's bounding box, calls assign_to_roi() using the center point. Increments the count for whatever section they're in. After this loop, roi_counts has the total people per section.",
            },
            {
                title: "compute_density() — Calculate & Return",
                code: `for name in roi_counts:\n    area = roi_areas[name]\n    density = (roi_counts[name] / area * 10_000) if area > 0 else 0.0\n    density_map[name] = {"count": roi_counts[name], "density": round(density, 4)}\nreturn density_map`,
                explanation: "density = people ÷ area × 10,000. Multiplying by 10,000 converts from 'people per pixel' (a tiny number) to 'people per 10,000 pixels' (a readable number). For example: 3 people in 76,800px² = 0.039 per px² = 0.39 per 10k px². This value is compared against DENSITY_ALERT_THRESHOLD (0.25).",
            },
            {
                title: "get_max_section()",
                code: `def get_max_section(density_map):\n    max_name = max(density_map, key=lambda k: density_map[k]["density"])\n    return max_name, density_map[max_name]["density"]`,
                explanation: "Utility function that scans the density_map and returns the (name, density) of the most crowded section. Note: this function is defined but not currently called in main.py — it's available for future use or debugging.",
            },
        ],
        usedBy: ["main.py"],
        imports: ["config.py → ROI_DEFINITIONS"],
    },

    "alerts.py": {
        icon: "🚨",
        color: "#EF4444",
        dark: "#5C1A1A",
        role: "Alert Engine",
        tagline: "Stateful class that tracks which sections are overcrowded and enforces cooldown timers.",
        sections: [
            {
                title: "Imports",
                code: `import time\nfrom config import DENSITY_ALERT_THRESHOLD, ALERT_COOLDOWN_SECONDS`,
                explanation: "time module is used to get current timestamps for cooldown tracking. Thresholds come from config.py.",
            },
            {
                title: "AlertManager.__init__()",
                code: `def __init__(self) -> None:\n    self._last_alert_time: dict[str, float] = {}\n    self.active_alerts: list[str] = []\n    self._active_sections: set[str] = set()`,
                explanation: "_last_alert_time: dictionary mapping section name → timestamp of last alert. Used to enforce cooldown. active_alerts: the list of alert strings generated this frame. _active_sections: set of section names currently above threshold — used by is_section_alert() which display.py calls to decide border color.",
            },
            {
                title: "check_alerts() — Core Logic",
                code: `now = time.time()\nfor section_name, data in density_map.items():\n    density = data["density"]\n    if density >= DENSITY_ALERT_THRESHOLD:\n        current_active.add(section_name)\n        last = self._last_alert_time.get(section_name, 0.0)\n        if now - last >= ALERT_COOLDOWN_SECONDS:\n            msg = f"Heavy Crowd in {section_name}"\n            new_alerts.append(msg)\n            self._last_alert_time[section_name] = now`,
                explanation: "Called every frame by main.py with the density_map. For each section: if density ≥ 0.25, it's currently active. Then checks: has it been ≥8 seconds since the last alert for this section? If yes, generate a new alert message and record the timestamp. This prevents alert spam — a crowded section only fires a new alert message every 8 seconds.",
            },
            {
                title: "check_alerts() — Update State",
                code: `self._active_sections = current_active\nself.active_alerts = new_alerts\nreturn new_alerts`,
                explanation: "_active_sections is updated every frame to reflect which sections are currently over threshold (regardless of cooldown). This is what is_section_alert() reads — so the red border stays on even between alert message cooldowns.",
            },
            {
                title: "is_section_alert()",
                code: `def is_section_alert(self, section_name: str) -> bool:\n    return section_name in self._active_sections`,
                explanation: "Called by display.py for each section when drawing borders. Returns True if the section is currently above the density threshold. This controls whether the section gets a red border (alert) or green border (normal). Works independently of cooldown — the border stays red as long as density is high.",
            },
        ],
        usedBy: ["main.py", "display.py"],
        imports: ["config.py → DENSITY_ALERT_THRESHOLD, ALERT_COOLDOWN_SECONDS"],
    },

    "display.py": {
        icon: "🖥️",
        color: "#10B981",
        dark: "#064E3B",
        role: "UI Renderer",
        tagline: "Draws all visual overlays onto the frame using OpenCV — sections, labels, badges, alerts.",
        sections: [
            {
                title: "Imports",
                code: `import cv2\nimport numpy as np\nfrom config import DENSITY_ALERT_THRESHOLD`,
                explanation: "cv2 (OpenCV) is the drawing library. numpy is needed for frame manipulation. DENSITY_ALERT_THRESHOLD from config.py is used to color-code the density badges.",
            },
            {
                title: "_draw_transparent_rect() — Helper",
                code: `def _draw_transparent_rect(frame, x1, y1, x2, y2, color, alpha):\n    overlay = frame.copy()\n    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)\n    return cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)`,
                explanation: "Private helper (prefix _ means internal use only). OpenCV can't draw transparent shapes directly. Trick: copy the frame → draw a solid rect on the copy → blend the copy with the original using addWeighted(). alpha=0.5 means 50% opacity. Used for text backgrounds and the alert panel.",
            },
            {
                title: "render_ui() — Section Borders",
                code: `is_alert = alert_manager.is_section_alert(name)\nborder_color = (0, 60, 220) if is_alert else (100, 200, 100)\nthickness = 3 if is_alert else 2\ncv2.rectangle(display, (rx1, ry1), (rx2, ry2), border_color, thickness)`,
                explanation: "For each of the 4 sections: calls alert_manager.is_section_alert() — this is the direct connection from display.py back to alerts.py. If the section is overcrowded, draws a thick red border. Otherwise draws a thin green border.",
            },
            {
                title: "render_ui() — Section Labels",
                code: `label_text = f"{name}  |  {section_data['count']}P"\n(tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)\ndisplay = _draw_transparent_rect(display, lx1, ly1, lx2, ly2, (0,0,0), 0.5)\ncv2.putText(display, label_text, ...)`,
                explanation: "Draws 'Section A  |  3P' in the top-left corner of each section. First measures text size with getTextSize(), then draws a semi-transparent black background behind it, then renders the white text on top. This keeps text readable regardless of background.",
            },
            {
                title: "render_ui() — Density Badges",
                code: `badge_text = f"D: {density_val:.2f}"\nbadge_color = (0, 60, 220) if density_val >= DENSITY_ALERT_THRESHOLD else (0, 200, 80)\ncv2.putText(display, badge_text, (bx, by), ...)`,
                explanation: "Draws 'D: 0.39' in the bottom-right corner of each section. Color is red if density exceeds the threshold, green otherwise. This is the visual indicator of crowding level for each section.",
            },
            {
                title: "render_ui() — Top Status Bar",
                code: `display = _draw_transparent_rect(display, 0, 0, w, 52, (0,0,0), 0.65)\ncv2.putText(display, "Crowd Monitor", (12, 36), ...)\ncv2.putText(display, f"Total People: {total_count}", (w - cw - 12, 36), ...)`,
                explanation: "Draws a dark semi-transparent strip across the top 52 pixels. Left side: 'Crowd Monitor' title in white. Right side: total people count in green. The count is right-aligned by measuring text width and subtracting from frame width.",
            },
            {
                title: "render_ui() — Alert Panel",
                code: `if alerts:\n    visible = alerts[:3]  # Max 3 alerts\n    panel_h = 36 * len(visible)\n    panel_y = h - panel_h\n    display = _draw_transparent_rect(display, 0, panel_y, w, h, (0,0,100), 0.6)\n    for i, alert_msg in enumerate(visible):\n        cv2.putText(display, f"  {alert_msg}", (8, panel_y + 25 + i * 36), ...)`,
                explanation: "Only renders if there are active alerts. Draws a dark blue panel at the BOTTOM of the frame. Height is dynamic: 36px per alert, max 3 alerts. Each alert message is printed in white text. This panel disappears automatically when no alerts are active.",
            },
        ],
        usedBy: ["main.py"],
        imports: ["config.py → DENSITY_ALERT_THRESHOLD", "alerts.py → alert_manager.is_section_alert() (passed as argument)"],
    },

    "main.py": {
        icon: "▶️",
        color: "#F97316",
        dark: "#7C2D12",
        role: "Entry Point & Orchestrator",
        tagline: "The program starts here. Opens video, runs the per-frame pipeline, displays results.",
        sections: [
            {
                title: "Imports — Everything",
                code: `from config import MODEL_PATH, VIDEO_SOURCE, PROCESS_EVERY_N, RESIZE_WIDTH, FRAME_HEIGHT, ROI_DEFINITIONS\nfrom counter import load_model, detect_people\nfrom density_check import compute_density\nfrom alerts import AlertManager\nfrom display import render_ui`,
                explanation: "main.py imports from ALL other files. It's the only file that does this — it's the assembler that wires all the modules together. config.py provides settings; counter/density_check/alerts/display provide the functions.",
            },
            {
                title: "Startup — Load Model & Open Video",
                code: `model = load_model(MODEL_PATH)\nalert_manager = AlertManager()\ncap = cv2.VideoCapture(VIDEO_SOURCE)\nif not cap.isOpened():\n    print(f"Error: Cannot open video source '{VIDEO_SOURCE}'")\n    return`,
                explanation: "Runs ONCE before the loop. load_model() loads YOLOv8 weights (slow — only do it once). AlertManager() creates the stateful alert tracker. VideoCapture opens the webcam or video file. Exits immediately with a clear error if the source can't be opened.",
            },
            {
                title: "Frame Loop — Read & Skip",
                code: `while True:\n    ret, frame = cap.read()\n    if not ret:\n        break\n    frame_idx += 1\n    if frame_idx % PROCESS_EVERY_N != 0:\n        continue`,
                explanation: "cap.read() grabs the next frame. If ret is False, the video ended — break out. PROCESS_EVERY_N (=2): only process even-numbered frames. This halves CPU/GPU load. Odd frames are read but immediately skipped with continue.",
            },
            {
                title: "Step 1 — Resize & Detect",
                code: `frame = cv2.resize(frame, (RESIZE_WIDTH, FRAME_HEIGHT))\ncount, boxes, annotated_frame = detect_people(model, frame)`,
                explanation: "Resizes to 640×480 before detection — ensures all ROI pixel coordinates in config.py are correct. Then calls detect_people() from counter.py. Returns: count (int), boxes (list of dicts with cx,cy), annotated_frame (frame with YOLO drawings).",
            },
            {
                title: "Step 2 — Compute Density",
                code: `density_map = compute_density(boxes, ROI_DEFINITIONS)`,
                explanation: "Passes the box list to density_check.py. Returns density_map — a dict like {'Section A': {'count': 2, 'density': 0.26}, 'Section B': {...}, ...}. This tells us how crowded each of the 4 sections is.",
            },
            {
                title: "Step 3 — Check Alerts",
                code: `alerts = alert_manager.check_alerts(density_map)`,
                explanation: "Passes density_map to the AlertManager. It checks each section against the threshold, respects the cooldown timer, and returns a list of new alert strings (e.g. ['Heavy Crowd in Section A']). Also updates alert_manager's internal state so is_section_alert() works correctly.",
            },
            {
                title: "Step 4 — Render & Display",
                code: `display_frame = render_ui(\n    annotated_frame, count, density_map,\n    alerts, alert_manager, ROI_DEFINITIONS\n)\ncv2.imshow("Crowd Monitor", display_frame)`,
                explanation: "Passes everything to display.py's render_ui(). Note that alert_manager is passed as an object — display.py will call alert_manager.is_section_alert() itself. cv2.imshow() opens/updates the display window with the final overlaid frame.",
            },
            {
                title: "Console Output & Quit",
                code: `if count != prev_count:\n    print(f"Count changed: {prev_count} -> {count}")\nfor a in alerts:\n    print(a)\nif cv2.waitKey(1) & 0xFF == ord("q"):\n    break`,
                explanation: "Prints to console only when count changes — avoids flooding the terminal. Prints each new alert message. cv2.waitKey(1) waits 1ms for a keypress. If user presses 'q', breaks the loop and exits cleanly.",
            },
            {
                title: "Cleanup — Finally Block",
                code: `finally:\n    cap.release()\n    cv2.destroyAllWindows()\n    print(f"Finished | Processed {frame_idx} frames | Final count: {prev_count}")`,
                explanation: "Always runs whether the loop exited normally, from 'q' key, or from Ctrl+C (KeyboardInterrupt is caught above). cap.release() frees the camera/file handle. destroyAllWindows() closes the OpenCV display window. Prints a final summary.",
            },
        ],
        usedBy: [],
        imports: [
            "config.py → MODEL_PATH, VIDEO_SOURCE, PROCESS_EVERY_N, RESIZE_WIDTH, FRAME_HEIGHT, ROI_DEFINITIONS",
            "counter.py → load_model, detect_people",
            "density_check.py → compute_density",
            "alerts.py → AlertManager",
            "display.py → render_ui",
        ],
    },
};

const FILE_ORDER = ["config.py", "counter.py", "density_check.py", "alerts.py", "display.py", "main.py"];

export default function App() {
    const [activeFile, setActiveFile] = useState("config.py");
    const [expandedSection, setExpandedSection] = useState(0);
    const file = FILES[activeFile];

    return (
        <div style={{
            fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
            background: "#080810",
            minHeight: "100vh",
            color: "#cbd5e1",
            display: "flex",
            flexDirection: "column",
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0d0d1a; }
        ::-webkit-scrollbar-thumb { background: #2a2a40; border-radius: 3px; }
        .file-tab { cursor: pointer; transition: all 0.15s ease; border: none; background: none; }
        .file-tab:hover { filter: brightness(1.2); }
        .section-row { cursor: pointer; transition: background 0.12s; }
        .section-row:hover { background: rgba(255,255,255,0.04) !important; }
        .fade { animation: fadeSlide 0.2s ease; }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .tag { font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
        pre { white-space: pre-wrap; word-break: break-word; }
      `}</style>

            {/* Header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #13131f", background: "#0c0c18" }}>
                <div style={{ fontSize: 10, color: "#4f4f7a", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 3 }}>
                    Crowd Monitor · Codebase
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 20, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                    6-File Code Breakdown
                </div>
            </div>

            {/* File Tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #13131f", background: "#0c0c18", overflowX: "auto", flexShrink: 0 }}>
                {FILE_ORDER.map((fname, i) => {
                    const f = FILES[fname];
                    const active = activeFile === fname;
                    return (
                        <button
                            key={fname}
                            className="file-tab"
                            onClick={() => { setActiveFile(fname); setExpandedSection(0); }}
                            style={{
                                padding: "10px 18px",
                                borderBottom: active ? `2px solid ${f.color}` : "2px solid transparent",
                                color: active ? f.color : "#4a5568",
                                fontSize: 12,
                                fontWeight: active ? 600 : 400,
                                fontFamily: "'IBM Plex Mono', monospace",
                                whiteSpace: "nowrap",
                                background: active ? f.color + "10" : "transparent",
                            }}
                        >
                            {f.icon} {fname}
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1, overflow: "hidden", minHeight: 0 }}>

                {/* Left: Sections */}
                <div style={{ overflowY: "auto", padding: "20px 24px" }} className="fade" key={activeFile}>

                    {/* File Header */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 28 }}>{file.icon}</span>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>{activeFile}</span>
                                    <span className="tag" style={{ background: file.color + "25", color: file.color }}>{file.role}</span>
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontFamily: "'IBM Plex Sans', sans-serif" }}>{file.tagline}</div>
                            </div>
                        </div>
                    </div>

                    {/* Code Sections */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {file.sections.map((sec, i) => {
                            const open = expandedSection === i;
                            return (
                                <div key={i} style={{ border: `1px solid ${open ? file.color + "50" : "#1a1a2e"}`, borderRadius: 8, overflow: "hidden", background: open ? file.color + "07" : "#0e0e1c" }}>
                                    {/* Section Header */}
                                    <div
                                        className="section-row"
                                        onClick={() => setExpandedSection(open ? -1 : i)}
                                        style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ color: file.color, fontSize: 11, fontWeight: 600, minWidth: 20 }}>
                                                {String(i + 1).padStart(2, "0")}
                                            </span>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: open ? "#f1f5f9" : "#94a3b8", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                {sec.title}
                                            </span>
                                        </div>
                                        <span style={{ color: "#4a5568", fontSize: 14, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
                                    </div>

                                    {/* Expanded Content */}
                                    {open && (
                                        <div style={{ borderTop: `1px solid ${file.color}25` }}>
                                            {/* Code Block */}
                                            <div style={{ background: "#06060f", padding: "14px 16px", position: "relative" }}>
                                                <div style={{ fontSize: 9, color: "#2d2d4a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>CODE</div>
                                                <pre style={{ fontSize: 11.5, color: "#a5b4fc", lineHeight: 1.7, fontFamily: "'IBM Plex Mono', monospace" }}>
                                                    {sec.code}
                                                </pre>
                                            </div>
                                            {/* Explanation */}
                                            <div style={{ padding: "14px 16px", background: file.color + "08" }}>
                                                <div style={{ fontSize: 9, color: file.color + "80", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>EXPLANATION</div>
                                                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                    {sec.explanation}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Sidebar */}
                <div style={{ borderLeft: "1px solid #13131f", background: "#0a0a14", overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* File Number */}
                    <div style={{ fontSize: 48, fontWeight: 700, color: file.color + "15", lineHeight: 1, letterSpacing: "-0.05em" }}>
                        {String(FILE_ORDER.indexOf(activeFile) + 1).padStart(2, "0")}
                        <span style={{ fontSize: 14, color: "#2a2a40", fontWeight: 400 }}>/06</span>
                    </div>

                    {/* Imports from */}
                    <div>
                        <div style={{ fontSize: 10, color: "#4f4f7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                            Imports From
                        </div>
                        {file.imports.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#2a2a40", fontStyle: "italic" }}>— nothing (root file)</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {file.imports.map((imp, i) => (
                                    <div key={i} style={{ background: "#0e0e1c", border: "1px solid #1a1a2e", borderRadius: 5, padding: "8px 10px" }}>
                                        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, fontFamily: "'IBM Plex Mono', monospace" }}>
                                            {imp.includes("→") ? (
                                                <>
                                                    <span style={{ color: "#f59e0b" }}>{imp.split("→")[0].trim()}</span>
                                                    <span style={{ color: "#2a2a40" }}> → </span>
                                                    <span style={{ color: "#a5b4fc" }}>{imp.split("→")[1].trim()}</span>
                                                </>
                                            ) : imp}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Used By */}
                    <div>
                        <div style={{ fontSize: 10, color: "#4f4f7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                            Used By
                        </div>
                        {file.usedBy.length === 0 ? (
                            <div style={{ fontSize: 12, color: "#2a2a40", fontStyle: "italic" }}>— nobody (this is the entry point)</div>
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {file.usedBy.map((f, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setActiveFile(f); setExpandedSection(0); }}
                                        style={{
                                            background: FILES[f].color + "18",
                                            border: `1px solid ${FILES[f].color}40`,
                                            borderRadius: 4,
                                            padding: "4px 10px",
                                            fontSize: 11,
                                            color: FILES[f].color,
                                            cursor: "pointer",
                                            fontFamily: "'IBM Plex Mono', monospace",
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section Navigator */}
                    <div>
                        <div style={{ fontSize: 10, color: "#4f4f7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                            Jump to Section
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {file.sections.map((sec, i) => (
                                <button
                                    key={i}
                                    onClick={() => setExpandedSection(i)}
                                    style={{
                                        background: expandedSection === i ? file.color + "18" : "transparent",
                                        border: `1px solid ${expandedSection === i ? file.color + "40" : "#1a1a2e"}`,
                                        borderRadius: 4,
                                        padding: "7px 10px",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span style={{ fontSize: 10, color: file.color, fontWeight: 600, minWidth: 16 }}>{i + 1}</span>
                                    <span style={{ fontSize: 11, color: expandedSection === i ? "#e2e8f0" : "#475569", fontFamily: "'IBM Plex Sans', sans-serif" }}>{sec.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* All Files Quick Nav */}
                    <div>
                        <div style={{ fontSize: 10, color: "#4f4f7a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                            All Files
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {FILE_ORDER.map((fname) => {
                                const f = FILES[fname];
                                const active = activeFile === fname;
                                return (
                                    <button
                                        key={fname}
                                        onClick={() => { setActiveFile(fname); setExpandedSection(0); }}
                                        style={{
                                            background: active ? f.color + "15" : "transparent",
                                            border: `1px solid ${active ? f.color + "40" : "#1a1a2e"}`,
                                            borderLeft: `3px solid ${active ? f.color : "#1a1a2e"}`,
                                            borderRadius: "0 4px 4px 0",
                                            padding: "7px 10px",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <span style={{ fontSize: 13 }}>{f.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 11, color: active ? f.color : "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>{fname}</div>
                                            <div style={{ fontSize: 10, color: "#2a2a40", fontFamily: "'IBM Plex Sans', sans-serif" }}>{f.role}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}