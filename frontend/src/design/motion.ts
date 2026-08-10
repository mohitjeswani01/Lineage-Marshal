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
  instant: 0.06,
  fast: 0.12,
  normal: 0.2,
  slow: 0.3,
  slower: 0.45,
  ambient: 4.0,
} as const;

export const easing = {
  /** Default for anything that starts and ends on screen. */
  standard: [0.2, 0, 0, 1],
  /** Enters decisively, settles gently. */
  entrance: [0.05, 0.7, 0.1, 1],
  /** Leaves quickly — exits should never make the user wait. */
  exit: [0.3, 0, 0.8, 0.15],
  /** Spring-like but CSS-compatible. */
  springOut: [0.15, 0.6, 0.3, 1],
} as const;

export const spring = {
  /** Snappy, no visible overshoot. Buttons, toggles, dropdowns. */
  snappy: { type: 'spring', stiffness: 500, damping: 35, mass: 0.6 },
  /** Default panel/card motion — a touch of life without bounce. */
  gentle: { type: 'spring', stiffness: 260, damping: 28, mass: 0.85 },
  /** Layout transitions where a small overshoot reads as "physical". */
  bouncy: { type: 'spring', stiffness: 320, damping: 20, mass: 0.75 },
  /** Graph node reveal, edge draw, hop-distance stagger. */
  graph: { type: 'spring', stiffness: 180, damping: 22, mass: 1.0 },
  /** Idle drift, slow pulse — barely perceptible. */
  ambient: { type: 'spring', stiffness: 40, damping: 8, mass: 2.0 },
} as const satisfies Record<string, Transition>;

export const stagger = {
  /** Between siblings in a list/grid reveal. */
  children: 0.05,
  /** Before the first child starts. */
  delay: 0.08,
  /** Between hop-distance bands in graph reveal. */
  hopBand: 0.08,
} as const;

/** Hover/press scale values — consistent physicality across every control. */
export const interaction = {
  hoverScale: 1.012,
  hoverLift: -2,
  pressScale: 0.988,
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
    x: [0, -4, 3, -2, 0],
    transition: { duration: duration.slow, ease: easing.standard },
  },
};

/**
 * Blast-radius reveal — delay is proportional to hop distance, so impacted
 * assets appear in the order the agent actually walked to them rather than
 * all at once. Pass the hop as `custom`.
 */
export const hopReveal: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: (hop = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      ...transition.entrance,
      delay: stagger.delay + hop * stagger.hopBand,
    },
  }),
};