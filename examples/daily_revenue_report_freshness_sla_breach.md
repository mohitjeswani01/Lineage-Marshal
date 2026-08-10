# Lineage Marshal — Investigation Report

**Generated:** 2026-08-10T13:56:38.176215+00:00

## Trigger

- **Asset:** `urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)`
- **Type:** FRESHNESS_SLA_BREACH
- **Time:** 2026-08-10T13:53:11.375224+00:00
- **Source:** manual
- **Context:** {
  "sla_hours": 24,
  "hours_since_last_update": 720,
  "expected_cadence": "DAILY"
}

## Blast Radius Summary

3 downstream asset(s) affected; 1 high; 1 with no owner.

## Impacted Assets

### 1. `urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD)`

- **Hop Distance:** 1
- **Impact Label:** HIGH
- **Impact Score:** 0.550
- **Usage Data Available:** Yes

**Ownership:**
- ❌ No owner assigned for urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD) — cannot notify

**Business Context:**
- No glossary terms associated

### 2. `urn:li:dataset:(urn:li:dataPlatform:hive,executive_finance_summary,PROD)`

- **Hop Distance:** 1
- **Impact Label:** MEDIUM
- **Impact Score:** 0.350
- **Usage Data Available:** Yes

**Ownership:**
- urn:li:corpuser:bob [corpuser]
- **Notification Priority:** ALL

**Business Context:**
- No glossary terms associated

### 3. `urn:li:dataset:(urn:li:dataPlatform:hive,revenue_analytics_dashboard,PROD)`

- **Hop Distance:** 1
- **Impact Label:** MEDIUM
- **Impact Score:** 0.350
- **Usage Data Available:** Yes

**Ownership:**
- urn:li:corpuser:alice [corpuser]
- **Notification Priority:** ALL

**Business Context:**
- No glossary terms associated

## ⚠️ Unknowns & Gaps

- No owner assigned for urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD) — cannot notify
- No business glossary terms found for urn:li:dataset:(urn:li:dataPlatform:hive,churn_risk_dashboard,PROD)
- No business glossary terms found for urn:li:dataset:(urn:li:dataPlatform:hive,executive_finance_summary,PROD)
- No business glossary terms found for urn:li:dataset:(urn:li:dataPlatform:hive,revenue_analytics_dashboard,PROD)

## Prior Incidents (Context Documents)

- **urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)**
  - Description: ## Investigation 1 — 2026-08-10T11:36:52.360000+00:00 (by urn:li:corpuser:datahub)

Test investigation context document...
