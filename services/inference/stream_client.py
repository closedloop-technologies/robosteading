from __future__ import annotations

import base64
import os

import cv2
import requests


def encode_jpeg_base64(frame):
    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise RuntimeError("Failed to encode frame")
    return base64.b64encode(buffer).decode("ascii")


def push_observation(observation, annotated_frame):
    api_url = os.environ.get("CHICKCOACH_API_URL", "http://localhost:44100").rstrip("/")
    token = os.environ.get("STREAM_INGEST_TOKEN", "dev-stream-token")
    payload = {
        **observation,
        "annotated_frame_base64": encode_jpeg_base64(annotated_frame),
    }
    response = requests.post(
        f"{api_url}/api/ingest/observation",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def push_audio_spectrum(bins, *, sample_rate, channels=1, levels=None, timestamp=None):
    api_url = os.environ.get("CHICKCOACH_API_URL", "http://localhost:44100").rstrip("/")
    token = os.environ.get("STREAM_INGEST_TOKEN", "dev-stream-token")
    payload = {
        "timestamp": timestamp,
        "sample_rate": sample_rate,
        "channels": channels,
        "bins": bins,
        "levels": levels,
    }
    response = requests.post(
        f"{api_url}/api/audio/spectrum",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=3,
    )
    response.raise_for_status()
    return response.json()
