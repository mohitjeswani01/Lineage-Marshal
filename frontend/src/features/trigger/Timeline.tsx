import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  UserCheck,
  Bell,
  Database,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { PipelineProgress, PipelineStep } from '@/api/contract';
import { spring, staggerList, fadeInUp } from '@/design';
import { getStepStatus } from '@/hooks/useTriggerProgress';

const STEP_CONFIG: Record<PipelineStep, { label: string; description: string; icon: typeof Search }> = {
  detect: {
    label: 'Detect',
    description: 'Identify the incident and affected asset',
    icon: Search,
  },
  investigate: {
    label: 'Investigate',
    description: 'Walk lineage upstream and downstream',
    icon: AlertTriangle,
  },
  resolve_owner: {
    label: 'Resolve owner',
    description: 'Find and verify responsible owners',
    icon: UserCheck,
  },
  notify: {
    label: 'Notify',
    description: 'Alert owners via configured channels',
    icon: Bell,
  },
  write_back: {
    label: 'Write back',
    description: 'Persist findings and update metadata',
    icon: Database,
  },
};

const STEP_ICONS: Record<PipelineStep, typeof Search> = {
  detect: Search,
  investigate: AlertTriangle,
  resolve_owner: UserCheck,
  notify: Bell,
  write_back: Database,
};

interface TimelineProps {
  progress: PipelineProgress | null;
  triggerId?: string;
  className?: string;
}

export function Timeline({ progress, triggerId, className }: TimelineProps) {
  const steps = Object.keys(STEP_CONFIG) as PipelineStep[];
  const isComplete = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Loader2
              aria-hidden
              className={cn(
                'size-4',
                (progress && progress.status === 'running') && 'animate-spin text-accent'
              )}
            />
            <span className="font-medium">Investigation timeline</span>
          </div>
          {triggerId && (
            <Badge tone="neutral" className="font-mono text-[10px]">
              {triggerId.slice(0, 8)}…
            </Badge>
          )}
        </div>
        {progress && (
          <p className="mt-1 text-[11px] text-muted">
            Status:{' '}
            <span className={cn('font-medium', {
              'text-success': isComplete,
              'text-danger': isFailed,
              'text-accent': progress.status === 'running',
            })}>
              {progress.status}
            </span>
            {progress.updatedAt && (
              <span className="ml-2">· Updated {new Date(progress.updatedAt).toLocaleTimeString()}</span>
            )}
          </p>
        )}
      </div>

      <div className="p-4">
        <motion.ul
          variants={staggerList}
          initial="hidden"
          animate="visible"
          className="space-y-3"
          role="list"
          aria-label="Agent investigation steps"
        >
          <AnimatePresence initial={false}>
            {steps.map((step, index) => (
              <TimelineStepItem
                key={step}
                step={step}
                index={index}
                progress={progress}
                isLast={index === steps.length - 1}
              />
            ))}
          </AnimatePresence>
        </motion.ul>

        {progress?.failedStep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 rounded-md border border-danger/25 bg-danger/8 p-3"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-medium text-danger text-sm">Step failed: {STEP_CONFIG[progress.failedStep].label}</p>
                {progress.error && (
                  <p className="mt-1 text-[11px] text-text-secondary">{progress.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}

interface TimelineStepItemProps {
  step: PipelineStep;
  index: number;
  progress: PipelineProgress | null;
  isLast: boolean;
}

function TimelineStepItem({ step, index, progress, isLast }: TimelineStepItemProps) {
  const config = STEP_CONFIG[step];
  const status = getStepStatus(progress, step);
  const detail = progress?.stepDetails?.[step];

  const getStepDuration = () => {
    if (detail?.startedAt && detail?.completedAt) {
      return new Date(detail.completedAt).getTime() - new Date(detail.startedAt).getTime();
    }
    return null;
  };

  const duration = getStepDuration();

  return (
    <motion.li
      variants={fadeInUp}
      layout
      className="relative flex gap-3"
      style={{ '--delay': `${index * 50}ms` } as React.CSSProperties}
    >
      <div className="relative flex flex-col items-center shrink-0">
        <StepIndicator
          step={step}
          status={status}
          isLast={isLast}
        />

        <div className="absolute left-1/2 top-6 -translate-x-1/2 w-px h-full bg-border" />
        {isLast && <div className="absolute left-1/2 top-6 -translate-x-1/2 w-px h-6 bg-border" />}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2">
          <motion.span
            initial={false}
            animate={{ opacity: status === 'completed' || status === 'running' ? 1 : 0.4 }}
            transition={spring.gentle}
            className="flex items-center gap-1.5"
          >
            <config.icon
              aria-hidden
              className={cn(
                'size-3.5 shrink-0',
                status === 'completed' && 'text-success',
                status === 'running' && 'text-accent animate-pulse',
                status === 'failed' && 'text-danger',
                (status === 'pending' || status === 'running') && 'text-muted',
              )}
            />
            <span
              className={cn(
                'font-medium text-sm',
                status === 'completed' && 'text-text',
                status === 'running' && 'text-accent',
                status === 'failed' && 'text-danger',
                status === 'pending' && 'text-muted',
              )}
            >
              {config.label}
            </span>
            {duration !== null && (
              <span className="font-mono text-[10px] text-muted">
                ({formatDuration(duration)})
              </span>
            )}
          </motion.span>
        </div>

        <motion.p
          initial={false}
          animate={{ opacity: status === 'pending' ? 0.5 : 1 }}
          transition={spring.gentle}
          className="mt-1 ml-5.5 text-[11px] text-text-secondary"
        >
          {config.description}
        </motion.p>

        {status === 'failed' && detail?.error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1.5 ml-5.5 text-[11px] text-danger"
          >
            {detail.error}
          </motion.p>
        )}

        {detail?.metadata && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-1.5 ml-5.5 flex flex-wrap gap-1"
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
  step,
  status,
  isLast,
}: {
  step: PipelineStep;
  status: 'pending' | 'running' | 'completed' | 'failed';
  isLast: boolean;
}) {
  const Icon = STEP_ICONS[step];

  return (
    <div className="relative flex size-7 items-center justify-center z-10">
      <div
        className={cn(
          'relative flex size-7 items-center justify-center rounded-full border-2',
          'transition-all duration-300 ease-standard',
          status === 'completed' && 'border-success bg-success',
          status === 'running' && 'border-accent bg-accent-subtle',
          status === 'failed' && 'border-danger bg-danger',
          status === 'pending' && 'border-border bg-surface',
        )}
      >
        {status === 'running' ? (
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            className="size-2.5 rounded-full bg-accent"
          />
        ) : status === 'completed' ? (
          <CheckCircle2 aria-hidden className="size-4 text-on-success" />
        ) : status === 'failed' ? (
          <XCircle aria-hidden className="size-4 text-on-danger" />
        ) : (
          <Icon aria-hidden className="size-3.5 text-muted" />
        )}
      </div>

      {!isLast && (
        <motion.div
          initial={false}
          animate={{
            backgroundColor: status === 'completed' ? 'var(--color-success)' : 'var(--color-border)',
          }}
          transition={spring.gentle}
          className="absolute left-1/2 top-7 -translate-x-1/2 w-px h-full"
        />
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}