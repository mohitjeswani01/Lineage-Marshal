/**
 * Elevation presets. Shadow colour is theme-aware (near-black in dark, warm
 * cocoa in light) via `--lm-shadow-color`, so a shadow never looks like soot
 * on the sand palette.
 *
 * Four levels only. If something needs a fifth, it probably needs less depth.
 */
export const shadows = {
  none: 'none',
  soft: 'var(--shadow-soft)',
  medium: 'var(--shadow-medium)',
  elevated: 'var(--shadow-elevated)',
  floating: 'var(--shadow-floating)',
} as const;

export type ShadowToken = keyof typeof shadows;

/** Elevation role → level. Keeps z-order legible in the UI, not just in CSS. */
export const elevation = {
  flat: 'none',
  card: 'soft',
  cardHover: 'medium',
  dropdown: 'elevated',
  dialog: 'floating',
  toast: 'floating',
} as const satisfies Record<string, ShadowToken>;
