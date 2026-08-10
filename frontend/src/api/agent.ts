import { request } from './client';
import type {
  AssetsResponse,
  HealthResponse,
  TriggerRequest,
  TriggerResponse,
} from './contract';

/** Agent liveness + whether it can currently reach DataHub GMS. */
export const getHealth = (signal?: AbortSignal) =>
  request<HealthResponse>('/api/health', { signal, timeoutMs: 5_000 });

/** The real DataHub catalog, as exposed by the agent. */
export const listAssets = (signal?: AbortSignal) =>
  request<AssetsResponse>('/api/assets', { signal, timeoutMs: 15_000 });

/**
 * Fire an incident trigger.
 *
 * This resolves as soon as the agent has *accepted* the incident — the
 * response carries a `triggerId` and `status: 'accepted'`, nothing more. The
 * investigation itself runs in the background; follow it with
 * `useTriggerProgress` and collect the findings with `getTriggerResult`.
 */
export const sendTrigger = (body: TriggerRequest, signal?: AbortSignal) =>
  request<TriggerResponse>('/api/trigger', {
    method: 'POST',
    body,
    signal,
    timeoutMs: 30_000,
  });

/**
 * The completed investigation: lineage, owners, blast radius, brief.
 *
 * Only valid once progress reports `completed` — until then the agent answers
 * 202, which arrives here as an `ApiError` rather than a half-filled report.
 */
export const getTriggerResult = (triggerId: string, signal?: AbortSignal) =>
  request<TriggerResponse>(`/api/trigger/${triggerId}`, {
    signal,
    timeoutMs: 15_000,
  });
