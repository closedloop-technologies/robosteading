# ChickCoach Local Inference Worker

This is the weekend scaffold for the webcam-to-Remix loop.

It currently:

- Captures one frame per loop with OpenCV.
- Falls back to a generated test frame if webcam capture fails.
- Uses Falcon-Perception, manual boxes from an env var, or a fake detector fallback.
- Assigns detections to configured zones.
- Draws annotations.
- Pushes observation JSON and the latest annotated JPEG to `/api/ingest/observation`.
- Can push normalized audio spectrum frames to `/api/audio/spectrum` for the live spectrogram.
- Can save raw/annotated debug frames and run a finite smoke test.
- Keeps running when detection or push fails so the next frame can recover.

Run it after the Remix app is running:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
CHICKCOACH_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

From the repo root, run both local dev loops together:

```sh
npm run dev
```

That starts the Remix server in `tsx watch` mode and the webcam worker under `watchmedo
auto-restart`. Edits to `server.ts`, `app/**`, or generated BAML files restart the web server.
Edits to `services/inference/**/*.py` or `services/inference/**/*.json` restart the worker.
Use `Ctrl-C` once to stop both processes.

Run it in Docker with the brooder camera:

```sh
docker build -t chickcoach-inference .
docker run --rm \
  --device=/dev/video2:/dev/video2 \
  --add-host=host.docker.internal:host-gateway \
  -e CAMERA_INDEX=2 \
  -e CHICKCOACH_API_URL=http://host.docker.internal:44100 \
  -e STREAM_INGEST_TOKEN=dev-stream-token \
  -e CHICKCOACH_DETECTOR=yolo \
  -e YOLO_CLASS_IDS=14 \
  -e YOLO_CONFIDENCE=0.03 \
  -e YOLO_IMAGE_SIZE=960 \
  chickcoach-inference
```

Useful weekend test modes:

```sh
# Run five fake-camera frames, save raw and annotated images under debug_frames/.
CHICKCOACH_FAKE_CAMERA=1 CHICKCOACH_SAVE_FRAMES=1 CHICKCOACH_MAX_FRAMES=5 python main.py

# Show a local OpenCV preview window while pushing frames.
CHICKCOACH_PREVIEW=1 python main.py

# Override fake detection boxes for calibration against a real frame.
CHICKCOACH_DETECTIONS_JSON='[
  {"track_id":"chick_1","bbox":[180,160,250,235],"confidence":0.9},
  {"track_id":"chick_2","bbox":[520,320,590,395],"confidence":0.9}
]' python main.py

# Run Falcon-Perception 300M detection against the real webcam, with fake fallback if model inference fails.
CHICKCOACH_DETECTOR=falcon FALCON_MODEL=tiiuae/Falcon-Perception-300M python main.py

# Practical local detector fallback. COCO class 14 is "bird"; set YOLO_CLASS_IDS=all to inspect all classes.
CHICKCOACH_DETECTOR=yolo YOLO_MODEL=yolov8n.pt python main.py

# RF-DETR detector. The default RFDETR_CLASS_IDS=14 keeps COCO "bird" detections as chick candidates.
CHICKCOACH_DETECTOR=rfdetr RFDETR_MODEL=nano RFDETR_CLASS_IDS=14 python main.py
```

Environment variables:

- `CHICKCOACH_API_URL`: Remix app base URL. Defaults to `http://localhost:44100`.
- `STREAM_INGEST_TOKEN`: Bearer token for `/api/ingest/observation`.
- `CAMERA_INDEX`: OpenCV camera index. Defaults to `0`.
- `CAPTURE_INTERVAL_SECONDS`: seconds between frames. Defaults to `3`.
- `CHICKCOACH_FAKE_CAMERA=1`: skip webcam capture and generate a moving test frame.
- `CHICKCOACH_DETECTOR`: `fake` by default; set to `falcon` to run Falcon-Perception or `yolo` for a lightweight local detector.
- `CHICKCOACH_FALLBACK_DETECTOR`: `fake` by default; set to `none` to fail instead of falling back.
- `CHICKCOACH_DETECTION_PROMPTS`: comma-separated prompt list. Defaults to `baby chick,white chick,baby chicken,small white bird`.
- `CHICKCOACH_SAVE_FRAMES=1`: save raw and annotated frames.
- `CHICKCOACH_SAVE_FRAME_HISTORY=1`: save timestamped debug frames in addition to `latest_raw.jpg` and `latest_annotated.jpg`.
- `CHICKCOACH_SAVE_MANIFEST=0`: disable `manifest.jsonl` writes when frame history is enabled. The manifest records each saved frame path, detector mode, stats, and detections for later model testing.
- `CHICKCOACH_DEBUG_DIR`: debug frame directory. Defaults to `debug_frames`.
- `CHICKCOACH_PREVIEW=1`: open a local OpenCV preview window.
- `CHICKCOACH_MAX_FRAMES`: stop after this many frames, useful for smoke tests.
- `CHICKCOACH_DETECTIONS_JSON`: manual detection boxes while calibrating zones or replacing the detector.
- `FALCON_MODEL`: Hugging Face model id. Defaults to `tiiuae/Falcon-Perception-300M`.
- `FALCON_DEVICE_MAP`: device passed to Transformers. Defaults to `cuda` when available, otherwise `cpu`.
- `FALCON_DTYPE`: `auto`, `float16`, `bfloat16`, or `float32`. Defaults to `auto`.
- `FALCON_TASK`: task passed to `model.generate`. Defaults to `detection`.
- `FALCON_MIN_DIMENSION` / `FALCON_MAX_DIMENSION`: image resize bounds for generation.
- `FALCON_COMPILE=0`: disables the model's first-run compile path.
- `YOLO_MODEL`: model file/name for Ultralytics. Defaults to `yolov8n.pt`.
- `YOLO_CLASS_IDS`: comma-separated COCO class IDs. Defaults to `14` for bird. Use `all` to keep all detections.
- `YOLO_CONFIDENCE`: confidence threshold. Defaults to `0.15`.
- `YOLO_IMAGE_SIZE`: inference image size. Defaults to `640`.
- `YOLO_MAX_DETECTIONS`: max boxes to pass through. Defaults to `8`.
- `CHICKCOACH_MIN_CHICK_BOX_WIDTH` / `CHICKCOACH_MIN_CHICK_BOX_HEIGHT`: reject tiny detections before labeling them as chicks. Both default to `45` pixels to avoid poop/feed false positives.
- `CHICKCOACH_MIN_CHICK_BOX_AREA`: reject small detection boxes. Defaults to `2500` pixels.
- `CHICKCOACH_LIGHT_BLOB_FALLBACK=1`: optional experimental fallback for large white feather blobs when YOLO finds no plausible chicks. Disabled by default because white bedding can look similar.
- `RFDETR_MODEL`: `nano`, `small`, `medium`, `base`, or `large`. Defaults to `nano`.
- `RFDETR_CLASS_IDS`: comma-separated COCO class IDs. Defaults to `14` for bird. Use `all` to keep all detections.
- `RFDETR_CONFIDENCE`: confidence threshold. Defaults to `0.03`.
- `RFDETR_MAX_DETECTIONS`: max boxes to pass through. Defaults to `12`.

Falcon-Perception is loaded lazily on the first frame. The first run may download model weights and
compile kernels, so expect it to be much slower than later frames.

Audio spectrum frames use the same `CHICKCOACH_API_URL` and `STREAM_INGEST_TOKEN` values. Post one
or two normalized frequency-bin arrays with values from `0` to `1`:

```py
from stream_client import push_audio_spectrum

push_audio_spectrum(
    bins=[left_bins, right_bins],  # use one array for mono
    sample_rate=48000,
    channels=2,
    levels=[left_rms, right_rms],
)
```
