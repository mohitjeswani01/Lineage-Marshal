/**
 * Graph / lineage-visualisation design tokens.
 *
 * The graph is the one surface that renders outside the DOM, so it cannot use
 * Tailwind utilities. These tokens are its equivalent: every world-unit size,
 * timing and limit the WebGL scene *and* the static SVG fallback read from
 * here, so the two stay visually identical and a tweak lands in one place.
 *
 * Colour deliberately lives elsewhere — see `GRAPH_PALETTE_VARS` below, which
 * points at the same CSS custom properties the rest of the app uses so the
 * graph re-themes with everything else instead of hardcoding a second palette.
 */
import { severityColor } from './colors';

export const graph = {
  node: {
    /** World-unit radius of a downstream node. */
    radius: 0.34,
    /** The triggering asset reads as the origin — noticeably bigger. */
    triggerRadius: 0.5,
    /** Sphere tessellation. 20 stays round at our node budget without waste. */
    segments: 20,
    /** Additive glow sprite size, relative to node radius. */
    haloScale: 3.2,
    /** Ownership-gap ring, relative to node radius. */
    warningRingScale: 1.55,
    /** Nodes referenced by lineage but absent from the catalog. */
    ghostOpacity: 0.34,
  },

  edge: {
    /** Screen-space px (Line2), so edges stay legible at any zoom. */
    width: 1.4,
    widthEmphasis: 2.4,
    /** Bezier lift as a fraction of the span — pure depth perception. */
    curve: 0.3,
    /** Points sampled per curve. 18 is smooth at our curvature. */
    segments: 18,
    baseOpacity: 0.3,
    activeOpacity: 0.95,
    /** Travelling "the walk is here now" packet. */
    pulseRadius: 0.075,
    /** Curve fractions traversed per second. */
    pulseSpeed: 0.55,
  },

  layout: {
    /** World units of radius per hop — hop distance IS radial distance. */
    hopRadius: 1.9,
    /** Downstream sinks as it gets further away; reads as flow direction. */
    hopDrop: 0.34,
    /** Rotates each ring so hop bands never line up into false spokes. */
    ringOffset: 2.399963, // golden angle (rad)
    /** Deterministic vertical scatter so same-ring nodes don't read as a disc. */
    jitter: 0.16,
  },

  camera: {
    fov: 45,
    /** Distance at 1 hop; scaled by the actual hop count at mount. */
    baseDistance: 4.6,
    distancePerHop: 1.9,
    height: 2.4,
    minDistance: 3,
    maxDistance: 26,
  },

  motion: {
    /** Seconds between hop bands during the blast-radius reveal. */
    hopStagger: 0.34,
    /** Seconds for a single node to spring in. */
    nodeReveal: 0.55,
    /** Seconds for an edge to fade to its resting opacity. */
    edgeReveal: 0.4,
    /** OrbitControls autoRotate speed while nothing is running. */
    idleRotate: 0.35,
    /** Faster orbit while the agent is actively walking lineage. */
    activeRotate: 0.9,
    triggerPulseCycle: 2.4,
    warningPulseCycle: 1.2,
    /** Idle "breathing" scale amplitude. */
    breath: 0.025,
  },

  limits: {
    /**
     * Hard render caps. Beyond these the scene degrades gracefully (extra
     * nodes are dropped and the count is surfaced in the HUD) rather than
     * blowing the frame budget on a machine we can't test.
     */
    maxNodes: 60,
    maxEdges: 120,
    /** Above this, drop the per-node glow sprites — they're the expensive bit. */
    haloThreshold: 36,
  },
} as const;

export type GraphTokens = typeof graph;

/**
 * Severity buckets the graph can paint. Derived from the agent's response —
 * see `deriveSeverity` in the graph feature — never authored by hand.
 */
export type GraphSeverity = keyof typeof severityColor;

/**
 * The graph's colours, as CSS custom-property names rather than literals.
 * Read at runtime (`useGraphPalette`) so a theme switch repaints the scene
 * instead of stranding it in dark-mode colours on a light page.
 *
 * The severity entries are derived from `severityColor` rather than restated,
 * so a graph node and a severity Badge can never disagree about what "high"
 * looks like.
 */
export const GRAPH_PALETTE_VARS = {
  critical: `--color-${severityColor.critical}`,
  high: `--color-${severityColor.high}`,
  medium: `--color-${severityColor.medium}`,
  low: `--color-${severityColor.low}`,
  unknown: `--color-${severityColor.unknown}`,
  trigger: '--color-accent',
  edge: '--color-border-strong',
  edgeActive: '--color-accent',
  background: '--color-bg',
  text: '--color-text',
} as const;

export type GraphPaletteKey = keyof typeof GRAPH_PALETTE_VARS;
export type GraphPalette = Record<GraphPaletteKey, string>;

/** Fallback used before the document is measurable (SSR, tests). Dark theme. */
export const GRAPH_PALETTE_FALLBACK: GraphPalette = {
  trigger: '#00d4aa',
  critical: '#ff4d6a',
  high: '#ffb800',
  medium: '#00a8d4',
  low: '#00d48a',
  unknown: '#5a7a8a',
  edge: '#2a3f4f',
  edgeActive: '#00d4aa',
  background: '#0a0e12',
  text: '#e8f0f4',
};
