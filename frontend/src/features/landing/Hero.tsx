import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Github, Radio } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/components/ui/Button';
import { LineageGraph } from '@/features/trigger/graph/LineageGraph';
import { SAMPLE_INVESTIGATION } from '@/api/sampleInvestigation';
import { stagger, transition, type as t } from '@/design';
import { HERO_STATS, LINKS } from './content';
import { SectionShell } from './Section';

/**
 * Hero.
 *
 * The visual is the real graph component rendering real response-shaped data,
 * not a screenshot — what you see here is exactly what the console draws when
 * an investigation lands. It carries its own "sample data" chip so nobody
 * mistakes the illustration for a live incident.
 */
export function Hero() {
  const reduced = useReducedMotion() ?? false;

  const item = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { ...transition.entrance, delay: i * stagger.children },
        };

  return (
    <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Horizon glow — the "something is transmitting" cue behind the fold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem]"
        style={{
          background:
            'radial-gradient(60rem 28rem at 50% -10%, var(--color-accent-subtle), transparent 70%)',
        }}
      />

      <SectionShell>
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...item(0)} className="flex justify-center">
            <span className="glass inline-flex items-center gap-2 rounded-full border border-glass-border px-3 py-1.5 text-[11px] text-text-secondary">
              <Radio aria-hidden className="size-3 text-accent" />
              Autonomous incident investigation for data pipelines
            </span>
          </motion.div>

          <motion.h1
            {...item(1)}
            className={cn(t.display, 'mt-6 text-balance sm:text-5xl')}
          >
            When a pipeline breaks, the{' '}
            <span className="bg-gradient-to-r from-accent to-info bg-clip-text text-transparent">
              investigation has already started
            </span>
          </motion.h1>

          <motion.p
            {...item(2)}
            className={cn(
              t.bodyLg,
              'mx-auto mt-5 max-w-2xl text-pretty text-text-secondary',
            )}
          >
            Lineage Marshal walks your DataHub lineage the moment a trigger
            fires — scoring blast radius, resolving owners, notifying them, and
            writing the whole investigation back to the catalog so the next one
            inherits it.
          </motion.p>

          <motion.div
            {...item(3)}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <a
              href={LINKS.console}
              className={buttonClasses({ variant: 'primary', size: 'lg' })}
            >
              Open the console
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <a
              href={LINKS.github}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonClasses({ variant: 'secondary', size: 'lg' })}
            >
              <Github aria-hidden className="size-4" />
              View source
            </a>
          </motion.div>

          <motion.dl
            {...item(4)}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="font-mono text-2xl font-semibold text-text">
                    {stat.value}
                  </span>
                  <span className={cn(t.overline, 'ml-2')}>{stat.label}</span>
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Product visual */}
        <motion.div
          {...(reduced
            ? {}
            : {
                initial: { opacity: 0, y: 24 },
                animate: { opacity: 1, y: 0 },
                transition: { ...transition.entrance, delay: 0.28 },
              })}
          className="rim-light glass relative mt-14 overflow-hidden rounded-xl border border-glass-border shadow-floating"
        >
          <div className="flex items-center gap-2 border-b border-glass-border px-4 py-2.5">
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-danger/50" />
              <span className="size-2.5 rounded-full bg-warning/50" />
              <span className="size-2.5 rounded-full bg-success/50" />
            </span>
            <p className={cn(t.overline, 'ml-2')}>
              blast radius · daily_revenue_report
            </p>
          </div>

          <div className="h-[22rem] sm:h-[32rem]">
            <LineageGraph
              triggerUrn={SAMPLE_INVESTIGATION.asset?.urn}
              triggerName={SAMPLE_INVESTIGATION.asset?.name}
              downstream={SAMPLE_INVESTIGATION.downstream}
              blastRadius={SAMPLE_INVESTIGATION.blastRadius}
              phase="complete"
              revealKey="hero"
              sample
            />
          </div>
        </motion.div>
      </SectionShell>
    </section>
  );
}
