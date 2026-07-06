# Can I Afford That?

A single-page scrollytelling calculator that helps you decide whether something
is affordable — either by working out how long it'd take to save up for it, or
what the monthly payment would be if you financed it.

Standalone POC: React + Vite, GBP-only, and no backend — a pure static,
client-side app. This repository contains the full source, tests, and Docker
setup for running it yourself.

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
