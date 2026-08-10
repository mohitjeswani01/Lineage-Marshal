import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { stagger, transition, type as t } from '@/design';

/**
 * Landing page section scaffolding.
 *
 * One reveal behaviour, one heading rhythm, one max-width — so eight sections
 * written at different times still read as a single page.
 */

const SHELL = 'mx-auto w-full max-w-[76rem] px-5 sm:px-8';

export function SectionShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(SHELL, className)}>{children}</div>;
}

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Centres the heading block. Default is left-aligned. */
  center?: boolean;
  className?: string;
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  center,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      // `scroll-mt` keeps the sticky header from covering an anchored heading.
      className={cn('scroll-mt-20 py-20 sm:py-28', className)}
    >
      <SectionShell>
        <Reveal>
          <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
            {eyebrow && (
              <p className={cn(t.overline, 'mb-3 text-accent')}>{eyebrow}</p>
            )}
            <h2 className={cn(t.h1, 'text-balance')}>{title}</h2>
            {description && (
              <p
                className={cn(
                  t.bodyLg,
                  'mt-4 text-pretty text-text-secondary',
                )}
              >
                {description}
              </p>
            )}
          </div>
        </Reveal>

        <div className="mt-12 sm:mt-16">{children}</div>
      </SectionShell>
    </section>
  );
}

/**
 * Scroll-triggered entrance. `once` so scrolling back up doesn't replay the
 * page, and the whole thing collapses to a plain render under reduced motion.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ ...transition.entrance, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Reveal for grids — children stagger by index without per-item wiring. */
export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * stagger.children}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
