import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { transition, type as t } from '@/design';

const CONTROL = cn(
  'w-full rounded-md border border-border bg-surface-elevated px-3',
  'text-sm text-text placeholder:text-muted',
  'transition-colors duration-150 ease-standard',
  'hover:border-border-strong focus:border-accent focus:outline-none',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-danger',
);

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Label + control + hint/error, wired for screen readers.
 *
 * The error replaces the hint rather than stacking, so the form never reflows
 * as validation state changes, and it's announced via `role="alert"`.
 */
export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className={cn(t.label, 'text-text-secondary')}>
        {label}
      </label>
      {children}
      <div className="min-h-4">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p
              key="error"
              id={`${htmlFor}-error`}
              role="alert"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transition.fast}
              className="flex items-center gap-1 text-[11px] text-danger"
            >
              <AlertCircle aria-hidden className="size-3 shrink-0" />
              {error}
            </motion.p>
          ) : (
            hint && (
              <motion.p
                key="hint"
                id={`${htmlFor}-hint`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition.fast}
                className="text-[11px] text-muted"
              >
                {hint}
              </motion.p>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, className, ...props }, ref) => {
    const id = useId();
    return (
      <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(CONTROL, 'h-10', className)}
          {...props}
        />
      </FieldShell>
    );
  },
);
TextField.displayName = 'TextField';

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, error, className, ...props }, ref) => {
    const id = useId();
    return (
      <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(CONTROL, 'resize-y py-2 leading-relaxed', className)}
          {...props}
        />
      </FieldShell>
    );
  },
);
TextAreaField.displayName = 'TextAreaField';
