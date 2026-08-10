import type { Asset } from './contract';

/**
 * The three real assets planted in DataHub by `scripts/seed_demo_issues.py`
 * (Issue #3), transcribed from `docs/demo-dataset.md`.
 *
 * These are NOT mock data — they are the actual URNs present in the live
 * catalog after seeding. They exist here as quick-pick shortcuts so the demo
 * narrative is one click away, and as a fallback catalog when `/api/assets`
 * is unreachable. Live asset metadata always comes from the agent; nothing
 * here is ever presented as an agent response.
 */
const HIVE = 'urn:li:dataPlatform:hive';
const urn = (name: string) => `urn:li:dataset:(${HIVE},${name},PROD)`;

export const DEMO_ASSETS: readonly Asset[] = [
  {
    urn: urn('daily_revenue_report'),
    name: 'daily_revenue_report',
    platform: 'hive',
    env: 'PROD',
    type: 'DATASET',
    issue: 'stale_freshness',
    owners: ['urn:li:corpuser:datahub'],
    description:
      'Daily expected cadence, but lastModified is ~30 days old — the freshness-SLA demo trigger.',
  },
  {
    urn: urn('orders_revenue_summary'),
    name: 'orders_revenue_summary',
    platform: 'hive',
    env: 'PROD',
    type: 'DATASET',
    issue: 'broken_lineage',
    description:
      'Upstream lineage points at orders_source_legacy, which was never ingested — a dead end for root-cause traversal.',
  },
  {
    urn: urn('user_churn_predictions'),
    name: 'user_churn_predictions',
    platform: 'hive',
    env: 'PROD',
    type: 'DATASET',
    issue: 'no_owner',
    owners: [],
    description:
      'Ownership aspect is explicitly empty — downstream impact with nobody to notify.',
  },
] as const;

/** The phantom upstream. Referenced by lineage, absent from the catalog. */
export const DANGLING_UPSTREAM_URN = urn('orders_source_legacy');
