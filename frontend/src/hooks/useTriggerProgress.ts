import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '@/api/client';
import type { PipelineProgress, PipelineStep } from '@/api/contract';

const POLL_INTERVAL_MS = 1000;

interface UseTriggerProgressOptions {
  triggerId?: string;
  enabled?: boolean;
  onComplete?: (progress: PipelineProgress) => void;
  onError?: (error: Error) => void;
}

export function useTriggerProgress({
  triggerId,
  enabled = true,
  onComplete,
  onError,
}: UseTriggerProgressOptions) {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    abortControllerRef.current?.abort();
    setIsPolling(false);
  }, []);

  const fetchProgress = useCallback(async () => {
    if (!triggerId) return;
    
    abortControllerRef.current = new AbortController();
    try {
      const data = await request<PipelineProgress>(
        `/api/trigger/${triggerId}/progress`,
        { signal: abortControllerRef.current.signal, timeoutMs: 5_000 }
      );
      
      if (!data) return;
      
      setProgress(data);
      
      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling();
        if (onComplete) onComplete(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        if (onError) onError(err);
      }
    }
  }, [triggerId, onComplete, onError, stopPolling]);

  useEffect(() => {
    if (!enabled || !triggerId) {
      stopPolling();
      return;
    }

    setIsPolling(true);
    fetchProgress();

    intervalRef.current = setInterval(fetchProgress, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [enabled, triggerId, fetchProgress, stopPolling]);

  const refetch = useCallback(() => {
    fetchProgress();
  }, [fetchProgress]);

  const reset = useCallback(() => {
    stopPolling();
    setProgress(null);
  }, [stopPolling]);

  return {
    progress,
    isPolling,
    refetch,
    reset,
  };
}

export function getStepIndex(step: PipelineStep): number {
  return PIPELINE_STEPS.indexOf(step);
}

export function isStepCompleted(progress: PipelineProgress | null, step: PipelineStep): boolean {
  if (!progress) return false;
  return progress.completedSteps.includes(step);
}

export function isStepCurrent(progress: PipelineProgress | null, step: PipelineStep): boolean {
  if (!progress) return false;
  return progress.currentStep === step;
}

export function isStepFailed(progress: PipelineProgress | null, step: PipelineStep): boolean {
  if (!progress) return false;
  return progress.failedStep === step;
}

export function getStepStatus(
  progress: PipelineProgress | null,
  step: PipelineStep
): 'pending' | 'running' | 'completed' | 'failed' {
  if (!progress) return 'pending';
  if (progress.failedStep === step) return 'failed';
  if (progress.completedSteps.includes(step)) return 'completed';
  if (progress.currentStep === step) return 'running';
  return 'pending';
}

const PIPELINE_STEPS = [
  'detect',
  'investigate',
  'resolve_owner',
  'notify',
  'write_back',
] as const;