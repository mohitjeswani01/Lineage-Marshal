import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, transition, type as t } from '@/design';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};

/**
 * Bottom-right toast stack.
 *
 * `role="status"` on the container (polite) rather than `alert` on each toast:
 * a burst of triggers shouldn't interrupt a screen-reader user mid-sentence.
 * Errors are never auto-dismissed (see useToast), so nothing important is lost.
 */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
              exit={{ opacity: 0, x: 24, transition: transition.exit }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg p-3',
                'glass border border-glass-border shadow-floating',
              )}
            >
              <Icon
                aria-hidden
                className={cn('mt-0.5 size-4 shrink-0', TONE_CLASS[toast.tone])}
              />
              <div className="min-w-0 flex-1">
                <p className={cn(t.label, 'text-text')}>{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={`Dismiss: ${toast.title}`}
                className="-m-1 rounded-md p-1 text-muted transition-colors hover:text-text"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
