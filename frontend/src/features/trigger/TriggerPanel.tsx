import { useState, type FormEvent } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import {
  AlertOctagon,
  Clock,
  GitBranch,
  Search,
  Send,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TextAreaField } from '@/components/ui/Field';
import {
  SEVERITIES,
  TRIGGER_TYPES,
  severityLabel,
  triggerTypeLabel,
  type Severity,
  type TriggerRequest,
  type TriggerType,
} from '@/api/contract';
import { isValidUrn, urnDisplayName } from '@/lib/urn';
import { shake, type as t } from '@/design';

const TRIGGER_ICONS: Record<TriggerType, typeof Clock> = {
  freshness_sla: Clock,
  schema_change: GitBranch,
  pipeline_failure: AlertOctagon,
  manual: Search,
};

const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  freshness_sla: 'Asset has not updated within its expected cadence',
  schema_change: 'A column was dropped or retyped upstream',
  pipeline_failure: 'The job feeding this asset failed',
  manual: 'Ad-hoc investigation with no automated signal',
};

const TRIGGER_OPTIONS: SelectOption<TriggerType>[] = TRIGGER_TYPES.map((v) => {
  const Icon = TRIGGER_ICONS[v];
  return {
    value: v,
    label: triggerTypeLabel[v],
    description: TRIGGER_DESCRIPTIONS[v],
    icon: <Icon aria-hidden className="size-4 text-muted" />,
  };
});

const SEVERITY_OPTIONS: SelectOption<Severity>[] = SEVERITIES.map((v) => ({
  value: v,
  label: severityLabel[v],
}));

const MAX_NOTE = 500;

interface TriggerPanelProps {
  urn: string;
  submitting: boolean;
  onSubmit: (request: TriggerRequest) => void;
  onCancel: () => void;
}

/**
 * The trigger form.
 *
 * Validation is client-side and advisory only — the agent is the authority on
 * whether a URN exists. Submitting without a valid asset shakes the panel and
 * shows an inline error rather than firing a request that will fail anyway.
 */
export function TriggerPanel({
  urn,
  submitting,
  onSubmit,
  onCancel,
}: TriggerPanelProps) {
  const [triggerType, setTriggerType] = useState<TriggerType>('freshness_sla');
  const [severity, setSeverity] = useState<Severity>('high');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const controls = useAnimationControls();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidUrn(urn)) {
      setError(
        urn
          ? 'That URN is malformed — expected urn:li:<entity>:(…).'
          : 'Select an asset first.',
      );
      void controls.start('shake');
      return;
    }
    setError(undefined);
    onSubmit({
      urn,
      triggerType,
      severity,
      note: note.trim() || undefined,
    });
  };

  return (
    <motion.div variants={shake} initial="idle" animate={controls}>
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-border p-4">
          <CardHeader
            icon={<Zap className="size-4" />}
            title="Trigger"
            description="Send an incident signal to the agent"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <Select
            label="Trigger type"
            value={triggerType}
            options={TRIGGER_OPTIONS}
            onChange={setTriggerType}
            disabled={submitting}
          />

          <Select
            label="Severity"
            value={severity}
            options={SEVERITY_OPTIONS}
            onChange={setSeverity}
            disabled={submitting}
          />

          <TextAreaField
            label="Context (optional)"
            rows={3}
            maxLength={MAX_NOTE}
            value={note}
            disabled={submitting}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the agent should know — alert source, on-call notes…"
            hint={`${note.length}/${MAX_NOTE}`}
          />

          <div
            className={cn(
              'rounded-md border border-border bg-surface-elevated px-3 py-2',
              t.mono,
            )}
          >
            <span className={cn(t.overline, 'mb-1 block')}>Target</span>
            <span className={urn ? 'text-text-secondary' : 'text-muted'}>
              {urn ? urnDisplayName(urn) : 'No asset selected'}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-[11px] text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={submitting}
              icon={!submitting && <Send aria-hidden className="size-4" />}
            >
              {submitting ? 'Agent running…' : 'Fire trigger'}
            </Button>
            {submitting && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
