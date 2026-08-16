import os
import json
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

def init_firebase():
    if not firebase_admin._apps:
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
            print(f"[+] Firebase initialized from {SERVICE_ACCOUNT_PATH}")
        elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
            json_dict = json.loads(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
            cred = credentials.Certificate(json_dict)
            firebase_admin.initialize_app(cred)
            print("[+] Firebase initialized from ENV JSON")
        else:
            print("[!] Offline mode: Generating local JSON data for climate risk.")
            return None
    return firestore.client()

# Risk calculation formula:
# Risk = (0.40 * Historical Frequency) + (0.40 * Regional Vulnerability) + (0.20 * Environmental Trend)
def calculate_risk(freq, vuln, trend):
    return round((0.40 * freq) + (0.40 * vuln) + (0.20 * trend), 1)

# Comprehensive dataset for Indian States
INDIA_STATES_DATA = [
    {
        "region_name": "Odisha",
        "region_type": "state",
        "iso_code": "IN-OR",
        "overall_risk_score": 88.5,
        "risk_scores": {
            "cyclone": calculate_risk(95, 90, 85),  # 91.0
            "flood": calculate_risk(90, 85, 80),    # 86.0
            "drought": calculate_risk(60, 55, 65),  # 59.0
            "earthquake": calculate_risk(30, 40, 35) # 35.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Extreme (480km coastline on Bay of Bengal)",
            "seismic_zone": "Zone II to III",
            "monsoon_vulnerability": "High vulnerability to tropical depressions"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 8},
            {"decade": "2000s", "events": 12},
            {"decade": "2010s", "events": 18},
            {"decade": "2020s", "events": 11}
        ],
        "historical_events": [
            {"year": 1999, "type": "Super Cyclone", "severity": "Extreme", "description": "1999 Odisha Super Cyclone (Category 5), 10,000+ casualties"},
            {"year": 2013, "type": "Cyclone Phailin", "severity": "Severe", "description": "Evacuated 1M+ people across coastal districts"},
            {"year": 2019, "type": "Cyclone Fani", "severity": "Extreme", "description": "Extensive structural damage in Puri & Bhubaneswar"},
            {"year": 2021, "type": "Cyclone Yaas", "severity": "High", "description": "Storm surge caused widespread coastal inundation"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Gujarat",
        "region_type": "state",
        "iso_code": "IN-GJ",
        "overall_risk_score": 84.0,
        "risk_scores": {
            "earthquake": calculate_risk(95, 95, 80), # 92.0
            "cyclone": calculate_risk(80, 85, 75),    # 81.0
            "drought": calculate_risk(75, 70, 80),    # 74.0
            "flood": calculate_risk(65, 70, 75)       # 69.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "High (Kutch & Arabian Sea coastline)",
            "seismic_zone": "Zone V (Kutch high-seismic fault)",
            "monsoon_vulnerability": "Moderate to arid variance"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 6},
            {"decade": "2000s", "events": 14},
            {"decade": "2010s", "events": 11},
            {"decade": "2020s", "events": 9}
        ],
        "historical_events": [
            {"year": 2001, "type": "Bhuj Earthquake", "severity": "Catastrophic", "description": "7.7 magnitude earthquake, 20,000+ casualties"},
            {"year": 2021, "type": "Cyclone Tauktae", "severity": "Extreme", "description": "Extremely Severe Cyclonic Storm landfall"},
            {"year": 2023, "type": "Cyclone Biparjoy", "severity": "Severe", "description": "Prolonged landfall near Jakhau Port"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Kerala",
        "region_type": "state",
        "iso_code": "IN-KL",
        "overall_risk_score": 81.2,
        "risk_scores": {
            "flood": calculate_risk(95, 90, 88),      # 91.6
            "landslide": calculate_risk(90, 85, 80),  # 86.0
            "cyclone": calculate_risk(60, 65, 70),    # 64.0
            "drought": calculate_risk(40, 35, 45)     # 39.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "High (Western Ghats slope & Arabian Sea)",
            "seismic_zone": "Zone III",
            "monsoon_vulnerability": "Extreme (South-West Monsoon heavy discharge)"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 5},
            {"decade": "2000s", "events": 7},
            {"decade": "2010s", "events": 16},
            {"decade": "2020s", "events": 10}
        ],
        "historical_events": [
            {"year": 2018, "type": "Great Kerala Deluge", "severity": "Catastrophic", "description": "Worst flooding in a century, 400+ casualties"},
            {"year": 2019, "type": "Monsoon Floods & Landslides", "severity": "Severe", "description": "Widespread landslides in Wayanad & Malappuram"},
            {"year": 2024, "type": "Wayanad Landslides", "severity": "Extreme", "description": "Devastating debris flows in Meppadi region"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Assam",
        "region_type": "state",
        "iso_code": "IN-AS",
        "overall_risk_score": 86.0,
        "risk_scores": {
            "flood": calculate_risk(98, 95, 90),      # 95.2
            "earthquake": calculate_risk(85, 90, 75),  # 85.0
            "cyclone": calculate_risk(40, 45, 50),    # 44.0
            "drought": calculate_risk(30, 35, 40)     # 34.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Inland Brahmaputra river basin",
            "seismic_zone": "Zone V (Eastern Himalayan fault zone)",
            "monsoon_vulnerability": "Extreme (Annual Brahmaputra river overflow)"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 10},
            {"decade": "2000s", "events": 15},
            {"decade": "2010s", "events": 20},
            {"decade": "2020s", "events": 14}
        ],
        "historical_events": [
            {"year": 1950, "type": "Assam-Tibet Earthquake", "severity": "Catastrophic", "description": "8.6 magnitude major Himalayan earthquake"},
            {"year": 2022, "type": "Assam Floods", "severity": "Extreme", "description": "Brahmaputra inundated 32 out of 36 districts"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Uttarakhand",
        "region_type": "state",
        "iso_code": "IN-UT",
        "overall_risk_score": 85.5,
        "risk_scores": {
            "landslide": calculate_risk(95, 95, 90),  # 94.0
            "flood": calculate_risk(90, 85, 85),      # 87.0
            "earthquake": calculate_risk(85, 90, 80), # 85.0
            "cyclone": calculate_risk(10, 10, 15)     # 11.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Central Himalayan mountain ecosystem",
            "seismic_zone": "Zone IV and V",
            "monsoon_vulnerability": "High (Cloudbursts & flash floods)"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 7},
            {"decade": "2000s", "events": 9},
            {"decade": "2010s", "events": 17},
            {"decade": "2020s", "events": 12}
        ],
        "historical_events": [
            {"year": 2013, "type": "Kedarnath Cloudburst & Deluge", "severity": "Catastrophic", "description": "Flash flood & glacial outburst in Mandakini valley"},
            {"year": 2021, "type": "Chamoli Glacial Outburst", "severity": "Severe", "description": "Rock and ice avalanche triggering Rishi Ganga flash flood"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Maharashtra",
        "region_type": "state",
        "iso_code": "IN-MH",
        "overall_risk_score": 76.5,
        "risk_scores": {
            "flood": calculate_risk(80, 85, 80),      # 81.0
            "drought": calculate_risk(85, 80, 85),    # 83.0
            "cyclone": calculate_risk(65, 70, 70),    # 68.0
            "earthquake": calculate_risk(50, 60, 45)  # 53.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Moderate (Konkan Coast & Marathwada arid belt)",
            "seismic_zone": "Zone III and IV (Latur seismic zone)",
            "monsoon_vulnerability": "High urban deluge + rural rain-shadow drought"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 9},
            {"decade": "2000s", "events": 13},
            {"decade": "2010s", "events": 15},
            {"decade": "2020s", "events": 10}
        ],
        "historical_events": [
            {"year": 1993, "type": "Latur Earthquake", "severity": "Extreme", "description": "6.2 magnitude intraplate earthquake, 9,000+ casualties"},
            {"year": 2005, "type": "Mumbai Floods", "severity": "Extreme", "description": "944mm record rainfall in 24 hours"},
            {"year": 2020, "type": "Cyclone Nisarga", "severity": "Severe", "description": "First severe cyclonic storm near Mumbai since 1891"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    }
]

# Sample dataset for Global Countries
GLOBAL_COUNTRIES_DATA = [
    {
        "region_name": "Japan",
        "region_type": "country",
        "iso_code": "JPN",
        "overall_risk_score": 92.0,
        "risk_scores": {
            "earthquake": calculate_risk(98, 95, 90), # 95.2
            "tsunami": calculate_risk(95, 90, 85),    # 91.0
            "cyclone": calculate_risk(85, 80, 80),    # 82.0
            "flood": calculate_risk(70, 65, 70)       # 68.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Pacific Ring of Fire",
            "seismic_zone": "Extreme (Subduction zone faults)",
            "monsoon_vulnerability": "Typhoon corridor"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 14},
            {"decade": "2000s", "events": 18},
            {"decade": "2010s", "events": 25},
            {"decade": "2020s", "events": 16}
        ],
        "historical_events": [
            {"year": 1995, "type": "Kobe Earthquake", "severity": "Catastrophic", "description": "Great Hanshin earthquake (M6.9)"},
            {"year": 2011, "type": "Tohoku Earthquake & Tsunami", "severity": "Catastrophic", "description": "9.0 magnitude quake & 40m tsunami wave"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Philippines",
        "region_type": "country",
        "iso_code": "PHL",
        "overall_risk_score": 89.5,
        "risk_scores": {
            "cyclone": calculate_risk(98, 95, 90),    # 95.2
            "flood": calculate_risk(90, 85, 85),      # 87.0
            "earthquake": calculate_risk(80, 85, 75), # 81.0
            "landslide": calculate_risk(85, 80, 80)   # 82.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Western Pacific Typhoon Belt",
            "seismic_zone": "Pacific Ring of Fire",
            "monsoon_vulnerability": "Extreme tropical storm frequency"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 20},
            {"decade": "2000s", "events": 28},
            {"decade": "2010s", "events": 35},
            {"decade": "2020s", "events": 22}
        ],
        "historical_events": [
            {"year": 2013, "type": "Super Typhoon Haiyan (Yolanda)", "severity": "Catastrophic", "description": "Category 5 typhoon, 6,300+ casualties"},
            {"year": 2021, "type": "Typhoon Rai (Odette)", "severity": "Extreme", "description": "Widespread destruction across Visayas & Mindanao"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    },
    {
        "region_name": "Bangladesh",
        "region_type": "country",
        "iso_code": "BGD",
        "overall_risk_score": 91.5,
        "risk_scores": {
            "flood": calculate_risk(99, 98, 92),      # 97.2
            "cyclone": calculate_risk(92, 90, 88),    # 90.4
            "drought": calculate_risk(50, 45, 55),    # 49.0
            "earthquake": calculate_risk(40, 50, 45)  # 45.0
        },
        "vulnerability_factors": {
            "coastal_exposure": "Bengal Delta low-lying deltaic region",
            "seismic_zone": "Plate boundary proximity",
            "monsoon_vulnerability": "Extreme sea-level rise & tidal inundation"
        },
        "decade_trends": [
            {"decade": "1990s", "events": 16},
            {"decade": "2000s", "events": 22},
            {"decade": "2010s", "events": 29},
            {"decade": "2020s", "events": 18}
        ],
        "historical_events": [
            {"year": 1991, "type": "Bangladesh Cyclone", "severity": "Catastrophic", "description": "Category 5 storm, 138,000+ casualties"},
            {"year": 2007, "type": "Cyclone Sidr", "severity": "Extreme", "description": "Devastated Sundarbans ecosystem and coastal districts"}
        ],
        "last_updated": datetime.utcnow().isoformat()
    }
]

def seed_climate_data():
    db = init_firebase()
    if db is None:
        print("[!] Offline mode: Saving local JSON fallback file to climate_risk_data.json")
        with open("climate_risk_data.json", "w") as f:
            json.dump({
                "india_states": INDIA_STATES_DATA,
                "global_countries": GLOBAL_COUNTRIES_DATA
            }, f, indent=2)
        print("[✓] Local climate_risk_data.json created.")
        return

    # Seed Indian States
    print(f"[+] Seeding {len(INDIA_STATES_DATA)} records into 'region_climate_data_india'...")
    batch_india = db.batch()
    for state in INDIA_STATES_DATA:
        doc_ref = db.collection("region_climate_data_india").document(state["region_name"].lower())
        batch_india.set(doc_ref, state)
    batch_india.commit()

    # Seed Global Countries
    print(f"[+] Seeding {len(GLOBAL_COUNTRIES_DATA)} records into 'region_climate_data_global'...")
    batch_global = db.batch()
    for country in GLOBAL_COUNTRIES_DATA:
        doc_ref = db.collection("region_climate_data_global").document(country["region_name"].lower())
        batch_global.set(doc_ref, country)
    batch_global.commit()

    print("[✓] Climate Risk Intelligence collections seeded successfully!")

if __name__ == "__main__":
    seed_climate_data()
