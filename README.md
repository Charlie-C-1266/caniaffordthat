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
in `docker-compose.yml` (e.g. `9000:80`) if that port is already taken. The
`Dockerfile` and its build-context ignore file live in `docker/`, which needs
BuildKit, Docker's default builder since Engine 23.

The container's nginx config (`docker/nginx.conf`) gzips text responses, caches
Vite's hashed `/assets/` for a year while holding HTML at `no-cache`, sends
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and a
`frame-ancestors` CSP, and returns a real 404 for unknown paths rather than
serving the calculator. To check all of that against a build:

```bash
npm run build
scripts/verify-nginx.sh      # needs nginx on PATH; CI runs this too
```

`verify-nginx.sh` is mostly a harness: it boots `docker/nginx.conf` against `./dist`
and hands the URL to `scripts/verify-headers.sh`, which holds the assertions
and takes a base URL of its own. (It adds one nginx-only check, that a direct
request for `/404.html` is a 404.) So the same expectations can be checked
against a running deployment, and a CDN's header policy can't quietly drift
away from `nginx.conf`:

```bash
scripts/verify-headers.sh https://staging.example.com
```

HSTS is only asserted when the base URL is `https`.

To produce a static build you can serve from any static host:

```bash
npm run build   # outputs to dist/
```

Vercel's Speed Insights and Analytics are only mounted in builds made on Vercel,
where the `VERCEL` environment variable is set. A self-hosted or local build
never mounts them, so it makes no requests to `/_vercel/` and reports nothing
anywhere.

## Testing

```bash
npm test            # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright) — starts its own dev server
scripts/check-uk-spelling.sh   # US spellings in the lines your branch adds
```

The site is UK-only, comments and test names included. `check-uk-spelling.sh
[base-ref]` (default `origin/dev`) fails on US spellings such as `color` or
`behavior` in the lines added since the base, and CI runs it on PRs into `dev`.
Spellings fixed by a spec, like CSS `color` or `text-align: center`, are allowed
by patterns in `scripts/uk-spelling-allow.txt`.

`npm run test:e2e` normally starts the dev server itself. Set `E2E_BASE_URL` to
run the same suite against a server that's already up — a preview build, a
staging deployment, anything reachable over http(s) — and no server is started:

```bash
E2E_BASE_URL=http://localhost:4173 npx playwright test   # e.g. against `npm run preview`
```

It must be an absolute `http://` or `https://` origin, such as
`https://staging.example.com`, with no path: the tests navigate with paths
from the site root, so a path in the URL would be ignored.

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
shellcheck, UK spelling, test, build, e2e) must pass before merging.

Dependency and GitHub Actions updates arrive on their own: Dependabot
(`.github/dependabot.yml`) opens weekly PRs into `dev` for npm, the Dockerfile
base images and the pinned actions, with minor and patch bumps grouped.

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

### Which pushes Vercel builds

`main` always deploys. On every other branch, Vercel first runs
`scripts/vercel-ignore-build.sh` (wired up through `vercel.json`) and skips the
preview build when nothing that reaches the deployed site has changed since
that branch's last successful deployment. A push that only touches unit tests
(`src/**/*.test.ts(x)`), `e2e/`, `.github/`, docs and Markdown, the other
`scripts/`, or the Docker and nginx setup is skipped. Anything else builds, and
so does a branch's first deployment and anything the script can't be sure
about. CI still builds and tests every PR either way. A skipped deployment
shows as cancelled in the Vercel dashboard (`CANCELED` in Vercel's API), with
the script's reason in its build log; the header of the script lists the full
rules.

To force a build anyway, open the deployment in the Vercel dashboard, choose
**Redeploy**, and untick **Use project's Ignore Build Step**.

### Response headers on Vercel

`vercel.json` also defines the production response headers: the four security
headers on every route, a year of `immutable` caching for the hashed
`/assets/`, an hour for the unhashed public files, and `no-cache` for each HTML
page. These mirror `docker/nginx.conf`, which only reaches self-hosters, so the two
files must stay in step — `src/lib/vercelHeaders.test.ts` fails if a header is
added, dropped or changed on one side only, or if the `/assets/` cache value
drifts. Adding a header is therefore a two-file change.

`trailingSlash: true` is set there too, so `/sources` redirects to `/sources/`
— the form the canonical URLs and the sitemap use.

After a deploy, `scripts/verify-headers.sh <url>` checks the served headers
against the same expectations, on Vercel or on a self-hosted container alike.
It recognises Vercel by the `x-vercel-id` header on every response and holds
any other host to the full nginx list, so a host that drops that header fails
safe. On Vercel it allows for two differences:

- **The trailing-slash redirect.** Because of `trailingSlash: true`, an
  extensionless unknown path such as `/does-not-exist` first 308-redirects to
  `/does-not-exist/`, and only that URL is the 404. The script checks that
  one redirect, then runs the 404 checks (status, branded body, security
  headers) on the URL it leads to. A redirect anywhere else, a temporary
  redirect or a second hop still fails. Vercel's redirect itself carries none
  of the security headers, which costs nothing because a redirect has no body
  to frame or sniff.
- **Four nginx-only checks**, reported as skipped with the reason rather than
  failed:
  - three expect no `Cache-Control` on a 404, which nginx achieves with an
    `always`-less `add_header`. Vercel matches headers by path with no
    condition on status, so a 404 under `/assets/` or a directory without an
    index carries the rule for its path;
  - one expects `Vary: Accept-Encoding` on compressed responses. Vercel's CDN
    negotiates the encoding itself and sends none.

A clean run against production ends with "All header checks passed …, with 4
nginx-only checks skipped."
