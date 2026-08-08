import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/shell/AppShell';
import { AssetSelector } from '@/features/trigger/AssetSelector';
import { TriggerPanel } from '@/features/trigger/TriggerPanel';
import { ResponsePanel } from '@/features/trigger/ResponsePanel';
import { TriggerHistory } from '@/features/trigger/TriggerHistory';
import { Timeline } from '@/features/trigger/Timeline';
import { sendTrigger } from '@/api/agent';
import { DEMO_ASSETS } from '@/api/demoAssets';
import type { TriggerRequest, TriggerResponse } from '@/api/contract';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { useTriggerHistory, type HistoryEntry } from '@/hooks/useTriggerHistory';
import { useTriggerProgress } from '@/hooks/useTriggerProgress';
import { urnDisplayName } from '@/lib/urn';
import { fadeInUp, staggerList } from '@/design';

export function TriggerDemoPage() {
  const [selectedUrn, setSelectedUrn] = useState<string>(
    DEMO_ASSETS[0]?.urn ?? '',
  );
  const [replayed, setReplayed] = useState<HistoryEntry>();
  const [elapsedMs, setElapsedMs] = useState<number>();
  const [triggerId, setTriggerId] = useState<string>();

  const toast = useToast();
  const history = useTriggerHistory();
  const startedAt = useRef(0);

  const trigger = useAsync<TriggerResponse, [TriggerRequest]>(
    (signal, request) => sendTrigger(request, signal),
  );

  const { progress, isPolling } = useTriggerProgress({
    triggerId,
    enabled: !!triggerId && trigger.status === 'loading',
    onComplete: (p) => {
      if (p.status === 'failed') {
        toast.push({
          tone: 'error',
          title: 'Investigation failed',
          description: p.error ?? `Failed at ${p.failedStep ?? 'unknown step'}`,
        });
      }
    },
  });

  useEffect(() => {
    if (trigger.status !== 'loading') return;
    const id = setInterval(
      () => setElapsedMs(performance.now() - startedAt.current),
      100,
    );
    return () => clearInterval(id);
  }, [trigger.status]);

  const handleSelect = useCallback((urn: string) => setSelectedUrn(urn), []);

  const handleSubmit = useCallback(
    async (request: TriggerRequest) => {
      setReplayed(undefined);
      setTriggerId(undefined);
      startedAt.current = performance.now();
      setElapsedMs(0);

      const result = await trigger.run(request);
      const durationMs = performance.now() - startedAt.current;
      setElapsedMs(durationMs);

      if (!result.ok && result.error === null) return;

      const base = {
        urn: request.urn,
        assetName: urnDisplayName(request.urn),
        triggerType: request.triggerType,
        severity: request.severity,
        note: request.note,
        firedAt: new Date().toISOString(),
        durationMs,
      };

      if (result.ok) {
        setTriggerId(result.data.triggerId);
        history.add({ ...base, outcome: 'success', response: result.data });
        toast.push({
          tone: 'success',
          title: 'Trigger accepted',
          description: `${base.assetName} · Investigation started`,
        });
      } else {
        history.add({
          ...base,
          outcome: 'error',
          errorMessage: result.error.userMessage,
        });
        toast.push({
          tone: 'error',
          title: 'Trigger failed',
          description: result.error.userMessage,
        });
      }
    },
    [trigger, history, toast],
  );

  const displayed = replayed?.response ?? trigger.data;
  const displayStatus = replayed
    ? ('success' as const)
    : trigger.status === 'idle'
      ? ('idle' as const)
      : trigger.status;

  const showTimeline = !!triggerId && (trigger.status === 'loading' || isPolling);

  return (
    <AppShell
      title="Trigger demo"
      subtitle="Send an incident signal to the Lineage Marshal agent and inspect its response"
    >
      <motion.div
        variants={staggerList}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-12"
      >
        <motion.div variants={fadeInUp} className="lg:col-span-4 lg:row-span-3">
          <AssetSelector selectedUrn={selectedUrn} onSelect={handleSelect} />
        </motion.div>

        <motion.div variants={fadeInUp} className="lg:col-span-3">
          <TriggerPanel
            urn={selectedUrn}
            submitting={trigger.status === 'loading'}
            onSubmit={(request) => void handleSubmit(request)}
            onCancel={trigger.reset}
          />
        </motion.div>

        {showTimeline && (
          <motion.div
            variants={fadeInUp}
            className="lg:col-span-5"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Timeline progress={progress} triggerId={triggerId} />
          </motion.div>
        )}

        <motion.div
          variants={fadeInUp}
          className={showTimeline ? 'lg:col-span-5 lg:row-span-2' : 'lg:col-span-5 lg:row-span-2'}
        >
          <ResponsePanel
            status={displayStatus}
            response={displayed}
            error={trigger.error}
            elapsedMs={replayed?.durationMs ?? elapsedMs}
          />
        </motion.div>

        <motion.div variants={fadeInUp} className="lg:col-span-3">
          <TriggerHistory
            entries={history.entries}
            activeId={replayed?.id}
            onReplay={setReplayed}
            onRemove={history.remove}
            onClear={history.clear}
          />
        </motion.div>
      </motion.div>
    </AppShell>
  );
}