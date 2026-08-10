import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { fadeInUp, type as t } from '@/design';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; loading?: boolean };
  /** Error framing: danger-tinted icon and an assertive live region. */
  tone?: 'neutral' | 'error';
  className?: string;
}

/**
 * Empty / error / not-yet state. One component for all three because they
 * differ only in tone and copy — and because an app with a beautiful empty
 * state and an ugly error state has it backwards.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  const isError = tone === 'error';

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      role={isError ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-11 items-center justify-center rounded-xl border',
          isError
            ? 'border-danger/25 bg-danger/10 text-danger'
            : 'border-border bg-accent-subtle text-accent',
        )}
      >
        {icon ?? <AlertTriangle className="size-5" />}
      </span>

      <div className="max-w-sm space-y-1">
        <h3 className={t.h3}>{title}</h3>
        {description && (
          <p className={cn(t.body, 'text-muted')}>{description}</p>
        )}
      </div>

      {action && (
        <Button
          size="sm"
          variant={isError ? 'primary' : 'secondary'}
          loading={action.loading}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
