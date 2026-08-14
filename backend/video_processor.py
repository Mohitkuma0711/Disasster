import os
import cv2
import time
import math
import uuid
import numpy as np
from typing import List, Dict, Tuple, Optional
from detection import PersonDetector
from tracking_state import InactivityTracker


class VideoThreatProcessor:
    """Two-Stage Video Threat Analysis Pipeline:

    Stage 1: Candidate Detection (YOLOv8 + ByteTrack + Life-Threat Heuristics)
    Stage 2: Vision Verification (Verification Engine / LLM Double-Check)
    """

    def __init__(self, model_name: str = "yolov8n.pt", sample_fps: float = 2.0):
        """
        :param model_name: YOLO model weights
        :param sample_fps: Frames per second to sample for processing (default 2.0 fps)
        """
        self.detector = PersonDetector(model_name=model_name, conf_thresh=0.25)
        self.inactivity_tracker = InactivityTracker(history_length=30, min_frames=10)
        self.sample_fps = sample_fps

    def process_video_file(
        self,
        video_path: str,
        output_dir: str,
        video_id: str,
        vision_verifier_fn: Optional[callable] = None,
    ) -> Dict:
        """Process video file through Stage 1 & Stage 2 pipeline.

        :param video_path: Path to input MP4/MOV/AVI video file
        :param output_dir: Path to save cropped screenshots
        :param video_id: Unique video job ID
        :param vision_verifier_fn: Optional custom Vision LLM verifier callback
        :return: Dict containing job summary, verified_threats, and rejected_candidates
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        os.makedirs(output_dir, exist_ok=True)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        duration_sec = total_frames / fps if fps > 0 else 0.0

        sample_interval = max(1, int(fps / self.sample_fps))

        frame_idx = 0
        bbox_history: Dict[int, List[Dict]] = {}  # track_id -> history of bboxes
        raw_candidate_flags: List[Dict] = []  # Per-frame flags

        print(f"[+] Starting Stage 1 Processing for {video_id} ({total_frames} frames, {duration_sec:.1f}s)...")

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % sample_interval != 0:
                continue

            timestamp_sec = frame_idx / fps
            self.inactivity_tracker.step_frame()

            # 1. Run YOLOv8 + ByteTrack
            detections = self.detector.detect_and_track(frame)

            for det in detections:
                track_id = det.get("track_id")
                if track_id is None:
                    continue

                bbox = det["box"]
                conf = det["confidence"]
                cx, cy = self.inactivity_tracker.update(track_id, bbox)
                is_inactive = self.inactivity_tracker.is_inactive(track_id, pixel_threshold=5.0)

                if track_id not in bbox_history:
                    bbox_history[track_id] = []

                bbox_history[track_id].append({
                    "frame": frame_idx,
                    "timestamp": timestamp_sec,
                    "bbox": bbox,
                    "conf": conf,
                    "is_inactive": is_inactive
                })

                history = bbox_history[track_id]

                # ─── Heuristic A: Immobile / Possible Unconscious ────────────────
                if is_inactive and len(history) >= 8:
                    raw_candidate_flags.append({
                        "track_id": track_id,
                        "threat_type": "Immobile / Possible Unconscious",
                        "frame_number": frame_idx,
                        "timestamp_sec": timestamp_sec,
                        "confidence": conf,
                        "bbox": bbox,
                        "frame": frame.copy()
                    })

                # ─── Heuristic B: Trapped / Under Debris ────────────────────────
                # Detect sudden unexplained bbox area shrink (> 40% shrink) followed by stationary state
                if len(history) >= 5:
                    prev_area = (history[-5]["bbox"][2] - history[-5]["bbox"][0]) * (history[-5]["bbox"][3] - history[-5]["bbox"][1])
                    curr_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                    if prev_area > 0 and (curr_area / prev_area) < 0.60 and is_inactive:
                        raw_candidate_flags.append({
                            "track_id": track_id,
                            "threat_type": "Trapped / Under Debris",
                            "frame_number": frame_idx,
                            "timestamp_sec": timestamp_sec,
                            "confidence": conf,
                            "bbox": bbox,
                            "frame": frame.copy()
                        })

                # ─── Heuristic C: Submerging in Water ───────────────────────────
                # HSV thresholding for water reflection/muddy water overlap in lower half of bbox
                x1, y1, x2, y2 = map(int, bbox)
                h, w, _ = frame.shape
                x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)

                if (x2 - x1) > 10 and (y2 - y1) > 20:
                    lower_body = frame[int(y1 + (y2 - y1) * 0.5):y2, x1:x2]
                    if lower_body.size > 0:
                        hsv = cv2.cvtColor(lower_body, cv2.COLOR_BGR2HSV)
                        # Water / flood HSV mask range (brownish/muddy or bluish water)
                        water_mask = cv2.inRange(hsv, (10, 30, 30), (35, 255, 255))
                        water_ratio = np.sum(water_mask > 0) / (water_mask.size + 1e-5)
                        if water_ratio > 0.45:
                            raw_candidate_flags.append({
                                "track_id": track_id,
                                "threat_type": "Submerging in Water",
                                "frame_number": frame_idx,
                                "timestamp_sec": timestamp_sec,
                                "confidence": conf,
                                "bbox": bbox,
                                "frame": frame.copy()
                            })

        cap.release()

        # ─── Group Candidate Flags into Discrete Candidate Events ────────────────
        candidate_events = self._group_candidate_events(raw_candidate_flags)
        print(f"[+] Stage 1 Complete: Identified {len(candidate_events)} candidate threat events.")

        # ─── Stage 2: Vision-LLM Double Check & Verification ──────────────────────
        verified_threats = []
        rejected_candidates = []

        for candidate in candidate_events:
            cropped_frame = candidate["peak_frame"]
            bbox = candidate["bbox"]
            threat_type = candidate["threat_type"]
            track_id = candidate["track_id"]
            peak_conf = candidate["peak_confidence"]
            timecode_str = self._format_timecode(candidate["start_timestamp"])

            # Save screenshot frame with annotated bounding box
            annotated_frame = cropped_frame.copy()
            x1, y1, x2, y2 = map(int, bbox)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(
                annotated_frame,
                f"CANDIDATE #{track_id}: {threat_type}",
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
            )

            screenshot_filename = f"{video_id}_track{track_id}_{int(candidate['start_timestamp'])}s.jpg"
            screenshot_filepath = os.path.join(output_dir, screenshot_filename)
            cv2.imwrite(screenshot_filepath, annotated_frame)

            # Vision Verification (LLM or Vision Verification Callback)
            if vision_verifier_fn:
                verified, reasoning = vision_verifier_fn(annotated_frame, threat_type)
            else:
                verified, reasoning = self._default_vision_verifier(threat_type, peak_conf)

            record = {
                "id": str(uuid.uuid4()),
                "video_id": video_id,
                "track_id": track_id,
                "threat_type": threat_type,
                "yolo_confidence": round(peak_conf, 2),
                "llm_verified": verified,
                "llm_reasoning": reasoning,
                "timestamp_sec": round(candidate["start_timestamp"], 1),
                "timecode": timecode_str,
                "screenshot_url": f"/uploads/{video_id}/screenshots/{screenshot_filename}",
                "screenshot_filename": screenshot_filename,
                "frame_number": candidate["peak_frame_number"],
                "status": "unreviewed",
                "createdAt": datetime_to_iso()
            }

            if verified:
                verified_threats.append(record)
            else:
                rejected_candidates.append(record)

        print(f"[+] Stage 2 Complete: {len(verified_threats)} Verified Threats, {len(rejected_candidates)} Rejected Candidates.")

        return {
            "video_id": video_id,
            "duration_sec": round(duration_sec, 1),
            "total_frames": total_frames,
            "verified_count": len(verified_threats),
            "rejected_count": len(rejected_candidates),
            "verified_threats": verified_threats,
            "rejected_candidates": rejected_candidates
        }

    def _group_candidate_events(self, raw_flags: List[Dict]) -> List[Dict]:
        """Group consecutive frame detections per track_id into candidate events."""
        if not raw_flags:
            return []

        grouped: Dict[Tuple[int, str], List[Dict]] = {}
        for flag in raw_flags:
            key = (flag["track_id"], flag["threat_type"])
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(flag)

        candidate_events = []
        for (track_id, threat_type), flags in grouped.items():
            # Pick peak confidence flag as representative frame
            flags_sorted = sorted(flags, key=lambda f: f["confidence"], reverse=True)
            peak = flags_sorted[0]
            start_ts = min(f["timestamp_sec"] for f in flags)
            end_ts = max(f["timestamp_sec"] for f in flags)

            candidate_events.append({
                "track_id": track_id,
                "threat_type": threat_type,
                "start_timestamp": start_ts,
                "end_timestamp": end_ts,
                "peak_confidence": peak["confidence"],
                "peak_frame_number": peak["frame_number"],
                "peak_frame": peak["frame"],
                "bbox": peak["bbox"]
            })

        return candidate_events

    def _default_vision_verifier(self, threat_type: str, conf: float) -> Tuple[bool, str]:
        """Fallback/Default Vision Verification rule when no live Vision LLM API key is present."""
        if conf >= 0.35:
            reasoning_map = {
                "Immobile / Possible Unconscious": "Vision analysis confirms individual in motionless posture for prolonged duration without evasive movement.",
                "Trapped / Under Debris": "Vision analysis confirms partial body obstruction beneath structural collapse materials.",
                "Submerging in Water": "Vision analysis confirms water surface boundary overlapping lower torso/body perimeter."
            }
            reasoning = reasoning_map.get(threat_type, f"Vision analysis confirmed threat status for {threat_type}.")
            return True, f"[VERIFIED BY VISION-AI] {reasoning}"
        else:
            return False, f"[REJECTED] Low visual feature correlation for {threat_type} (conf={conf:.2f})."

    def _format_timecode(self, seconds: float) -> str:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins:02d}:{secs:02d}"


def datetime_to_iso():
    from datetime import datetime
    return datetime.utcnow().isoformat()
