import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { popover, transition, type as t } from '@/design';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible listbox with animated open/close.
 *
 * Built rather than borrowed: the app needs exactly one dropdown pattern, and
 * the WAI-ARIA listbox interaction is ~60 lines — cheaper than a headless UI
 * dependency and its styling adapter.
 *
 * Keyboard: ↑/↓ move, Home/End jump, Enter/Space commit, Esc closes and
 * returns focus to the trigger. Active option is tracked with
 * `aria-activedescendant`, so focus never leaves the trigger.
 */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: SelectProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Close on outside pointer-down. Pointer-down (not click) so the menu can't
  // survive a drag that started outside it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)} ref={rootRef}>
      <span id={`${id}-label`} className={cn(t.label, 'text-text-secondary')}>
        {label}
      </span>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={open ? `${id}-opt-${activeIndex}` : undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md',
            'border border-border bg-surface-elevated px-3 text-left text-sm',
            'transition-colors duration-150 ease-standard',
            'hover:border-border-strong focus:border-accent focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'border-accent',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? 'Select…'}</span>
          </span>
          <motion.span
            aria-hidden
            animate={{ rotate: open ? 180 : 0 }}
            transition={transition.fast}
            className="text-muted"
          >
            <ChevronDown className="size-4" />
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={`${id}-label`}
              variants={popover}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ transformOrigin: 'top' }}
              className={cn(
                'absolute z-50 mt-1.5 max-h-72 w-full overflow-auto p-1',
                'glass rounded-lg border border-glass-border shadow-elevated',
              )}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`${id}-opt-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => commit(index)}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2',
                      'text-sm transition-colors duration-100 ease-standard',
                      index === activeIndex && 'bg-accent-subtle',
                      isSelected && 'text-accent',
                    )}
                  >
                    {option.icon && (
                      <span className="mt-0.5 shrink-0">{option.icon}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                    )}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
