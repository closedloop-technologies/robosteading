# ChickCoach Local Inference Worker

This is the weekend scaffold for the webcam-to-Remix loop.

It currently:

- Captures one frame per loop with OpenCV.
- Falls back to a generated test frame if webcam capture fails.
- Uses a fake detector shaped like the Falcon-Perception output.
- Assigns detections to configured zones.
- Draws annotations.
- Pushes observation JSON and the latest annotated JPEG to `/api/ingest/observation`.

Run it after the Remix app is running:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
CHICKCOACH_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

Replace `falcon_segment.py` with the Falcon-Perception implementation when the local model runtime
is ready.
