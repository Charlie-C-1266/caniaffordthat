import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gem,
  HelpCircle,
  House,
  KeyRound,
  Landmark,
  Moon,
  Plane,
  ShoppingBag,
  Sun,
  Umbrella,
  X,
  type LucideIcon,
} from 'lucide-react'

// The Lucide icons used across the app, keyed by the kebab-case names stored in
// the goal config (see lib/goals.ts) and referenced by UI chrome. Kept as one
// small registry so components pass a name string rather than importing icon
// components individually.
const ICONS = {
  house: House,
  car: Car,
  plane: Plane,
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
  // Vehicle flow: the four purchase-method cards and the running-costs step.
  banknote: Banknote,
  'key-round': KeyRound,
  'calendar-clock': CalendarClock,
  landmark: Landmark,
  fuel: Fuel,
  // Theme toggle.
  sun: Sun,
  moon: Moon,
} satisfies Record<string, LucideIcon>

/** A registered icon name — a compile error (not a silently blank icon) if a caller or the goal config typos one. */
export type IconName = keyof typeof ICONS

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
