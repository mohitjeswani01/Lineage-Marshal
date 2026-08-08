/**
 * Wire contract for the Lineage Marshal agent API (backend Issue #12).
 *
 * The frontend owns none of this — these types describe what the agent
 * returns, and exist so the UI fails loudly at the boundary instead of
 * silently rendering `undefined`. Response shapes are intentionally tolerant:
 * every analysis field is optional, because the agent fills them in as it
 * gains capability, and the response panel renders whatever actually arrived
 * plus a raw-JSON view of the rest.
 *
 * Endpoints consumed (read-only from the frontend's perspective):
 *   GET  /api/health           → HealthResponse
 *   GET  /api/assets           → AssetsResponse
 *   POST /api/trigger          → TriggerResponse
 */

/** A DataHub URN, e.g. `urn:li:dataset:(urn:li:dataPlatform:hive,x,PROD)`. */
export type Urn = string;

export type IssueKind =
  | 'broken_lineage'
  | 'no_owner'
  | 'stale_freshness'
  | 'unknown';

export interface Asset {
  urn: Urn;
  name: string;
  platform: string;
  env: string;
  /** DataHub entity type — `DATASET`, `CHART`, … */
  type?: string;
  description?: string;
  owners?: string[];
  /** Unix ms, as DataHub reports it. */
  lastModified?: number;
  /** Set when the agent (or the demo seed) knows this asset is problematic. */
  issue?: IssueKind;
}

export interface AssetsResponse {
  assets: Asset[];
}

export interface HealthResponse {
  status: string;
  /** Whether the agent can currently reach DataHub GMS. */
  datahub?: { reachable: boolean; gmsUrl?: string };
  version?: string;
}

export const TRIGGER_TYPES = [
  'freshness_sla',
  'schema_change',
  'pipeline_failure',
  'manual',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface TriggerRequest {
  urn: Urn;
  triggerType: TriggerType;
  severity: Severity;
  /** Free-text incident context passed through to the agent's brief. */
  note?: string;
}

export interface LineageNode {
  urn: Urn;
  name?: string;
  /** Hops from the triggered asset. */
  depth?: number;
  /** False when the URN is referenced in lineage but absent from the catalog. */
  exists?: boolean;
  owners?: string[];
}

export interface BlastRadius {
  score?: number;
  level?: 'low' | 'medium' | 'high' | 'critical';
  downstreamCount?: number;
  ownerlessCount?: number;
  rationale?: string;
}

export interface TriggerResponse {
  triggerId: string;
  status: 'accepted' | 'completed' | 'failed';
  /** ISO-8601. */
  receivedAt?: string;
  durationMs?: number;
  asset?: Asset;
  upstream?: LineageNode[];
  downstream?: LineageNode[];
  owners?: string[];
  blastRadius?: BlastRadius;
  /** Plain-English incident summary — the agent's headline output. */
  brief?: string;
  /** Non-fatal findings: dangling upstreams, unnotifiable owners, etc. */
  warnings?: string[];
  /** Anything the agent returns that this contract doesn't name yet. */
  [key: string]: unknown;
}

/** Human labels — kept beside the contract so a new enum value can't ship unlabelled. */
export const triggerTypeLabel: Record<TriggerType, string> = {
  freshness_sla: 'Missed freshness SLA',
  schema_change: 'Breaking schema change',
  pipeline_failure: 'Pipeline failure',
  manual: 'Manual investigation',
};

export const severityLabel: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const issueLabel: Record<IssueKind, string> = {
  broken_lineage: 'Broken lineage',
  no_owner: 'No owner',
  stale_freshness: 'Stale freshness',
  unknown: 'Unclassified',
};

export const PIPELINE_STEPS = [
  'detect',
  'investigate',
  'resolve_owner',
  'notify',
  'write_back',
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export interface PipelineProgress {
  triggerId: string;
  currentStep: PipelineStep;
  completedSteps: PipelineStep[];
  failedStep?: PipelineStep;
  error?: string;
  status: 'running' | 'completed' | 'failed';
  updatedAt: string;
  stepDetails?: Record<PipelineStep, StepDetail>;
}

export interface StepDetail {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
