# Context Document Write-Back — Technical Specification

> **Issue 10:** After an investigation completes, the agent writes a Context Document back onto the affected asset(s) in DataHub recording what happened, blast radius, and resolution status, so the next investigation inherits this knowledge instead of starting from zero.

## Overview

The Context Document Write-Back feature implements **knowledge inheritance** — every investigation produces a versioned, append-only document stored in DataHub's `InstitutionalMemory` aspect. Subsequent investigations on the same or downstream assets automatically read and incorporate prior context.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTEXT DOCUMENT LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐ │
│   │ INVESTIGATE │────▶│  GENERATE   │────▶│  WRITE TO   │────▶│  READ   │ │
│   │  PIPELINE   │     │   REPORT    │     │  DataHub    │     │  PRIOR  │ │
│   └─────────────┘     └─────────────┘     └─────────────┘     └─────────┘ │
│         │                   │                   │                   │       │
│         ▼                   ▼                   ▼                   ▼       │
│   • Trigger event     • Markdown report  • InstitutionalMemory  • get_    │
│   • Blast radius      • JSON + MD        • Aspect (append)     context_ │
│   • Ownership         • Prior incidents  • Versioned elements  document │
│   • Glossary          • Unknowns/gaps    • Audit stamps        ()       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## DataHub Integration: InstitutionalMemory Aspect

### Why InstitutionalMemory?

| Requirement | Solution |
|-------------|----------|
| **Append-only** | `InstitutionalMemoryClass.elements` is a list — we append, never replace |
| **Versioning** | Each element has `createStamp` (audit timestamp + actor) |
| **Visibility** | `settings.showInAssetPreview = true` → appears in DataHub UI Documentation tab |
| **Queryable** | Standard DataHub GraphQL/REST API for reading history |
| **Native** | First-class DataHub aspect, no custom schema needed |

### Aspect Structure

```python
InstitutionalMemoryClass(
    elements=[
        InstitutionalMemoryMetadataClass(
            url=urn,                                    # Asset URN
            description=markdown_report,                # Full investigation report
            createStamp=AuditStampClass(time=ms, actor=urn),
            updateStamp=AuditStampClass(time=ms, actor=urn),
            settings=InstitutionalMemoryMetadataSettingsClass(
                showInAssetPreview=True                # Shows in UI
            )
        ),
        # ... previous elements preserved ...
    ]
)
```

## Implementation

### Core Module: `agent/core/writeback.py`

```python
def write_context_document(urn: str, markdown_content: str, actor: str = "urn:li:corpuser:datahub") -> WriteResult:
    """
    Write investigation context document to InstitutionalMemory aspect (append semantics).
    
    Args:
        urn: Target asset URN
        markdown_content: Rendered investigation report
        actor: Corpuser URN performing the write
        
    Returns:
        WriteResult with success status, element count, or error
    """
    # 1. Read existing InstitutionalMemory
    existing = graph.get_aspect(urn, InstitutionalMemoryClass)
    
    # 2. Create new element with audit stamp
    new_element = InstitutionalMemoryMetadataClass(
        url=urn,
        description=markdown_content,
        createStamp=audit_stamp,
        updateStamp=audit_stamp,
        settings=InstitutionalMemoryMetadataSettingsClass(showInAssetPreview=True)
    )
    
    # 3. APPEND (not replace) — preserve history
    elements = (existing.elements if existing else []) + [new_element]
    
    # 4. Emit via REST emitter
    mcp = MetadataChangeProposalWrapper(entityUrn=urn, aspect=InstitutionalMemoryClass(elements=elements))
    emitter.emit_mcp(mcp)
    
    return WriteResult(success=True, urn=urn, elements_count=len(elements))
```

### Reading Prior Context: `agent/mcp/tools.py` → `agent/core/writeback.py`

```python
def read_context_document(urn: str) -> Union[ContextDocumentResult, NoData]:
    """Read investigation context documents from InstitutionalMemory aspect."""
    im = graph.get_aspect(urn, InstitutionalMemoryClass)
    
    if im is None or not im.elements:
        return NoData(reason="No context documents found", urn=urn)
    
    # Combine all elements into single markdown (chronological)
    parts = []
    for i, elem in enumerate(im.elements):
        timestamp = datetime.fromtimestamp(elem.createStamp.time / 1000, tz=timezone.utc).isoformat()
        actor = elem.createStamp.actor
        parts.append(f"## Investigation {i + 1} — {timestamp} (by {actor})\n\n{elem.description}")
    
    combined = "\n\n---\n\n".join(parts)
    return ContextDocumentResult(urn=urn, description=combined, documents=[{"elements": len(im.elements)}])
```

## Pipeline Integration

### In `agent/api/routes.py` — `_run_full_pipeline()`

```python
# Step 5: Read prior context (BEFORE generating report)
prior_context_docs = {}
for asset in blast.downstream_assets:
    prior_context_docs[asset.urn] = read_context_document(asset.urn)
prior_context_docs[request.urn] = read_context_document(request.urn)

# Step 6: Generate report (includes prior_incidents section)
report = generate_investigation_report(
    trigger_event=event,
    blast_radius=blast,
    ownership_map=ownership_map,
    glossary_map=glossary_map,
    prior_context_docs=prior_context_docs,  # ← Passed to report generator
)

# Step 7: Write back (appends to existing)
report_markdown = render_report(report)
write_result = await write_context_document(request.urn, report_markdown)
```

### In `agent/core/report.py` — `generate_investigation_report()`

```python
# Read prior context documents and include in report
prior_incidents: List[Dict[str, Any]] = []
for urn, doc_result in prior_context_docs.items():
    if isinstance(doc_result, NoData):
        continue
    # Filter out fake context docs (raw entity metadata)
    desc = doc_result.description or ""
    if desc.strip().startswith("[{") or desc.strip().startswith("{\"urn\""):
        continue
    prior_incidents.append(_context_doc_to_dict(doc_result))

if not prior_incidents:
    unknowns.append("First occurrence — no prior investigation context found on any impacted asset")

return InvestigationReport(
    trigger=trigger_dict,
    blast_radius_summary=blast_radius.summary,
    impacted_assets=impacted_assets,
    unknowns=unknowns,
    prior_incidents=prior_incidents,  # ← Included in report
)
```

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| **First investigation** | No prior context → report includes "First occurrence" in Unknowns |
| **Existing context docs** | Appends new element; all versions preserved |
| **Write failure (auth/network)** | Returns `WriteResult(success=False, error=...)` — pipeline marks step failed, logs error, doesn't silently succeed |
| **Phantom context docs** | Filters out raw entity metadata (starts with `[{` or `{"urn"`) that MCP might return |
| **Large documents** | No hard limit; DataHub handles large aspects |
| **Concurrent writes** | REST emitter is sequential; last-write-wins for the aspect but elements are additive |

## Verification

### CLI Test

```bash
# First run — creates v1
python -m agent.cli investigate \
  --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
  --type FRESHNESS_SLA_BREACH \
  --context '{"sla_hours": 24}'

# Output: "Total versions : 1"

# Second run — appends v2, reads v1 as prior context
python -m agent.cli investigate \
  --urn "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)" \
  --type FRESHNESS_SLA_BREACH \
  --context '{"sla_hours": 24, "re_run": true}'

# Output: "Total versions : 2"
# Report includes "## Prior Incidents" section with v1 content
```

### DataHub UI Verification

1. Open asset in DataHub UI (`http://localhost:9002`)
2. Go to **Documentation** tab
3. **Verify:** Multiple investigation reports visible, each with:
   - Timestamp
   - Actor
   - Full markdown report content
   - Version chronological order

### Frontend Verification

1. Open `http://localhost:5173`
2. Fire trigger on same asset twice
3. History panel shows both runs
4. Click second run → Response panel shows **Prior Incidents** section with first run's findings

## API Contract

The write-back is triggered via the pipeline's `write_back` step. Frontend polls `/api/trigger/{id}/progress`:

```json
{
  "triggerId": "abc123",
  "currentStep": "write_back",
  "completedSteps": ["detect", "investigate", "resolve_owner", "notify", "write_back"],
  "status": "completed",
  "stepDetails": {
    "write_back": {
      "status": "completed",
      "metadata": {
        "written": true,
        "elements": 2
      }
    }
  }
}
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `DATAHUB_GMS_URL` | `http://localhost:8080` | GMS endpoint for REST emitter |
| `DATAHUB_GMS_TOKEN` | `` | PAT for authenticated writes |
| `TOOLS_IS_MUTATION_ENABLED` | `true` | Must be `true` for MCP mutation tools (InstitutionalMemory write) |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `WriteResult: FAILED` | `TOOLS_IS_MUTATION_ENABLED=false` | Set to `true` in `.env`, restart MCP server |
| `401 Unauthorized` | Invalid/expired PAT | Regenerate PAT in DataHub UI, update `.env`, re-run `datahub init` |
| `InstitutionalMemory aspect not found` | Asset doesn't exist | Verify asset URN exists in DataHub (`datahub get --urn <URN>`) |
| Context not appearing in UI | `showInAssetPreview=false` | Code sets to `true` — verify DataHub version supports this setting |

## Future Enhancements

- [ ] Cross-asset context linking (write to all downstream assets, not just trigger asset)
- [ ] Structured context (JSON + Markdown) for programmatic querying
- [ ] Context expiration/archival policies
- [ ] Webhook on context document creation for external systems