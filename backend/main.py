import os
import uuid
import json
import shutil
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from video_processor import VideoThreatProcessor, datetime_to_iso

# Initialize FastAPI application
app = FastAPI(title="Disaster Victim Detection & Video Threat Intelligence API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory and mount static server for video screenshots
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# In-memory storage for jobs & threats (backed up by Firestore when client connected)
VIDEO_JOBS_DB = {}
VERIFIED_THREATS_DB = {}
REJECTED_CANDIDATES_DB = {}

# Initialize Processor Instance
processor = VideoThreatProcessor(model_name="yolov8n.pt", sample_fps=2.0)


# ─── 1. Health Endpoint ───────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Disaster Victim Detection API"}


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
        result = processor.process_video_file(
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
