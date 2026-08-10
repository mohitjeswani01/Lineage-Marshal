import { cn } from '@/lib/cn';
import { CopyButton } from '@/components/ui/CopyButton';
import { type as t } from '@/design';
import { QUICK_START } from './content';
import { Reveal, Section } from './Section';

/** Four commands from nothing to a running investigation. */
export function QuickStart() {
  return (
    <Section
      id="quick-start"
      eyebrow="Quick start"
      title="Running locally in four commands"
      description="Needs Docker with at least 8 GB allocated and Python 3.9 or newer. Insufficient Docker memory is the single most common failure."
    >
      <ol className="grid gap-4 md:grid-cols-2">
        {QUICK_START.map((step, i) => (
          <Reveal key={step.step} delay={i * 0.06}>
            <li className="rim-light h-full rounded-lg border border-border bg-card p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-accent">{step.step}</span>
                <h3 className={t.h3}>{step.title}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                {step.body}
              </p>

              <div className="relative mt-4">
                <CopyButton
                  value={step.code}
                  label={`Copy command for ${step.title}`}
                  className="absolute top-1.5 right-1.5 z-10"
                />
                <pre className="overflow-x-auto rounded-md border border-border bg-bg-subtle p-3 pr-12">
                  <code className={cn(t.monoSm, 'text-text-secondary')}>
                    {step.code}
                  </code>
                </pre>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
