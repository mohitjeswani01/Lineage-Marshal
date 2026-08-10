import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Database,
  ExternalLink,
  Menu,
  Radio,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ThemeToggle } from './ThemeToggle';
import { StatusDot } from '@/components/ui/Badge';
import { fadeIn, spring, transition, type as t } from '@/design';
import { getHealth } from '@/api/agent';
import { useAsync } from '@/hooks/useAsync';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Radio;
  /** Sections not yet built are shown but disabled — honest, not hidden. */
  disabled?: boolean;
}

const NAV: NavItem[] = [
  { id: 'trigger', label: 'Trigger demo', icon: Radio },
  { id: 'catalog', label: 'Catalog', icon: Database, disabled: true },
  { id: 'incidents', label: 'Incidents', icon: Activity, disabled: true },
];

const DATAHUB_UI =
  import.meta.env.VITE_DATAHUB_UI_URL ?? 'http://localhost:9002';

/**
 * Reusable application shell: sidebar nav, sticky top bar, content slot.
 *
 * Layout only — it knows nothing about triggers. Pages render into `children`,
 * so adding a route later is a one-line change here plus a router at the top.
 * The sidebar is a slide-over drawer below `lg`, fixed above it.
 */
export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [active, setActive] = useState('trigger');

  return (
    <div className="relative z-10 min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
      >
        Skip to content
      </a>

      {/* Mobile drawer scrim */}
      <AnimatePresence>
        {navOpen && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-overlay lg:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar
        items={NAV}
        active={active}
        onSelect={(id) => {
          setActive(id);
          setNavOpen(false);
        }}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="lg:pl-66">
        <header className="glass sticky top-0 z-30 border-b border-glass-border">
          <div className="flex h-15 items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="-ml-1 rounded-md p-2 text-text-secondary hover:bg-accent-subtle hover:text-text lg:hidden"
            >
              <Menu aria-hidden className="size-4" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className={cn(t.h3, 'truncate')}>{title}</h1>
              {subtitle && (
                <p className="truncate text-[11px] text-muted">{subtitle}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <a
                href={DATAHUB_UI}
                target="_blank"
                rel="noreferrer noopener"
                className="hidden items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text sm:inline-flex"
              >
                DataHub
                <ExternalLink aria-hidden className="size-3" />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  items,
  active,
  onSelect,
  open,
  onClose,
}: {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <motion.nav
      data-sidebar
      aria-label="Primary"
      initial={false}
      animate={{ x: open ? 0 : '-100%' }}
      transition={spring.gentle}
      className="fixed inset-y-0 left-0 z-50 flex w-66 flex-col border-r border-border bg-surface"
    >
      <div className="flex h-15 items-center gap-2.5 border-b border-border px-4">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-deep text-on-accent shadow-soft"
        >
          <Radio className="size-3.5" />
        </span>
        <span className="flex-1 text-sm font-semibold tracking-[-0.01em]">
          Lineage Marshal
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="rounded-md p-1.5 text-muted hover:text-text lg:hidden"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <ul className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.disabled}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                  'transition-colors duration-150 ease-standard',
                  isActive ? 'text-text' : 'text-text-secondary',
                  item.disabled
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:bg-accent-subtle hover:text-text',
                )}
              >
                {isActive && (
                  // Shared layout id → the pill slides between items instead of
                  // popping, which is the whole trick behind Linear-style nav.
                  <motion.span
                    layoutId="nav-active"
                    transition={spring.gentle}
                    className="absolute inset-0 rounded-md bg-accent-subtle"
                  />
                )}
                <item.icon aria-hidden className="relative size-4 shrink-0" />
                <span className="relative truncate">{item.label}</span>
                {item.disabled && (
                  <span className="relative ml-auto text-[10px] text-muted">
                    soon
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <AgentStatus />
    </motion.nav>
  );
}

/** Live agent/DataHub reachability, polled once on mount and on demand. */
function AgentStatus() {
  const health = useAsync(getHealth, { immediate: true });

  const [tone, label] =
    health.status === 'loading'
      ? (['info', 'Checking agent…'] as const)
      : health.status === 'success'
        ? health.data.datahub && !health.data.datahub.reachable
          ? (['warning', 'Agent up · DataHub unreachable'] as const)
          : (['success', 'Agent connected'] as const)
        : (['danger', 'Agent offline'] as const);

  return (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={() => void health.run()}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-muted transition-colors hover:bg-accent-subtle hover:text-text-secondary"
      >
        <StatusDot
          tone={tone}
          pulse={health.status === 'loading'}
          label={label}
        />
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition.fast}
          className="truncate"
        >
          {label}
        </motion.span>
      </button>
    </div>
  );
}
