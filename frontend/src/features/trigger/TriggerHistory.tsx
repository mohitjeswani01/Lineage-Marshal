import { AnimatePresence, motion } from 'framer-motion';
import { History, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { severityLabel, triggerTypeLabel } from '@/api/contract';
import type { HistoryEntry } from '@/hooks/useTriggerHistory';
import { absoluteTime, formatDuration, relativeTime } from '@/lib/format';
import { fadeInUp, spring, staggerList, type as t } from '@/design';

interface TriggerHistoryProps {
  entries: HistoryEntry[];
  activeId?: string;
  onReplay: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * Locally stored log of triggers fired from this browser.
 *
 * Clicking an entry replays its stored response into the response panel — no
 * second round trip, so a demo can be re-shown after the agent is stopped.
 */
export function TriggerHistory({
  entries,
  activeId,
  onReplay,
  onRemove,
  onClear,
}: TriggerHistoryProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-border p-4">
        <CardHeader
          icon={<History className="size-4" />}
          title="History"
          description="Stored in this browser only"
          action={
            entries.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                icon={<Trash2 aria-hidden className="size-3.5" />}
              >
                Clear
              </Button>
            )
          }
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="Nothing fired yet"
          description="Triggers you send appear here — click one to replay its response."
          className="py-8"
        />
      ) : (
        <motion.ul
          variants={staggerList}
          initial="hidden"
          animate="visible"
          className="max-h-80 divide-y divide-border overflow-y-auto"
        >
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                variants={fadeInUp}
                layout
                exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                transition={spring.gentle}
                className={cn(
                  'group relative flex items-start gap-2 px-4 py-2.5 transition-colors',
                  entry.id === activeId ? 'bg-accent-subtle' : 'hover:bg-surface-elevated',
                )}
              >
                <button
                  type="button"
                  onClick={() => onReplay(entry)}
                  disabled={!entry.response}
                  aria-current={entry.id === activeId ? 'true' : undefined}
                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-mono text-[11px] text-text">
                      {entry.assetName}
                    </span>
                    <Badge tone={entry.outcome === 'success' ? 'success' : 'danger'}>
                      {entry.outcome === 'success'
                        ? formatDuration(entry.durationMs)
                        : 'failed'}
                    </Badge>
                  </span>
                  <span
                    className="mt-0.5 block truncate text-[11px] text-muted"
                    title={absoluteTime(entry.firedAt)}
                  >
                    {triggerTypeLabel[entry.triggerType]} ·{' '}
                    {severityLabel[entry.severity]} · {relativeTime(entry.firedAt)}
                  </span>
                  {entry.errorMessage && (
                    <span className="mt-0.5 block truncate text-[11px] text-danger">
                      {entry.errorMessage}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label={`Remove ${entry.assetName} from history`}
                  className={cn(
                    'shrink-0 rounded-md p-1 text-muted transition-opacity',
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                    'hover:text-danger',
                  )}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      {entries.length > 0 && (
        <p className={cn(t.caption, 'border-t border-border px-4 py-2')}>
          Last {entries.length} of 25 kept locally.
        </p>
      )}
    </Card>
  );
}
