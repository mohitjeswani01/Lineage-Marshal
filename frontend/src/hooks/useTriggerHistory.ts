import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Severity, TriggerResponse, TriggerType, Urn } from '@/api/contract';

/** One local record of a trigger the user fired from this browser. */
export interface HistoryEntry {
  id: string;
  urn: Urn;
  assetName: string;
  triggerType: TriggerType;
  severity: Severity;
  note?: string;
  /** ISO-8601, stamped client-side when the response landed. */
  firedAt: string;
  durationMs: number;
  outcome: 'success' | 'error';
  /** Present on success — replayed into the response panel on click. */
  response?: TriggerResponse;
  /** Present on failure — the honest reason, kept for debugging a demo. */
  errorMessage?: string;
}

const KEY = 'lm.triggerHistory';
const LIMIT = 25;

/**
 * Trigger history, local to the browser.
 *
 * Deliberately client-only: the agent owns incident state, this is just "what
 * did I click in this session" so a demo can be replayed without re-running
 * the agent. Capped at 25 entries because full agent responses are fat and
 * localStorage is a 5 MB budget shared with everything else.
 */
export function useTriggerHistory() {
  const [entries, setEntries] = useLocalStorage<HistoryEntry[]>(KEY, []);

  /** Returns the new entry's id so a still-running investigation can fill it in. */
  const add = useCallback(
    (entry: Omit<HistoryEntry, 'id'>) => {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${entry.firedAt}-${Math.round(performance.now())}`;
      setEntries((prev) => [{ ...entry, id }, ...prev].slice(0, LIMIT));
      return id;
    },
    [setEntries],
  );

  /**
   * Patch an existing entry. The agent accepts a trigger long before it
   * finishes, so an entry is written at fire time and completed later.
   */
  const update = useCallback(
    (id: string, patch: Partial<Omit<HistoryEntry, 'id'>>) =>
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      ),
    [setEntries],
  );

  const remove = useCallback(
    (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    [setEntries],
  );

  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, add, update, remove, clear };
}
