# Demo Dataset — Lineage Marshal

> **Purpose:** This document describes the demo dataset used for Lineage Marshal's hackathon demo. It covers: what the `showcase-ecommerce` pack contains, the 3 deliberate issues we planted on top of it, and a demo narrative script for Rahul to use during the demo.

---

## 1. Base Dataset — `showcase-ecommerce`

**Ingestion command:**
```bash
datahub docker ingest-sample-data --pack showcase-ecommerce
```

> **Note:** As of `acryl-datahub` 1.6.0.17, the `datahub datapack` CLI wrapper crashes with a missing resource file bug. The above command calls the same underlying code and works correctly. See `docs/local-setup.md §7` for details.

**What it contains (approximate):**
- ~1,000 entities total
- Datasets (Hive, Snowflake, Redshift, dbt, Looker)
- Charts, Dashboards, Data Pipelines
- Rich lineage edges connecting source tables → transformed datasets → downstream charts
- Ownership, tags, glossary terms, and descriptions on most entities

**Verified in UI at:** http://localhost:9002 → Catalog → Datasets

---

## 2. Planted Demo Issues

We layered 3 deliberate issues on top of the showcase data using `scripts/seed_demo_issues.py`. All 3 are on platform `hive`, environment `PROD` — consistent with the showcase pack's existing Hive assets so they appear naturally in search alongside real data.

**Script:** `scripts/seed_demo_issues.py`  
**Idempotency:** Re-running the script is safe. It uses a check-if-exists-then-upsert pattern (`DataHubGraph.get_aspect()` → skip create, re-emit aspects). If you wipe and rebuild Docker containers, re-run the script to restore planted issues.

```bash
# Restore planted issues after a Docker wipe:
python3 scripts/seed_demo_issues.py

# Against a non-default GMS URL or with a PAT:
python3 scripts/seed_demo_issues.py --gms-url http://localhost:8080 --token <your-PAT>
```

---

### Issue 1 — Broken Lineage Edge

| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)` |
| **Asset name** | `orders_revenue_summary` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | An `UpstreamLineage` aspect pointing to a dangling upstream URN that was never ingested |
| **Dangling upstream URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)` |
| **Why this is realistic** | A decommissioned source table — the lineage edge was never cleaned up when the table was dropped |

**How to detect it:**
- **UI:** Search `orders_revenue_summary` → open Lineage tab → upstream node `orders_source_legacy` appears but clicking it shows "Entity not found" / no metadata
- **MCP/API:** `get_lineage(urn)` returns `orders_source_legacy` as upstream; `get_dataset_properties(orders_source_legacy URN)` returns null/404

**Demo significance:** The agent should identify this as a broken lineage edge, note that the upstream doesn't exist in the catalog, and flag it as an unresolvable dependency — so any freshness or schema check on `orders_revenue_summary` cannot be traced back to a root source.

---

### Issue 2 — No Owner Assigned

| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)` |
| **Asset name** | `user_churn_predictions` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | `OwnershipClass(owners=[])` — an explicitly empty ownership aspect |
| **Why this is realistic** | ML model output orphaned after a team reorg — the owning team dissolved and nobody re-assigned it |

**How to detect it:**
- **UI:** Search `user_churn_predictions` → open Governance tab → Owners section is empty
- **MCP/API:** `get_owners(urn)` returns `[]` (empty list)

**Demo significance:** The agent cannot notify anyone about an incident affecting this asset — it's a true ownership gap. Lineage Marshal should surface this as part of blast radius computation: "downstream affected, but no owner to notify."

---

### Issue 3 — Stale Freshness Signal

| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)` |
| **Asset name** | `daily_revenue_report` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | `DatasetPropertiesClass.lastModified` set to **30 days before the seed script ran** |
| **Expected cadence** | Daily (documented in `customProperties.expected_update_cadence`) |
| **Owner** | `urn:li:corpuser:datahub` (has an owner — this is not an ownership issue) |

**How to detect it:**
- **UI:** Search `daily_revenue_report` → Properties tab → Last Modified timestamp is 30 days old
- **MCP/API:** `get_dataset_properties(urn).lastModified.time` returns a Unix-ms timestamp ~30 days in the past; delta from now > 1 day = SLA breach for a daily pipeline

**Demo significance:** The agent should detect this as a missed freshness SLA — the pipeline that feeds this report has not run in 30 days despite a daily expected cadence. This is the trigger scenario for the "missed freshness SLA" use case.

---

## 3. Verification — Live Query Output (real output, run 2026-08-06)

The following is actual terminal output from `python3 scripts/seed_demo_issues.py` run against the live DataHub instance:

```
19:56:29  INFO     Lineage Marshal — Demo Issue Seeder
19:56:29  INFO     GMS URL : http://localhost:8080
19:56:29  INFO     Auth    : no auth (open instance)
19:56:30  INFO     Checking GMS connectivity …
19:56:30  INFO     Connected to DataHub GMS. Auth enabled: unknown
19:56:30  INFO     ─── Planting demo issues ───
19:56:32  INFO     [Issue 1] Creating orders_revenue_summary …
19:56:35  INFO     [Issue 1] ✓ Broken lineage planted.
          Asset  : urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)
          Dangling upstream: urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)
19:56:36  INFO     [Issue 2] Creating user_churn_predictions …
19:56:49  INFO     [Issue 2] ✓ No-owner condition planted.
          Asset: urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)
          Owners: [] (empty)
19:56:50  INFO     [Issue 3] Creating daily_revenue_report with lastModified=2026-07-07T19:56:49Z …
19:56:53  INFO     [Issue 3] ✓ Stale freshness planted.
          Asset      : urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)
          lastModified: 2026-07-07T19:56:49Z (30 days ago)
19:56:53  INFO     Waiting 3s for GMS to index MCPs …
19:56:58  INFO     ─── Live verification (reading back from DataHub) ───
19:56:58  INFO     [Verify 1] Querying lineage for orders_revenue_summary …
19:56:58  INFO                upstream URN : urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)
           exists in catalog: False  ← should be False   ✓
19:56:58  INFO     [Verify 2] Querying ownership for user_churn_predictions …
19:56:58  INFO                owners: []  ← should be []   ✓
19:56:58  INFO     [Verify 3] Querying properties for daily_revenue_report …
19:56:58  INFO                lastModified : 2026-07-07T19:56:49Z
           age (days)   : 30  ← should be ~30   ✓
19:56:58  INFO     Seed complete. Check DataHub UI at http://localhost:9002
```

**Final entity counts after ingestion + seeding** (queried via GraphQL):

| Entity type | Count |
|---|---|
| DATASET | **70** (67 showcase + 3 seeded) |
| CHART | 12 |
| DASHBOARD | 0 (Looker/Tableau views stored as datasets) |
| DATA_FLOW | 23 |
| DATA_JOB | 20 |
| GLOSSARY_TERM | 10 |

---

## 4. What's Real vs. Planted

| Asset | Source | Notes |
|---|---|---|
| All showcase-ecommerce entities | Real (loaded by `datahub docker ingest-sample-data`) | Hive, Snowflake, dbt, Looker assets with rich lineage |
| `orders_revenue_summary` | **Planted** | Synthetic — the broken-lineage target |
| `orders_source_legacy` | **Planted (phantom)** | Never ingested — exists only as a dangling reference in `orders_revenue_summary`'s lineage |
| `user_churn_predictions` | **Planted** | Synthetic — the no-owner asset |
| `daily_revenue_report` | **Planted** | Synthetic — the stale freshness asset |

---

## 5. Demo Narrative (for Rahul)

**Scene: Lineage Marshal receives an incident trigger**

> "A freshness SLA breach has been detected on `daily_revenue_report` — it hasn't been updated in 30 days. The agent kicks in."

**Step 1 — Trigger receipt**
> The agent receives a simulated trigger: asset `urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)` has missed its daily freshness SLA.

**Step 2 — Lineage traversal**
> Agent calls DataHub's lineage API via MCP. It walks upstream to find root causes, and downstream to compute blast radius. During upstream traversal, it crosses into `orders_revenue_summary`... and hits a dead end: `orders_source_legacy` doesn't exist in the catalog.

**Step 3 — Ownership lookup**
> Agent resolves owners for all affected downstream assets. For `user_churn_predictions` (downstream of the revenue pipeline), the ownership API returns an empty list. The agent notes: "Cannot notify — no owner."

**Step 4 — Blast radius scoring**
> Agent computes blast radius using lineage depth + usage stats. The daily revenue report feeds the finance dashboard — high usage, high priority.

**Step 5 — Plain-English brief to owner**
> Agent notifies `datahub` (the owner of `daily_revenue_report`) with a summary: pipeline down for 30 days, broken upstream lineage at `orders_source_legacy`, one downstream orphaned asset with no owner.

**Step 6 — Context Document written back to DataHub**
> Agent writes an incident context doc onto `daily_revenue_report` in DataHub: what broke, blast radius, resolution status. The next engineer (or agent) who looks at this asset sees the full incident history — zero re-investigation needed.

---

## 6. Re-seeding After a Docker Wipe

If you wipe and rebuild DataHub containers (common during development), the planted issues will be gone. Restore them:

```bash
# 1. Re-init CLI auth
datahub init --username datahub --password datahub --force

# 2. Re-load sample data
datahub docker ingest-sample-data --pack showcase-ecommerce

# 3. Re-plant the 3 issues (idempotent — safe to run even if some assets survived)
python3 scripts/seed_demo_issues.py
```
