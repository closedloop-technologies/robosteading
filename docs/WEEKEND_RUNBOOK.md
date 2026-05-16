# BroodCast Weekend Runbook

## Web app

```sh
npm i
STREAM_INGEST_TOKEN=dev-stream-token ADMIN_TOKEN=broodcast npm run dev
```

Open:

- Public live view: `http://localhost:44100/broodcast/live`
- Admin dashboard: `http://localhost:44100/broodcast/dashboard`
- Temporary admin token: `broodcast`, unless `ADMIN_TOKEN` is set.

## Local worker

```sh
cd services/inference
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
BROODCAST_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

The worker tries to use a webcam through OpenCV. If webcam capture is unavailable, it generates a
simple fallback frame and still pushes observations so the full Remix path can be tested.

To force generated frames:

```sh
CHICKCOACH_FAKE_CAMERA=1 BROODCAST_API_URL=http://localhost:44100 STREAM_INGEST_TOKEN=dev-stream-token python main.py
```

## Kimi chat

Set these before starting the web app:

```sh
KIMI_BASE_URL=
KIMI_API_KEY=
KIMI_MODEL=
```

If they are absent or the request fails, `/broodcast/api/chat` uses the local conservative fallback
responder. Root `/api/...` aliases are also available for the local worker.
