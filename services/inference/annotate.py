from __future__ import annotations

import cv2


def draw_annotations(frame, detections, zones):
    annotated = frame.copy()
    for zone in zones:
      polygon = zone["polygon"]
      for index, point in enumerate(polygon):
          next_point = polygon[(index + 1) % len(polygon)]
          cv2.line(annotated, tuple(point), tuple(next_point), (40, 120, 80), 2)
      cv2.putText(
          annotated,
          zone["name"],
          tuple(polygon[0]),
          cv2.FONT_HERSHEY_SIMPLEX,
          0.65,
          (40, 120, 80),
          2,
      )

    for detection in detections:
        x1, y1, x2, y2 = detection["bbox"]
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (30, 130, 210), 3)
        label = f'{detection["track_id"]} {detection["zone"]} {detection["activity"]}'
        cv2.putText(annotated, label, (x1, max(24, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 90, 150), 2)

    return annotated
