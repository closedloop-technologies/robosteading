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

    if detector == "rfdetr":
        try:
            detections = rfdetr_detections(frame)
            _last_detector_mode = "rfdetr"
            return detections
        except Exception as error:
            _last_detector_mode = "rfdetr_failed_fake"
            print(f"RF-DETR detector failed: {error}", file=sys.stderr, flush=True)
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
            "class_name": "chick",
            "bbox": [int(width * 0.24), int(height * 0.34), int(width * 0.33), int(height * 0.48)],
            "confidence": 0.72,
        },
        {
            "track_id": "chick_2",
            "class_name": "chick",
            "bbox": [int(width * 0.64), int(height * 0.52), int(width * 0.73), int(height * 0.65)],
            "confidence": 0.68,
        },
    ]


def yolo_detections(frame):
    model = load_yolo_model()
    confidence_threshold = float(os.environ.get("YOLO_CONFIDENCE", "0.15"))
    image_size = int(os.environ.get("YOLO_IMAGE_SIZE", "640"))
    class_ids = yolo_class_ids()
    height, width = frame.shape[:2]
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
        bbox = clamp_bbox([x1, y1, x2, y2], width, height)
        if not is_plausible_chick_box(bbox, width, height):
            continue
        detections.append({
            "track_id": f"chick_{len(detections) + 1}",
            "class_name": "chick",
            "bbox": bbox,
            "confidence": float(box.conf[0].item()) if box.conf is not None else 0.5,
        })
        if len(detections) >= int(os.environ.get("YOLO_MAX_DETECTIONS", "8")):
            break

    if not detections and os.environ.get("CHICKCOACH_LIGHT_BLOB_FALLBACK", "0") == "1":
        return light_blob_chick_detections(frame)

    return detections


def rfdetr_detections(frame):
    model = load_rfdetr_model()
    image = frame_to_pil(frame)
    height, width = frame.shape[:2]
    threshold = float(os.environ.get("RFDETR_CONFIDENCE", "0.03"))
    class_ids = rfdetr_class_ids()
    predictions = model.predict(image, threshold=threshold)
    detections = []

    xyxy = getattr(predictions, "xyxy", [])
    confidence = getattr(predictions, "confidence", [])
    class_id = getattr(predictions, "class_id", [])

    for index, bbox in enumerate(xyxy):
        detected_class_id = int(class_id[index]) if len(class_id) > index else -1
        if class_ids and detected_class_id not in class_ids:
            continue
        x1, y1, x2, y2 = [int(value) for value in bbox]
        box = clamp_bbox([x1, y1, x2, y2], width, height)
        if not is_plausible_chick_box(box, width, height):
            continue
        detections.append({
            "track_id": f"chick_{len(detections) + 1}",
            "class_name": "chick",
            "bbox": box,
            "confidence": float(confidence[index]) if len(confidence) > index else 0.5,
        })
        if len(detections) >= int(os.environ.get("RFDETR_MAX_DETECTIONS", "12")):
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


def rfdetr_class_ids():
    value = os.environ.get("RFDETR_CLASS_IDS", os.environ.get("YOLO_CLASS_IDS", "14"))
    if value.strip().lower() in {"", "all", "*"}:
        return set()
    return {int(part.strip()) for part in value.split(",") if part.strip()}


def is_plausible_chick_box(bbox, frame_width, frame_height):
    x1, y1, x2, y2 = bbox
    width = max(0, x2 - x1)
    height = max(0, y2 - y1)
    area = width * height
    frame_area = frame_width * frame_height

    min_width = int(os.environ.get("CHICKCOACH_MIN_CHICK_BOX_WIDTH", "45"))
    min_height = int(os.environ.get("CHICKCOACH_MIN_CHICK_BOX_HEIGHT", "45"))
    min_area = int(os.environ.get("CHICKCOACH_MIN_CHICK_BOX_AREA", "2500"))
    max_area_ratio = float(os.environ.get("CHICKCOACH_MAX_CHICK_BOX_AREA_RATIO", "0.55"))
    max_aspect_ratio = float(os.environ.get("CHICKCOACH_MAX_CHICK_BOX_ASPECT_RATIO", "8"))

    if width < min_width or height < min_height or area < min_area:
        return False
    if frame_area and area / frame_area > max_area_ratio:
        return False

    aspect_ratio = max(width / max(1, height), height / max(1, width))
    return aspect_ratio <= max_aspect_ratio


def light_blob_chick_detections(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([0, 0, 170]), np.array([179, 55, 255]))
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _hierarchy = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = frame.shape[:2]
    candidates = []
    min_area = int(os.environ.get("CHICKCOACH_LIGHT_BLOB_MIN_AREA", "6000"))
    max_detections = int(os.environ.get("CHICKCOACH_LIGHT_BLOB_MAX_DETECTIONS", "1"))

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        x, y, box_width, box_height = cv2.boundingRect(contour)
        bbox = clamp_bbox([x, y, x + box_width, y + box_height], width, height)
        if not is_plausible_chick_box(bbox, width, height):
            continue
        candidates.append((area, bbox))

    candidates.sort(reverse=True, key=lambda item: item[0])
    return [
        {
            "track_id": f"chick_{index}",
            "class_name": "chick",
            "bbox": bbox,
            "confidence": 0.25,
        }
        for index, (_area, bbox) in enumerate(candidates[:max_detections], start=1)
    ]


@lru_cache(maxsize=1)
def load_rfdetr_model():
    from rfdetr import RFDETRBase, RFDETRLarge, RFDETRMedium, RFDETRNano, RFDETRSmall

    model_size = os.environ.get("RFDETR_MODEL", "nano").lower()
    models = {
        "nano": RFDETRNano,
        "small": RFDETRSmall,
        "medium": RFDETRMedium,
        "base": RFDETRBase,
        "large": RFDETRLarge,
    }
    model_class = models.get(model_size, RFDETRNano)
    return model_class()


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
            "class_name": str(detection.get("class_name") or "chick"),
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
            "class_name": "chick",
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
