# ChickCoach Weekend Runbook

## Web app

```sh
npm i
STREAM_INGEST_TOKEN=dev-stream-token ADMIN_TOKEN=chickcoach npm run dev
```

Open:

- Public live view: `http://localhost:44100/chickcheck/live`
- Admin dashboard: `http://localhost:44100/chickcheck/dashboard`
- Temporary admin token: `chickcoach`, unless `ADMIN_TOKEN` is set.

## Local worker

```sh
cd services/inference
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
CHICKCOACH_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

The worker tries to use a webcam through OpenCV. If webcam capture is unavailable, it generates a
simple fallback frame and still pushes observations so the full Remix path can be tested.

To force generated frames:

```sh
CHICKCOACH_FAKE_CAMERA=1 CHICKCOACH_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

## Kimi chat

Set these before starting the web app:

```sh
KIMI_BASE_URL=
KIMI_API_KEY=
KIMI_MODEL=
```

If they are absent or the request fails, `/chickcheck/api/chat` uses the local conservative fallback
responder. Root `/api/...` aliases are also available for the local worker.
