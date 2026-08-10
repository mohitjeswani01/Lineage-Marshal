import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { type as t } from '@/design';
import { FEATURES, PROBLEMS } from './content';
import { Reveal, Section } from './Section';

/** The three failures the agent exists to remove. Stated plainly, then answered. */
export function Problem() {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="A broken pipeline is rarely the hard part"
      description="Finding out what it touched, who owns those things, and what the last person already learned about it — that is where the hours go."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {PROBLEMS.map((problem, i) => (
          <Reveal key={problem.title} delay={i * 0.06}>
            <Card className="h-full border-border/70">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs text-danger">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={t.h3}>{problem.title}</h3>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-text-secondary">
                {problem.body}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/** What the agent actually implements, each card naming the module behind it. */
export function Features() {
  return (
    <Section
      id="features"
      eyebrow="Capabilities"
      title="Everything an on-call engineer would have to do by hand"
      description="Each of these is implemented and running — the file behind every card is named on it."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 0.05}>
            <Card
              interactive
              className="flex h-full flex-col border-border/70"
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-lg bg-accent-subtle text-accent"
              >
                <feature.icon className="size-4.5" />
              </span>

              <h3 className={cn(t.h3, 'mt-4')}>{feature.title}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-text-secondary">
                {feature.body}
              </p>

              {'detail' in feature && feature.detail && (
                <p className="mt-4 rounded-md border border-border bg-bg-subtle px-2.5 py-2 font-mono text-[11px] text-accent">
                  {feature.detail}
                </p>
              )}
              {'footnote' in feature && feature.footnote && (
                <p className="mt-1.5 font-mono text-[10px] text-muted">
                  {feature.footnote}
                </p>
              )}

              <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-muted">
                {feature.source}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
