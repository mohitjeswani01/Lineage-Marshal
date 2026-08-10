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
 * Fire an incident trigger. The agent walks lineage, resolves owners and
 * scores blast radius, so this can legitimately take tens of seconds.
 */
export const sendTrigger = (body: TriggerRequest, signal?: AbortSignal) =>
  request<TriggerResponse>('/api/trigger', {
    method: 'POST',
    body,
    signal,
    timeoutMs: 120_000,
  });
