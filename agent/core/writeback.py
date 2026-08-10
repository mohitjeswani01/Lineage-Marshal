"""Context document write-back using DataHub InstitutionalMemory aspect.

Provides append/version semantics for investigation context documents.
Uses DataHubGraph (acryl-datahub SDK) directly since MCP doesn't expose InstitutionalMemory.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.ingestion.graph.client import DataHubGraph, DataHubGraphConfig
from datahub.metadata.schema_classes import (
    AuditStampClass,
    InstitutionalMemoryClass,
    InstitutionalMemoryMetadataClass,
    InstitutionalMemoryMetadataSettingsClass,
)

from agent.mcp.tools import ContextDocumentResult, NoData

logger = logging.getLogger(__name__)


@dataclass
class WriteResult:
    """Result of a context document write operation."""

    success: bool
    urn: str
    error: Optional[str] = None
    elements_count: int = 0


# Module-level cached graph/emitter for performance
_graph: Optional[DataHubGraph] = None
_emitter: Optional[DatahubRestEmitter] = None


def _get_graph_and_emitter() -> tuple[DataHubGraph, DatahubRestEmitter]:
    """Get or create DataHubGraph and emitter instances."""
    global _graph, _emitter
    if _graph is None or _emitter is None:
        gms_url = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
        token = os.environ.get("DATAHUB_GMS_TOKEN", "") or None

        _graph = DataHubGraph(DataHubGraphConfig(server=gms_url, token=token))
        _emitter = DatahubRestEmitter(gms_server=gms_url, token=token)
    return _graph, _emitter


def _create_audit_stamp(actor: str = "urn:li:corpuser:datahub") -> AuditStampClass:
    """Create an audit stamp with current timestamp."""
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return AuditStampClass(time=now_ms, actor=actor)


def read_context_document(urn: str) -> Union[ContextDocumentResult, NoData]:
    """Read investigation context documents from InstitutionalMemory aspect."""
    try:
        graph, _ = _get_graph_and_emitter()
        im = graph.get_aspect(urn, InstitutionalMemoryClass)

        if im is None or not im.elements:
            return NoData(reason="No context documents found", urn=urn)

        # Combine all elements into a single markdown document
        parts = []
        for i, elem in enumerate(im.elements):
            timestamp = datetime.fromtimestamp(elem.createStamp.time / 1000, tz=timezone.utc).isoformat()
            actor = elem.createStamp.actor
            parts.append(f"## Investigation {i + 1} — {timestamp} (by {actor})\n\n{elem.description}")

        combined = "\n\n---\n\n".join(parts)
        return ContextDocumentResult(urn=urn, description=combined, documents=[{"elements": len(im.elements)}])

    except Exception as e:
        logger.warning(f"Read context document failed for '{urn}': {e}")
        return NoData(reason=f"Read context document error: {e}", urn=urn)


def write_context_document(urn: str, markdown_content: str, actor: str = "urn:li:corpuser:datahub") -> WriteResult:
    """Write investigation context document to InstitutionalMemory aspect (append semantics)."""
    try:
        graph, emitter = _get_graph_and_emitter()

        # Read existing institutional memory
        existing = graph.get_aspect(urn, InstitutionalMemoryClass)

        # Create new element
        audit_stamp = _create_audit_stamp(actor)
        new_element = InstitutionalMemoryMetadataClass(
            url=urn,
            description=markdown_content,
            createStamp=audit_stamp,
            updateStamp=audit_stamp,
            settings=InstitutionalMemoryMetadataSettingsClass(showInAssetPreview=True),
        )

        if existing and existing.elements:
            elements = existing.elements + [new_element]
        else:
            elements = [new_element]

        im_class = InstitutionalMemoryClass(elements=elements)

        # Emit via REST emitter
        mcp = MetadataChangeProposalWrapper(entityUrn=urn, aspect=im_class)
        emitter.emit_mcp(mcp)

        logger.info(f"Wrote context document to {urn} (total elements: {len(elements)})")
        return WriteResult(success=True, urn=urn, elements_count=len(elements))

    except Exception as e:
        logger.error(f"Failed to write context document for '{urn}': {e}")
        return WriteResult(success=False, urn=urn, error=str(e))


def get_context_document_count(urn: str) -> int:
    """Get the number of context document versions for an asset."""
    try:
        graph, _ = _get_graph_and_emitter()
        im = graph.get_aspect(urn, InstitutionalMemoryClass)
        return len(im.elements) if im and im.elements else 0
    except Exception:
        return 0