import { useEffect, useRef, useState } from 'react';
import { request } from '@/api/client';
import type { PipelineProgress, PipelineStep } from '@/api/contract';

const POLL_INTERVAL_MS = 1000;

/**
 * A missing or broken progress endpoint shouldn't turn into a request every
 * second forever. The tolerance is generous on purpose: the agent answers 404
 * for the first moments after accepting a trigger, while the background task
 * is still spinning up, and that must not read as a dead endpoint.
 */
const MAX_CONSECUTIVE_FAILURES = 8;

interface UseTriggerProgressOptions {
  triggerId?: string;
  enabled?: boolean;
  onComplete?: (progress: PipelineProgress) => void;
  onError?: (error: Error) => void;
}

/**
 * Polls the agent for live pipeline progress on one trigger.
 *
 * Polling is keyed strictly on `triggerId` + `enabled`. The callbacks are held
 * in a ref on purpose: callers pass inline arrows, and including those in the
 * effect's dependencies would tear down and re-create the interval on every
 * render — which also re-runs `setIsPolling`, and loops.
 */
export function useTriggerProgress({
  triggerId,
  enabled = true,
  onComplete,
  onError,
}: UseTriggerProgressOptions) {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const callbacks = useRef({ onComplete, onError });
  useEffect(() => {
    callbacks.current = { onComplete, onError };
  });

  useEffect(() => {
    if (!enabled || !triggerId) {
      setIsPolling(false);
      return;
    }

    let cancelled = false;
    let failures = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();

    const stop = () => {
      if (interval) clearInterval(interval);
      interval = undefined;
      setIsPolling(false);
    };

    const tick = async () => {
      try {
        const data = await request<PipelineProgress>(
          `/api/trigger/${triggerId}/progress`,
          { signal: controller.signal, timeoutMs: 5_000 },
        );
        if (cancelled) return;

        failures = 0;
        setProgress(data);

        if (data.status === 'completed' || data.status === 'failed') {
          stop();
          callbacks.current.onComplete?.(data);
        }
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          stop();
          callbacks.current.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }
    };

    setProgress(null);
    setIsPolling(true);
    void tick();
    interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      controller.abort();
    };
  }, [enabled, triggerId]);

  return { progress, isPolling };
}

/**
 * Where a single step stands. `failedStep` wins over `completedSteps` so a
 * step that failed after partial work never renders as a green tick.
 */
export function getStepStatus(
  progress: PipelineProgress | null,
  step: PipelineStep,
): 'pending' | 'running' | 'completed' | 'failed' {
  if (!progress) return 'pending';
  if (progress.failedStep === step) return 'failed';
  if (progress.completedSteps.includes(step)) return 'completed';
  if (progress.currentStep === step && progress.status === 'running') {
    return 'running';
  }
  return 'pending';
}
