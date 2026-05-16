from __future__ import annotations

import os

import cv2


def hex_to_bgr(value, fallback):
    if not isinstance(value, str) or not value.startswith("#") or len(value) != 7:
        return fallback
    try:
        red = int(value[1:3], 16)
        green = int(value[3:5], 16)
        blue = int(value[5:7], 16)
        return (blue, green, red)
    except ValueError:
        return fallback


def draw_annotations(frame, detections, zones):
    annotated = frame.copy()
    if os.getenv("CHICKCOACH_DRAW_ZONES") == "1":
        zone_layer = annotated.copy()
        for zone in zones:
            polygon = zone["polygon"]
            color = hex_to_bgr(zone.get("color"), (40, 120, 80))
            points = [tuple(point) for point in polygon]
            for index, point in enumerate(points):
                next_point = points[(index + 1) % len(points)]
                cv2.line(zone_layer, point, next_point, color, 1)
            label_at = points[0]
            cv2.putText(
                zone_layer,
                zone["name"],
                (label_at[0] + 4, label_at[1] + 16),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
            )
        annotated = cv2.addWeighted(zone_layer, 0.35, annotated, 0.65, 0)

    for detection in detections:
        x1, y1, x2, y2 = detection["bbox"]
        color = (30, 130, 210)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = detection.get("track_id", detection.get("class_name", "chick"))
        cv2.putText(annotated, label, (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

    return annotated
