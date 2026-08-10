/**
 * Spacing scale — a strict 4pt grid. No value outside this set may be used.
 *
 * In JSX prefer Tailwind's numeric scale, which is the same grid
 * (`p-4` === 16px === spacing.lg). These aliases exist for JS consumers and to
 * give the steps names in review conversations.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export type SpacingToken = keyof typeof spacing;

/** px value → css length. `space('xl') === '24px'` */
export const space = (token: SpacingToken): string => `${spacing[token]}px`;

/** Layout constants that are structural, not decorative. */
export const layout = {
  sidebarWidth: 264,
  sidebarCollapsedWidth: 72,
  topBarHeight: 60,
  contentMaxWidth: 1440,
} as const;
