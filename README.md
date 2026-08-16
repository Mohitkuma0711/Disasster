# Disaster Victim Detection & Climate Intelligence System

An end-to-end AI/ML command & triage platform designed for disaster response operations, search-and-rescue mission dispatch, and 3D climate vulnerability modeling. Built for Smart India Hackathon (SIH) Demo Day.

---

## 🌟 Key Modules & Features

### 1. Real-Time Tactical Victim Map & Priority Queue (`/`)
- **YOLOv8 + ByteTrack Object Tracking**: Live person detection (Class 0) with persistent tracking IDs across video frames.
- **Inactivity & Posture Detection**: Centroid tracking (`InactivityTracker`) detects stationary / trapped / unconscious victims over consecutive frames.
- **Explainable Priority Scoring Engine**: Transparent 0–100 priority score calculation based on:
  $$\text{Priority Score} = 0.20(\text{Confidence}) + 0.30(\text{Inactivity}) + 0.25(\text{DBSCAN Cluster Density}) + 0.25(\text{Hazard Proximity})$$
- **Interactive Tactical Map (`react-leaflet`)**: Color-coded pulsing markers for high-priority targets (Red $>70$, Orange $40-70$, Yellow $<40$).
- **Dispatch Priority Queue**: Sortable incident table with live status updates and one-click **"Mark Rescued"** action synced with Firestore.
- **Field Report Form**: Ground incident report submission with GPS auto-location detection.

### 2. Automated Two-Stage Video Threat Analysis (`/video-analysis`)
- **Stage 1 (Candidate Detection)**: OpenCV frame sampling + YOLOv8 + ByteTrack + heuristic classifiers for:
  - *Trapped under structural debris*
  - *Submerging in floodwaters*
  - *Immobile / unconscious posture*
- **Stage 2 (Gemini 2.0 Flash Vision Verification)**: Sends peak-confidence candidate frames to Google Gemini 2.0 Flash API (`google-generativeai`) to confirm/reject candidates and generate 1-sentence explainable reasoning.
- **Interactive Case Review Gallery**: Video player with clickable timecode markers, verified threat screenshots, AI explanation snippets, and review actions (`Mark Reviewed` / `False Positive`).

### 3. 3D Climate Risk & Disaster Vulnerability Intelligence (`/climate-risk`)
- **3D Interactive Globe (`react-globe.gl` + Three.js)**: Rotatable, zoomable global risk view styled in dark tactical theme.
- **Dual GeoJSON Layer Toggle**: Switch seamlessly between **India (States)** and **Global (Countries)** boundary polygons.
- **Risk Forecast Spider/Radar Chart**: Recharts radar visualization displaying risk components per hazard (flood, earthquake, cyclone, drought, landslide):
  $$\text{Risk Score} = 0.40(\text{Historical Freq}) + 0.40(\text{Vulnerability}) + 0.20(\text{Environmental Trend})$$
- **Historical Disaster Timeline**: Chronological archive of past catastrophe events (e.g. 1999 Odisha Super Cyclone, 2001 Bhuj Earthquake, 2018 Kerala Deluge, 2024 Wayanad Landslides).

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Leaflet (`react-leaflet`), `react-globe.gl`, Three.js, Recharts, Lucide Icons
- **Backend**: Python FastAPI, Uvicorn, OpenCV, Ultralytics YOLOv8, ByteTrack, Scikit-Learn (DBSCAN), Google Generative AI SDK (`google-generativeai`)
- **Database & Cloud**: Firebase (Firestore Real-Time Database, Firebase Storage)
- **UI Theme**: Dark "Evidence-Board / Case-File" Tactical Aesthetic with Google Typewriter Typography (`Special Elite` + `Courier Prime`).

---

## 📁 Repository Structure

```
disaster-victim-detection/
├── backend/
│   ├── detection.py            # YOLOv8n + ByteTrack PersonDetector class
│   ├── tracking_state.py       # InactivityTracker centroid movement & stale track cleanup
│   ├── scoring.py              # Priority scoring engine (DBSCAN + Hazard Proximity)
│   ├── video_processor.py      # Two-stage video analysis (Stage 1 candidate + Stage 2 Gemini 2.0 Flash)
│   ├── main.py                 # FastAPI application, CORS, static routes, async background tasks
│   ├── seed_firestore.py       # Firestore seeding script for victim records
│   ├── seed_climate_risk.py    # Firestore seeding script for climate risk collections
│   ├── .env.example            # Environment variables template
│   └── requirements.txt        # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MapView.jsx              # Leaflet tactical map with pulsing priority markers
│   │   │   ├── PriorityQueue.jsx        # Sortable dispatch queue table with Mark Rescued
│   │   │   ├── ReportForm.jsx           # Ground field report submission with GPS
│   │   │   ├── AnalyticsCharts.jsx      # Recharts triage spectrum & status charts
│   │   │   ├── ClimateRiskModule.jsx    # 3D Globe with GeoJSON, Radar chart, & history
│   │   │   └── VideoThreatAnalysis.jsx # Two-stage video upload, scrubber, & AI verification
│   │   ├── firebase.js                  # Firebase client configuration
│   │   ├── App.jsx                      # Main dashboard navigation & layout
│   │   ├── index.css                    # Tailwind CSS & custom evidence-board textures
│   │   └── main.jsx
│   ├── index.html                       # Google Fonts & Leaflet CSS
│   ├── vite.config.js                   # Vite configuration with React & Tailwind plugins
│   └── package.json
│
├── .gitignore                           # Git ignore rules for Python & Node
└── README.md
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 2. Environment Setup (`backend/.env`)
Create a `.env` file in the `backend/` directory:

```env
# Google Gemini API Key for Stage 2 Vision Verification (Get free key from Google AI Studio)
GEMINI_API_KEY=AIzaSy_your_gemini_api_key_here

# Firebase Service Account Path (Optional)
FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json
```

### 3. Backend Setup
```bash
cd backend

# Create & activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI dev server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
*Backend API runs at `http://127.0.0.1:8000` (Health check: `http://127.0.0.1:8000/health`).*

### 4. Frontend Setup
```bash
cd frontend

# Install npm packages
npm install

# Start Vite dev server
npm run dev
```
*Frontend web application runs at `http://localhost:5173`.*

---

## 🧪 Verification & Testing Commands

### Standalone Component Tests
```bash
cd backend
source venv/bin/activate

# Test PersonDetector (YOLOv8 + ByteTrack)
python detection.py

# Test InactivityTracker centroid displacement
python tracking_state.py

# Test Priority Scoring Engine (DBSCAN + Hazard Proximity)
python scoring.py

# Seed Demo Datasets
python seed_firestore.py
python seed_climate_risk.py
```

---

## 📜 License & Acknowledgments

Developed for Smart India Hackathon (SIH). Powered by Ultralytics YOLOv8, ByteTrack, Scikit-Learn, Google Gemini 2.0 Flash, Leaflet, and Three-Globe.
