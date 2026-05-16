from __future__ import annotations


def detect_chicks(frame):
    height, width = frame.shape[:2]
    return [
        {
            "track_id": "chick_1",
            "bbox": [int(width * 0.24), int(height * 0.34), int(width * 0.33), int(height * 0.48)],
            "confidence": 0.72,
        },
        {
            "track_id": "chick_2",
            "bbox": [int(width * 0.64), int(height * 0.52), int(width * 0.73), int(height * 0.65)],
            "confidence": 0.68,
        },
    ]
