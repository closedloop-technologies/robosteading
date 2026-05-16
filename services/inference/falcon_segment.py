from __future__ import annotations

import json
import os
import sys
from functools import lru_cache

import cv2
import numpy as np

DEFAULT_PROMPTS = ["baby chick", "white chick", "baby chicken", "small white bird"]
YOLO_BIRD_CLASS_ID = 14

_last_detector_mode = "fake"


def detect_chicks(frame):
    global _last_detector_mode

    manual = manual_detections()
    if manual is not None:
        _last_detector_mode = "manual"
        return manual

    detector = os.environ.get("CHICKCOACH_DETECTOR", "fake").lower()
    if detector == "falcon":
        try:
            detections = falcon_detections(frame)
            _last_detector_mode = "falcon"
            return detections
        except Exception as error:
            _last_detector_mode = "falcon_failed_fake"
            print(f"Falcon detector failed: {error}", file=sys.stderr, flush=True)
            if os.environ.get("CHICKCOACH_FALLBACK_DETECTOR", "fake").lower() == "none":
                raise
            return fake_detections(frame)

    if detector == "yolo":
        try:
            detections = yolo_detections(frame)
            _last_detector_mode = "yolo"
            return detections
        except Exception as error:
            _last_detector_mode = "yolo_failed_fake"
            print(f"YOLO detector failed: {error}", file=sys.stderr, flush=True)
            if os.environ.get("CHICKCOACH_FALLBACK_DETECTOR", "fake").lower() == "none":
                raise
            return fake_detections(frame)

    _last_detector_mode = "fake"
    return fake_detections(frame)


def detector_mode():
    return _last_detector_mode


def fake_detections(frame):
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


def yolo_detections(frame):
    model = load_yolo_model()
    confidence_threshold = float(os.environ.get("YOLO_CONFIDENCE", "0.15"))
    image_size = int(os.environ.get("YOLO_IMAGE_SIZE", "640"))
    class_ids = yolo_class_ids()
    results = model.predict(frame, imgsz=image_size, conf=confidence_threshold, verbose=False)
    detections = []

    if not results:
        return detections

    boxes = getattr(results[0], "boxes", None)
    if boxes is None:
        return detections

    for index, box in enumerate(boxes, start=1):
        class_id = int(box.cls[0].item()) if box.cls is not None else -1
        if class_ids and class_id not in class_ids:
            continue
        x1, y1, x2, y2 = [int(value) for value in box.xyxy[0].tolist()]
        detections.append({
            "track_id": f"chick_{len(detections) + 1}",
            "bbox": [x1, y1, x2, y2],
            "confidence": float(box.conf[0].item()) if box.conf is not None else 0.5,
        })
        if len(detections) >= int(os.environ.get("YOLO_MAX_DETECTIONS", "8")):
            break

    return detections


def yolo_class_ids():
    value = os.environ.get("YOLO_CLASS_IDS")
    if value is None:
        return {YOLO_BIRD_CLASS_ID}
    if value.strip().lower() in {"", "all", "*"}:
        return set()
    return {int(part.strip()) for part in value.split(",") if part.strip()}


@lru_cache(maxsize=1)
def load_yolo_model():
    from ultralytics import YOLO

    return YOLO(os.environ.get("YOLO_MODEL", "yolov8n.pt"))


def manual_detections():
    value = os.environ.get("CHICKCOACH_DETECTIONS_JSON")
    if not value:
        return None

    detections = json.loads(value)
    if not isinstance(detections, list):
        raise ValueError("CHICKCOACH_DETECTIONS_JSON must be a JSON array")

    normalized = []
    for index, detection in enumerate(detections, start=1):
        bbox = detection.get("bbox") if isinstance(detection, dict) else None
        if not isinstance(bbox, list) or len(bbox) != 4:
            raise ValueError("Each manual detection must include a bbox array of four numbers")
        normalized.append({
            "track_id": str(detection.get("track_id") or f"chick_{index}"),
            "bbox": [int(value) for value in bbox],
            "confidence": float(detection.get("confidence", 0.5)),
        })
    return normalized


def falcon_detections(frame):
    model = load_falcon_model()
    image = frame_to_pil(frame)
    width, height = image.size

    for prompt in detection_prompts():
        results = model.generate(
            image,
            prompt,
            task=os.environ.get("FALCON_TASK", "detection"),
            max_new_tokens=int(os.environ.get("FALCON_MAX_NEW_TOKENS", "512")),
            min_dimension=int(os.environ.get("FALCON_MIN_DIMENSION", "256")),
            max_dimension=int(os.environ.get("FALCON_MAX_DIMENSION", "768")),
            compile=os.environ.get("FALCON_COMPILE", "1") != "0",
        )
        detections = normalize_falcon_results(results[0] if results else [], width, height)
        if detections:
            return detections

    return []


@lru_cache(maxsize=1)
def load_falcon_model():
    import torch
    from transformers import AutoModelForCausalLM

    model_id = os.environ.get("FALCON_MODEL", "tiiuae/Falcon-Perception-300M")
    device_map = os.environ.get("FALCON_DEVICE_MAP") or ("cuda" if torch.cuda.is_available() else "cpu")
    dtype = falcon_dtype(torch, os.environ.get("FALCON_DTYPE", "auto"))
    return AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        dtype=dtype,
        device_map=device_map,
    )


def falcon_dtype(torch, value):
    if value == "auto":
        return torch.bfloat16 if torch.cuda.is_available() else torch.float32
    if value == "float16":
        return torch.float16
    if value == "bfloat16":
        return torch.bfloat16
    if value == "float32":
        return torch.float32
    return value


def frame_to_pil(frame):
    from PIL import Image

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def detection_prompts():
    value = os.environ.get("CHICKCOACH_DETECTION_PROMPTS")
    if not value:
        return DEFAULT_PROMPTS
    return [prompt.strip() for prompt in value.split(",") if prompt.strip()]


def normalize_falcon_results(results, width, height):
    detections = []
    for index, result in enumerate(results, start=1):
        bbox = bbox_from_falcon_result(result, width, height)
        if bbox is None:
            continue
        detections.append({
            "track_id": f"chick_{index}",
            "bbox": bbox,
            "confidence": float(result.get("score", result.get("confidence", 0.75))),
        })
    return detections


def bbox_from_falcon_result(result, width, height):
    if not isinstance(result, dict):
        return None

    if "bbox" in result and isinstance(result["bbox"], list) and len(result["bbox"]) == 4:
        return clamp_bbox([int(value) for value in result["bbox"]], width, height)

    if "box" in result and isinstance(result["box"], list) and len(result["box"]) == 4:
        return clamp_bbox([int(value) for value in result["box"]], width, height)

    xy = result.get("xy")
    hw = result.get("hw")
    if isinstance(xy, dict) and isinstance(hw, dict):
        cx = float(xy.get("x", 0)) * width
        cy = float(xy.get("y", 0)) * height
        box_width = float(hw.get("w", 0)) * width
        box_height = float(hw.get("h", 0)) * height
        return clamp_bbox([
            int(cx - box_width / 2),
            int(cy - box_height / 2),
            int(cx + box_width / 2),
            int(cy + box_height / 2),
        ], width, height)

    mask_rle = result.get("mask_rle")
    if mask_rle:
        bbox = bbox_from_mask_rle(mask_rle)
        if bbox is not None:
            return clamp_bbox(bbox, width, height)

    return None


def bbox_from_mask_rle(mask_rle):
    from pycocotools import mask as mask_utils

    mask = mask_utils.decode(mask_rle).astype(bool)
    ys, xs = np.where(mask)
    if len(xs) == 0 or len(ys) == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def clamp_bbox(bbox, width, height):
    x1, y1, x2, y2 = bbox
    x1 = max(0, min(width - 1, x1))
    y1 = max(0, min(height - 1, y1))
    x2 = max(0, min(width - 1, x2))
    y2 = max(0, min(height - 1, y2))
    if x2 <= x1 or y2 <= y1:
        return None
    return [x1, y1, x2, y2]
