/**
 * localStorage key for the user's explicit theme choice. Lives in its own
 * DOM-free module because both sides of the theme system need it: theme.ts
 * (the running app's helpers, which touch window/document) and
 * themeBootstrap.ts (imported by vite.config.ts, whose node-side TS project
 * has no DOM lib). theme.ts re-exports it, so app code keeps importing from
 * there.
 */
export const THEME_STORAGE_KEY = 'theme'
