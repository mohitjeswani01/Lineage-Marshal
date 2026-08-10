# Lineage Marshal — Investigation Report

**Generated:** 2026-08-10T13:58:12.050005+00:00

## Trigger

- **Asset:** `urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)`
- **Type:** JOB_FAILURE
- **Time:** 2026-08-10T13:57:31.213442+00:00
- **Source:** manual
- **Context:** {
  "job_name": "train_churn_model",
  "exit_code": 137,
  "error": "OOMKilled"
}

## Blast Radius Summary

1 downstream asset(s) affected; 1 high; 1 with no owner.

## Impacted Assets

### 1. `urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD)`

- **Hop Distance:** 1
- **Impact Label:** HIGH
- **Impact Score:** 0.550
- **Usage Data Available:** Yes

**Ownership:**
- ❌ No owner assigned for urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD) — cannot notify

**Business Context:**
- No glossary terms associated

## ⚠️ Unknowns & Gaps

- No owner assigned for urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD) — cannot notify
- No business glossary terms found for urn:li:dataset:(urn:li:dataPlatform:hive,marketing_campaign_target_list,PROD)

## Prior Incidents (Context Documents)

- **urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)**
  - Description: ## Investigation 1 — 2026-08-10T12:04:12.902000+00:00 (by urn:li:corpuser:datahub)

### Incident Investigation Context
Tested by Lineage Marshal Agent Phase 1

---

## Investigation 2 — 2026-08-10T12:...
