# RoboSteading

RoboSteading is a Remix-powered site for AI automation on the modern homestead.

## App Shape

- `app/controllers/home.tsx` renders the landing page.
- `app/routes.ts` defines the route contract.
- `app/router.ts` wires Remix routes and static file middleware.
- `app/utils/render.tsx` centralizes HTML response rendering.
- `public/` contains browser assets, favicons, `robots.txt`, `sitemap.xml`, and CSS.
- `dnsconfig.js` contains the DNSControl configuration for `robosteading.com`.

## Requirements

Use Node 24 or newer. With `nvm`:

```sh
nvm use
npm install
```

## Commands

```sh
npm run dev
npm run start
npm test
npm run typecheck
```

## DNS

Environment variables are managed outside Git. To preview or push DNS changes, authenticate with
the 1Password CLI and run:

```sh
op run --env-file .env -- dnscontrol preview
op run --env-file .env -- dnscontrol push
```
