/**
 * Typography tokens.
 *
 * Each entry is a ready-to-spread Tailwind class string, so a heading is
 * `<h2 className={type.h2}>` and never a pile of ad-hoc size/weight/tracking
 * utilities that slowly diverge across pages.
 */
export const type = {
  display: 'text-3xl sm:text-4xl font-semibold tracking-[-0.02em] leading-[1.1]',
  h1: 'text-2xl sm:text-3xl font-semibold tracking-[-0.02em] leading-[1.15]',
  h2: 'text-xl font-semibold tracking-[-0.01em] leading-[1.25]',
  h3: 'text-base font-semibold tracking-[-0.01em] leading-[1.35]',

  body: 'text-sm leading-[1.6]',
  bodyLg: 'text-base leading-[1.65]',

  label: 'text-xs font-medium tracking-[0.02em]',
  caption: 'text-xs leading-[1.5] text-muted',
  overline: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-muted',

  button: 'text-sm font-medium tracking-[-0.005em]',
  mono: 'font-mono text-xs leading-[1.6]',
  monoSm: 'font-mono text-[11px] leading-[1.5]',
} as const;

export type TypeToken = keyof typeof type;

/** Raw values, for the rare JS consumer that can't take a class name. */
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;
