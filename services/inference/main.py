from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone

from analyze import ActivityTracker, assign_zone, comfort_score
from annotate import draw_annotations
from capture import capture_frame
from falcon_segment import detect_chicks
from stream_client import push_observation


def load_zones():
    with open("zones.json", "r", encoding="utf-8") as handle:
        return json.load(handle)["zones"]


def centroid_for_bbox(bbox):
    x1, y1, x2, y2 = bbox
    return [int((x1 + x2) / 2), int((y1 + y2) / 2)]


def build_observation(frame_id, detections, movement_score):
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

    while True:
        frame_id = f"frame_{int(time.time())}.jpg"
        frame = capture_frame(camera_index)
        raw_detections = detect_chicks(frame)
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
        observation = build_observation(frame_id, detections, movement_score)
        result = push_observation(observation, annotated)
        print(f"pushed {frame_id}: {result}")
        time.sleep(interval)


if __name__ == "__main__":
    main()
