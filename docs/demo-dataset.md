# Demo Dataset — Lineage Marshal

> **Purpose:** This document describes the demo dataset used for Lineage Marshal's hackathon demo. It covers: what the `showcase-ecommerce` pack contains, the 3 deliberate trigger issues and 6 downstream fan-out assets we planted on top of it, and a demo narrative script for Rahul to use during the demo.

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

## 2. Planted Demo Issues & Downstream Fan-out

We layered 3 trigger issues and multi-hop downstream fan-out assets on top of the showcase data using `scripts/seed_demo_issues.py`. All are on platform `hive`, environment `PROD` — consistent with the showcase pack's existing Hive assets so they appear naturally in search alongside real data.

**Script:** `scripts/seed_demo_issues.py`  
**Idempotency:** Re-running the script is safe. It uses a check-if-exists-then-upsert pattern (`DataHubGraph.get_aspect()` → skip create, re-emit aspects). If you wipe and rebuild Docker containers, re-run the script to restore planted issues.

```bash
# Restore planted issues after a Docker wipe:
python3 scripts/seed_demo_issues.py

# Against a non-default GMS URL or with a PAT:
python3 scripts/seed_demo_issues.py --gms-url http://localhost:8080 --token <your-PAT>
```

---

### Issue 1 — Broken Lineage Edge & Downstream Fan-out

#### Primary Trigger Asset
| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)` |
| **Asset name** | `orders_revenue_summary` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | An `UpstreamLineage` aspect pointing to a dangling upstream URN that was never ingested |
| **Dangling upstream URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)` |
| **Why this is realistic** | A decommissioned source table — the lineage edge was never cleaned up when the table was dropped |

#### Downstream Assets
1. **`monthly_reconciliation_report`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,monthly_reconciliation_report,PROD)`
   - **Lineage Position:** Hop 1 downstream of `orders_revenue_summary`
   - **Ownership:** `urn:li:corpuser:charlie` (Assigned owner)
   - **Why this is realistic:** Monthly financial reconciliation report derived from daily order revenue totals.
2. **`legacy_audit_export`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,legacy_audit_export,PROD)`
   - **Lineage Position:** Hop 2 downstream of `orders_revenue_summary` (via `monthly_reconciliation_report`)
   - **Ownership:** `[]` (Explicitly ownerless)
   - **Why this is realistic:** Legacy audit compliance export script orphaned after a team reorg.

**How to detect it:**
- **UI:** Search `orders_revenue_summary` → open Lineage tab → upstream node `orders_source_legacy` appears but clicking it shows "Entity not found" / no metadata
- **MCP/API:** `get_lineage(urn)` returns `orders_source_legacy` as upstream; `get_dataset_properties(orders_source_legacy URN)` returns null/404

**Demo significance:** Lineage Marshal identifies the dangling upstream reference, computes blast radius across both downstream hops, and flags `legacy_audit_export` as unnotifiable due to missing ownership.

---

### Issue 2 — No Owner Assigned & Downstream Target

#### Primary Trigger Asset
| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)` |
| **Asset name** | `user_churn_predictions` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | `OwnershipClass(owners=[])` — an explicitly empty ownership aspect |
| **Why this is realistic** | ML model output orphaned after a team reorg — the owning team dissolved and nobody re-assigned it |

#### Downstream Asset
1. **`marketing_campaign_target_list`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD)`
   - **Lineage Position:** Hop 1 downstream of `user_churn_predictions`
   - **Ownership:** `[]` (Explicitly ownerless)
   - **Why this is realistic:** Automated target list fed by ML model outputs for re-engagement campaigns; also orphaned after team changes.

**How to detect it:**
- **UI:** Search `user_churn_predictions` → open Governance tab → Owners section is empty
- **MCP/API:** `get_owners(urn)` returns `[]` (empty list)

**Demo significance:** Lineage Marshal detects that neither the root model output nor its downstream campaign list has an assigned owner, highlighting an urgent operational gap in the blast radius analysis.

---

### Issue 3 — Stale Freshness Signal & Multi-Hop Downstream Fan-out

#### Primary Trigger Asset
| Field | Value |
|---|---|
| **Asset URN** | `urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)` |
| **Asset name** | `daily_revenue_report` |
| **Platform / env** | `hive` / `PROD` |
| **What was planted** | `DatasetPropertiesClass.lastModified` set to **30 days before the seed script ran** |
| **Expected cadence** | Daily (documented in `customProperties.expected_update_cadence`) |
| **Owner** | `urn:li:corpuser:datahub` (has an owner — this is not an ownership issue) |

#### Downstream Assets
1. **`revenue_analytics_dashboard`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,revenue_analytics_dashboard,PROD)`
   - **Lineage Position:** Hop 1 downstream of `daily_revenue_report`
   - **Ownership:** `urn:li:corpuser:alice` (Assigned owner)
   - **Why this is realistic:** Operational analytics dashboard consumed by business analysts.
2. **`executive_finance_summary`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,executive_finance_summary,PROD)`
   - **Lineage Position:** Hop 1 downstream of `daily_revenue_report`
   - **Ownership:** `urn:li:corpuser:bob` (Assigned owner)
   - **Why this is realistic:** High-visibility executive table summarizing daily financial health.
3. **`churn_risk_dashboard`**
   - **Asset URN:** `urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD)`
   - **Lineage Position:** Hop 2 downstream of `daily_revenue_report` (via `executive_finance_summary`)
   - **Ownership:** `[]` (Explicitly ownerless)
   - **Why this is realistic:** Risk management dashboard consuming executive summaries; unowned.

**How to detect it:**
- **UI:** Search `daily_revenue_report` → Properties tab → Last Modified timestamp is 30 days old
- **MCP/API:** `get_dataset_properties(urn).lastModified.time` returns a Unix-ms timestamp ~30 days in the past; delta from now > 1 day = SLA breach for a daily pipeline

**Demo significance:** Demonstrates Lineage Marshal's composite severity ranking. `churn_risk_dashboard` ranks #1 (`HIGH` severity) due to the ownership penalty (`❌` no owner), while `executive_finance_summary` and `revenue_analytics_dashboard` rank `MEDIUM` severity.

---

## 3. Verification — Live Query Output

Actual terminal output from `python3 scripts/seed_demo_issues.py` run against the live DataHub instance:

```text
20:44:19  INFO     [Issue 3] ✓ Stale freshness & multi-hop downstream lineage planted.
          Asset      : urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)
          lastModified: 2026-07-09T20:43:58Z (30 days ago)
          Downstream Hop 1a: urn:li:dataset:(urn:li:dataPlatform:hive,revenue_analytics_dashboard,PROD) (Owner: alice)
          Downstream Hop 1b: urn:li:dataset:(urn:li:dataPlatform:hive,executive_finance_summary,PROD) (Owner: bob)
          Downstream Hop 2 : urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD) (NO OWNER)

20:44:22  INFO     ─── Live verification (reading back from DataHub) ───
20:44:22  INFO     [Verify 1] Querying lineage for orders_revenue_summary …
20:44:22  INFO                upstream URN : urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)
           exists in catalog: False  ← should be False
20:44:22  INFO     [Verify 2] Querying ownership for user_churn_predictions …
20:44:22  INFO                owners: []  ← should be []
20:44:22  INFO     [Verify 3] Querying properties for daily_revenue_report …
20:44:22  INFO                lastModified : 2026-07-09T20:43:58Z
           age (days)   : 30  ← should be ~30
```

---

## 4. What's Real vs. Planted

| Asset | Source | Notes |
|---|---|---|
| All showcase-ecommerce entities | Real (loaded by `datahub docker ingest-sample-data`) | Hive, Snowflake, dbt, Looker assets with rich lineage |
| `orders_revenue_summary` | **Planted** | Synthetic — broken-lineage trigger asset |
| `orders_source_legacy` | **Planted (phantom)** | Never ingested — dangling upstream reference |
| `monthly_reconciliation_report` | **Planted** | Synthetic — Hop 1 downstream of `orders_revenue_summary` (Owner: `charlie`) |
| `legacy_audit_export` | **Planted** | Synthetic — Hop 2 downstream of `orders_revenue_summary` (Ownerless) |
| `user_churn_predictions` | **Planted** | Synthetic — no-owner trigger asset |
| `marketing_campaign_target_list` | **Planted** | Synthetic — Hop 1 downstream of `user_churn_predictions` (Ownerless) |
| `daily_revenue_report` | **Planted** | Synthetic — stale freshness trigger asset |
| `revenue_analytics_dashboard` | **Planted** | Synthetic — Hop 1 downstream of `daily_revenue_report` (Owner: `alice`) |
| `executive_finance_summary` | **Planted** | Synthetic — Hop 1 downstream of `daily_revenue_report` (Owner: `bob`) |
| `churn_risk_dashboard` | **Planted** | Synthetic — Hop 2 downstream of `daily_revenue_report` (Ownerless) |

---

## 5. Demo Narrative (for Rahul)

**Scene: Lineage Marshal receives an incident trigger**

> "A freshness SLA breach has been detected on `daily_revenue_report` — it hasn't been updated in 30 days. Lineage Marshal kicks in."

**Step 1 — Trigger receipt**
> The agent receives a simulated trigger: asset `urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)` has missed its daily freshness SLA.

**Step 2 — Lineage & Blast Radius traversal**
> Agent calls DataHub's lineage API via MCP. It walks downstream across multiple hops to identify all dependent assets (`revenue_analytics_dashboard`, `executive_finance_summary`, `churn_risk_dashboard`).

**Step 3 — Severity & Ownership Analysis**
> Agent computes composite impact scores. `churn_risk_dashboard` ranks #1 with `HIGH` severity because of an ownership gap (`❌` no owner assigned).

**Step 4 — Plain-English brief to owner**
> Agent notifies `datahub` (owner of `daily_revenue_report`), `alice`, and `bob`, while highlighting unnotifiable ownerless downstream assets in the incident alert.

**Step 5 — Context Document written back to DataHub**
> Agent writes an incident context doc onto affected assets in DataHub so future investigations inherit the context instantly.

---

## 6. Re-seeding After a Docker Wipe

If you wipe and rebuild DataHub containers (common during development), the planted issues will be gone. Restore them:

```bash
# 1. Re-init CLI auth
datahub init --username datahub --password datahub --force

# 2. Re-load sample data
datahub docker ingest-sample-data --pack showcase-ecommerce

# 3. Re-plant issues & downstream lineage (idempotent — safe to run repeatedly)
python3 scripts/seed_demo_issues.py
```
