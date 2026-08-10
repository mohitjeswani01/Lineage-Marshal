import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring } from '@/design';

/**
 * Copy-to-clipboard with an inline confirmation swap.
 *
 * URNs are long and get pasted into CLI commands constantly during a demo —
 * this is the highest-traffic micro-interaction in the app.
 */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure origin / permission) — no-op is honest here */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'relative inline-flex size-7 shrink-0 items-center justify-center rounded-md',
        'text-muted transition-colors duration-150 ease-standard',
        'hover:bg-accent-subtle hover:text-text',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'done' : 'idle'}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1, transition: spring.snappy }}
          exit={{ opacity: 0, scale: 0.7 }}
        >
          {copied ? (
            <Check aria-hidden className="size-3.5 text-success" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
