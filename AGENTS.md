# RoboSteading Agent Guide

RoboSteading is a Remix 3 app with a ChickCoach live-observation feature and a local Python
inference worker. Use these conventions when continuing to build it out.

## Requirements

- Use Node `>=24.3.0`.
- Run `npm i` before local development.
- Python inference work lives under `services/inference/` and uses its own virtualenv plus
  `services/inference/requirements.txt`.

## Commands

```sh
npm i
npm run dev
npm run start
npm run build
npm test
npm run typecheck
```

## Building Features

Refer to `./.agents/skills/remix/SKILL.md` for Remix routing, controller, middleware, UI,
validation, hydration, and testing conventions.

## App Layout

- `server.ts` loads `.env`, imports the router, serves requests with `remix/node-serve`, and
  defaults to port `44100`.
- `app/routes.ts` defines the route contract. Update this first when adding or changing URLs.
- `app/router.ts` wires route definitions to controller actions and serves `public/` through
  `staticFiles('./public')`.
- `app/controllers/home.tsx` owns the marketing home page at `/`.
- `app/controllers/chickcoach.tsx` owns ChickCoach pages and APIs under `/chickcheck/*` plus the
  mirrored top-level `/api/*` ingestion/chat/report endpoints.
- `app/data/` owns ChickCoach runtime state, auth helpers, chat answering, and care knowledge.
- `app/ui/` owns shared cross-route UI such as the ChickCoach page shell and status components.
- `app/utils/render.tsx` centralizes HTML response rendering.
- `app/utils/http.ts` contains small `json`, `redirect`, and JSON body helpers.
- `app/utils/env.ts` contains the local `.env` loader used by `server.ts`.
- `public/` contains static browser assets, CSS, JS, favicons, uploads, `robots.txt`, and
  `sitemap.xml`.
- `docs/` contains operator-facing ChickCoach safety, report, and runbook docs.
- `baml_src/` contains the ChickCoach LLM schema, prompt contract, and Kimi client config. Keep it
  aligned with `app/data/chat.server.ts` when changing chat answer shape or safety behavior.
- `scripts/build-static.mjs` builds `dist/` by copying `public/`, rendering the home page, and
  writing `CNAME`.
- `dnsconfig.js` contains DNSControl config for `robosteading.com`.
- `services/inference/` contains the local webcam/OpenCV worker that posts observations to the
  Remix API.

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Keep simple pages in flat files like `app/controllers/home.tsx`.
- Keep the current ChickCoach surface in `app/controllers/chickcoach.tsx` until it becomes large
  enough to justify promotion into a controller folder.
- Promote a route into a controller folder with `controller.tsx` only when it gains nested routes, multiple actions, or route-owned modules.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/controllers/`.
- Keep persistence, external API calls, domain types, and runtime state in `app/data/`.
- Keep cross-layer response helpers in `app/utils/` only when they do not have a clearer owner.

## ChickCoach Notes

- Runtime state is stored in `tmp/chickcoach-store.json` by `app/data/store.ts`; `tmp/` is scratch
  data and should not be treated as source.
- Uploaded annotated frames are written under `public/uploads/` by the ingest endpoint.
- Admin access is cookie-based and controlled by `ADMIN_TOKEN` or `CHICKCOACH_ADMIN_TOKEN`.
- Stream ingestion uses `STREAM_INGEST_TOKEN`; the development fallback is `dev-stream-token`.
- Chat answering uses Kimi/Fireworks when `KIMI_API_KEY` or `FIREWORKS_API_KEY` is available, with
  a deterministic fallback in `app/data/chat.server.ts`.
- The Python worker should be run from `services/inference/` after the Remix app is running. See
  `services/inference/README.md` for webcam, fake-camera, preview, and smoke-test commands.

## Static And Deployment Notes

- `npm run build` generates a static `dist/` snapshot of the home page and public assets. It starts
  the local server during the build, so keep port configuration consistent with `PORT` when needed.
- Dynamic ChickCoach routes require the Remix server; they are not captured by the static build.
- DNS changes belong in `dnsconfig.js` and should be previewed before push with DNSControl.

## Build-Out Notes

- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
- Add `app/middleware/` only when request lifecycle behavior outgrows the current static-file
  middleware setup.
- Add `test/` when adding meaningful router, data, or worker coverage; `npm test` currently runs
  Node's test runner through `tsx --test`.
- Do not commit local secrets, `.env`, generated `tmp/` state, inference debug frames, or generated
  upload artifacts unless there is an explicit reason.
