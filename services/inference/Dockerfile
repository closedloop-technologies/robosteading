FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CHICKCOACH_API_URL=http://host.docker.internal:44100 \
    CAMERA_INDEX=0 \
    CAPTURE_INTERVAL_SECONDS=3 \
    CHICKCOACH_DETECTOR=yolo \
    YOLO_MODEL=yolov8n.pt \
    YOLO_CLASS_IDS=14 \
    YOLO_CONFIDENCE=0.03 \
    YOLO_IMAGE_SIZE=960

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libgl1 \
      libglib2.0-0 \
      libgomp1 \
      v4l-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY analyze.py annotate.py capture.py falcon_segment.py main.py stream_client.py zones.json ./

CMD ["python", "main.py"]
