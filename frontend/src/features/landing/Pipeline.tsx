import { cn } from '@/lib/cn';
import { type as t } from '@/design';
import { PIPELINE } from './content';
import { Reveal, Section } from './Section';

/**
 * The five stages, laid out as the rail the console animates along. Same order,
 * same labels, same icons as the live timeline — the marketing page and the
 * product describe the pipeline identically because both read `PIPELINE`.
 */
export function Pipeline() {
  return (
    <Section
      id="pipeline"
      eyebrow="How it works"
      title="One trigger. Five stages. No manual steps."
      description="Every stage reports its own state, so you are never watching a spinner wondering whether the agent is stuck or just slow."
    >
      <div className="relative">
        {/* Connecting rail, desktop only — mirrors the console's timeline. */}
        <div
          aria-hidden
          className="absolute top-6 right-0 left-0 hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent lg:block"
        />

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
          {PIPELINE.map((stage, i) => (
            <Reveal key={stage.id} delay={i * 0.06}>
              <li className="relative flex h-full flex-col">
                <span
                  aria-hidden
                  className="glow flex size-12 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-bg text-accent"
                >
                  <stage.icon className="size-5" />
                </span>

                <p className={cn(t.overline, 'mt-5')}>
                  Stage {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className={cn(t.h3, 'mt-1')}>{stage.label}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  {stage.body}
                </p>
                <code className="mt-3 font-mono text-[10px] text-muted">
                  {stage.id}
                </code>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}
