import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Github, Menu, Radio, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { transition, type as t } from '@/design';
import { Hero } from '@/features/landing/Hero';
import { Pipeline } from '@/features/landing/Pipeline';
import { Features, Problem } from '@/features/landing/Features';
import { DataHubSection } from '@/features/landing/DataHubSection';
import { QuickStart } from '@/features/landing/QuickStart';
import { Reveal, SectionShell } from '@/features/landing/Section';
import { DOC_LINKS, LINKS } from '@/features/landing/content';

const NAV = [
  { label: 'Problem', href: '#problem' },
  { label: 'How it works', href: '#pipeline' },
  { label: 'Capabilities', href: '#features' },
  { label: 'DataHub', href: '#datahub' },
  { label: 'Quick start', href: '#quick-start' },
] as const;

/**
 * Product landing page.
 *
 * Deliberately built from the same design tokens and components as the console
 * rather than as a standalone marketing artefact — the page a visitor lands on
 * and the product they open should not look like two different products.
 */
export function LandingPage() {
  return (
    <div className="relative z-10 min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
      >
        Skip to content
      </a>

      <TopBar />

      <main id="main">
        <Hero />
        <Problem />
        <Pipeline />
        <Features />
        <DataHubSection />
        <QuickStart />
        <CallToAction />
      </main>

      <Footer />
    </div>
  );
}

function TopBar() {
  const [open, setOpen] = useState(false);

  // A hash link inside the drawer navigates without unmounting it, so close
  // on any hash change rather than wiring an onClick to every single link.
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);

  return (
    <header className="glass sticky top-0 z-50 border-b border-glass-border">
      <SectionShell className="flex h-15 items-center gap-4">
        <a href="#/" className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-deep text-on-accent shadow-soft"
          >
            <Radio className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em]">
            Lineage Marshal
          </span>
        </a>

        <nav aria-label="Sections" className="ml-4 hidden gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[13px] text-text-secondary transition-colors duration-150 ease-standard hover:bg-accent-subtle hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View Lineage Marshal on GitHub"
            className="hidden rounded-md p-2 text-text-secondary transition-colors hover:bg-accent-subtle hover:text-text sm:inline-flex"
          >
            <Github aria-hidden className="size-4" />
          </a>
          <ThemeToggle />
          <a
            href={LINKS.console}
            className={buttonClasses({ variant: 'primary', size: 'sm' })}
          >
            Open console
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="rounded-md p-2 text-text-secondary hover:bg-accent-subtle hover:text-text lg:hidden"
          >
            {open ? (
              <X aria-hidden className="size-4" />
            ) : (
              <Menu aria-hidden className="size-4" />
            )}
          </button>
        </div>
      </SectionShell>

      {open && (
        <motion.nav
          aria-label="Sections"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={transition.entrance}
          className="overflow-hidden border-t border-glass-border lg:hidden"
        >
          <SectionShell className="flex flex-col py-2">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2.5 text-sm text-text-secondary hover:bg-accent-subtle hover:text-text"
              >
                {item.label}
              </a>
            ))}
          </SectionShell>
        </motion.nav>
      )}
    </header>
  );
}

function CallToAction() {
  return (
    <section className="pb-20 sm:pb-28">
      <SectionShell>
        <Reveal>
          <div className="rim-light relative overflow-hidden rounded-xl border border-accent/20 px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(40rem 20rem at 50% 120%, var(--color-accent-subtle), transparent 70%)',
              }}
            />
            <h2 className={cn(t.h1, 'text-balance')}>
              Fire a trigger and watch it resolve
            </h2>
            <p
              className={cn(
                t.bodyLg,
                'mx-auto mt-4 max-w-xl text-pretty text-text-secondary',
              )}
            >
              The console ships with three seeded incidents — a broken lineage
              edge, an ownerless asset and a table thirty days stale.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                Read the source
              </a>
            </div>
          </div>
        </Reveal>
      </SectionShell>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-14">
      <SectionShell>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-deep text-on-accent"
              >
                <Radio className="size-3.5" />
              </span>
              <span className="text-sm font-semibold">Lineage Marshal</span>
            </div>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-text-secondary">
              An autonomous incident investigation agent for data pipelines,
              built on DataHub. Computes blast radius, resolves ownership, and
              writes what it learned back to the catalog.
            </p>
            <p className="mt-4 text-[11px] text-muted">
              Apache 2.0 licensed ·{' '}
              <a
                href={LINKS.license}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-text-secondary hover:underline"
              >
                LICENSE
              </a>
            </p>
          </div>

          <FooterColumn
            title="Project"
            links={[
              { label: 'GitHub repository', href: LINKS.github, external: true },
              {
                label: LINKS.liveDemo ? 'Live demo' : 'Live demo (this build)',
                href: LINKS.liveDemo ?? LINKS.console,
                external: !!LINKS.liveDemo,
              },
              { label: 'Console', href: LINKS.console },
              { label: 'README', href: LINKS.readme, external: true },
              { label: 'Issues', href: LINKS.issues, external: true },
            ]}
          />

          <FooterColumn
            title="Documentation"
            links={DOC_LINKS.map((doc) => ({ ...doc, external: true }))}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted">
            Built on{' '}
            <a
              href={LINKS.datahub}
              target="_blank"
              rel="noreferrer noopener"
              className="text-text-secondary hover:underline"
            >
              DataHub
            </a>{' '}
            and the{' '}
            <a
              href={LINKS.datahubMcp}
              target="_blank"
              rel="noreferrer noopener"
              className="text-text-secondary hover:underline"
            >
              DataHub MCP server
            </a>
            .
          </p>
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-text"
          >
            <Github aria-hidden className="size-3.5" />
            mohitjeswani01/Lineage-Marshal
          </a>
        </div>
      </SectionShell>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h2 className={t.overline}>{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noreferrer noopener' }
                : {})}
              className="inline-flex items-center gap-1 text-[13px] text-text-secondary transition-colors hover:text-text"
            >
              {link.label}
              {link.external && (
                <ArrowUpRight aria-hidden className="size-3 text-muted" />
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
