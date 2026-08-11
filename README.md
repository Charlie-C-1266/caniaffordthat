# Can I Afford That?

A single-page scrollytelling calculator that helps you decide whether something
is affordable — either by working out how long it'd take to save up for it, or
what the monthly payment would be if you financed it.

Standalone POC: React + Vite, GBP-only, and almost entirely static — the app
itself is a pure client-side SPA. The one exception is an optional serverless
function (`api/parse-product.ts`) that powers the "paste a product link"
autofill; see [Paste a product link](#paste-a-product-link-optional) below.
This repository contains the full source, tests, and Docker setup for running
it yourself.

## Running it locally

With Node installed:

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to <http://localhost:5173>).

Or with Docker:

```bash
docker compose up -d --build
```

This serves on <http://localhost:4321>. Change the left half of the port mapping
in `docker-compose.yml` (e.g. `9000:80`) if that port is already taken.

To produce a static build you can serve from any static host:

```bash
npm run build   # outputs to dist/
```

## Paste a product link (optional)

On the tailored details step for product-shaped goals (luxury item, big
purchase, vehicle) there's an optional field: paste a retailer product URL and
the calculator fills in the item name and price for you.

Because a browser can't fetch an arbitrary retailer page (CORS), this is served
by a small **Vercel serverless function** at `api/parse-product.ts`. It fetches
the page server-side and reads the price from JSON-LD / Open Graph markup, with
SSRF guards, an 8s timeout and a response-size cap.

The feature is **Vercel-only and degrades gracefully everywhere else**: on the
static build, the Docker/nginx image, or `npm run dev`, the endpoint simply
isn't there, so the field falls back to manual entry with a quiet one-line
message. Nothing else in the app depends on it. To exercise the function
locally, run it with the Vercel CLI:

```bash
npx vercel dev
```

## Found a bug?

Please [raise an issue](../../issues) or email **hello@caniaffordthat.co.uk** —
whichever's easier. A note on how to reproduce it is always appreciated.

## Contributing

Contributions are very welcome — feel free to raise a PR with any change you
think would be beneficial. Changes land via PR into `main` rather than direct
pushes:

```bash
git checkout -b feature/short-description   # or bugfix/short-description
# ...make changes...
git push -u origin feature/short-description
```

Then open a PR into `main`. CI (`.github/workflows/ci.yml` — typecheck, lint,
test, build) must pass before merging.
