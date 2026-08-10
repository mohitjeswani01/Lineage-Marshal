/**
 * Corner radius scale. Nested surfaces step down one level so inner and outer
 * curves stay concentric (a card at `lg` holds inputs at `md`).
 */
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  '2xl': '24px',
  full: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;

/**
 * Which radius a given surface role uses. Encoded so components don't each
 * make their own call and drift apart.
 */
export const radiusFor = {
  badge: 'full',
  button: 'md',
  input: 'md',
  card: 'lg',
  panel: 'xl',
  dialog: '2xl',
  toast: 'lg',
} as const satisfies Record<string, RadiusToken>;
