import { useDeferredValue, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Database,
  ExternalLink,
  PlugZap,
  Search,
  SearchX,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { CopyButton } from '@/components/ui/CopyButton';
import { listAssets } from '@/api/agent';
import { DEMO_ASSETS } from '@/api/demoAssets';
import { issueLabel, type Asset, type IssueKind } from '@/api/contract';
import { useAsync } from '@/hooks/useAsync';
import { datahubUrl, isValidUrn, urnDisplayName } from '@/lib/urn';
import { relativeTime } from '@/lib/format';
import { fadeInUp, staggerList, transition, type as t } from '@/design';

const ISSUE_TONE: Record<IssueKind, 'danger' | 'warning' | 'neutral'> = {
  broken_lineage: 'danger',
  no_owner: 'warning',
  stale_freshness: 'warning',
  unknown: 'neutral',
};

interface AssetSelectorProps {
  selectedUrn: string;
  onSelect: (urn: string) => void;
}

/**
 * Asset picker backed by the agent's live catalog.
 *
 * Three sources, in priority order:
 *   1. `GET /api/assets` — the real DataHub catalog.
 *   2. The three seeded demo assets (docs/demo-dataset.md) as quick picks.
 *   3. Free-text URN entry, for anything not in either list.
 *
 * When the agent is unreachable the component says so plainly and still lets
 * you proceed by URN — it never substitutes invented data for the catalog.
 */
export function AssetSelector({ selectedUrn, onSelect }: AssetSelectorProps) {
  const [query, setQuery] = useState('');
  // Filtering a few hundred rows is cheap, but deferring keeps typing at 60fps
  // once the real catalog (~1,000 entities) is wired up.
  const deferredQuery = useDeferredValue(query);
  const catalog = useAsync(listAssets, { immediate: true });

  const assets = catalog.data?.assets;

  const filtered = useMemo(() => {
    if (!assets) return [];
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.urn.toLowerCase().includes(q) ||
        a.platform?.toLowerCase().includes(q),
    );
  }, [assets, deferredQuery]);

  const showManualEntry =
    catalog.status === 'error' ||
    (catalog.status === 'success' && filtered.length === 0);

  return (
    <Card padding="none" className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <CardHeader
          icon={<Database className="size-4" />}
          title="Asset"
          description="Pick the DataHub entity the incident is about"
          action={
            assets && (
              <Badge tone="neutral">
                {filtered.length}
                {filtered.length !== assets.length && ` / ${assets.length}`}
              </Badge>
            )
          }
        />

        <div className="relative mt-3">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, platform, or paste a URN…"
            aria-label="Search assets"
            className="h-10 w-full rounded-md border border-border bg-surface-elevated pr-3 pl-9 text-sm placeholder:text-muted transition-colors duration-150 ease-standard hover:border-border-strong focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Demo quick picks — real seeded URNs, one click from the demo script. */}
      <div className="border-b border-border px-4 py-3">
        <p className={cn(t.overline, 'mb-2 flex items-center gap-1.5')}>
          <Sparkles aria-hidden className="size-3" />
          Seeded demo assets
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ASSETS.map((asset) => (
            <button
              key={asset.urn}
              type="button"
              onClick={() => onSelect(asset.urn)}
              aria-pressed={asset.urn === selectedUrn}
              title={asset.description}
              className={cn(
                'rounded-full border px-2.5 py-1 font-mono text-[11px]',
                'transition-colors duration-150 ease-standard',
                asset.urn === selectedUrn
                  ? 'border-accent/40 bg-accent-subtle text-accent'
                  : 'border-border text-text-secondary hover:border-border-strong hover:bg-accent-subtle',
              )}
            >
              {asset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {catalog.status === 'loading' && !assets && (
          <div className="p-2">
            <SkeletonList rows={4} />
          </div>
        )}

        {catalog.status === 'error' && (
          <EmptyState
            tone="error"
            icon={<PlugZap className="size-5" />}
            title="Catalog unavailable"
            description={catalog.error.userMessage}
            action={{
              label: 'Retry',
              onClick: () => void catalog.run(),
              loading: false,
            }}
          />
        )}

        {catalog.status === 'success' && filtered.length === 0 && (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title="No matching assets"
            description="Nothing in the catalog matches that search. You can still enter a URN directly below."
          />
        )}

        {filtered.length > 0 && (
          <motion.ul
            variants={staggerList}
            initial="hidden"
            animate="visible"
            className="space-y-1"
          >
            <AnimatePresence initial={false}>
              {filtered.map((asset) => (
                <AssetRow
                  key={asset.urn}
                  asset={asset}
                  selected={asset.urn === selectedUrn}
                  onSelect={() => onSelect(asset.urn)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showManualEntry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.normal}
            className="overflow-hidden border-t border-border"
          >
            <ManualUrnEntry onSubmit={onSelect} />
          </motion.div>
        )}
      </AnimatePresence>

      {selectedUrn && (
        <div className="flex items-center gap-2 border-t border-border bg-surface-elevated px-4 py-2.5">
          <span className={cn(t.overline, 'shrink-0')}>Selected</span>
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-secondary">
            {selectedUrn}
          </code>
          <CopyButton value={selectedUrn} label="Copy URN" />
          <a
            href={datahubUrl(selectedUrn)}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Open ${urnDisplayName(selectedUrn)} in DataHub`}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-accent-subtle hover:text-text"
          >
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      )}
    </Card>
  );
}

function AssetRow({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.li variants={fadeInUp} layout="position">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left',
          'transition-colors duration-150 ease-standard',
          selected
            ? 'border-accent/40 bg-accent-subtle'
            : 'border-transparent hover:border-border hover:bg-surface-elevated',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            selected ? 'bg-accent text-on-accent' : 'bg-surface-elevated text-muted',
          )}
        >
          <Database className="size-3.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{asset.name}</span>
            {asset.issue && (
              <Badge tone={ISSUE_TONE[asset.issue]}>
                {issueLabel[asset.issue]}
              </Badge>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="uppercase">{asset.platform}</span>
            <span aria-hidden>·</span>
            <span>{asset.env}</span>
            {asset.lastModified !== undefined && (
              <>
                <span aria-hidden>·</span>
                <span>updated {relativeTime(asset.lastModified)}</span>
              </>
            )}
            {asset.owners?.length === 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-warning">no owner</span>
              </>
            )}
          </span>
        </span>
      </button>
    </motion.li>
  );
}

function ManualUrnEntry({ onSubmit }: { onSubmit: (urn: string) => void }) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const invalid = trimmed.length > 0 && !isValidUrn(trimmed);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !invalid) onSubmit(trimmed);
      }}
      className="flex items-end gap-2 p-3"
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor="manual-urn"
          className={cn(t.label, 'mb-1.5 block text-text-secondary')}
        >
          Enter a URN directly
        </label>
        <input
          id="manual-urn"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          placeholder="urn:li:dataset:(urn:li:dataPlatform:hive,name,PROD)"
          className={cn(
            'h-9 w-full rounded-md border bg-surface-elevated px-3 font-mono text-[11px]',
            'placeholder:text-muted focus:outline-none',
            invalid ? 'border-danger' : 'border-border focus:border-accent',
          )}
        />
      </div>
      <Button type="submit" size="sm" disabled={!trimmed || invalid}>
        Use
      </Button>
    </form>
  );
}
