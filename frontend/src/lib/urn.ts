/**
 * DataHub URN helpers.
 *
 * Format: urn:li:dataset:(urn:li:dataPlatform:<platform>,<name>,<env>)
 * Parsing is deliberately lenient — the agent is the authority on validity;
 * the frontend only needs enough structure to label a row and to stop an
 * obviously malformed string before it costs a round trip.
 */

export interface ParsedUrn {
  entityType: string;
  platform?: string;
  name?: string;
  env?: string;
}

const URN_RE = /^urn:li:([a-zA-Z]+):\((.+)\)$/;

export function parseUrn(urn: string): ParsedUrn | null {
  const match = URN_RE.exec(urn.trim());
  if (!match) return null;
  const [, entityType = '', inner = ''] = match;

  // Split on top-level commas only — the platform URN contains colons but no
  // commas, so a plain split is safe for dataset URNs.
  const parts = inner.split(',');
  if (parts.length < 3) return { entityType };

  return {
    entityType,
    platform: parts[0]?.split(':').pop(),
    name: parts[1],
    env: parts[2],
  };
}

/** Client-side gate before firing a trigger. Cheap, not authoritative. */
export function isValidUrn(urn: string): boolean {
  return URN_RE.test(urn.trim());
}

/** Best-effort display name; falls back to the raw URN. */
export function urnDisplayName(urn: string): string {
  return parseUrn(urn)?.name ?? urn;
}

/** Deep link into the local DataHub UI for an entity. */
export function datahubUrl(urn: string): string {
  const base = (
    import.meta.env.VITE_DATAHUB_UI_URL ?? 'http://localhost:9002'
  ).replace(/\/$/, '');
  const parsed = parseUrn(urn);
  const entity = parsed?.entityType ?? 'dataset';
  return `${base}/${entity}/${encodeURIComponent(urn)}`;
}
