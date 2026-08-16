import math
from typing import Callable, Optional, Union
import numpy as np
from sklearn.cluster import DBSCAN


def compute_cluster_info(
    all_detections: list[dict],
    eps: float = 50.0,
    min_samples: int = 2
) -> list[tuple[int, int]]:
    """Run DBSCAN on detection coordinates and return (cluster_id, cluster_size) for each detection.

    :param all_detections: List of detection dicts containing 'coordinates' (x, y) or (lat, lng)
    :param eps: DBSCAN maximum distance between two samples for one to be considered in the neighborhood of the other
    :param min_samples: DBSCAN minimum samples in a neighborhood for a point to be considered a core point
    :return: List of tuples (cluster_id, cluster_size) corresponding to each detection in all_detections
    """
    n_detections = len(all_detections)
    if n_detections == 0:
        return []

    # Extract coordinates
    coords = []
    for d in all_detections:
        coord = d.get("coordinates") or d.get("coords")
        if coord is None and "box" in d:
            # Fallback to centroid of box [x1, y1, x2, y2]
            box = d["box"]
            coord = ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)
        coords.append(coord if coord is not None else (0.0, 0.0))

    coords_arr = np.array(coords, dtype=np.float64)

    if n_detections < 2:
        return [(-1, 1)] * n_detections

    # Fit DBSCAN
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(coords_arr)
    labels = db.labels_

    # Count cluster sizes (excluding noise label -1)
    cluster_counts = {}
    for label in labels:
        if label != -1:
            cluster_counts[label] = cluster_counts.get(label, 0) + 1

    # Map each detection to (cluster_id, size)
    results = []
    for label in labels:
        if label == -1:
            results.append((-1, 1))
        else:
            results.append((int(label), cluster_counts[label]))

    return results


def compute_priority_score(
    detection: dict,
    all_detections: list[dict],
    eps: float = 50.0,
    min_samples: int = 2,
    danger_zone_map: Optional[Union[Callable, dict]] = None,
) -> tuple[float, dict]:
    """Compute overall victim priority score (0-100) and explainable component breakdown.

    Weights:
      1. Confidence Score (20%): confidence * 100 * 0.20
      2. Inactivity Score (30%): 100 * 0.30 if is_inactive else 0
      3. Cluster Score (25%): Larger DBSCAN cluster size -> higher score * 0.25
      4. Accessibility Score (25%): Proximity to hazard / danger zone * 0.25

    :param detection: Target detection dict (must include confidence, is_inactive, coordinates or box)
    :param all_detections: List of all current detections for clustering context
    :param eps: DBSCAN distance threshold
    :param min_samples: DBSCAN minimum samples threshold
    :param danger_zone_map: Callable distance_fn(coord) -> float (0.0=highest danger, 100.0=safest)
                            or dict with {'hazard_center': (x,y), 'max_radius': r}
    :return: Tuple of (total_score, breakdown_dict)
    """
    # 1. Confidence Component (Max 20 points)
    conf = float(detection.get("confidence", 0.0))
    conf = max(0.0, min(1.0, conf))
    raw_conf_score = conf * 100.0
    conf_score = raw_conf_score * 0.20

    # 2. Inactivity Component (Max 30 points)
    is_inactive = bool(detection.get("is_inactive", False))
    raw_inactivity_score = 100.0 if is_inactive else 0.0
    inactivity_score = raw_inactivity_score * 0.30

    # 3. Cluster Component (Max 25 points)
    cluster_info = compute_cluster_info(all_detections, eps=eps, min_samples=min_samples)
    
    # Find matching index of detection in all_detections
    det_coord = detection.get("coordinates") or detection.get("coords")
    if det_coord is None and "box" in detection:
        box = detection["box"]
        det_coord = ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)

    target_cluster_id = -1
    target_cluster_size = 1

    # Find detection in all_detections list
    for idx, d in enumerate(all_detections):
        if d.get("track_id") == detection.get("track_id") and d.get("track_id") is not None:
            target_cluster_id, target_cluster_size = cluster_info[idx]
            break
    else:
        # Fallback if not matched by track_id: match by coordinates
        for idx, d in enumerate(all_detections):
            c = d.get("coordinates") or d.get("coords")
            if c is None and "box" in d:
                box = d["box"]
                c = ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)
            if c == det_coord:
                target_cluster_id, target_cluster_size = cluster_info[idx]
                break

    max_possible_cluster = len(all_detections)
    if max_possible_cluster > 1:
        # Score scales linearly with cluster size up to max cluster
        raw_cluster_score = min(100.0, (target_cluster_size / max_possible_cluster) * 100.0)
    else:
        raw_cluster_score = 20.0

    cluster_score = raw_cluster_score * 0.25

    # 4. Accessibility / Danger Component (Max 25 points)
    raw_access_score = 50.0  # default neutral score

    if callable(danger_zone_map):
        try:
            # Distance / danger evaluation from custom function
            # Output expected: 0-100 danger rating (100 = highest danger / highest priority)
            raw_access_score = float(danger_zone_map(det_coord))
            raw_access_score = max(0.0, min(100.0, raw_access_score))
        except Exception:
            raw_access_score = 50.0
    elif isinstance(danger_zone_map, dict):
        center = danger_zone_map.get("hazard_center", (0.0, 0.0))
        max_radius = danger_zone_map.get("max_radius", 500.0)
        if det_coord:
            dist = math.hypot(det_coord[0] - center[0], det_coord[1] - center[1])
            # Closer to hazard center -> higher danger score (100 inside center, 0 at max_radius)
            raw_access_score = max(0.0, min(100.0, (1.0 - dist / max_radius) * 100.0))

    accessibility_score = raw_access_score * 0.25

    # Total Score Calculation (0-100 scale)
    total_score = conf_score + inactivity_score + cluster_score + accessibility_score
    total_score = max(0.0, min(100.0, total_score))

    breakdown = {
        "confidence_score": round(conf_score, 2),
        "inactivity_score": round(inactivity_score, 2),
        "cluster_score": round(cluster_score, 2),
        "accessibility_score": round(accessibility_score, 2),
        "raw_components": {
            "confidence": round(raw_conf_score, 2),
            "inactivity": round(raw_inactivity_score, 2),
            "cluster_size": target_cluster_size,
            "cluster_id": target_cluster_id,
            "accessibility": round(raw_access_score, 2),
        },
        "total_score": round(total_score, 2),
    }

    return round(total_score, 2), breakdown


if __name__ == "__main__":
    print("=== Testing Priority Scoring Module ===")

    # Define a hazard zone center at (100, 100) with max radius 400
    hazard_map = {"hazard_center": (100.0, 100.0), "max_radius": 400.0}

    # Create 6 dummy detections with varying attributes and spatial coordinates:
    # - Group A (clustered around 100,100): Detections 1, 2, 3
    # - Group B (isolated): Detections 4, 5, 6
    dummy_detections = [
        {
            "track_id": 1,
            "confidence": 0.95,
            "is_inactive": True,  # Clustered + Inactive + High Conf + Near Hazard -> Should score HIGHEST
            "coordinates": (105.0, 110.0),
        },
        {
            "track_id": 2,
            "confidence": 0.88,
            "is_inactive": True,  # Clustered + Inactive
            "coordinates": (110.0, 100.0),
        },
        {
            "track_id": 3,
            "confidence": 0.75,
            "is_inactive": False,  # Clustered + Active (Moving)
            "coordinates": (115.0, 105.0),
        },
        {
            "track_id": 4,
            "confidence": 0.90,
            "is_inactive": True,  # Isolated + Inactive
            "coordinates": (500.0, 500.0),
        },
        {
            "track_id": 5,
            "confidence": 0.60,
            "is_inactive": False,  # Isolated + Active
            "coordinates": (800.0, 800.0),
        },
        {
            "track_id": 6,
            "confidence": 0.35,
            "is_inactive": False,  # Low conf + Isolated + Active -> Should score LOWEST
            "coordinates": (1200.0, 1200.0),
        },
    ]

    print(f"\nEvaluating priority scores for {len(dummy_detections)} dummy detections...\n")
    print(f"{'ID':<4} | {'Conf':<6} | {'Inactive':<8} | {'Coords':<14} | {'Score':<6} | Component Breakdown (Conf / Inact / Clust / Access)")
    print("-" * 95)

    scored_results = []
    for det in dummy_detections:
        score, breakdown = compute_priority_score(
            det, dummy_detections, eps=50.0, min_samples=2, danger_zone_map=hazard_map
        )
        scored_results.append((det["track_id"], score, breakdown))

        b = breakdown
        coords_str = f"({det['coordinates'][0]:.0f},{det['coordinates'][1]:.0f})"
        components_str = f"{b['confidence_score']:5.2f} / {b['inactivity_score']:5.2f} / {b['cluster_score']:5.2f} / {b['accessibility_score']:5.2f}"
        print(f"{det['track_id']:<4} | {det['confidence']:<6.2f} | {str(det['is_inactive']):<8} | {coords_str:<14} | {score:<6.2f} | {components_str}")

    print("\nScore Rankings (High to Low Priority):")
    scored_results.sort(key=lambda x: x[1], reverse=True)
    for rank, (tid, score, bd) in enumerate(scored_results, start=1):
        print(f"  Rank #{rank}: Track ID {tid} -> Total Priority Score: {score}/100")
