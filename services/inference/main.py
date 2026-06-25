from __future__ import annotations

import argparse
import json
import os
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

from analyze import ActivityTracker, assign_zone, comfort_score
from annotate import draw_annotations
from capture import capture_frame_with_source
from falcon_segment import detect_chicks, detector_mode
from stream_client import push_observation


def parse_args():
    parser = argparse.ArgumentParser(
        description="Capture brooder webcam frames, derive local metrics, and push them to a BroodCast server.",
    )
    parser.add_argument("--server", default=os.environ.get("BROODCAST_API_URL", os.environ.get("CHICKCOACH_API_URL", "http://localhost:44100")), help="BroodCast server base URL.")
    parser.add_argument("--token", default=os.environ.get("STREAM_INGEST_TOKEN", "dev-stream-token"), help="Bearer token for ingestion APIs.")
    parser.add_argument("--camera", type=int, default=int(os.environ.get("CAMERA_INDEX", "0")), help="OpenCV camera index.")
    parser.add_argument("--interval", type=float, default=float(os.environ.get("CAPTURE_INTERVAL_SECONDS", "3")), help="Seconds between captures.")
    parser.add_argument("--device-id", default=os.environ.get("BROODCAST_EDGE_DEVICE_ID", platform.node() or "edge_webcam"), help="Stable id for this edge capture device.")
    parser.add_argument("--location-id", default=os.environ.get("BROODCAST_LOCATION_ID", "garage_brooder"), help="Server-side location id.")
    parser.add_argument("--camera-id", default=os.environ.get("BROODCAST_CAMERA_ID", "webcam_1"), help="Server-side camera id.")
    parser.add_argument("--detector", choices=["fake", "falcon", "yolo", "rfdetr"], default=os.environ.get("CHICKCOACH_DETECTOR"), help="Local detector mode.")
    parser.add_argument("--fake-camera", action="store_true", default=os.environ.get("CHICKCOACH_FAKE_CAMERA") == "1", help="Use a generated test frame instead of a webcam.")
    parser.add_argument("--preview", action="store_true", default=os.environ.get("CHICKCOACH_PREVIEW") == "1", help="Show an OpenCV preview window.")
    parser.add_argument("--save-frames", action="store_true", default=os.environ.get("CHICKCOACH_SAVE_FRAMES") == "1", help="Write latest debug frames locally.")
    parser.add_argument("--save-history", action="store_true", default=os.environ.get("CHICKCOACH_SAVE_FRAME_HISTORY") == "1", help="Write timestamped debug frame history.")
    parser.add_argument("--debug-dir", default=os.environ.get("CHICKCOACH_DEBUG_DIR", "debug_frames"), help="Directory for local debug frames.")
    parser.add_argument("--max-frames", type=int, default=int(os.environ.get("CHICKCOACH_MAX_FRAMES", "0")), help="Stop after this many frames; 0 runs forever.")
    return parser.parse_args()


def apply_runtime_env(args):
    os.environ["BROODCAST_API_URL"] = args.server
    os.environ["STREAM_INGEST_TOKEN"] = args.token
    os.environ["CAMERA_INDEX"] = str(args.camera)
    os.environ["CAPTURE_INTERVAL_SECONDS"] = str(args.interval)
    os.environ["BROODCAST_EDGE_DEVICE_ID"] = args.device_id
    os.environ["BROODCAST_LOCATION_ID"] = args.location_id
    os.environ["BROODCAST_CAMERA_ID"] = args.camera_id
    if args.detector:
        os.environ["CHICKCOACH_DETECTOR"] = args.detector
    if args.fake_camera:
        os.environ["CHICKCOACH_FAKE_CAMERA"] = "1"
    if args.preview:
        os.environ["CHICKCOACH_PREVIEW"] = "1"
    if args.save_frames:
        os.environ["CHICKCOACH_SAVE_FRAMES"] = "1"
    if args.save_history:
        os.environ["CHICKCOACH_SAVE_FRAME_HISTORY"] = "1"
    os.environ["CHICKCOACH_DEBUG_DIR"] = args.debug_dir
    os.environ["CHICKCOACH_MAX_FRAMES"] = str(args.max_frames)


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
        "location_id": os.environ.get("BROODCAST_LOCATION_ID", "garage_brooder"),
        "camera_id": os.environ.get("BROODCAST_CAMERA_ID", "webcam_1"),
        "camera_attachment_id": os.environ.get("BROODCAST_EDGE_DEVICE_ID", "edge_webcam"),
        "model_version_id": f"local-{detector_mode()}-{datetime.now(timezone.utc).date().isoformat()}",
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
            "edge_device_id": os.environ.get("BROODCAST_EDGE_DEVICE_ID", "edge_webcam"),
        },
        "detections": detections,
    }


def summarize(detections, score):
    if not detections:
        return "No chicks were detected in the latest frame."
    parts = [f'{d["track_id"]} is in the {d["zone"]} zone and appears {d["activity"]}' for d in detections]
    return f'{len(detections)} chicks detected. {"; ".join(parts)}. Comfort signal is {score}/5.'


def main():
    args = parse_args()
    apply_runtime_env(args)
    zones = load_zones()
    tracker = ActivityTracker()
    camera_index = args.camera
    interval = args.interval
    max_frames = args.max_frames
    save_frames = args.save_frames
    save_frame_history = args.save_history
    save_manifest = os.environ.get("CHICKCOACH_SAVE_MANIFEST", "1") == "1"
    preview = args.preview
    debug_dir = Path(args.debug_dir)
    if save_frames:
        debug_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"BroodCast edge worker pushing camera {camera_index} to {args.server} "
        f"as {args.device_id} every {interval}s",
        flush=True,
    )

    frame_number = 0
    while True:
        frame_number += 1
        frame_id = f"frame_{time.time_ns()}_{frame_number}.jpg"
        frame, frame_source = capture_frame_with_source(camera_index)
        raw_frame_path = None
        annotated_frame_path = None
        if save_frames:
            save_frame(debug_dir / "latest_raw.jpg", frame)
            if save_frame_history:
                raw_frame_path = debug_dir / f"raw_{frame_id}"
                save_frame(raw_frame_path, frame)

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
                annotated_frame_path = debug_dir / f"annotated_{frame_id}"
                save_frame(annotated_frame_path, annotated)
        if preview:
            preview_frame(annotated)

        observation = build_observation(frame_id, detections, movement_score, frame_source)
        if save_frames and save_frame_history and save_manifest:
            append_manifest(debug_dir / "manifest.jsonl", observation, raw_frame_path, annotated_frame_path)
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


def append_manifest(path, observation, raw_frame_path, annotated_frame_path):
    record = {
        **observation,
        "raw_frame_path": str(raw_frame_path) if raw_frame_path else None,
        "annotated_frame_path": str(annotated_frame_path) if annotated_frame_path else None,
    }
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, separators=(",", ":")) + "\n")


def preview_frame(frame):
    import cv2

    cv2.imshow("BroodCast preview", frame)
    cv2.waitKey(1)


if __name__ == "__main__":
    main()
