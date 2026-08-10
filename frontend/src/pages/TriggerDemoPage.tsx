import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Waypoints } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AssetSelector } from '@/features/trigger/AssetSelector';
import { TriggerPanel } from '@/features/trigger/TriggerPanel';
import { ResponsePanel } from '@/features/trigger/ResponsePanel';
import { TriggerHistory } from '@/features/trigger/TriggerHistory';
import { Timeline } from '@/features/trigger/Timeline';
import { LineageGraph } from '@/features/trigger/graph/LineageGraph';
import type { GraphPhase } from '@/features/trigger/graph/GraphScene';
import { getTriggerResult, sendTrigger } from '@/api/agent';
import { ApiError } from '@/api/client';
import { DEMO_ASSETS } from '@/api/demoAssets';
import { SAMPLE_INVESTIGATION } from '@/api/sampleInvestigation';
import type { TriggerRequest, TriggerResponse } from '@/api/contract';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { useTriggerHistory, type HistoryEntry } from '@/hooks/useTriggerHistory';
import { useTriggerProgress } from '@/hooks/useTriggerProgress';
import { urnDisplayName } from '@/lib/urn';
import { fadeInUp, staggerList, transition } from '@/design';

/**
 * The investigation workspace.
 *
 * Mirrors the agent's actual three-phase lifecycle rather than pretending a
 * trigger is one request:
 *   1. POST /api/trigger        → accepted, returns a triggerId only
 *   2. GET  .../progress (poll) → live step-by-step pipeline state
 *   3. GET  /api/trigger/{id}   → the findings, once progress says completed
 *
 * Everything on screen — graph, timeline, panel — is fed from those three.
 */
export function TriggerDemoPage() {
  const [selectedUrn, setSelectedUrn] = useState<string>(
    DEMO_ASSETS[0]?.urn ?? '',
  );
  const [replayed, setReplayed] = useState<HistoryEntry>();
  const [elapsedMs, setElapsedMs] = useState<number>();
  const [triggerId, setTriggerId] = useState<string>();
  /** The completed investigation, fetched once the pipeline reports done. */
  const [result, setResult] = useState<TriggerResponse>();
  const [resultError, setResultError] = useState<ApiError>();

  const toast = useToast();
  const history = useTriggerHistory();
  const startedAt = useRef(0);
  /** History row for the in-flight run, completed when the findings land. */
  const historyId = useRef<string | undefined>(undefined);

  const trigger = useAsync<TriggerResponse, [TriggerRequest]>(
    (signal, request) => sendTrigger(request, signal),
  );

  const collectResult = useCallback(
    async (id: string) => {
      try {
        const findings = await getTriggerResult(id);
        const took = findings.durationMs ?? performance.now() - startedAt.current;

        setResult(findings);
        setElapsedMs(took);
        if (historyId.current) {
          history.update(historyId.current, {
            response: findings,
            durationMs: took,
          });
        }
        toast.push({
          tone: 'success',
          title: 'Investigation complete',
          description: findings.blastRadius?.level
            ? `Blast radius: ${findings.blastRadius.level}`
            : 'Report written back to DataHub',
        });
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError('network', String(err), `/api/trigger/${id}`);
        setResultError(apiError);
        toast.push({
          tone: 'error',
          title: "Couldn't collect the report",
          description: apiError.userMessage,
        });
      }
    },
    [history, toast],
  );

  const { progress, isPolling } = useTriggerProgress({
    triggerId,
    enabled: !!triggerId,
    onComplete: (p) => {
      if (p.status === 'failed') {
        const reason = p.error ?? `Failed at ${p.failedStep ?? 'an unknown step'}`;
        setResultError(
          new ApiError('http', reason, `/api/trigger/${p.triggerId}`),
        );
        if (historyId.current) {
          history.update(historyId.current, {
            outcome: 'error',
            errorMessage: reason,
          });
        }
        toast.push({
          tone: 'error',
          title: 'Investigation failed',
          description: reason,
        });
        return;
      }
      void collectResult(p.triggerId);
    },
    onError: (err) => {
      setResultError(
        new ApiError('network', err.message, `/api/trigger/${triggerId}/progress`),
      );
      toast.push({
        tone: 'error',
        title: 'Lost track of the investigation',
        description: "The agent stopped reporting progress. It may still be running — check the agent's logs.",
      });
    },
  });

  /** True from acceptance until the findings (or a failure) land. */
  const investigating =
    trigger.status === 'loading' ||
    (!!triggerId && !result && !resultError && trigger.status !== 'error');

  useEffect(() => {
    if (!investigating) return;
    const id = setInterval(
      () => setElapsedMs(performance.now() - startedAt.current),
      100,
    );
    return () => clearInterval(id);
  }, [investigating]);

  const handleSelect = useCallback((urn: string) => setSelectedUrn(urn), []);

  const handleReplay = useCallback((entry: HistoryEntry) => {
    setReplayed(entry);
    // A replayed run has stored findings but no live pipeline left to poll.
    setTriggerId(undefined);
    setResultError(undefined);
  }, []);

  const handleSubmit = useCallback(
    async (request: TriggerRequest) => {
      setReplayed(undefined);
      setTriggerId(undefined);
      setResult(undefined);
      setResultError(undefined);
      historyId.current = undefined;
      startedAt.current = performance.now();
      setElapsedMs(0);

      const accepted = await trigger.run(request);
      // `error === null` means the request was superseded, not that it failed.
      if (!accepted.ok && accepted.error === null) return;

      const base = {
        urn: request.urn,
        assetName: urnDisplayName(request.urn),
        triggerType: request.triggerType,
        severity: request.severity,
        note: request.note,
        firedAt: new Date().toISOString(),
        durationMs: performance.now() - startedAt.current,
      };

      if (accepted.ok) {
        setTriggerId(accepted.data.triggerId);
        historyId.current = history.add({ ...base, outcome: 'success' });
        toast.push({
          tone: 'success',
          title: 'Trigger accepted',
          description: `${base.assetName} · walking lineage`,
        });
      } else {
        setElapsedMs(base.durationMs);
        history.add({
          ...base,
          outcome: 'error',
          errorMessage: accepted.error.userMessage,
        });
        toast.push({
          tone: 'error',
          title: 'Trigger failed',
          description: accepted.error.userMessage,
        });
      }
    },
    [trigger, history, toast],
  );

  const displayed = replayed?.response ?? result;
  const error = trigger.error ?? resultError;

  const displayStatus = replayed
    ? ('success' as const)
    : displayed
      ? ('success' as const)
      : investigating
        ? ('loading' as const)
        : error
          ? ('error' as const)
          : ('idle' as const);

  // The timeline stays up after a run finishes — a completed pipeline is as
  // useful to read as a running one.
  const showTimeline = !!triggerId;

  const phase: GraphPhase = investigating
    ? 'running'
    : displayed
      ? 'complete'
      : 'idle';

  /**
   * Nothing real to plot yet, so the graph shows an illustrative walk instead
   * of an empty box. It is labelled as sample data on the panel and on the
   * graph itself, stays out of the response panel and history, and is dropped
   * the moment a real investigation produces findings.
   */
  const showSample = !displayed && !investigating && !error;
  const graphData = displayed ?? (showSample ? SAMPLE_INVESTIGATION : undefined);

  /** Restarts the hop-by-hop reveal for each distinct run, replays included. */
  const revealKey = useMemo(
    () => replayed?.id ?? graphData?.triggerId ?? 'idle',
    [replayed?.id, graphData?.triggerId],
  );

  return (
    <AppShell
      title="Investigation console"
      subtitle="Fire an incident signal at the agent and watch the investigation land"
    >
      <motion.div
        variants={staggerList}
        initial="hidden"
        animate="visible"
        className="grid gap-4 lg:grid-cols-12"
      >
        {/* Controls rail — everything the operator acts on, in one column. */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <motion.div variants={fadeInUp}>
            <AssetSelector selectedUrn={selectedUrn} onSelect={handleSelect} />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <TriggerPanel
              urn={selectedUrn}
              submitting={investigating}
              onSubmit={(request) => void handleSubmit(request)}
              onCancel={trigger.reset}
            />
          </motion.div>

          <motion.div variants={fadeInUp}>
            <TriggerHistory
              entries={history.entries}
              activeId={replayed?.id}
              onReplay={handleReplay}
              onRemove={history.remove}
              onClear={history.clear}
            />
          </motion.div>
        </div>

        {/* Investigation column — graph first, because it's the whole story. */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <motion.div variants={fadeInUp}>
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <CardHeader
                  icon={<Waypoints className="size-4" />}
                  title="Blast radius"
                  description={
                    showSample
                      ? 'Illustrative walk — fire a trigger to plot a real one'
                      : displayed?.asset?.name
                        ? `Downstream of ${displayed.asset.name}`
                        : 'Downstream lineage, by hop distance from the break'
                  }
                />
                <Badge
                  tone={
                    showSample
                      ? 'warning'
                      : phase === 'running'
                        ? 'accent'
                        : phase === 'complete'
                          ? 'success'
                          : 'neutral'
                  }
                  className="shrink-0"
                >
                  {showSample
                    ? 'sample'
                    : phase === 'running'
                      ? 'walking lineage'
                      : phase === 'complete'
                        ? 'settled'
                        : 'standing by'}
                </Badge>
              </div>

              <div className="h-[26rem] sm:h-[30rem]">
                <LineageGraph
                  triggerUrn={graphData?.asset?.urn}
                  triggerName={graphData?.asset?.name}
                  downstream={graphData?.downstream}
                  blastRadius={graphData?.blastRadius}
                  phase={phase}
                  revealKey={revealKey}
                  sample={showSample}
                />
              </div>
            </Card>
          </motion.div>

          {showTimeline && (
            <motion.div
              variants={fadeInUp}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition.entrance}
            >
              <Timeline
                progress={progress}
                triggerId={triggerId}
                polling={isPolling}
              />
            </motion.div>
          )}

          <motion.div variants={fadeInUp}>
            <ResponsePanel
              status={displayStatus}
              response={displayed}
              error={error}
              elapsedMs={replayed?.durationMs ?? elapsedMs}
            />
          </motion.div>
        </div>
      </motion.div>
    </AppShell>
  );
}
