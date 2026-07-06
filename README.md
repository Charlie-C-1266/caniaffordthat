# Can I Afford That?

A single-page scrollytelling calculator that helps decide whether an item is
affordable — either by working out how long it'll take to save up for it, or
what the monthly payment would be if financing it.

Standalone POC. React + Vite, GBP-only, no backend.
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

Serves on **http://localhost:4321**. Change the left half of the port mapping
in `docker-compose.yml` (e.g. `9000:80`) if that port is already taken.

## Deployment

Zero-config on Vercel or Netlify — it's a pure static build with no backend:
build command `npm run build`, publish directory `dist`. Both platforms
auto-detect Vite, so importing the GitHub repo directly should just work.

Live on Vercel, connected directly to this GitHub repo — every push and PR
gets its own preview deployment automatically (Vercel's native Git
integration, no GitHub Actions involved in the deploy itself).

## Workflow

Changes land via PR, not direct pushes to `main`:

```bash
git checkout -b feature/short-description   # or bugfix/short-description
# ...make changes...
git push -u origin feature/short-description
```

Open a PR into `main`. That gives you two things automatically: a Vercel
preview URL on the PR (via Vercel's Git integration) and a CI run
(`.github/workflows/ci.yml` — typecheck, lint, test, build) that has to pass
before merging.
