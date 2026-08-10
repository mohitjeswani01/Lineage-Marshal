/**
 * Semantic colour tokens.
 *
 * Values are CSS `var()` references, not hex — the literal palette lives in
 * `src/index.css` and switches with `[data-theme]`. That means a token read
 * here is automatically theme-correct, and there is exactly one place to
 * change a colour.
 *
 * Prefer the Tailwind utility (`bg-surface`) in JSX. Use these only where a
 * value must be passed to JS: Framer Motion `animate`, canvas, inline SVG fill.
 */
export const colors = {
  bg: 'var(--color-bg)',
  bgSubtle: 'var(--color-bg-subtle)',
  surface: 'var(--color-surface)',
  surfaceElevated: 'var(--color-surface-elevated)',
  card: 'var(--color-card)',

  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  accentDeep: 'var(--color-accent-deep)',
  accentSubtle: 'var(--color-accent-subtle)',
  onAccent: 'var(--color-on-accent)',

  border: 'var(--color-border)',
  borderStrong: 'var(--color-border-strong)',

  text: 'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  muted: 'var(--color-muted)',

  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',

  focus: 'var(--color-focus)',
  overlay: 'var(--color-overlay)',
  glass: 'var(--color-glass)',
  glassBorder: 'var(--color-glass-border)',
} as const;

export type ColorToken = keyof typeof colors;

/** Semantic status → colour token. Used by Badge, StatusDot, and the response panel. */
export const statusColor = {
  idle: 'muted',
  pending: 'info',
  running: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
} as const satisfies Record<string, ColorToken>;

export type StatusTone = keyof typeof statusColor;

/**
 * Blast radius severity → colour token. Used by Badge, the timeline, and the
 * lineage graph — `design/graph.ts` derives the graph's CSS variable names
 * from this, so severity has exactly one colour mapping in the whole app.
 */
export const severityColor = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
  unknown: 'muted',
} as const satisfies Record<string, ColorToken>;