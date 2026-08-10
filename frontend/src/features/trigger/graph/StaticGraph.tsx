/**
 * Reduced-motion / no-WebGL lineage graph.
 *
 * Same layout, same colour language, same information — projected flat and
 * held still. This is a first-class view, not a degraded one: it's also the
 * keyboard-navigable version, since a WebGL canvas has no focusable children.
 */
import { useId } from 'react';
import { graph } from '@/design';
import type { GraphLayout, GraphNode } from './layout';

const SEVERITY_FILL: Record<GraphNode['severity'], string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-info)',
  low: 'var(--color-success)',
  unknown: 'var(--color-muted)',
};

/** World units → SVG units. The layout is authored in world space. */
const SCALE = 44;

interface StaticGraphProps {
  layout: GraphLayout;
  onSelect?: (node: GraphNode | null) => void;
  selectedUrn?: string;
}

export function StaticGraph({ layout, onSelect, selectedUrn }: StaticGraphProps) {
  const glowId = useId();
  const pad = graph.node.radius * SCALE * 4;
  const half = layout.extent * SCALE + pad;

  return (
    <svg
      viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}
      className="size-full"
      role="group"
      aria-label={`Lineage graph: ${layout.nodes.length} assets across ${layout.maxDepth} hops from ${layout.trigger.name}`}
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Hop rings — hop distance stays readable without any motion. */}
      {Array.from({ length: layout.maxDepth }, (_, i) => i + 1).map((depth) => (
        <circle
          key={depth}
          cx={0}
          cy={0}
          r={depth * graph.layout.hopRadius * SCALE}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 6"
          opacity={0.5}
        />
      ))}

      {layout.edges.map((edge) => (
        <line
          key={edge.id}
          x1={edge.source.x * SCALE}
          y1={edge.source.z * SCALE}
          x2={edge.target.x * SCALE}
          y2={edge.target.z * SCALE}
          stroke={
            edge.depth <= 1 ? 'var(--color-accent)' : 'var(--color-border-strong)'
          }
          strokeWidth={edge.depth <= 1 ? graph.edge.widthEmphasis : graph.edge.width}
          opacity={edge.depth <= 1 ? 0.7 : 0.45}
        />
      ))}

      <circle
        cx={0}
        cy={0}
        r={graph.node.triggerRadius * SCALE * 3}
        fill={`url(#${glowId})`}
      />

      {layout.nodes.map((node) => (
        <StaticNode
          key={node.urn}
          node={node}
          selected={node.urn === selectedUrn}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

function StaticNode({
  node,
  selected,
  onSelect,
}: {
  node: GraphNode;
  selected: boolean;
  onSelect?: (node: GraphNode | null) => void;
}) {
  const r = (node.isTrigger ? graph.node.triggerRadius : graph.node.radius) * SCALE;
  const cx = node.x * SCALE;
  const cy = node.z * SCALE;

  const label = [
    node.name,
    node.isTrigger ? 'triggering asset' : `hop ${node.depth}`,
    !node.exists ? 'not in catalog' : node.ownerless ? 'no owner' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={label}
      className="cursor-pointer outline-none focus-visible:opacity-100"
      onFocus={() => onSelect?.(node)}
      onBlur={() => onSelect?.(null)}
      onMouseEnter={() => onSelect?.(node)}
      onMouseLeave={() => onSelect?.(null)}
    >
      <title>{label}</title>

      {/* Ownership gap gets a ring, not just a hue — colour alone can't carry it. */}
      {node.ownerless && !node.isTrigger && node.exists && (
        <circle
          cx={cx}
          cy={cy}
          r={r * graph.node.warningRingScale}
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth={2}
          opacity={0.8}
        />
      )}

      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={node.isTrigger ? 'var(--color-accent)' : SEVERITY_FILL[node.severity]}
        fillOpacity={node.exists ? 1 : graph.node.ghostOpacity}
        stroke={node.isTrigger ? 'var(--color-accent)' : 'var(--color-bg)'}
        strokeWidth={node.isTrigger ? 3 : 1.5}
        strokeDasharray={node.exists ? undefined : '3 3'}
      />

      {(selected || node.isTrigger) && (
        <text
          x={cx}
          y={cy - r - 6}
          textAnchor="middle"
          className="fill-text-secondary font-mono"
          style={{ fontSize: 11 }}
        >
          {node.name.length > 22 ? `${node.name.slice(0, 21)}…` : node.name}
        </text>
      )}
    </g>
  );
}
