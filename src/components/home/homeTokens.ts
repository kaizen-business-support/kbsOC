/**
 * homeTokens.ts
 *
 * Tokens partagés par tous les composants de la home page.
 * Aucun usage en dehors de src/components/home/ et de la Sidebar (polish).
 */

export const colors = {
  bg: {
    page:    '#F8FAFC',
    surface: '#FFFFFF',
    subtle:  '#F1F5F9',
  },
  accent: {
    primary: '#1F4E79',
    hover:   '#2A5E92',
    muted:   '#E0E9F2',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#475569',
    muted:     '#94A3B8',
  },
  border: {
    default: '#E2E8F0',
  },
} as const;

export const shadows = {
  card:      '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.02)',
  cardHover: '0 6px 16px rgba(15,23,42,0.08)',
} as const;

export const radii = {
  card: 12,
  chip: 999,
} as const;

export const transitions = {
  fast:  '180ms cubic-bezier(0.22,1,0.36,1)',
  enter: '320ms cubic-bezier(0.22,1,0.36,1)',
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
