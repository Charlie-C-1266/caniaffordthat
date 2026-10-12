/// <reference types="vite/client" />

/**
 * True only in bundles built on Vercel. Supplied by Vite's `define` (see
 * vite.config.ts) from Vercel's own `VERCEL` environment variable, so it is a
 * compile-time boolean literal — nothing sets it on `window`, and no deploy
 * has to remember a `VITE_`-prefixed variable.
 *
 * Deliberately a `__FLAG__` global rather than `import.meta.env.ON_VERCEL`:
 * values reached through `import.meta.env` arrive as **strings**, so the gate
 * would read the string `'false'`, which is truthy, and stay open everywhere.
 */
declare const __ON_VERCEL__: boolean
