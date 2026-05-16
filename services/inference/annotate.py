from __future__ import annotations

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
    for zone in zones:
        polygon = zone["polygon"]
        color = hex_to_bgr(zone.get("color"), (40, 120, 80))
        thickness = 3 if zone.get("kind") == "object" else 2
        for index, point in enumerate(polygon):
            next_point = polygon[(index + 1) % len(polygon)]
            cv2.line(annotated, tuple(point), tuple(next_point), color, thickness)
        cv2.putText(
            annotated,
            zone["name"],
            tuple(polygon[0]),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            color,
            2,
        )

    for detection in detections:
        x1, y1, x2, y2 = detection["bbox"]
        color = (30, 130, 210)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
        label = f'{detection.get("class_name", "chick")} {detection["track_id"]} {detection["zone"]} {detection["activity"]}'
        cv2.putText(annotated, label, (x1, max(24, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 90, 150), 2)

    return annotated
