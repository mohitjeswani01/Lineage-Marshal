/**
 * Minimal fetch wrapper for the agent API.
 *
 * Deliberately not a client library: one function, typed errors, an abort
 * signal. The value it adds over bare `fetch` is that a network failure, a
 * non-2xx, and a malformed body all arrive as the same `ApiError` shape, so
 * every caller can render one honest error state.
 */

/** Empty in dev (the Vite proxy handles /api); set for a deployed backend. */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export type ApiErrorKind = 'network' | 'http' | 'parse' | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly url: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    url: string,
    status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.url = url;
  }

  /** Copy suitable for showing a user, with a concrete next action. */
  get userMessage(): string {
    switch (this.kind) {
      case 'network':
        return `Can't reach the Lineage Marshal agent at ${this.url}. Start the agent API and try again.`;
      case 'http':
        return this.status === 404
          ? `The agent responded, but ${this.url} isn't implemented yet (404).`
          : `The agent returned ${this.status ?? 'an error'} for ${this.url}.`;
      case 'parse':
        return `The agent's response at ${this.url} wasn't valid JSON.`;
      case 'aborted':
        return 'Request cancelled.';
    }
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  /** Fail fast rather than hanging on a dead port. */
  timeoutMs?: number;
}

export async function request<T>(
  path: string,
  { method = 'GET', body, signal, timeoutMs = 30_000 }: RequestOptions = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: combined,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (signal?.aborted) throw new ApiError('aborted', 'Aborted', url);
    const detail = err instanceof Error ? err.message : String(err);
    throw new ApiError('network', detail, url);
  }

  if (!res.ok) {
    // Surface the server's own message when it sends one — much better than
    // "Request failed" when debugging a real backend.
    const detail = await res.text().catch(() => '');
    throw new ApiError(
      'http',
      detail.slice(0, 500) || res.statusText,
      url,
      res.status,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('parse', 'Invalid JSON', url);
  }
}
