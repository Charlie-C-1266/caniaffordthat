/**
 * The attributes that turn a sideways-scrolling box into something a keyboard
 * user can reach and a screen reader can name — applied only while it really
 * does scroll (#314).
 *
 * `tabIndex` is what puts it in the tab order, so the arrow keys can scroll
 * the hidden columns into view. `role="region"` with a name is what stops it
 * being an unlabelled stop once it is there: without the name a region is
 * announced as nothing at all. The two go together, which is why this is one
 * helper rather than three attributes spelled out at each call site.
 */
export function scrollerRegionProps(
  overflowing: boolean,
  name: string,
): { tabIndex: 0; role: 'region'; 'aria-label': string } | Record<string, never> {
  return overflowing ? { tabIndex: 0, role: 'region', 'aria-label': name } : {}
}
