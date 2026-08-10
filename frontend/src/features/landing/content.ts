/**
 * Landing page copy, as data.
 *
 * Every claim here is traceable to something the agent actually implements —
 * see `README.md` and `agent/core/*`. Keeping it in one typed file (rather than
 * inline in JSX) means the marketing surface can be diffed against the code
 * when behaviour changes, instead of quietly drifting into fiction.
 */
import {
  Bell,
  BookOpen,
  Database,
  Gauge,
  GitBranch,
  History,
  Search,
  Send,
  UserCheck,
  Waypoints,
} from 'lucide-react';

const REPO = 'https://github.com/mohitjeswani01/Lineage-Marshal';

export const LINKS = {
  github: REPO,
  issues: `${REPO}/issues`,
  license: `${REPO}/blob/main/LICENSE`,
  readme: `${REPO}/blob/main/README.md`,
  /** In-app route — the console is served by this same build. */
  console: '#/console',
  datahub: 'https://datahubproject.io',
  datahubMcp: 'https://github.com/acryldata/mcp-server-datahub',
  /**
   * Set `VITE_LIVE_DEMO_URL` at build time once the app is deployed. Left
   * undefined the footer links to the bundled console instead of inventing a
   * URL that doesn't resolve.
   */
  liveDemo: import.meta.env.VITE_LIVE_DEMO_URL as string | undefined,
} as const;

export const DOC_LINKS = [
  { label: 'Local setup', href: `${REPO}/blob/main/docs/local-setup.md` },
  { label: 'Demo dataset', href: `${REPO}/blob/main/docs/demo-dataset.md` },
  {
    label: 'Blast radius scoring',
    href: `${REPO}/blob/main/docs/blast-radius-scoring.md`,
  },
  {
    label: 'Context document write-back',
    href: `${REPO}/blob/main/docs/context-document-writeback.md`,
  },
  {
    label: 'Live verification',
    href: `${REPO}/blob/main/docs/live-verification.md`,
  },
  { label: 'Deployment plan', href: `${REPO}/blob/main/docs/deployment-plan.md` },
  { label: 'Design system', href: `${REPO}/blob/main/design.md` },
  {
    label: 'MCP tools discovered',
    href: `${REPO}/blob/main/docs/mcp-tools-discovered.md`,
  },
] as const;

/* ---------------------------------------------------------------------------
 * The problem — README §"The Problem"
 * ------------------------------------------------------------------------ */

export const PROBLEMS = [
  {
    title: 'No context',
    body: 'What broke? What sits upstream and downstream of it? Who owns any of it? The answers exist in the catalog — just not where the on-call engineer is looking at 3am.',
  },
  {
    title: 'No inheritance',
    body: 'Every investigation restarts from zero. Whatever the last engineer worked out about this pipeline died in a thread nobody can find.',
  },
  {
    title: 'No notification',
    body: 'Owners get told manually, if at all — and assets with no owner at all are exactly the ones nobody notices are broken.',
  },
] as const;

/* ---------------------------------------------------------------------------
 * Pipeline — the five stages the agent reports through
 * (`PIPELINE_STEPS` in `api/contract.ts`, driven by `agent/api/routes.py`)
 * ------------------------------------------------------------------------ */

export const PIPELINE = [
  {
    id: 'detect',
    label: 'Detect',
    body: 'Accepts a freshness SLA breach, schema change, pipeline failure or manual trigger. Validates and de-duplicates it.',
    icon: Search,
  },
  {
    id: 'investigate',
    label: 'Investigate',
    body: 'Walks DataHub lineage downstream hop by hop and scores blast radius for every impacted asset it finds.',
    icon: Waypoints,
  },
  {
    id: 'resolve_owner',
    label: 'Resolve owner',
    body: 'Resolves corpuser and corpgroup owners with email and display name — and flags the assets that have nobody.',
    icon: UserCheck,
  },
  {
    id: 'notify',
    label: 'Notify',
    body: 'Sends every resolved owner an actionable summary over Slack or email, with the ownership gaps called out.',
    icon: Bell,
  },
  {
    id: 'write_back',
    label: 'Write back',
    body: 'Appends a versioned report to the asset’s InstitutionalMemory, so the next investigation starts where this one ended.',
    icon: Database,
  },
] as const;

/* ---------------------------------------------------------------------------
 * Capabilities — README §"Key Features Implemented"
 * ------------------------------------------------------------------------ */

export const FEATURES = [
  {
    title: 'Blast radius scoring',
    body: 'A composite score per impacted asset, not a flat downstream count. Usage weight, hop proximity and ownership gap combine into one number you can triage on.',
    icon: Gauge,
    detail: '0.5 × usage + 0.3 × proximity + 0.2 × ownership gap',
    footnote: 'critical ≥ 0.7 · high ≥ 0.5 · medium ≥ 0.3 · low · unknown',
    source: 'agent/core/blast_radius.py',
  },
  {
    title: 'Ownership resolution',
    body: 'Parses raw ownership metadata into real contacts — corpuser and corpgroup with email and display name — and returns a notification priority. Empty ownership is surfaced, never swallowed.',
    icon: UserCheck,
    source: 'agent/core/ownership.py',
  },
  {
    title: 'Business context',
    body: 'Enriches every impacted asset with glossary terms, tags and domain associations, so a notification says what the table means to the business, not just what it is called.',
    icon: BookOpen,
    source: 'agent/core/ownership.py',
  },
  {
    title: 'Knowledge that compounds',
    body: 'Each investigation is appended to DataHub’s InstitutionalMemory as a new versioned element. Prior context is read back automatically on the next run. Nothing is ever overwritten.',
    icon: History,
    detail: 'Append-only · versioned · inherited',
    source: 'agent/core/writeback.py',
  },
  {
    title: 'Owner notifications',
    body: 'Slack webhook and SMTP email, with a rich markdown summary covering blast radius, ownership gaps and prior incidents. Degrades gracefully when there is no owner to reach.',
    icon: Send,
    source: 'agent/integrations/notifications.py',
  },
  {
    title: 'Live investigation console',
    body: 'Watch the pipeline advance in real time, see the blast radius light up hop by hop in 3D, then read the full report or raw JSON. Every run is replayable from local history.',
    icon: GitBranch,
    source: 'frontend/',
  },
] as const;

/* ---------------------------------------------------------------------------
 * DataHub surface area — README §"DataHub Features Used"
 * ------------------------------------------------------------------------ */

export const DATAHUB_FEATURES = [
  {
    name: 'MCP Server',
    api: 'mcp-server-datahub',
    purpose:
      'Primary interface for reading lineage, ownership, glossary and usage statistics over JSON-RPC.',
  },
  {
    name: 'InstitutionalMemory',
    api: 'institutionalMemory',
    purpose:
      'Append-only context documents that survive across investigations — the knowledge inheritance mechanism.',
  },
  {
    name: 'Upstream lineage',
    api: 'UpstreamLineageClass',
    purpose: 'Lineage edges traversed hop by hop to compute the blast radius.',
  },
  {
    name: 'Ownership',
    api: 'OwnershipClass',
    purpose: 'Owner assignment used to route notifications and detect gaps.',
  },
  {
    name: 'Dataset properties',
    api: 'DatasetProperties',
    purpose:
      'Freshness signals such as lastModified, plus custom properties on the asset.',
  },
  {
    name: 'Glossary, tags, domains',
    api: 'GlossaryTerms',
    purpose: 'Business context enrichment attached to every impacted asset.',
  },
] as const;

/* ---------------------------------------------------------------------------
 * Quick start — condensed from README §"Quick Start"
 * ------------------------------------------------------------------------ */

export const QUICK_START = [
  {
    step: '01',
    title: 'Start DataHub',
    body: 'Needs Docker with at least 8 GB of RAM allocated.',
    code: 'datahub docker quickstart',
  },
  {
    step: '02',
    title: 'Seed the demo issues',
    body: 'Plants three trigger scenarios with downstream fan-out: broken lineage, a missing owner and a stale table.',
    code: 'python3 scripts/seed_demo_issues.py',
  },
  {
    step: '03',
    title: 'Run the agent',
    body: 'FastAPI on :8000, with OpenAPI docs at /docs.',
    code: 'pip install -r agent/requirements.txt\npython -m agent.main',
  },
  {
    step: '04',
    title: 'Open the console',
    body: 'The interface on :5173 — pick an asset, fire a trigger, watch it resolve.',
    code: 'cd frontend && npm install && npm run dev',
  },
] as const;

/** Headline counters. Each is a fact about the implementation, not a metric. */
export const HERO_STATS = [
  { value: '5', label: 'pipeline stages' },
  { value: '3', label: 'scoring signals' },
  { value: '6', label: 'DataHub aspects read' },
] as const;
