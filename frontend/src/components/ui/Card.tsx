import type { HTMLAttributes, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { interaction, spring, type as t } from '@/design';

export interface CardProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  /** Adds hover lift + shadow. Use only when the whole card is clickable. */
  interactive?: boolean;
  /** Frosted variant for surfaces that sit over content. */
  glass?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export function Card({
  interactive,
  glass,
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      whileHover={
        interactive && !reduced
          ? { y: interaction.hoverLift, transition: spring.gentle }
          : undefined
      }
      className={cn(
        'rim-light relative rounded-lg border',
        glass ? 'glass border-glass-border' : 'border-border bg-card',
        interactive &&
          'cursor-pointer shadow-soft transition-shadow duration-200 ease-standard hover:shadow-medium hover:border-border-strong',
        PADDING[padding],
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Consistent card/panel heading: icon · title · description · trailing action. */
export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            aria-hidden
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className={cn(t.h3, 'truncate')}>{title}</h2>
          {description && (
            <p className={cn(t.caption, 'mt-0.5')}>{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
