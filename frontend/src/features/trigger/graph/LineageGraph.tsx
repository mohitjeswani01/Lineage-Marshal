/**
 * Lineage + blast-radius visualisation — the hero surface of the workspace.
 *
 * Renders whatever the agent actually returned: the triggering asset at the
 * origin, downstream assets placed by hop distance, ownership gaps ringed.
 * There is no mock path — with no trigger data it says so and renders nothing.
 *
 * Three renderers, one layout (`buildGraphLayout`):
 *   · WebGL       — default
 *   · Static SVG  — reduced motion, or no WebGL, or the user pinned it
 *   · Empty state — no trigger yet
 */
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Boxes, FlaskConical, Layers, Orbit, Radio, Square } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { transition, type as t } from '@/design';
import type { BlastRadius, LineageNode } from '@/api/contract';
import { buildGraphLayout, type GraphNode } from './layout';
import { supportsWebGL, useGraphPalette } from './palette';
import { StaticGraph } from './StaticGraph';
import type { GraphPhase } from './GraphScene';

const GraphScene = lazy(() => import('./GraphScene'));

export interface LineageGraphProps {
  /** The triggering asset. Absent until a trigger has been fired. */
  triggerUrn?: string;
  triggerName?: string;
  downstream?: LineageNode[];
  blastRadius?: BlastRadius;
  phase: GraphPhase;
  /** Identity of the current run. A change replays the hop-by-hop reveal. */
  revealKey?: string;
  /**
   * Marks the plotted data as illustrative, not a real investigation. Renders
   * a permanent chip on the graph — sample data must never be able to pass for
   * agent output just because a caller forgot to label it.
   */
  sample?: boolean;
  className?: string;
}

export function LineageGraph({
  triggerUrn,
  triggerName,
  downstream,
  blastRadius,
  phase,
  revealKey,
  sample,
  className,
}: LineageGraphProps) {
  const reduced = useReducedMotion() ?? false;
  const palette = useGraphPalette();
  const container = useRef<HTMLDivElement>(null);

  // The user can pin the flat view even without a reduced-motion preference —
  // it's the faster, more readable one on a busy graph.
  const [pinnedStatic, setPinnedStatic] = useState(false);
  const [focused, setFocused] = useState<GraphNode | null>(null);

  const active = useVisible(container);

  const layout = useMemo(
    () =>
      triggerUrn
        ? buildGraphLayout(triggerUrn, triggerName, downstream ?? [], blastRadius)
        : undefined,
    [triggerUrn, triggerName, downstream, blastRadius],
  );

  const canUseWebGL = supportsWebGL();
  const useStatic = pinnedStatic || reduced || !canUseWebGL;

  // The container renders in every state, empty included, so the visibility
  // observer attaches once and is already live when the first trigger lands.
  return (
    <div ref={container} className={cn('relative size-full overflow-hidden', className)}>
      {!layout ? (
        <div className="flex size-full items-center justify-center">
          <EmptyState
            icon={<Radio className="size-5" />}
            title="No lineage to plot yet"
            description="Fire a trigger and the agent's downstream walk lands here — one ring per hop, ownership gaps flagged on the node."
          />
        </div>
      ) : useStatic ? (
        <div className="size-full p-4">
          <StaticGraph
            layout={layout}
            selectedUrn={focused?.urn}
            onSelect={setFocused}
          />
        </div>
      ) : (
        <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
          <GraphScene
            layout={layout}
            palette={palette}
            phase={phase}
            revealKey={revealKey ?? triggerUrn ?? ''}
            reduced={reduced}
            active={active}
          />
        </Suspense>
      )}

      {/* --- HUD ------------------------------------------------------- */}
      {layout && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition.entrance}
            className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="glass flex items-center gap-3 rounded-md border border-glass-border px-2.5 py-1.5">
                <Stat
                  icon={<Boxes className="size-3" />}
                  value={layout.nodes.length}
                  label="assets"
                />
                <span className="h-3 w-px bg-border" />
                <Stat
                  icon={<Layers className="size-3" />}
                  value={layout.maxDepth}
                  label="hops"
                />
              </div>

              {sample && (
                <span className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[10px] font-medium text-warning">
                  <FlaskConical aria-hidden className="size-3" />
                  Sample data — not a real investigation
                </span>
              )}
            </div>

            {canUseWebGL && !reduced && (
              <button
                type="button"
                onClick={() => setPinnedStatic((v) => !v)}
                aria-pressed={pinnedStatic}
                className="glass pointer-events-auto flex items-center gap-1.5 rounded-md border border-glass-border px-2 py-1.5 text-[10px] text-text-secondary transition-colors duration-200 ease-standard hover:text-text"
              >
                {pinnedStatic ? (
                  <Orbit aria-hidden className="size-3" />
                ) : (
                  <Square aria-hidden className="size-3" />
                )}
                {pinnedStatic ? '3D view' : 'Flat view'}
              </button>
            )}
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              <LegendChip color="bg-accent" label="Origin" />
              <LegendChip color="bg-warning" label="No owner" />
              <LegendChip color="bg-info" label="1 hop" />
              <LegendChip color="bg-success" label="2+ hops" />
              <LegendChip color="bg-muted" label="Not in catalog" />
            </div>

            {/* Never let a render cap masquerade as complete coverage. */}
            {layout.droppedNodes > 0 && (
              <p className="glass rounded-md border border-glass-border px-2 py-1 text-[10px] text-muted">
                +{layout.droppedNodes} further assets not plotted
              </p>
            )}
          </div>

          {/* The canvas has no focusable children — this is the graph's real
              accessible representation, and it stays in sync by construction. */}
          <ul className="sr-only">
            {sample && (
              <li>
                Sample data for illustration. This is not a real investigation.
              </li>
            )}
            <li>
              Triggering asset: {layout.trigger.name}, {layout.nodes.length - 1}{' '}
              downstream assets across {layout.maxDepth} hops.
            </li>
            {layout.nodes
              .filter((node) => !node.isTrigger)
              .map((node) => (
                <li key={node.urn}>
                  {node.name}, hop {node.depth},{' '}
                  {!node.exists
                    ? 'referenced by lineage but not in the catalog'
                    : node.ownerless
                      ? 'no owner assigned'
                      : `${node.owners.length} owner${node.owners.length === 1 ? '' : 's'}`}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-text-secondary">
      <span aria-hidden className="text-accent">
        {icon}
      </span>
      <strong className="font-mono text-text">{value}</strong>
      <span className={t.overline}>{label}</span>
    </span>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="glass flex items-center gap-1.5 rounded-full border border-glass-border px-2 py-1 text-[10px] text-text-secondary">
      <span aria-hidden className={cn('size-1.5 rounded-full', color)} />
      {label}
    </span>
  );
}

/**
 * True only while the graph is on screen *and* the tab is foregrounded.
 * A 60fps WebGL loop running behind another tab is pure battery drain.
 */
function useVisible(ref: React.RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  const onVisibility = useCallback(() => setTabVisible(!document.hidden), []);

  useEffect(() => {
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [onVisibility]);

  return onScreen && tabVisible;
}

export default LineageGraph;
