# Can I Afford That?

A single-page scrollytelling calculator that helps decide whether an item is
affordable — either by working out how long it'll take to save up for it, or
what the monthly payment would be if financing it.

Standalone POC, separate from PiLedger. React + Vite, GBP-only, no backend.
See the [implementation plan](https://app.notion.com/p/39324a157886817aaf8ed3a8199f6bd3)
for the build breakdown, and `design/` for the original design handoff this is
built from.

## Development

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up -d --build
```

Serves on **http://localhost:4321** (port chosen to avoid clashing with
PiLedger on 8080 and floci on 4500/4566 on this machine).

## Deployment

Zero-config on Vercel or Netlify — it's a pure static build with no backend:
build command `npm run build`, publish directory `dist`. Both platforms
auto-detect Vite, so importing the GitHub repo directly should just work.
