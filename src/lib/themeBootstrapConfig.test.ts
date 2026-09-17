// @vitest-environment node
// Separate from themeBootstrap.test.ts because vite.config.ts resolves its
// HTML entries via import.meta.url, which is only a file: URL under the node
// environment — jsdom rewrites it to http and the import throws.
import { describe, it, expect } from 'vitest'
import { THEME_BOOTSTRAP_PLUGIN_NAME } from './themeBootstrap'
import viteConfig from '../../vite.config'

/** Flattens Vite's arbitrarily nested PluginOption tree into plain values. */
function flattenPlugins(value: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) value.forEach((entry) => flattenPlugins(entry, out))
  else out.push(value)
  return out
}

describe('theme bootstrap registration in vite.config', () => {
  it('covers all four HTML entry points with the injection plugin', () => {
    // The plugin transforms every HTML entry the config declares, so
    // together these assertions guarantee all 4 built outputs carry the
    // identical, current script — an entry added later is covered
    // automatically, and removing the plugin (or an entry) fails here.
    const input = viteConfig.build?.rollupOptions?.input
    const entries = input && typeof input === 'object' ? Object.keys(input) : []
    expect(entries).toHaveLength(4)

    const plugins = flattenPlugins(viteConfig.plugins ?? [])
    expect(plugins.some((p) => typeof p === 'object' && p !== null && 'name' in p && p.name === THEME_BOOTSTRAP_PLUGIN_NAME)).toBe(true)
  })
})
