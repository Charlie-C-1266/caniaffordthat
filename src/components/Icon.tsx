import { ICONS, type IconName } from './iconRegistry'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}

/** Renders a named Lucide line icon with the design's default stroke weight. */
export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  const Glyph = ICONS[name]
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />
}
