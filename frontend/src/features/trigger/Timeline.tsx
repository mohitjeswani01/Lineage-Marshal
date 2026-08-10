/**
 * Live investigation timeline: detect → investigate → resolve_owner → notify
 * → write_back.
 *
 * Every state here comes from `useTriggerProgress` polling the real agent —
 * there is no simulated advance. If the backend stalls on `investigate`, this
 * sits on `investigate`, which is exactly what an on-call engineer needs to
 * see. The animation's only job is to make the current position obvious at a
 * glance from across the room.
 */
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  Database,
  Loader2,
  Search,
  UserCheck,
  Waypoints,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { PipelineProgress, PipelineStep, StepDetail } from '@/api/contract';
import { PIPELINE_STEPS } from '@/api/contract';
import { duration, easing, spring, stagger, transition, type as t } from '@/design';
import { formatDuration } from '@/lib/format';
import { getStepStatus } from '@/hooks/useTriggerProgress';

type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

const STEP_CONFIG: Record<
  PipelineStep,
  { label: string; description: string; icon: typeof Search }
> = {
  detect: {
    label: 'Detect',
    description: 'Classify the incident and confirm the affected asset',
    icon: Search,
  },
  investigate: {
    label: 'Investigate',
    description: 'Walk DataHub lineage and score blast radius per hop',
    icon: Waypoints,
  },
  resolve_owner: {
    label: 'Resolve owner',
    description: 'Resolve owners and flag assets that have none',
    icon: UserCheck,
  },
  notify: {
    label: 'Notify',
    description: 'Alert the resolved owners on their configured channel',
    icon: Bell,
  },
  write_back: {
    label: 'Write back',
    description: 'Persist a versioned report to DataHub',
    icon: Database,
  },
};

interface TimelineProps {
  progress: PipelineProgress | null;
  triggerId?: string;
  /** Whether the agent is still being polled — true before the first payload. */
  polling?: boolean;
  className?: string;
}

export function Timeline({
  progress,
  triggerId,
  polling,
  className,
}: TimelineProps) {
  const reduced = useReducedMotion() ?? false;

  const isComplete = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';
  // Before the first poll lands there is no progress payload, but the agent is
  // very much running — say so rather than showing an inert list.
  const isRunning = progress?.status === 'running' || (!!polling && !progress);

  const completed = progress?.completedSteps.length ?? 0;
  const percent = Math.round((completed / PIPELINE_STEPS.length) * 100);

  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Loader2
              aria-hidden
              className={cn(
                'size-4 shrink-0',
                isRunning && !reduced && 'animate-spin',
                isRunning ? 'text-accent' : isFailed ? 'text-danger' : 'text-success',
              )}
            />
            <h2 className={t.h3}>Investigation timeline</h2>
          </div>
          {triggerId && (
            <Badge tone="neutral" className="shrink-0 font-mono text-[10px]">
              {triggerId.slice(0, 8)}
            </Badge>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className={t.overline}>
              {completed} of {PIPELINE_STEPS.length} steps
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isFailed ? 'text-danger' : isComplete ? 'text-success' : 'text-accent',
              )}
            >
              {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Investigation progress"
            className="h-1.5 overflow-hidden rounded-full bg-border"
          >
            <motion.div
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={reduced ? { duration: 0 } : spring.gentle}
              className={cn(
                'h-full rounded-full',
                isFailed
                  ? 'bg-danger'
                  : 'glow bg-gradient-to-r from-accent-deep to-accent',
              )}
            />
          </div>
        </div>

        {progress && (
          <p className="mt-2 text-[11px] text-muted" aria-live="polite">
            <span
              className={cn(
                'font-medium',
                isComplete && 'text-success',
                isFailed && 'text-danger',
                isRunning && 'text-accent',
              )}
            >
              {isRunning
                ? `Running · ${STEP_CONFIG[progress.currentStep].label}`
                : progress.status}
            </span>
            <span className="ml-2">
              updated {new Date(progress.updatedAt).toLocaleTimeString()}
            </span>
          </p>
        )}
      </div>

      <div className="relative p-4">
        {/* Rail. Sits at the indicator centre: 16px padding + 16px half-width. */}
        <div className="absolute top-6 bottom-6 left-8 w-px bg-border" aria-hidden>
          <motion.div
            initial={reduced ? false : { scaleY: 0 }}
            animate={{ scaleY: completed / PIPELINE_STEPS.length }}
            transition={reduced ? { duration: 0 } : spring.gentle}
            style={{ transformOrigin: 'top center' }}
            className={cn(
              'size-full',
              isFailed
                ? 'bg-danger'
                : 'bg-gradient-to-b from-accent to-accent-hover',
            )}
          />
        </div>

        <ol className="relative space-y-1" aria-label="Agent investigation steps">
          {PIPELINE_STEPS.map((step, index) => (
            <TimelineStepItem
              key={step}
              step={step}
              index={index}
              status={getStepStatus(progress, step)}
              detail={progress?.stepDetails?.[step]}
              reduced={reduced}
            />
          ))}
        </ol>

        {progress?.failedStep && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.entrance}
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-danger/25 bg-danger/8 p-3"
          >
            <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-danger">
                Failed at {STEP_CONFIG[progress.failedStep].label}
              </p>
              {progress.error && (
                <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                  {progress.error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}

function TimelineStepItem({
  step,
  index,
  status,
  detail,
  reduced,
}: {
  step: PipelineStep;
  index: number;
  status: StepStatus;
  detail?: StepDetail;
  reduced: boolean;
}) {
  const config = STEP_CONFIG[step];
  const isPending = status === 'pending';

  const elapsed =
    detail?.startedAt && detail?.completedAt
      ? Date.parse(detail.completedAt) - Date.parse(detail.startedAt)
      : undefined;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { ...transition.entrance, delay: stagger.delay + index * stagger.children }
      }
      className="relative flex gap-3"
    >
      <StepIndicator status={status} icon={config.icon} reduced={reduced} />

      <div className="min-w-0 flex-1 pt-1 pb-3">
        <div className="flex flex-wrap items-center gap-x-2">
          <span
            className={cn(
              'text-sm font-medium transition-colors duration-200 ease-standard',
              status === 'completed' && 'text-text',
              status === 'running' && 'text-accent',
              status === 'failed' && 'text-danger',
              isPending && 'text-muted',
            )}
          >
            {config.label}
          </span>
          {elapsed !== undefined && (
            <span className="font-mono text-[10px] text-muted">
              {formatDuration(elapsed)}
            </span>
          )}
        </div>

        <p
          className={cn(
            'mt-0.5 text-[11px] leading-relaxed transition-opacity duration-200 ease-standard',
            isPending ? 'text-muted opacity-60' : 'text-text-secondary',
          )}
        >
          {config.description}
        </p>

        {status === 'failed' && detail?.error && (
          <p className="mt-1.5 text-[11px] text-danger">{detail.error}</p>
        )}

        {detail?.metadata && Object.keys(detail.metadata).length > 0 && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.entrance}
            className="mt-1.5 flex flex-wrap gap-1"
          >
            {Object.entries(detail.metadata).map(([key, value]) => (
              <Badge key={key} tone="neutral" className="text-[10px]">
                {key}: {String(value)}
              </Badge>
            ))}
          </motion.div>
        )}
      </div>
    </motion.li>
  );
}

function StepIndicator({
  status,
  icon: Icon,
  reduced,
}: {
  status: StepStatus;
  icon: typeof Search;
  reduced: boolean;
}) {
  const running = status === 'running';

  return (
    <div className="relative z-10 shrink-0">
      <motion.div
        animate={
          running && !reduced
            ? { scale: [1, 1.06, 1] }
            : { scale: 1 }
        }
        transition={
          running && !reduced
            ? { duration: duration.ambient / 2, repeat: Infinity, ease: 'easeInOut' }
            : spring.snappy
        }
        className={cn(
          'flex size-8 items-center justify-center rounded-full border-2 bg-bg',
          'transition-colors duration-300 ease-standard',
          status === 'completed' && 'border-success bg-success',
          running && 'glow border-accent bg-accent-subtle',
          status === 'failed' && 'border-danger bg-danger',
          status === 'pending' && 'border-border bg-surface',
        )}
      >
        {status === 'completed' ? (
          <CheckMark reduced={reduced} />
        ) : status === 'failed' ? (
          <XCircle aria-hidden className="size-4 text-bg" />
        ) : running ? (
          <motion.span
            aria-hidden
            animate={reduced ? {} : { scale: [1, 1.35, 1], opacity: [1, 0.45, 1] }}
            transition={{
              duration: duration.ambient / 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="size-2.5 rounded-full bg-accent"
          />
        ) : (
          <Icon aria-hidden className="size-3.5 text-muted" />
        )}
      </motion.div>
    </div>
  );
}

/** Draws itself in rather than popping — the completion beat of each step. */
function CheckMark({ reduced }: { reduced: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-bg">
      <motion.path
        d="M6 12.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          reduced ? { duration: 0 } : { duration: duration.slow, ease: easing.entrance }
        }
      />
    </svg>
  );
}
