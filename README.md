# Lineage Marshal

> **Incident investigation agent for data pipelines** — Automatically computes blast radius, resolves ownership, and writes investigation context back to DataHub so the next investigation inherits this knowledge.

## The Problem

When a data pipeline breaks, on-call engineers face three problems:
1. **No context** — What broke? What's upstream/downstream? Who owns it?
2. **No inheritance** — Every investigation starts from zero; prior findings are lost
3. **No notifications** — Owners are notified manually (if at all)

## The Solution

**Lineage Marshal** is an autonomous agent that:
- **Receives triggers** from pipeline failures, schema changes, freshness SLA breaches
- **Walks lineage** via DataHub MCP to find all downstream assets
- **Scores blast radius** using usage stats + hop distance + ownership gaps
- **Resolves owners** with contact info (email, displayName) from DataHub
- **Enriches with business context** — glossary terms, tags, domains
- **Reads prior context documents** from InstitutionalMemory on impacted assets
- **Writes investigation report** back to DataHub as versioned context documents
- **Notifies owners** via Slack/email with actionable summaries

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LINEAGE MARSHAL AGENT                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   TRIGGER    │───▶│  INVESTIGATE │───▶│  RESOLVE     │───▶│  NOTIFY  │ │
│  │  (detect)    │    │ (blast rad)  │    │  (owners)    │    │          │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────┘ │
│         │                   │                   │                   │       │
│         ▼                   ▼                   ▼                   ▼       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    DATAHUB MCP SERVER (stdio)                         │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │  │
│  │  │Lineage  │  │Ownership│  │Glossary │  │ Usage   │  │Instit.   │  │  │
│  │  │         │  │         │  │         │  │ Stats   │  │ Memory   │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └──────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      DATAHUB GMS (REST API)                          │  │
│  │  • Metadata Storage   • Search   • Lineage Graph   • Access Control │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
           ┌─────────────────┐              ┌─────────────────┐
           │   FRONTEND      │              │   CONTEXT DOCS  │
           │   (React/Vite)  │              │   (Institutional│
           │                 │              │    Memory)      │
           │ • Asset picker  │              │                 │
           │ • Trigger form  │              │ • Versioned     │
           │ • Live timeline │              │ • Append-only   │
           │ • Response view │              │ • Inherited by  │
           │ • History       │              │   next run      │
           └─────────────────┘              └─────────────────┘
```

### DataHub Features Used

| Feature | Purpose |
|---------|---------|
| **MCP Server** (`mcp-server-datahub`) | Primary interface for reading lineage, ownership, glossary, usage stats |
| **InstitutionalMemory Aspect** | Append-only context documents that survive across investigations |
| **DatasetProperties** | Freshness signals (`lastModified`), custom properties |
| **OwnershipClass** | Owner assignment for notification routing |
| **UpstreamLineageClass** | Lineage edges for blast radius traversal |
| **GlossaryTerms / Tags / Domains** | Business context enrichment for notifications |

---

## Quick Start

### Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| Docker Desktop | 4.x | Must be running |
| Docker RAM | **8 GB** | Insufficient RAM is the #1 failure cause |
| Python | 3.9+ | 3.12 confirmed |
| pip | 22+ | `pip install --upgrade pip` first |

### 1. Start DataHub

```bash
datahub docker quickstart
```

> **Services:** GMS at `http://localhost:8080`, UI at `http://localhost:9002` (user: `datahub` / pass: `datahub`)

### 2. Authenticate CLI

```bash
datahub init --username datahub --password datahub --force
```

### 3. Load Sample Data

```bash
# Load the showcase-ecommerce pack (~1,000 entities with rich lineage)
datahub docker ingest-sample-data --pack showcase-ecommerce
```

### 4. Seed Demo Issues (Planted Edge Cases)

```bash
# Plants 3 trigger scenarios + downstream fan-out for demo
python3 scripts/seed_demo_issues.py
```

This creates:
| Issue | Trigger Asset | Downstream Assets |
|-------|--------------|-------------------|
| **Broken Lineage** | `orders_revenue_summary` → `orders_source_legacy` (phantom) | `monthly_reconciliation_report` (owned), `legacy_audit_export` (ownerless) |
| **No Owner** | `user_churn_predictions` (empty owners) | `marketing_campaign_target_list` (ownerless) |
| **Stale Freshness** | `daily_revenue_report` (30 days stale) | `revenue_analytics_dashboard` (owned), `executive_finance_summary` (owned), `churn_risk_dashboard` (ownerless) |

### 5. Install Agent Dependencies

```bash
cd agent
pip install -r requirements.txt
```

### 6. Run the Agent API

```bash
# From repo root
python -m agent.main
```

API available at `http://localhost:8000` (OpenAPI docs at `/docs`)

### 7. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`

---

## Usage

### CLI — Full Investigation Pipeline

```bash
# Fire trigger + compute blast radius + resolve owners + glossary + report + write-back
python -m agent.cli investigate \
  --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
  --type FRESHNESS_SLA_BREACH \
  --context '{"sla_hours": 24, "expected_cadence": "daily"}' \
  --max-hops 3
```

### CLI — Blast Radius Only

```bash
python -m agent.cli blast-radius \
  --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
  --max-hops 3
```

### Frontend — Interactive Demo

1. Open `http://localhost:5173`
2. Select an asset from the left panel (3 demo assets with planted issues)
3. Choose trigger type and severity
4. Click **Fire Trigger**
5. Watch the live timeline: Detect → Investigate → Resolve Owner → Notify → Write Back
6. View the response: Blast radius score, impacted assets, owners, warnings, prior context

---

## Demo Narrative (for Judges)

**Scene:** Lineage Marshal receives a freshness SLA breach trigger on `daily_revenue_report`.

| Step | Action | What Happens |
|------|--------|--------------|
| 1 | **Trigger Receipt** | Agent receives `FRESHNESS_SLA_BREACH` for `daily_revenue_report` (lastModified = 30 days ago) |
| 2 | **Lineage Walk** | MCP `get_lineage` traverses downstream: finds 3 assets across 2 hops |
| 3 | **Severity Scoring** | Composite score = 0.5×usage + 0.3×proximity + 0.2×ownership_gap. `churn_risk_dashboard` ranks **HIGH** (ownerless penalty) |
| 4 | **Owner Resolution** | Reads ownership from DataHub: `datahub` (root), `alice`, `bob` (Hop 1), ❌ (Hop 2) |
| 5 | **Business Context** | Fetches glossary terms, tags, domains for each asset |
| 6 | **Prior Context** | Reads InstitutionalMemory from all impacted assets — finds previous investigations |
| 7 | **Report Generation** | Renders markdown report with trigger, blast radius, impacted assets, ownership, glossary, unknowns, prior incidents |
| 8 | **Write Back** | Appends report to InstitutionalMemory on `daily_revenue_report` (versioned, not overwritten) |
| 9 | **Notification** | Sends Slack/email to all owners with actionable summary; flags unnotifiable ownerless assets |

---

## Key Features Implemented

### 1. Blast Radius Scoring (`agent/core/blast_radius.py`)
- **Usage-weighted** (50%): Normalized query count (saturates at 10 queries)
- **Proximity-weighted** (30%): Inverse hop distance (1/hop)
- **Ownership penalty** (20%): +1.0 penalty for ownerless assets
- Labels: `critical` ≥ 0.7, `high` ≥ 0.5, `medium` ≥ 0.3, `low`, `unknown` (no usage data)

### 2. Ownership Resolution (`agent/core/ownership.py`)
- Parses raw MCP ownership JSON to extract `corpuser`/`corpgroup` with email & displayName
- Returns notification priority (`ALL` vs `PRIMARY_ONLY`)
- Handles empty ownership gracefully

### 3. Business Context (`agent/core/ownership.py`)
- Glossary terms with definitions
- Tags and domain associations
- Enriches notifications with plain-English business meaning

### 4. Context Documents / Knowledge Inheritance (`agent/core/writeback.py`)
- Uses **DataHub InstitutionalMemory aspect** (append-only)
- Each investigation creates a new versioned element
- Prior context automatically read and included in next report
- **Never overwrites** — full history preserved

### 5. Notification System (`agent/integrations/notifications.py`)
- Slack webhook + Email (SMTP) support
- Rich markdown with blast radius, ownership gaps, prior incidents
- Graceful degradation when owners missing

### 6. Frontend (`frontend/`)
- **Trigger Demo Page**: Asset picker, trigger form, live timeline, response panel
- **Timeline**: Real-time polling of pipeline progress (detect → investigate → resolve_owner → notify → write_back)
- **Response Panel**: Summary view + Raw JSON view
- **History**: Local browser history of triggers for replay
- **Design System**: Custom tokens (colors, typography, spacing, motion) — no Tailwind defaults

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/local-setup.md` | Complete local DataHub setup with troubleshooting |
| `docs/demo-dataset.md` | Planted demo issues, verification output, demo script |
| `docs/blast-radius-scoring.md` | Scoring algorithm details |
| `docs/deployment-plan.md` | Production deployment architecture |
| `docs/live-verification.md` | **End-to-end verification with screenshots/logs** |
| `docs/mcp-tools-discovered.md` | Full MCP tool discovery output |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATAHUB_GMS_URL` | Yes | `http://localhost:8080` | DataHub GMS REST endpoint |
| `DATAHUB_GMS_TOKEN` | No | `` | Personal Access Token for auth |
| `TOOLS_IS_MUTATION_ENABLED` | No | `true` | Enable MCP mutation tools |
| `MCP_SERVER_BIN` | No | `~/.local/bin/mcp-server-datahub` | Path to MCP server binary |

---

## Project Structure

```
Lineage-Marshal/
├── agent/
│   ├── api/
│   │   └── routes.py          # FastAPI endpoints (/api/health, /api/assets, /api/trigger, /api/trigger/{id}/progress)
│   ├── core/
│   │   ├── blast_radius.py    # Blast radius computation with scoring
│   │   ├── ownership.py       # Ownership + glossary resolution
│   │   ├── report.py          # Investigation report generation (JSON + Markdown)
│   │   ├── trigger.py         # Trigger validation + deduplication
│   │   └── writeback.py       # Context document write-back (InstitutionalMemory)
│   ├── integrations/
│   │   └── notifications.py   # Slack + Email notifications
│   ├── mcp/
│   │   ├── client.py          # MCP stdio client (JSON-RPC 2.0)
│   │   └── tools.py           # Typed MCP tool wrappers (lineage, ownership, glossary, usage, context)
│   ├── main.py                # FastAPI app entry point
│   ├── cli.py                 # CLI commands (trigger, blast-radius, investigate)
│   ├── config.py              # Environment configuration
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # API client + contract types
│   │   ├── components/        # UI components (shell, ui)
│   │   ├── features/trigger/  # Trigger demo feature components
│   │   ├── hooks/             # React hooks (useAsync, useTriggerProgress, useTriggerHistory, useToast)
│   │   ├── lib/               # Utilities (urn, format, cn)
│   │   ├── pages/             # TriggerDemoPage
│   │   └── design/            # Design tokens (colors, typography, motion, spacing)
│   └── package.json
├── scripts/
│   ├── seed_demo_issues.py    # Plants 3 demo issues + downstream fan-out
│   ├── discover_mcp_tools.py  # MCP tool discovery script
│   └── generate_examples.py   # Generates example investigation outputs
├── examples/                  # Example investigation outputs (JSON + Markdown)
├── docs/                      # Documentation
└── design.md                  # Frontend design system specification
```

---

## Testing

```bash
# Agent tests
cd agent
python -m pytest tests/ -v

# Frontend typecheck
cd frontend
npm run typecheck
```

---

## License

Apache 2.0 — see `LICENSE` file.