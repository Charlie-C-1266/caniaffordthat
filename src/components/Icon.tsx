import {
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gem,
  Hammer,
  Heart,
  HelpCircle,
  House,
  Plane,
  ShoppingBag,
  Umbrella,
  X,
  type LucideIcon,
} from 'lucide-react'

// The Lucide icons used across the app, keyed by the kebab-case names stored in
// the goal config (see lib/goals.ts) and referenced by UI chrome. Kept as one
// small registry so components pass a name string rather than importing icon
// components individually.
const ICONS: Record<string, LucideIcon> = {
  house: House,
  car: Car,
  plane: Plane,
  heart: Heart,
  hammer: Hammer,
  gem: Gem,
  umbrella: Umbrella,
  'shopping-bag': ShoppingBag,
  'arrow-right': ArrowRight,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  check: Check,
  'help-circle': HelpCircle,
  x: X,
}

interface IconProps {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
}

/** Renders a named Lucide line icon with the design's default stroke weight. */
export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />
}
