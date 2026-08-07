import type { Transition, Variants } from 'framer-motion';

/**
 * Motion tokens. Every animation in the app pulls its timing from here — no
 * component declares a raw duration, easing curve or spring.
 *
 * Rule of thumb encoded below: the bigger the moving element, the slower it
 * moves; anything the user initiated (press, hover) is `fast` so it feels
 * attached to the finger.
 */
export const duration = {
  instant: 0.08,
  fast: 0.14,
  normal: 0.22,
  slow: 0.34,
  slower: 0.5,
} as const;

export const easing = {
  /** Default for anything that starts and ends on screen. */
  standard: [0.2, 0, 0, 1],
  /** Enters decisively, settles gently. */
  entrance: [0.05, 0.7, 0.1, 1],
  /** Leaves quickly — exits should never make the user wait. */
  exit: [0.3, 0, 0.8, 0.15],
} as const;

export const spring = {
  /** Snappy, no visible overshoot. Buttons, toggles, dropdowns. */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 },
  /** Default panel/card motion — a touch of life without bounce. */
  gentle: { type: 'spring', stiffness: 280, damping: 30, mass: 0.9 },
  /** Layout transitions where a small overshoot reads as "physical". */
  bouncy: { type: 'spring', stiffness: 340, damping: 22, mass: 0.8 },
} as const satisfies Record<string, Transition>;

export const stagger = {
  /** Between siblings in a list/grid reveal. */
  children: 0.045,
  /** Before the first child starts. */
  delay: 0.06,
} as const;

/** Hover/press scale values — consistent physicality across every control. */
export const interaction = {
  hoverScale: 1.015,
  hoverLift: -2,
  pressScale: 0.985,
} as const;

export const transition = {
  fast: { duration: duration.fast, ease: easing.standard },
  normal: { duration: duration.normal, ease: easing.standard },
  slow: { duration: duration.slow, ease: easing.standard },
  entrance: { duration: duration.normal, ease: easing.entrance },
  exit: { duration: duration.fast, ease: easing.exit },
} as const satisfies Record<string, Transition>;

/* --------------------------------------------------------------------------
 * Shared variants — import these instead of writing inline objects, so a
 * tweak to "how things enter" happens in one place.
 * ----------------------------------------------------------------------- */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.entrance },
  exit: { opacity: 0, y: -4, transition: transition.exit },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.normal },
  exit: { opacity: 0, transition: transition.exit },
};

/** Parent of a staggered list. Children should use `fadeInUp`. */
export const staggerList: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger.children,
      delayChildren: stagger.delay,
    },
  },
};

/** Dropdown / popover — grows from its trigger edge. */
export const popover: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring.snappy },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: transition.exit },
};

/** Error feedback — a short, low-amplitude shake. Never more than one cycle. */
export const shake: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -5, 4, -3, 2, 0],
    transition: { duration: duration.slow, ease: easing.standard },
  },
};
