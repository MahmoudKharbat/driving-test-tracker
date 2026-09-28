/**
 * Shared visual tokens. Kept deliberately small — this app is four screens and a
 * form; a full design system would be more scaffolding than product.
 */

export const colors = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',

  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',

  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryFaint: '#EFF6FF',

  pass: '#16A34A',
  passFaint: '#F0FDF4',
  fail: '#DC2626',
  failFaint: '#FEF2F2',

  warnFaint: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnText: '#92400E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;
