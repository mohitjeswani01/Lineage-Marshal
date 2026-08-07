import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-elevated text-muted border-border',
  accent: 'bg-accent-subtle text-accent border-accent/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Compact status/label chip. Always bordered so it reads on any surface. */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[11px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Live status indicator. The pulse is a decorative echo behind a solid dot, so
 * the meaning survives if animation is disabled.
 */
export function StatusDot({
  tone = 'neutral',
  pulse,
  label,
}: {
  tone?: BadgeTone;
  pulse?: boolean;
  label: string;
}) {
  const color = {
    neutral: 'bg-muted',
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }[tone];

  return (
    <span className="relative inline-flex size-2 shrink-0" title={label}>
      <span className="sr-only">{label}</span>
      {pulse && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 animate-ping rounded-full opacity-60',
            color,
          )}
        />
      )}
      <span aria-hidden className={cn('relative size-2 rounded-full', color)} />
    </span>
  );
}
