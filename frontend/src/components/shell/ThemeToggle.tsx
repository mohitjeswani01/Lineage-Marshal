import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { spring } from '@/design';

/** Dark/light switch. Icon cross-fades and rotates so the swap reads as one object turning over. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="relative flex size-9 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-secondary transition-colors duration-150 ease-standard hover:border-border-strong hover:text-text"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1, transition: spring.snappy }}
          exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
          className="absolute"
        >
          {theme === 'dark' ? (
            <Moon aria-hidden className="size-4" />
          ) : (
            <Sun aria-hidden className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
