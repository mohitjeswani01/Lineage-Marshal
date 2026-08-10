import { ArrowUpRight, Database } from 'lucide-react';
import { cn } from '@/lib/cn';
import { type as t } from '@/design';
import { DATAHUB_FEATURES, LINKS } from './content';
import { Reveal, Section } from './Section';

/**
 * What DataHub is, and precisely which parts of it the agent touches.
 *
 * Worth being concrete here: "integrates with DataHub" means nothing, whereas
 * naming the six aspects read tells a data engineer exactly what to expect.
 */
export function DataHubSection() {
  return (
    <Section
      id="datahub"
      eyebrow="Built on DataHub"
      title="The catalog already knows. It just cannot investigate."
      description="DataHub is an open-source metadata platform — it holds the lineage graph, ownership, glossary terms and usage statistics for every asset in your warehouse. Lineage Marshal is the agent that reads all of that under incident pressure and writes its findings back."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-1">
          <div className="rim-light flex h-full flex-col justify-between rounded-lg border border-accent/20 bg-accent-subtle p-6">
            <div>
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-xl bg-accent text-on-accent"
              >
                <Database className="size-5" />
              </span>
              <h3 className={cn(t.h2, 'mt-5')}>Read and written, both ways</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
                Most tools treat a catalog as read-only. Lineage Marshal closes
                the loop: every investigation is appended back onto the asset as
                a versioned context document, so the knowledge lives with the
                data instead of in a chat thread.
              </p>
            </div>

            <a
              href={LINKS.datahub}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              datahubproject.io
              <ArrowUpRight aria-hidden className="size-3.5" />
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="lg:col-span-2">
          <div className="h-full overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                DataHub features used by Lineage Marshal
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-elevated">
                  <th scope="col" className={cn(t.overline, 'px-4 py-3')}>
                    Aspect
                  </th>
                  <th
                    scope="col"
                    className={cn(t.overline, 'hidden px-4 py-3 sm:table-cell')}
                  >
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                {DATAHUB_FEATURES.map((feature) => (
                  <tr
                    key={feature.name}
                    className="border-b border-border last:border-0"
                  >
                    <th scope="row" className="px-4 py-3.5 align-top">
                      <span className="block text-[13px] font-medium text-text">
                        {feature.name}
                      </span>
                      <code className="mt-0.5 block font-mono text-[10px] font-normal text-accent">
                        {feature.api}
                      </code>
                      {/* Purpose folds under the name on narrow screens rather
                          than forcing the table to scroll sideways. */}
                      <span className="mt-1.5 block text-[12px] leading-relaxed font-normal text-text-secondary sm:hidden">
                        {feature.purpose}
                      </span>
                    </th>
                    <td className="hidden px-4 py-3.5 align-top text-[12px] leading-relaxed text-text-secondary sm:table-cell">
                      {feature.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
