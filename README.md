# Can I Afford That?

A single-page scrollytelling calculator that helps you decide whether something
is affordable — by working out how long it'd take to save up for it, or what the
monthly payment would be if you financed it, and then flipping the question
round to show what salary you'd need to earn to afford it.

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

Please [raise an issue](../../issues) or email **<hello@caniaffordthat.co.uk>** —
whichever's easier. A note on how to reproduce it is always appreciated.

## Contributing

Contributions are very welcome — feel free to raise a PR with any change you
think would be beneficial. Changes land via PR rather than direct pushes:

```bash
git checkout -b feature/short-description   # or bugfix/short-description
# ...make changes...
git push -u origin feature/short-description
```

Then open a PR into `dev`. CI (`.github/workflows/ci.yml` — typecheck, lint,
test, build, e2e) must pass before merging.

## Branching and releases

Two long-lived branches:

- **`dev`** — the integration branch. Every feature and fix PR targets this.
- **`main`** — what's deployed. Vercel builds production from it, so whatever
  lands here is live.

Releases are batched: when `dev` has accumulated enough to ship, open a single
`dev` → `main` PR describing everything in it.

**Merge feature PRs into `dev` however you like, but merge release PRs with a
merge commit — never squash them.** A squash gives `main` one new commit that
isn't an ancestor of `dev`, so the two branches end up with identical content
but divergent history. Git then still considers the _pre-release_ `main` to be
their merge base, and the next release PR re-displays everything from the
previous release as though it had never shipped.

If a release does get squashed by accident, the repair is a back-merge —
`git checkout dev && git merge origin/main` — which carries no content change
and just reconnects the two branches. This happened once, to the #23 release;
`028d677` is the back-merge that fixed it.
