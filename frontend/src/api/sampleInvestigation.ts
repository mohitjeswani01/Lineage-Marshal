import type { TriggerResponse } from './contract';

/**
 * An illustrative investigation, used ONLY to populate the blast-radius graph
 * before anything has been triggered.
 *
 * This is sample data and the UI says so, loudly and permanently, wherever it
 * is rendered: the panel header shows a "sample" badge and the graph carries a
 * "not a real investigation" chip. It is never written to history, never shown
 * in the response panel, and is discarded the instant a real trigger returns.
 *
 * The URNs are the genuine seeded demo assets (`scripts/seed_demo_issues.py`),
 * so the shape matches what the agent actually returns — but the hop layout,
 * scores and owners here are authored, not measured. Nothing in this file may
 * ever be presented as an agent response.
 */
const HIVE = 'urn:li:dataPlatform:hive';
const urn = (name: string) => `urn:li:dataset:(${HIVE},${name},PROD)`;

const OWNER_ANALYTICS = 'urn:li:corpuser:analytics';
const OWNER_FINANCE = 'urn:li:corpuser:finance';

export const SAMPLE_TRIGGER_ID = 'sample';

export const SAMPLE_INVESTIGATION: TriggerResponse = {
  triggerId: SAMPLE_TRIGGER_ID,
  status: 'completed',
  durationMs: 4120,

  asset: {
    urn: urn('daily_revenue_report'),
    name: 'daily_revenue_report',
    platform: 'hive',
    env: 'PROD',
    type: 'DATASET',
    owners: [OWNER_FINANCE],
  },

  owners: [OWNER_FINANCE],

  // One entry per visual state the graph can render: owned, ownerless, and
  // referenced-but-absent — across three hop bands.
  downstream: [
    {
      urn: urn('orders_revenue_summary'),
      name: 'orders_revenue_summary',
      depth: 1,
      exists: true,
      owners: [OWNER_ANALYTICS],
    },
    {
      urn: urn('monthly_reconciliation_report'),
      name: 'monthly_reconciliation_report',
      depth: 1,
      exists: true,
      owners: [],
    },
    {
      urn: urn('revenue_analytics_dashboard'),
      name: 'revenue_analytics_dashboard',
      depth: 2,
      exists: true,
      owners: [OWNER_ANALYTICS],
    },
    {
      urn: urn('user_churn_predictions'),
      name: 'user_churn_predictions',
      depth: 2,
      exists: true,
      owners: [],
    },
    {
      urn: urn('legacy_audit_export'),
      name: 'legacy_audit_export',
      depth: 2,
      exists: false,
      owners: [],
    },
    {
      urn: urn('churn_risk_dashboard'),
      name: 'churn_risk_dashboard',
      depth: 3,
      exists: true,
      owners: [OWNER_ANALYTICS],
    },
    {
      urn: urn('executive_finance_summary'),
      name: 'executive_finance_summary',
      depth: 3,
      exists: true,
      owners: [],
    },
    {
      urn: urn('marketing_campaign_target_list'),
      name: 'marketing_campaign_target_list',
      depth: 3,
      exists: true,
      owners: [OWNER_FINANCE],
    },
  ],

  blastRadius: {
    score: 78,
    level: 'high',
    downstreamCount: 8,
    ownerlessCount: 3,
    rationale:
      'Eight assets downstream across three hops, three of them with no owner to notify.',
  },
};
