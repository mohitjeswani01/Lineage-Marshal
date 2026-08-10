import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Braces,
  FileText,
  Radio,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { CopyButton } from '@/components/ui/CopyButton';
import type { BlastRadius, LineageNode, TriggerResponse } from '@/api/contract';
import type { ApiError } from '@/api/client';
import { urnDisplayName } from '@/lib/urn';
import { formatDuration } from '@/lib/format';
import {
  fadeInUp,
  spring,
  staggerList,
  transition,
  type as t,
} from '@/design';

const LEVEL_TONE: Record<string, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

interface ResponsePanelProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  response?: TriggerResponse;
  error?: ApiError;
  elapsedMs?: number;
}

/**
 * Renders the agent's trigger response.
 *
 * Tolerant by design: every analysis field is optional, so a partially
 * implemented agent renders what it produced instead of blank space, and the
 * raw view always shows the full payload — nothing the backend returns is
 * hidden from the operator.
 */
export function ResponsePanel({
  status,
  response,
  error,
  elapsedMs,
}: ResponsePanelProps) {
  const [view, setView] = useState<'summary' | 'raw'>('summary');

  return (
    <Card padding="none" className="flex h-full min-h-96 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <CardHeader
          icon={<Terminal className="size-4" />}
          title="Agent response"
          description={
            response?.triggerId
              ? `Trigger ${response.triggerId}`
              : 'Lineage, ownership and blast radius'
          }
        />
        {response && (
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface-elevated p-0.5">
            {(['summary', 'raw'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  'relative rounded px-2.5 py-1 text-[11px] capitalize transition-colors',
                  view === v ? 'text-text' : 'text-muted hover:text-text-secondary',
                )}
              >
                {view === v && (
                  <motion.span
                    layoutId="response-view"
                    transition={spring.snappy}
                    className="absolute inset-0 rounded bg-accent-subtle"
                  />
                )}
                <span className="relative flex items-center gap-1">
                  {v === 'raw' ? (
                    <Braces aria-hidden className="size-3" />
                  ) : (
                    <FileText aria-hidden className="size-3" />
                  )}
                  {v}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'idle' && (
            <motion.div key="idle" {...panelMotion}>
              <EmptyState
                icon={<Radio className="size-5" />}
                title="No trigger fired yet"
                description="Pick an asset and fire a trigger — the agent's lineage walk, ownership lookup and blast-radius score land here."
              />
            </motion.div>
          )}

          {status === 'loading' && (
            <motion.div key="loading" {...panelMotion} className="p-4">
              <RunningState elapsedMs={elapsedMs} />
            </motion.div>
          )}

          {status === 'error' && error && (
            <motion.div key="error" {...panelMotion}>
              <EmptyState
                tone="error"
                icon={<ShieldAlert className="size-5" />}
                title="Trigger failed"
                description={error.userMessage}
              />
            </motion.div>
          )}

          {status === 'success' && response && (
            <motion.div key={`ok-${view}`} {...panelMotion} className="p-4">
              {view === 'summary' ? (
                <Summary response={response} elapsedMs={elapsedMs} />
              ) : (
                <RawJson response={response} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

const panelMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: transition.entrance },
  exit: { opacity: 0, y: -4, transition: transition.exit },
} as const;

/** Indeterminate progress — the agent doesn't stream stage events (yet). */
function RunningState({ elapsedMs }: { elapsedMs?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <motion.span
          aria-hidden
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="size-2 rounded-full bg-accent"
        />
        Agent is walking lineage and resolving owners
        {elapsedMs !== undefined && (
          <span className="ml-auto font-mono text-muted">
            {formatDuration(elapsedMs)}
          </span>
        )}
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function Summary({
  response,
  elapsedMs,
}: {
  response: TriggerResponse;
  elapsedMs?: number;
}) {
  const {
    brief,
    blastRadius,
    upstream = [],
    downstream = [],
    owners = [],
    warnings = [],
    status,
    durationMs,
  } = response;

  const took = durationMs ?? elapsedMs;

  return (
    <motion.div
      variants={staggerList}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={fadeInUp} className="flex items-center gap-2">
        <SuccessMark />
        <Badge tone={status === 'failed' ? 'danger' : 'success'}>
          {status}
        </Badge>
        {took !== undefined && (
          <span className="font-mono text-[11px] text-muted">
            {formatDuration(took)}
          </span>
        )}
        {owners.length === 0 && (
          <Badge tone="warning" icon={<UserX aria-hidden className="size-3" />}>
            no owner to notify
          </Badge>
        )}
      </motion.div>

      {brief && (
        <motion.div
          variants={fadeInUp}
          className="rounded-lg border border-border bg-surface-elevated p-3"
        >
          <p className={cn(t.overline, 'mb-1.5')}>Brief</p>
          <p className={cn(t.body, 'whitespace-pre-wrap text-text-secondary')}>
            {brief}
          </p>
        </motion.div>
      )}

      {blastRadius && (
        <motion.div variants={fadeInUp}>
          <BlastRadiusCard blastRadius={blastRadius} />
        </motion.div>
      )}

      {warnings.length > 0 && (
        <motion.ul variants={fadeInUp} className="space-y-1.5">
          {warnings.map((warning, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning/8 p-2.5 text-[11px] leading-relaxed text-text-secondary"
            >
              <TriangleAlert
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-warning"
              />
              {warning}
            </li>
          ))}
        </motion.ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <LineageList
            title="Upstream"
            icon={<ArrowUpRight aria-hidden className="size-3.5" />}
            nodes={upstream}
            emptyLabel="No upstream returned"
          />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <LineageList
            title="Downstream"
            icon={<ArrowDownRight aria-hidden className="size-3.5" />}
            nodes={downstream}
            emptyLabel="No downstream returned"
          />
        </motion.div>
      </div>

      {owners.length > 0 && (
        <motion.div variants={fadeInUp}>
          <p className={cn(t.overline, 'mb-1.5')}>Owners</p>
          <div className="flex flex-wrap gap-1.5">
            {owners.map((owner) => (
              <Badge key={owner} tone="accent">
                {owner.split(':').pop()}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function BlastRadiusCard({ blastRadius }: { blastRadius: BlastRadius }) {
  const { score, level, downstreamCount, ownerlessCount, rationale } = blastRadius;
  const pct = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between gap-2">
        <p className={t.overline}>Blast radius</p>
        {level && <Badge tone={LEVEL_TONE[level] ?? 'neutral'}>{level}</Badge>}
      </div>

      {pct !== undefined && (
        <div className="mt-2">
          <div
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Blast radius score"
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ...spring.gentle, delay: 0.1 }}
              className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent"
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted">{pct}/100</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        {downstreamCount !== undefined && (
          <span>
            <strong className="text-text">{downstreamCount}</strong> downstream
          </span>
        )}
        {ownerlessCount !== undefined && (
          <span>
            <strong className="text-text">{ownerlessCount}</strong> without owner
          </span>
        )}
      </div>

      {rationale && (
        <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
          {rationale}
        </p>
      )}
    </div>
  );
}

function LineageList({
  title,
  icon,
  nodes,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  nodes: LineageNode[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className={cn(t.overline, 'mb-2 flex items-center gap-1.5')}>
        {icon}
        {title}
        <span className="ml-auto font-mono normal-case">{nodes.length}</span>
      </p>

      {nodes.length === 0 ? (
        <p className="text-[11px] text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {nodes.map((node) => (
            <li
              key={node.urn}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px]"
            >
              <span className="truncate font-mono text-text-secondary">
                {node.name ?? urnDisplayName(node.urn)}
              </span>
              {node.depth !== undefined && (
                <span className="shrink-0 text-muted">·{node.depth}</span>
              )}
              {node.exists === false && (
                <Badge tone="danger" className="ml-auto shrink-0">
                  missing
                </Badge>
              )}
              {node.exists !== false && node.owners?.length === 0 && (
                <Badge tone="warning" className="ml-auto shrink-0">
                  no owner
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RawJson({ response }: { response: TriggerResponse }) {
  const json = JSON.stringify(response, null, 2);
  return (
    <div className="relative">
      <CopyButton
        value={json}
        label="Copy JSON"
        className="absolute top-1 right-1 z-10 bg-surface-elevated"
      />
      <pre className="overflow-x-auto rounded-lg border border-border bg-bg-subtle p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
        {json}
      </pre>
    </div>
  );
}

/** Hand-drawn check — the one moment of celebration in the app. */
function SuccessMark() {
  const reduced = useReducedMotion();
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-success"
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, transition: spring.bouncy }}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <motion.path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.08 }}
      />
    </motion.svg>
  );
}
