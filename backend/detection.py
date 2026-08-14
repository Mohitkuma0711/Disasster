import sys
import cv2
import numpy as np
from ultralytics import YOLO


class PersonDetector:
    """Person detection and multi-object tracking using YOLOv8 and ByteTrack."""

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        conf_thresh: float = 0.25,
        tracker: str = "bytetrack.yaml",
    ):
        """Initialize the YOLOv8 model.

        :param model_name: YOLO model weights (downloads automatically if not local)
        :param conf_thresh: Confidence threshold filter
        :param tracker: Tracker specification ('bytetrack.yaml' or 'botsort.yaml')
        """
        self.model = YOLO(model_name)
        self.conf_thresh = conf_thresh
        self.tracker = tracker

    def detect_and_track(self, frame: np.ndarray) -> list[dict]:
        """Process a single frame, detect persons (class 0), and update ByteTrack IDs.

        :param frame: Input image frame as BGR numpy array
        :return: List of dicts containing:
                 - 'track_id': Persistent integer ID (or None if unassigned)
                 - 'box': [x1, y1, x2, y2] bounding box coordinates (floats)
                 - 'confidence': Detection confidence score (float)
                 - 'class_id': 0 (person)
        """
        if frame is None or frame.size == 0:
            return []

        # Run tracking using YOLOv8 built-in ByteTrack integration
        results = self.model.track(
            source=frame,
            persist=True,
            conf=self.conf_thresh,
            classes=[0],  # Filter to class 0 (person)
            tracker=self.tracker,
            verbose=False,
        )

        detections = []
        if not results or len(results) == 0:
            return detections

        res = results[0]
        boxes = res.boxes

        if boxes is None or len(boxes) == 0:
            return detections

        # Extract bounding box coordinates, confidences, and track IDs
        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()

        # Track IDs assigned by ByteTrack
        if boxes.id is not None:
            track_ids = boxes.id.cpu().numpy().astype(int)
        else:
            track_ids = [None] * len(boxes)

        for i in range(len(boxes)):
            detections.append(
                {
                    "track_id": int(track_ids[i]) if track_ids[i] is not None else None,
                    "box": [
                        float(xyxy[i][0]),
                        float(xyxy[i][1]),
                        float(xyxy[i][2]),
                        float(xyxy[i][3]),
                    ],
                    "confidence": float(confs[i]),
                    "class_id": 0,
                }
            )

        return detections

    def draw_detections(self, frame: np.ndarray, detections: list[dict]) -> np.ndarray:
        """Draw bounding boxes and persistent track IDs on a copy of the frame.

        :param frame: Original image frame
        :param detections: List of detection dicts from detect_and_track
        :return: Annotated image frame
        """
        annotated = frame.copy()
        for det in detections:
            x1, y1, x2, y2 = map(int, det["box"])
            track_id = det["track_id"]
            conf = det["confidence"]

            label = f"Person #{track_id} ({conf:.2f})" if track_id is not None else f"Person ({conf:.2f})"

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Label text background
            (text_w, text_h), baseline = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2
            )
            cv2.rectangle(
                annotated,
                (x1, y1 - text_h - 10),
                (x1 + text_w, y1),
                (0, 255, 0),
                -1,
            )

            # Label text
            cv2.putText(
                annotated,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                2,
            )

        return annotated


if __name__ == "__main__":
    print("Initializing PersonDetector with YOLOv8n + ByteTrack...")
    detector = PersonDetector(model_name="yolov8n.pt", conf_thresh=0.25)

    # Determine video source: webcam or video file path from command line
    video_source = sys.argv[1] if len(sys.argv) > 1 else 0
    cap = cv2.VideoCapture(video_source)

    if not cap.isOpened():
        print(f"Error: Could not open video source '{video_source}'. Generating test frame...")
        # Create a synthetic frame with person-like test shapes if no video source is available
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        results = detector.detect_and_track(dummy_frame)
        print("Test frame detections:", results)
        sys.exit(0)

    print("Running detection and tracking loop. Press 'q' to exit.")
    window_name = "Person Detector & ByteTrack"

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("End of video stream.")
                break

            # Perform detection & tracking
            detections = detector.detect_and_track(frame)

            # Render annotations
            annotated = detector.draw_detections(frame, detections)

            # Display frame
            cv2.imshow(window_name, annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    except Exception as e:
        print(f"Display loop output (headless environment fallback): {e}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
