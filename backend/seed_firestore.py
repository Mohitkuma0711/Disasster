import os
import json
import time
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK
# Provide path to your serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT environment variable
SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

def init_firebase():
    if not firebase_admin._apps:
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
            print(f"[+] Firebase Admin initialized using {SERVICE_ACCOUNT_PATH}")
        elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
            json_dict = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
            cred = credentials.Certificate(json_dict)
            firebase_admin.initialize_app(cred)
            print("[+] Firebase Admin initialized using ENV JSON")
        else:
            print("[!] Warning: No serviceAccountKey.json found. Seeding with mock DB writer.")
            return None
    return firestore.client()

# Sample realistic victim records for disaster triage demo
DEMO_VICTIMS = [
    {
        "track_id": 101,
        "lat": 28.6139,
        "lng": 77.2090,
        "confidence": 0.94,
        "is_inactive": True,
        "priority_score": 93.5,
        "status": "unhandled",
        "description": "Trapped under collapsed concrete structure in Sector 4. Stationary for >5 mins.",
        "score_breakdown": {
            "confidence_score": 18.8,
            "inactivity_score": 30.0,
            "cluster_score": 20.0,
            "accessibility_score": 24.7
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 102,
        "lat": 28.6145,
        "lng": 77.2095,
        "confidence": 0.91,
        "is_inactive": True,
        "priority_score": 89.2,
        "status": "unhandled",
        "description": "Cluster victim nearby Sector 4 collapse point. Unresponsive to drone audio.",
        "score_breakdown": {
            "confidence_score": 18.2,
            "inactivity_score": 30.0,
            "cluster_score": 20.0,
            "accessibility_score": 21.0
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 103,
        "lat": 28.6180,
        "lng": 77.2150,
        "confidence": 0.88,
        "is_inactive": True,
        "priority_score": 78.4,
        "status": "unhandled",
        "description": "Isolated individual detected on rooftop surrounded by floodwaters.",
        "score_breakdown": {
            "confidence_score": 17.6,
            "inactivity_score": 30.0,
            "cluster_score": 12.5,
            "accessibility_score": 18.3
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 104,
        "lat": 28.6110,
        "lng": 77.2020,
        "confidence": 0.76,
        "is_inactive": False,
        "priority_score": 54.2,
        "status": "unhandled",
        "description": "Mobile individual walking along perimeter road, signaling for aid.",
        "score_breakdown": {
            "confidence_score": 15.2,
            "inactivity_score": 0.0,
            "cluster_score": 15.0,
            "accessibility_score": 24.0
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 105,
        "lat": 28.6250,
        "lng": 77.2210,
        "confidence": 0.85,
        "is_inactive": True,
        "priority_score": 71.0,
        "status": "unhandled",
        "description": "Stationary target near hazardous electrical grid failure area.",
        "score_breakdown": {
            "confidence_score": 17.0,
            "inactivity_score": 30.0,
            "cluster_score": 10.0,
            "accessibility_score": 14.0
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 106,
        "lat": 28.6080,
        "lng": 77.1980,
        "confidence": 0.68,
        "is_inactive": False,
        "priority_score": 38.5,
        "status": "unhandled",
        "description": "Moving individual in open field section.",
        "score_breakdown": {
            "confidence_score": 13.6,
            "inactivity_score": 0.0,
            "cluster_score": 10.0,
            "accessibility_score": 14.9
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 107,
        "lat": 28.6050,
        "lng": 77.1950,
        "confidence": 0.95,
        "is_inactive": True,
        "priority_score": 91.0,
        "status": "rescued",
        "description": "Evacuated by National Disaster Response Force (NDRF) Team Alpha.",
        "score_breakdown": {
            "confidence_score": 19.0,
            "inactivity_score": 30.0,
            "cluster_score": 22.0,
            "accessibility_score": 20.0
        },
        "updatedAt": datetime.utcnow().isoformat()
    },
    {
        "track_id": 108,
        "lat": 28.6020,
        "lng": 77.1910,
        "confidence": 0.92,
        "is_inactive": True,
        "priority_score": 86.5,
        "status": "rescued",
        "description": "Extricated from debris by local rescue unit.",
        "score_breakdown": {
            "confidence_score": 18.4,
            "inactivity_score": 30.0,
            "cluster_score": 18.1,
            "accessibility_score": 20.0
        },
        "updatedAt": datetime.utcnow().isoformat()
    }
]

def seed_database():
    db = init_firebase()
    if db is None:
        print("[!] Local demo mode: Printing dummy records without Firestore write.")
        for v in DEMO_VICTIMS:
            print(f"  - Track #{v['track_id']} | Priority: {v['priority_score']} | Status: {v['status']}")
        return

    print(f"[+] Seeding {len(DEMO_VICTIMS)} victim records to Firestore 'victims' collection...")
    batch = db.batch()
    
    for victim in DEMO_VICTIMS:
        doc_id = f"VICTIM-{victim['track_id']}"
        doc_ref = db.collection("victims").document(doc_id)
        batch.set(doc_ref, victim)

    batch.commit()
    print("[✓] Successfully seeded Firestore database for SIH Demo Day!")

if __name__ == "__main__":
    seed_database()
