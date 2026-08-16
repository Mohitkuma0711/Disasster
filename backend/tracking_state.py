import math
from collections import deque


class InactivityTracker:
    """Maintains centroid history per track_id and detects stationary/inactive individuals."""

    def __init__(self, history_length: int = 30, min_frames: int = 10):
        """
        :param history_length: Maximum recent centroid positions to store per track (default 30)
        :param min_frames: Minimum frames required before evaluating inactivity (default 10)
        """
        self.history_length = history_length
        self.min_frames = min_frames
        self.tracks: dict[int, deque[tuple[float, float]]] = {}
        self.last_seen: dict[int, int] = {}
        self.current_frame: int = 0

    def update(self, track_id: int, bbox: list[float]) -> tuple[float, float]:
        """Compute centroid from bbox [x1, y1, x2, y2] and append to track history.

        :param track_id: Object tracking ID
        :param bbox: [x1, y1, x2, y2] bounding box
        :return: Centroid (cx, cy)
        """
        if track_id is None:
            return (0.0, 0.0)

        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        if track_id not in self.tracks:
            self.tracks[track_id] = deque(maxlen=self.history_length)

        self.tracks[track_id].append((cx, cy))
        self.last_seen[track_id] = self.current_frame

        return (cx, cy)

    def step_frame(self):
        """Advance frame counter by 1."""
        self.current_frame += 1

    def is_inactive(self, track_id: int, pixel_threshold: float = 5.0) -> bool:
        """Check if centroid for track_id hasn't moved more than pixel_threshold across stored history.

        :param track_id: Object tracking ID
        :param pixel_threshold: Movement limit in pixels (default 5)
        :return: True if stationary/inactive, False if moving or insufficient history
        """
        if track_id not in self.tracks:
            return False

        history = self.tracks[track_id]
        if len(history) < self.min_frames:
            return False

        first_cx, first_cy = history[0]
        max_dist = 0.0

        for cx, cy in history:
            dist = math.hypot(cx - first_cx, cy - first_cy)
            if dist > max_dist:
                max_dist = dist

        return max_dist <= pixel_threshold

    def get_movement_distance(self, track_id: int) -> float:
        """Return maximum displacement distance across stored history for track_id."""
        if track_id not in self.tracks or len(self.tracks[track_id]) < 2:
            return 0.0

        history = self.tracks[track_id]
        first_cx, first_cy = history[0]
        max_dist = 0.0

        for cx, cy in history:
            dist = math.hypot(cx - first_cx, cy - first_cy)
            if dist > max_dist:
                max_dist = dist

        return max_dist

    def cleanup_stale(self, max_missing_frames: int = 60) -> list[int]:
        """Remove track_ids that have not been updated for max_missing_frames.

        :param max_missing_frames: Threshold number of frames without updates
        :return: List of removed track_ids
        """
        stale_ids = []
        for track_id, last_f in list(self.last_seen.items()):
            if self.current_frame - last_f > max_missing_frames:
                stale_ids.append(track_id)
                del self.tracks[track_id]
                del self.last_seen[track_id]

        return stale_ids


if __name__ == "__main__":
    print("=== Testing InactivityTracker ===")
    tracker = InactivityTracker(history_length=30, min_frames=10)

    # 1. Simulate track_id 1: Stationary person (small jitter < 5px)
    print("\n--- Simulating Track 1: Stationary Person ---")
    stationary_base_bbox = [100.0, 100.0, 150.0, 200.0]  # centroid (125, 150)
    for frame_idx in range(35):
        tracker.step_frame()
        # Add slight jitter <= 1 pixel
        jitter_x = (frame_idx % 3) * 0.5
        jitter_y = (frame_idx % 2) * 0.5
        bbox = [
            stationary_base_bbox[0] + jitter_x,
            stationary_base_bbox[1] + jitter_y,
            stationary_base_bbox[2] + jitter_x,
            stationary_base_bbox[3] + jitter_y,
        ]
        tracker.update(track_id=1, bbox=bbox)

    dist1 = tracker.get_movement_distance(track_id=1)
    inactive1 = tracker.is_inactive(track_id=1, pixel_threshold=5.0)
    print(f"Track 1 - Max displacement: {dist1:.2f}px | Is Inactive (<= 5px): {inactive1}")
    assert inactive1 is True, "Track 1 should be detected as inactive!"

    # 2. Simulate track_id 2: Moving person (moving 2px per frame = 60px displacement)
    print("\n--- Simulating Track 2: Moving Person ---")
    moving_base_bbox = [200.0, 200.0, 250.0, 300.0]
    for frame_idx in range(35):
        tracker.step_frame()
        offset = frame_idx * 2.0  # Moves 2px per frame
        bbox = [
            moving_base_bbox[0] + offset,
            moving_base_bbox[1] + offset,
            moving_base_bbox[2] + offset,
            moving_base_bbox[3] + offset,
        ]
        tracker.update(track_id=2, bbox=bbox)

    dist2 = tracker.get_movement_distance(track_id=2)
    inactive2 = tracker.is_inactive(track_id=2, pixel_threshold=5.0)
    print(f"Track 2 - Max displacement: {dist2:.2f}px | Is Inactive (<= 5px): {inactive2}")
    assert inactive2 is False, "Track 2 should be detected as active/moving!"

    # 3. Test stale track cleanup
    print("\n--- Simulating Stale Track Cleanup ---")
    print(f"Active tracks before cleanup: {list(tracker.tracks.keys())}")
    # Advance 100 frames without updating Track 1
    for _ in range(100):
        tracker.step_frame()
        # Only update Track 2
        tracker.update(track_id=2, bbox=[300, 300, 350, 400])

    removed = tracker.cleanup_stale(max_missing_frames=60)
    print(f"Cleaned up stale track IDs: {removed}")
    print(f"Active tracks after cleanup: {list(tracker.tracks.keys())}")
    assert 1 in removed and 1 not in tracker.tracks, "Track 1 should have been cleaned up!"
    assert 2 in tracker.tracks, "Track 2 should still be active!"

    print("\nAll tests passed successfully!")
