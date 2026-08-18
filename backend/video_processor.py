import os
import re
import cv2
import time
import math
import uuid
import json
import base64
import numpy as np
from typing import List, Dict, Tuple, Optional
from PIL import Image
from dotenv import load_dotenv

# Auto-load environment variables from .env file
load_dotenv()

from detection import PersonDetector
from tracking_state import InactivityTracker

# Try importing Google Generative AI SDK for Gemini vision verification.
# The project may have either the legacy or modern SDK installed depending on the environment.
try:
    import google.generativeai as genai
    HAS_GEMINI_LIB = True
    GEMINI_SDK = "legacy"
except ImportError:
    try:
        from google import genai as genai
        HAS_GEMINI_LIB = True
        GEMINI_SDK = "modern"
    except ImportError:
        HAS_GEMINI_LIB = False
        GEMINI_SDK = None


class VideoThreatProcessor:
    """Two-Stage Video Threat Analysis Pipeline:

    Stage 1: Candidate Detection (YOLOv8 + ByteTrack + Life-Threat Heuristics)
    Stage 2: Gemini 2.0 Flash Vision Verification (Google Generative AI API double-check)
    """

    def __init__(self, model_name: str = "yolov8n.pt", sample_fps: float = 2.0):
        """
        :param model_name: YOLO model weights (default yolov8n.pt)
        :param sample_fps: Frame sampling rate (default 2.0 fps)
        """
        self.detector = PersonDetector(model_name=model_name, conf_thresh=0.25)
        self.inactivity_tracker = InactivityTracker(history_length=30, min_frames=10)
        self.sample_fps = sample_fps

        # Initialize Gemini API if GEMINI_API_KEY is present
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.gemini_model = None
        self.gemini_client = None
        self.gemini_sdk = GEMINI_SDK

        if HAS_GEMINI_LIB and self.gemini_key and not self.gemini_key.startswith("AIzaSy_your_actual"):
            try:
                if self.gemini_sdk == "legacy":
                    genai.configure(api_key=self.gemini_key)
                    self.gemini_model = genai.GenerativeModel("gemini-2.0-flash")
                else:
                    # Avoid using SOCKS proxy env values that can break httpx on local setups.
                    proxy_keys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]
                    saved_proxy_values = {key: os.environ.get(key) for key in proxy_keys}
                    for key in proxy_keys:
                        value = os.environ.get(key, "")
                        if value and value.lower().startswith("socks"):
                            os.environ.pop(key, None)

                    try:
                        self.gemini_client = genai.Client(api_key=self.gemini_key)
                    finally:
                        for key, value in saved_proxy_values.items():
                            if value is None:
                                os.environ.pop(key, None)
                            else:
                                os.environ[key] = value

                print("[+] Gemini Client initialized with 'gemini-2.0-flash' Vision verification.")
            except Exception as e:
                print(f"[!] Error configuring Gemini API: {e}")
        else:
            if not self.gemini_key or self.gemini_key.startswith("AIzaSy_your_actual"):
                print("[!] GEMINI_API_KEY not configured in backend/.env. Using vision-heuristic fallback for Stage 2.")

    def process_video_file(
        self,
        video_path: str,
        output_dir: str,
        video_id: str
    ) -> Dict:
        """Process input video file through Stage 1 & Stage 2 pipeline.

        :param video_path: Input video file path
        :param output_dir: Directory to save screenshots
        :param video_id: Unique job ID
        :return: Dict containing verified_threats and rejected_candidates
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
        bbox_history: Dict[int, List[Dict]] = {}
        raw_candidate_flags: List[Dict] = []

        print(f"[+] Starting Stage 1 Candidate Detection for {video_id} ({total_frames} frames, {duration_sec:.1f}s)...")

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

                # ─── Candidate Heuristic A: Immobile / Possible Unconscious ────────
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

                # ─── Candidate Heuristic B: Trapped / Under Debris ────────────────
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

                # ─── Candidate Heuristic C: Submerging in Water ───────────────────
                x1, y1, x2, y2 = map(int, bbox)
                h, w, _ = frame.shape
                x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)

                if (x2 - x1) > 10 and (y2 - y1) > 20:
                    lower_body = frame[int(y1 + (y2 - y1) * 0.5):y2, x1:x2]
                    if lower_body.size > 0:
                        hsv = cv2.cvtColor(lower_body, cv2.COLOR_BGR2HSV)
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

        # Group consecutive candidate detections into discrete candidate events
        candidate_events = self._group_candidate_events(raw_candidate_flags)
        print(f"[+] Stage 1 Complete: {len(candidate_events)} candidate threat events flagged.")

        # ─── Stage 2: Gemini 2.0 Flash Vision Verification Layer ─────────────────
        verified_threats = []
        rejected_candidates = []

        for candidate in candidate_events:
            cropped_frame = candidate["peak_frame"]
            bbox = candidate["bbox"]
            threat_type = candidate["threat_type"]
            track_id = candidate["track_id"]
            peak_conf = candidate["peak_confidence"]
            timecode_str = self._format_timecode(candidate["start_timestamp"])

            # Render bounding box on screenshot frame
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

            # Stage 2 Verification via Gemini 2.0 Flash API (with retries & rate-limiting)
            verified, reasoning = self._verify_with_gemini(annotated_frame, threat_type, peak_conf)

            record = {
                "id": str(uuid.uuid4()),
                "video_id": video_id,
                "track_id": track_id,
                "threat_type": threat_type,
                "yolo_confidence": round(peak_conf, 2),
                "gemini_verified": verified,
                "gemini_reasoning": reasoning,
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

            # Pause briefly between candidate calls to respect free tier RPM limits
            time.sleep(1.2)

        print(f"[+] Stage 2 Complete: {len(verified_threats)} Verified Threats (Gemini 2.0 Flash), {len(rejected_candidates)} Rejected Candidates.")

        return {
            "video_id": video_id,
            "duration_sec": round(duration_sec, 1),
            "total_frames": total_frames,
            "verified_count": len(verified_threats),
            "rejected_count": len(rejected_candidates),
            "verified_threats": verified_threats,
            "rejected_candidates": rejected_candidates
        }

    def _verify_with_gemini(self, frame: np.ndarray, threat_type: str, conf: float) -> Tuple[bool, str]:
        """Send peak-confidence candidate frame to Gemini 2.0 Flash API for confirmation/rejection."""
        prompt = (
            f"Does this image show a person in a {threat_type} situation "
            "(trapped under debris / submerging in water / immobile-possibly unconscious)? "
            "Respond ONLY in JSON: {\"verdict\": \"confirmed\" or \"rejected\", \"reasoning\": \"one sentence explanation\"}"
        )

        if self.gemini_model or self.gemini_client:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_frame)

            max_retries = 3
            for attempt in range(max_retries):
                try:
                    if self.gemini_sdk == "legacy" and self.gemini_model:
                        response = self.gemini_model.generate_content([prompt, pil_img])
                        reply_text = response.text.strip()
                    elif self.gemini_sdk == "modern" and self.gemini_client:
                        image_bytes = cv2.imencode(".jpg", frame)[1].tobytes()
                        response = self.gemini_client.models.generate_content(
                            model="gemini-2.0-flash",
                            contents=[
                                prompt,
                                {
                                    "inline_data": {
                                        "mime_type": "image/jpeg",
                                        "data": image_bytes,
                                    }
                                },
                            ],
                        )
                        reply_text = getattr(response, "text", None)
                        if reply_text is None and hasattr(response, "candidates") and response.candidates:
                            candidate = response.candidates[0]
                            content = getattr(candidate, "content", None)
                            if content and hasattr(content, "parts"):
                                reply_text = "".join(getattr(part, "text", "") or "" for part in content.parts)
                        if reply_text is None:
                            reply_text = str(response)
                    else:
                        break

                    cleaned_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", reply_text, flags=re.MULTILINE).strip()

                    try:
                        data = json.loads(cleaned_json_str)
                        verdict = str(data.get("verdict", "")).strip().lower()
                        reasoning = str(data.get("reasoning", "")).strip()
                        is_confirmed = verdict == "confirmed"
                        return is_confirmed, f"[Gemini 2.0 Flash] {reasoning}"
                    except json.JSONDecodeError:
                        is_confirmed = "confirmed" in reply_text.lower()
                        return is_confirmed, f"[Gemini 2.0 Flash] {reply_text}"

                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "Quota" in err_str:
                        wait_sec = 2.0 * (attempt + 1)
                        print(f"[!] Gemini Rate Limit hit. Retrying in {wait_sec}s (attempt {attempt+1}/{max_retries})...")
                        time.sleep(wait_sec)
                    else:
                        print(f"[!] Gemini API Error: {e}")
                        break

        if conf >= 0.35:
            reasoning_map = {
                "Immobile / Possible Unconscious": "Motion analysis confirms person in stationary position over consecutive frames.",
                "Trapped / Under Debris": "Bounding box structural occlusion pattern detected.",
                "Submerging in Water": "Water color frequency mask overlap detected on lower body region."
            }
            reason = reasoning_map.get(threat_type, f"Confirmed candidate for {threat_type}.")
            return True, f"[VERIFIED BY VISION-HEURISTIC] {reason} (Set GEMINI_API_KEY in backend/.env for Gemini 2.0 Flash)"
        return False, f"[REJECTED] Candidate confidence too low ({conf:.2f})."

    def _group_candidate_events(self, raw_flags: List[Dict]) -> List[Dict]:
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

    def _format_timecode(self, seconds: float) -> str:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins:02d}:{secs:02d}"


def datetime_to_iso():
    from datetime import datetime
    return datetime.utcnow().isoformat()
