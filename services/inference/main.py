from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from analyze import ActivityTracker, assign_zone, comfort_score
from annotate import draw_annotations
from capture import capture_frame_with_source
from falcon_segment import detect_chicks, detector_mode
from stream_client import push_observation


def load_zones():
    with open("zones.json", "r", encoding="utf-8") as handle:
        return json.load(handle)["zones"]


def centroid_for_bbox(bbox):
    x1, y1, x2, y2 = bbox
    return [int((x1 + x2) / 2), int((y1 + y2) / 2)]


def build_observation(frame_id, detections, movement_score, frame_source):
    chick_count = len(detections)
    heater_count = sum(1 for detection in detections if detection["zone"] == "heater")
    food_count = sum(1 for detection in detections if detection["zone"] == "food_water")
    heater_pct = heater_count / chick_count if chick_count else 0
    food_pct = food_count / chick_count if chick_count else 0
    score = comfort_score(detections, heater_pct, movement_score)
    summary = summarize(detections, score)
    alerts = []
    if chick_count == 0:
        alerts.append("no chicks detected")
    if heater_pct > 0.8:
        alerts.append("most chicks near heater")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "frame_id": frame_id,
        "comfort_score": score,
        "summary": summary,
        "alerts": alerts,
        "stats": {
            "chick_count": chick_count,
            "heater_zone_pct_10m": heater_pct,
            "food_water_zone_pct_10m": food_pct,
            "movement_score": movement_score,
            "frame_source": frame_source,
            "detector_mode": detector_mode(),
        },
        "detections": detections,
    }


def summarize(detections, score):
    if not detections:
        return "No chicks were detected in the latest frame."
    parts = [f'{d["track_id"]} is in the {d["zone"]} zone and appears {d["activity"]}' for d in detections]
    return f'{len(detections)} chicks detected. {"; ".join(parts)}. Comfort signal is {score}/5.'


def main():
    zones = load_zones()
    tracker = ActivityTracker()
    camera_index = int(os.environ.get("CAMERA_INDEX", "0"))
    interval = float(os.environ.get("CAPTURE_INTERVAL_SECONDS", "3"))
    max_frames = int(os.environ.get("CHICKCOACH_MAX_FRAMES", "0"))
    save_frames = os.environ.get("CHICKCOACH_SAVE_FRAMES") == "1"
    save_frame_history = os.environ.get("CHICKCOACH_SAVE_FRAME_HISTORY") == "1"
    preview = os.environ.get("CHICKCOACH_PREVIEW") == "1"
    debug_dir = Path(os.environ.get("CHICKCOACH_DEBUG_DIR", "debug_frames"))
    if save_frames:
        debug_dir.mkdir(parents=True, exist_ok=True)

    frame_number = 0
    while True:
        frame_number += 1
        frame_id = f"frame_{time.time_ns()}_{frame_number}.jpg"
        frame, frame_source = capture_frame_with_source(camera_index)
        if save_frames:
            save_frame(debug_dir / "latest_raw.jpg", frame)
            if save_frame_history:
                save_frame(debug_dir / f"raw_{frame_id}", frame)

        try:
            raw_detections = detect_chicks(frame)
        except Exception as error:
            print(f"detector failed for {frame_id}, continuing with no detections: {error}", flush=True)
            raw_detections = []

        detections = []

        for raw in raw_detections:
            centroid = centroid_for_bbox(raw["bbox"])
            activity, _delta = tracker.label(raw["track_id"], centroid)
            detections.append({
                **raw,
                "centroid": centroid,
                "zone": assign_zone(centroid, zones),
                "activity": activity,
            })

        movement_score = tracker.movement_score()
        annotated = draw_annotations(frame, detections, zones)
        if save_frames:
            save_frame(debug_dir / "latest_annotated.jpg", annotated)
            if save_frame_history:
                save_frame(debug_dir / f"annotated_{frame_id}", annotated)
        if preview:
            preview_frame(annotated)

        observation = build_observation(frame_id, detections, movement_score, frame_source)
        try:
            result = push_observation(observation, annotated)
            print(f"pushed {frame_id}: {result}", flush=True)
        except Exception as error:
            print(f"push failed for {frame_id}, will retry on next frame: {error}", flush=True)

        if max_frames and frame_number >= max_frames:
            break
        time.sleep(interval)


def save_frame(path, frame):
    import cv2

    ok = cv2.imwrite(str(path), frame)
    if not ok:
        raise RuntimeError(f"Failed to write debug frame: {path}")


def preview_frame(frame):
    import cv2

    cv2.imshow("ChickCoach preview", frame)
    cv2.waitKey(1)


if __name__ == "__main__":
    main()
