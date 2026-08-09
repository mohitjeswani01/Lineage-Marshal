"""Ownership and business context resolution for Lineage Marshal.

Resolves actual owners with contact-identifying info (email, displayName) from DataHub,
and pulls glossary/business-definition context for plain-English notifications.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union

from agent.mcp.client import DataHubMCPClient
from agent.mcp.tools import GlossaryResult, NoData, OwnershipResult, get_glossary_context, get_ownership

logger = logging.getLogger(__name__)


@dataclass
class OwnerContact:
    """Contact-identifying information for a single owner (corpuser or corpgroup)."""

    owner_urn: str
    owner_type: Literal["corpuser", "corpgroup"]
    email: Optional[str] = None
    display_name: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OwnershipResolution:
    """Resolved ownership information for an asset."""

    has_owner: bool
    primary_owner: Optional[str] = None
    all_owners: List[OwnerContact] = field(default_factory=list)
    notification_priority: Literal["ALL", "PRIMARY_ONLY"] = "ALL"
    no_owner_finding: Optional[str] = None


@dataclass
class GlossaryTerm:
    """A single business glossary term with human-readable definition."""

    term_urn: str
    name: str
    definition: Optional[str] = None


@dataclass
class GlossaryResolution:
    """Resolved glossary/business context for an asset."""

    terms: List[GlossaryTerm] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    domain: Optional[str] = None


def _parse_owner_from_raw(raw_text: str) -> List[OwnerContact]:
    """Parse owner contact info from the raw ownership JSON text returned by MCP."""
    contacts: List[OwnerContact] = []

    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                ownership = item.get("ownership", {})
                owners = ownership.get("owners", [])
                for owner_entry in owners:
                    owner_obj = owner_entry.get("owner", {})
                    if not owner_obj:
                        continue

                    owner_urn = owner_obj.get("urn", "")
                    props = owner_obj.get("properties", {}) or {}
                    email = props.get("email")
                    display_name = props.get("displayName")

                    if "corpuser" in owner_urn:
                        owner_type = "corpuser"
                    elif "corpgroup" in owner_urn:
                        owner_type = "corpgroup"
                    else:
                        owner_type = "corpuser"

                    contacts.append(
                        OwnerContact(
                            owner_urn=owner_urn,
                            owner_type=owner_type,
                            email=email,
                            display_name=display_name,
                            raw=owner_entry,
                        )
                    )
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse ownership raw text: {e}")
        urn_match = re.search(r"urn:li:corpuser:[^\s,\"']+", str(raw_text))
        if urn_match:
            contacts.append(
                OwnerContact(
                    owner_urn=urn_match.group(0),
                    owner_type="corpuser",
                    raw={"raw_text": raw_text},
                )
            )

    return contacts


def _parse_glossary_terms(raw_text: str) -> List[GlossaryTerm]:
    """Parse glossary terms from the raw glossary JSON text returned by MCP."""
    terms: List[GlossaryTerm] = []

    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                if "error" in item:
                    continue
                glossary_terms = item.get("glossaryTerms", {})
                term_list = glossary_terms.get("terms", [])
                for term_entry in term_list:
                    term_obj = term_entry.get("term", {})
                    if not term_obj:
                        continue
                    term_urn = term_obj.get("urn", "")
                    props = term_obj.get("properties", {}) or {}
                    name = props.get("name", "")
                    definition = props.get("description")
                    if term_urn and name:
                        terms.append(
                            GlossaryTerm(term_urn=term_urn, name=name, definition=definition)
                        )
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse glossary raw text: {e}")

    return terms


def _parse_tags(raw_text: str) -> List[str]:
    """Parse tags from the raw entity JSON text."""
    tags: List[str] = []
    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                tag_list = item.get("globalTags", {}).get("tags", [])
                for tag_entry in tag_list:
                    tag_obj = tag_entry.get("tag", {})
                    props = tag_obj.get("properties", {}) or {}
                    name = props.get("name")
                    if name:
                        tags.append(name)
    except (json.JSONDecodeError, TypeError):
        pass
    return tags


def _parse_domain(raw_text: str) -> Optional[str]:
    """Parse domain from the raw entity JSON text."""
    try:
        data = json.loads(raw_text)
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                domain_assoc = item.get("domain", {})
                domain = domain_assoc.get("domain", {})
                props = domain.get("properties", {}) or {}
                name = props.get("name")
                if name:
                    return name
    except (json.JSONDecodeError, TypeError):
        pass
    return None


def resolve_ownership(client: DataHubMCPClient, urn: str) -> OwnershipResolution:
    """Resolve full ownership with contact info for an asset."""
    ownership_result = get_ownership(client, urn)

    if isinstance(ownership_result, NoData):
        return OwnershipResolution(
            has_owner=False,
            no_owner_finding=f"No ownership data available for {urn} (asset may not exist or metadata unreadable)",
        )

    all_contacts: List[OwnerContact] = []
    for owner_entry in ownership_result.owners:
        if isinstance(owner_entry, dict):
            raw = owner_entry.get("raw", "")
            if raw:
                all_contacts.extend(_parse_owner_from_raw(raw))

    has_owner = len(all_contacts) > 0
    primary_owner = all_contacts[0].owner_urn if all_contacts else None
    no_owner_finding = None if has_owner else f"No owner assigned for {urn} — cannot notify"

    return OwnershipResolution(
        has_owner=has_owner,
        primary_owner=primary_owner,
        all_owners=all_contacts,
        notification_priority="ALL",
        no_owner_finding=no_owner_finding,
    )


def resolve_glossary_context(client: DataHubMCPClient, urn: str) -> GlossaryResolution:
    """Resolve business glossary terms, tags, and domain for an asset."""
    glossary_result = get_glossary_context(client, urn)

    if isinstance(glossary_result, NoData):
        return GlossaryResolution()

    all_terms: List[GlossaryTerm] = []
    all_tags: List[str] = []
    domain: Optional[str] = None

    for term_entry in glossary_result.terms:
        if isinstance(term_entry, dict):
            raw = term_entry.get("raw", "")
            if raw:
                all_terms.extend(_parse_glossary_terms(raw))
                all_tags.extend(_parse_tags(raw))
                if domain is None:
                    domain = _parse_domain(raw)

    return GlossaryResolution(terms=all_terms, tags=all_tags, domain=domain)