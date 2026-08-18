import os
import uuid
import json
import shutil
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.photo_routes import router as photo_router
from core.config import APP_TITLE, UPLOADS_DIR
from video_processor import VideoThreatProcessor, datetime_to_iso


# Initialize FastAPI application
app = FastAPI(title=APP_TITLE)
app.include_router(photo_router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory and mount static server for video screenshots
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# In-memory storage for jobs & threats (backed up by Firestore when client connected)
VIDEO_JOBS_DB = {}
VERIFIED_THREATS_DB = {}
REJECTED_CANDIDATES_DB = {}

# Create the heavyweight video processor only when a video is actually uploaded.
# This keeps lightweight routes (health, city search, climate assessment) available
# even when the YOLO weights are not present yet.
processor = None

def get_video_processor() -> VideoThreatProcessor:
    global processor
    if processor is None:
        processor = VideoThreatProcessor(model_name="yolov8n.pt", sample_fps=2.0)
    return processor


def _local_climate_assessment(latitude: float, longitude: float) -> dict:
    """Useful local response when Gemini is not configured."""
    return {
        "location_name": f"Selected location ({latitude:.3f}, {longitude:.3f})",
        "risk_level": "UNKNOWN",
        "risk_score": None,
        "summary": "Gemini is not configured, so a city-specific historical assessment cannot be generated.",
        "top_hazards": [],
        "historical_signals": [],
        "preparedness": ["Configure GEMINI_API_KEY in backend/.env and restart the API."],
        "source": "local fallback",
        "disclaimer": "This tool is not a real-time warning system. Follow official disaster-management and weather agencies for active alerts.",
    }


def _parse_gemini_json(text: str) -> dict:
    """Accept JSON responses even when a model wraps them in a Markdown fence."""
    cleaned = re.sub(r"^```(?:json)?\\s*|\\s*```$", "", text.strip(), flags=re.IGNORECASE)
    return json.loads(cleaned)


@app.post("/city-search")
def city_search(payload: dict):
    """Resolve a human-readable city name to coordinates for the globe."""
    query = str(payload.get("query", "")).strip()
    if not query:
        raise HTTPException(status_code=422, detail="A city name is required")

    try:
        params = urlencode({"format": "jsonv2", "limit": 1, "q": query})
        request = Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": "DisasterRiskCommandCenter/1.0 (local development)"},
        )
        with urlopen(request, timeout=10) as response:
            matches = json.loads(response.read().decode("utf-8"))
        if not matches:
            raise HTTPException(status_code=404, detail="City not found")

        match = matches[0]
        return {
            "name": match["display_name"],
            "latitude": float(match["lat"]),
            "longitude": float(match["lon"]),
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[!] City search failed: {exc}")
        raise HTTPException(status_code=503, detail="City search is temporarily unavailable")


# ─── 1. Health Endpoint ───────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Disaster Victim Detection API"}


@app.post("/climate-risk-assessment")
def climate_risk_assessment(location: dict):
    """Generate a historical, city-level hazard assessment from a globe coordinate."""
    try:
        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="latitude and longitude are required numbers")

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Coordinates are outside valid geographic bounds")

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or gemini_key.startswith("AIzaSy_your_actual"):
        return _local_climate_assessment(latitude, longitude)

    prompt = f"""
You are a disaster-risk research assistant. Assess the location at latitude {latitude:.5f}, longitude {longitude:.5f}.
Identify the nearest city or locality, then provide a cautious historical natural-hazard assessment based on broadly documented patterns and geographic context. Do not claim live weather, active alerts, certainty, or access to databases. If you are uncertain about a historical fact, describe it as a general pattern rather than inventing a precise event.

Return only valid JSON with this exact shape:
{{
  "location_name": "City, region, country",
  "risk_level": "LOW|MODERATE|HIGH|VERY HIGH|UNKNOWN",
  "risk_score": 0,
  "summary": "2-3 sentence historical risk assessment",
  "top_hazards": [{{"type": "Flood", "risk": "High", "reason": "brief geographic or historical reason"}}],
  "historical_signals": ["short, cautious historical pattern or event"],
  "preparedness": ["practical preparedness action"],
  "source": "Gemini historical-context assessment",
  "disclaimer": "Historical-context estimate only; not a live warning or official forecast."
}}
Use an integer risk_score from 0 to 100, and include 2-4 top_hazards and 2-4 preparedness actions.
"""

    try:
        request_body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }).encode("utf-8")
        request = Request(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={gemini_key}",
            data=request_body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        # Historical assessments can take longer than simple Gemini prompts.
        with urlopen(request, timeout=90) as response:
            response_body = json.loads(response.read().decode("utf-8"))
        response_text = response_body["candidates"][0]["content"]["parts"][0]["text"]
        assessment = _parse_gemini_json(response_text)
        assessment["source"] = assessment.get("source") or "Gemini historical-context assessment"
        assessment["disclaimer"] = assessment.get("disclaimer") or "Historical-context estimate only; not a live warning or official forecast."
        return assessment
    except Exception as exc:
        print(f"[!] Gemini climate-risk assessment failed: {exc}")
        fallback = _local_climate_assessment(latitude, longitude)
        fallback["summary"] = "Gemini could not return an assessment for this location. Check the API key, quota, and backend logs."
        return fallback


# ─── 2. WebSocket Route ───────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        pass


# ─── 3. Video Upload & Background Processing ──────────────────────────────────

def run_video_processing_task(video_id: str, video_path: str, output_dir: str):
    """Background Task execution for Video Threat Analysis."""
    try:
        VIDEO_JOBS_DB[video_id]["status"] = "processing"
        
        # Process Video with 2-stage pipeline
        result = get_video_processor().process_video_file(
            video_path=video_path,
            output_dir=output_dir,
            video_id=video_id
        )

        # Save Verified Threats
        for threat in result["verified_threats"]:
            VERIFIED_THREATS_DB[threat["id"]] = threat

        # Save Rejected Candidates
        for rejected in result["rejected_candidates"]:
            REJECTED_CANDIDATES_DB[rejected["id"]] = rejected

        VIDEO_JOBS_DB[video_id]["status"] = "completed"
        VIDEO_JOBS_DB[video_id]["duration_sec"] = result["duration_sec"]
        VIDEO_JOBS_DB[video_id]["verified_count"] = result["verified_count"]
        VIDEO_JOBS_DB[video_id]["rejected_count"] = result["rejected_count"]
        VIDEO_JOBS_DB[video_id]["completed_at"] = datetime_to_iso()

        print(f"[✓] Background Task Completed for Video {video_id}: {result['verified_count']} verified threats.")

    except Exception as e:
        print(f"[!] Error processing video {video_id}: {e}")
        VIDEO_JOBS_DB[video_id]["status"] = "error"
        VIDEO_JOBS_DB[video_id]["error_message"] = str(e)


@app.post("/upload-video")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Accepts video file (mp4/mov/avi), saves to disk, creates video_job, and triggers async processing."""
    allowed_exts = [".mp4", ".mov", ".avi", ".mkv"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '{ext}'. Allowed: {allowed_exts}")

    video_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
    job_dir = os.path.join(UPLOADS_DIR, video_id)
    screenshots_dir = os.path.join(job_dir, "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)

    saved_filename = f"original{ext}"
    saved_filepath = os.path.join(job_dir, saved_filename)

    with open(saved_filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Register Job Record
    job_record = {
        "video_id": video_id,
        "filename": file.filename,
        "video_url": f"/uploads/{video_id}/{saved_filename}",
        "status": "queued",
        "upload_timestamp": datetime_to_iso(),
        "duration_sec": 0.0,
        "verified_count": 0,
        "rejected_count": 0
    }
    VIDEO_JOBS_DB[video_id] = job_record

    # Schedule Async Background Task
    background_tasks.add_task(run_video_processing_task, video_id, saved_filepath, screenshots_dir)

    return {
        "message": "Video uploaded successfully and queued for AI threat analysis.",
        "video_id": video_id,
        "job": job_record
    }


@app.get("/video-jobs")
def list_video_jobs():
    """Returns list of all video processing jobs."""
    return list(VIDEO_JOBS_DB.values())


@app.get("/video-jobs/{video_id}")
def get_video_job_detail(video_id: str):
    """Returns job details along with verified threat records."""
    if video_id not in VIDEO_JOBS_DB:
        raise HTTPException(status_code=404, detail="Video job not found.")

    job = VIDEO_JOBS_DB[video_id]
    threats = [t for t in VERIFIED_THREATS_DB.values() if t["video_id"] == video_id]

    return {
        "job": job,
        "verified_threats": threats
    }


@app.patch("/video-threats/{threat_id}")
def update_threat_status(threat_id: str, status_payload: dict):
    """Update threat status ('reviewed', 'false_positive', 'resolved')."""
    if threat_id not in VERIFIED_THREATS_DB:
        raise HTTPException(status_code=404, detail="Threat record not found.")

    new_status = status_payload.get("status")
    if new_status not in ["unreviewed", "reviewed", "false_positive", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status value.")

    VERIFIED_THREATS_DB[threat_id]["status"] = new_status
    return {"message": "Status updated successfully.", "threat": VERIFIED_THREATS_DB[threat_id]}
