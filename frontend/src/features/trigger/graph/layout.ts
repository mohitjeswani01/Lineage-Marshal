/**
 * Lineage graph layout — pure, deterministic, renderer-agnostic.
 *
 * Both the WebGL scene and the static SVG fallback consume this, which is the
 * whole point: the reduced-motion view is the same graph with the motion
 * removed, not a different picture.
 *
 * Everything here derives from a real `TriggerResponse`. The agent gives us a
 * flat downstream list with a hop `depth`, so the layout's job is to turn hop
 * distance into geometry: depth → radial distance, plus a deterministic angle
 * so the same response always lays out identically (no `Math.random()` — that
 * would reshuffle the graph on every React re-render).
 */
import { graph, type GraphSeverity } from '@/design';
import type { BlastRadius, LineageNode } from '@/api/contract';
import { urnDisplayName } from '@/lib/urn';

export interface GraphNode {
  urn: string;
  name: string;
  /** Hops from the triggering asset. 0 = the trigger itself. */
  depth: number;
  /** False when lineage references a URN the catalog doesn't have. */
  exists: boolean;
  owners: string[];
  /** An ownership gap — the thing the agent exists to surface. */
  ownerless: boolean;
  isTrigger: boolean;
  severity: GraphSeverity;
  /** World-space position. `y` is up; the graph lays out on the x/z plane. */
  x: number;
  y: number;
  z: number;
  /** Radial angle, kept so the SVG fallback can reuse the same placement. */
  angle: number;
}

export interface GraphEdge {
  id: string;
  source: GraphNode;
  target: GraphNode;
  /** Hop band this edge lands in — drives reveal order and emphasis. */
  depth: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  trigger: GraphNode;
  maxDepth: number;
  /** How many downstream nodes the render caps dropped, for honest HUD copy. */
  droppedNodes: number;
  /** Radius of the outermost ring — used to frame the camera / viewBox. */
  extent: number;
}

/**
 * Stable [0,1) hash of a URN. Gives each node a fixed scatter offset that
 * survives re-renders, so the graph never "twitches" between frames.
 */
function hash01(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Severity for a downstream node, mirroring how the agent scores blast radius:
 * proximity to the break plus ownership gap. Missing assets can't be scored at
 * all, so they read as `unknown` rather than being quietly painted "low".
 */
export function deriveSeverity(node: LineageNode): GraphSeverity {
  if (node.exists === false) return 'unknown';
  if (!node.owners || node.owners.length === 0) return 'high';
  if ((node.depth ?? 1) <= 1) return 'medium';
  return 'low';
}

/** The triggering asset carries the incident's own severity, not a derived one. */
function triggerSeverity(blastRadius?: BlastRadius): GraphSeverity {
  return blastRadius?.level ?? 'critical';
}

export function buildGraphLayout(
  triggerUrn: string,
  triggerName: string | undefined,
  downstream: LineageNode[],
  blastRadius?: BlastRadius,
): GraphLayout {
  const { layout, limits } = graph;

  const trigger: GraphNode = {
    urn: triggerUrn,
    name: triggerName ?? urnDisplayName(triggerUrn),
    depth: 0,
    exists: true,
    owners: [],
    ownerless: false,
    isTrigger: true,
    severity: triggerSeverity(blastRadius),
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
  };

  // Cap before layout so the drop is by arrival order (closest hops first),
  // not an arbitrary slice of the far ring.
  const ordered = [...downstream].sort(
    (a, b) => (a.depth ?? 1) - (b.depth ?? 1),
  );
  const budget = Math.max(0, limits.maxNodes - 1);
  const rendered = ordered.slice(0, budget);
  const droppedNodes = ordered.length - rendered.length;

  const byDepth = new Map<number, LineageNode[]>();
  for (const node of rendered) {
    const depth = Math.max(1, node.depth ?? 1);
    const bucket = byDepth.get(depth);
    if (bucket) bucket.push(node);
    else byDepth.set(depth, [node]);
  }

  const nodes: GraphNode[] = [trigger];
  const byDepthLaid = new Map<number, GraphNode[]>([[0, [trigger]]]);
  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  for (const depth of depths) {
    const ring = byDepth.get(depth)!;
    const radius = depth * layout.hopRadius;
    const step = (Math.PI * 2) / ring.length;
    // Each ring is rotated by the golden angle so hop bands never align into
    // spokes that read as lineage paths they aren't.
    const offset = depth * layout.ringOffset;
    const laid: GraphNode[] = [];

    ring.forEach((node, i) => {
      const angle = offset + i * step;
      const scatter = (hash01(node.urn) - 0.5) * 2;

      laid.push({
        urn: node.urn,
        name: node.name ?? urnDisplayName(node.urn),
        depth,
        exists: node.exists !== false,
        owners: node.owners ?? [],
        ownerless: !node.owners || node.owners.length === 0,
        isTrigger: false,
        severity: deriveSeverity(node),
        x: Math.cos(angle) * radius,
        y: -depth * layout.hopDrop + scatter * layout.jitter,
        z: Math.sin(angle) * radius,
        angle,
      });
    });

    byDepthLaid.set(depth, laid);
    nodes.push(...laid);
  }

  // The contract gives depth but not parentage, so each node attaches to the
  // angularly nearest node one hop closer. That's a presentational inference,
  // and it is the only one this file makes.
  const edges: GraphEdge[] = [];
  for (const depth of depths) {
    const parents = byDepthLaid.get(depth - 1);
    if (!parents || parents.length === 0) continue;

    for (const node of byDepthLaid.get(depth)!) {
      if (edges.length >= graph.limits.maxEdges) break;
      const parent = nearestByAngle(parents, node.angle);
      edges.push({
        id: `${parent.urn}→${node.urn}`,
        source: parent,
        target: node,
        depth,
      });
    }
  }

  const maxDepth = depths.length > 0 ? depths[depths.length - 1]! : 0;

  return {
    nodes,
    edges,
    trigger,
    maxDepth,
    droppedNodes,
    extent: Math.max(layout.hopRadius, maxDepth * layout.hopRadius),
  };
}

/** Depth 0 has a single node at the origin, where angle is meaningless. */
function nearestByAngle(candidates: GraphNode[], angle: number): GraphNode {
  let best = candidates[0]!;
  let bestDelta = Infinity;
  for (const candidate of candidates) {
    const raw = Math.abs(candidate.angle - angle) % (Math.PI * 2);
    const delta = Math.min(raw, Math.PI * 2 - raw);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = candidate;
    }
  }
  return best;
}

/**
 * Total seconds the hop-by-hop reveal takes. The camera framing and the HUD
 * both need this, so it lives beside the layout rather than in the scene.
 */
export function revealDuration(maxDepth: number): number {
  return maxDepth * graph.motion.hopStagger + graph.motion.nodeReveal;
}
