import { colors, statusColor } from './colors';
import { spacing, layout } from './spacing';
import { radius, radiusFor } from './radius';
import { shadows, elevation } from './shadows';
import { type as typography, fontSize, fontWeight } from './typography';
import {
  duration,
  easing,
  spring,
  stagger,
  interaction,
  transition,
} from './motion';

/**
 * The single design-token object. Components should import the focused module
 * they need (`import { spring } from '@/design'`); this aggregate exists for
 * documentation, dev tooling, and anywhere a whole theme must be passed around.
 *
 * Colour tokens resolve through CSS custom properties, so `theme.colors.surface`
 * is correct in both themes without a re-render.
 */
export const theme = {
  colors,
  status: statusColor,
  spacing,
  layout,
  radius,
  radiusFor,
  shadows,
  elevation,
  typography,
  fontSize,
  fontWeight,
  motion: { duration, easing, spring, stagger, interaction, transition },
} as const;

export type Theme = typeof theme;

/** The two supported themes. Persisted under `lm.theme` in localStorage. */
export const THEMES = ['dark', 'light'] as const;
export type ThemeName = (typeof THEMES)[number];
