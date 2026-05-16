from __future__ import annotations

import time
import os

import cv2
import numpy as np


def capture_frame(camera_index):
    if os.environ.get("CHICKCOACH_FAKE_CAMERA") == "1":
        return fallback_frame()

    camera = cv2.VideoCapture(camera_index)
    ok, frame = camera.read()
    camera.release()
    if ok and frame is not None:
        return frame
    return fallback_frame()


def fallback_frame():
    frame = np.full((640, 900, 3), (226, 215, 190), dtype=np.uint8)
    cv2.rectangle(frame, (180, 120), (430, 360), (90, 130, 240), 2)
    cv2.putText(frame, "heater", (190, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (90, 60, 30), 2)
    cv2.rectangle(frame, (430, 120), (760, 480), (80, 160, 70), 2)
    cv2.putText(frame, "turf", (445, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (40, 90, 40), 2)
    shift = int(time.time() * 20) % 180
    cv2.circle(frame, (250 + shift, 250), 32, (245, 245, 235), -1)
    cv2.circle(frame, (610 - shift // 2, 360), 30, (245, 245, 235), -1)
    cv2.putText(frame, "fallback webcam frame", (24, 610), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (60, 55, 45), 2)
    return frame
