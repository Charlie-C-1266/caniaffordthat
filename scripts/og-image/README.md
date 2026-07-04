# OG image generator

Generates the social-share card at `public/og-image.png` (referenced by the
Open Graph / Twitter meta tags in `index.html`).

- `og.html` — the 1200×630 card layout (kept in sync with the hero headline in
  `src/components/steps/Step0Intro.tsx`).
- `render.mjs` — screenshots `og.html` with Playwright's bundled Chromium.

To regenerate after editing `og.html`:

```bash
node scripts/og-image/render.mjs
```

Playwright is already a dev dependency; if the browser binary is missing, run
`npx playwright install chromium` first.
