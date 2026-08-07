import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { interaction, spring } from '@/design';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover shadow-soft hover:shadow-medium',
  secondary:
    'bg-surface-elevated text-text border border-border hover:border-border-strong hover:bg-accent-subtle',
  ghost: 'text-text-secondary hover:text-text hover:bg-accent-subtle',
  danger: 'bg-danger text-on-accent hover:opacity-90 shadow-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 gap-1.5 text-xs rounded-md',
  md: 'h-10 px-4 gap-2 text-sm rounded-md',
  lg: 'h-11 px-5 gap-2 text-sm rounded-lg',
};

export interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
  > {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/**
 * The one button. Press/hover physics come from motion tokens so every
 * control in the app has the same weight.
 *
 * `loading` keeps the label mounted and swaps only the icon slot — the button
 * doesn't resize mid-request, so nothing under the cursor jumps.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      iconRight,
      fullWidth,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reduced = useReducedMotion();
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        whileHover={isDisabled || reduced ? undefined : { scale: interaction.hoverScale }}
        whileTap={isDisabled || reduced ? undefined : { scale: interaction.pressScale }}
        transition={spring.snappy}
        className={cn(
          'inline-flex items-center justify-center font-medium select-none',
          'transition-colors duration-150 ease-standard',
          'disabled:opacity-50 disabled:pointer-events-none',
          VARIANTS[variant],
          SIZES[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          icon
        )}
        {children}
        {iconRight}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
