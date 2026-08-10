/** Formatting helpers shared across panels. Intl does the heavy lifting. */

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const DAY = 86_400_000;

/**
 * [unit, divisor, threshold]. Threshold is deliberately separate from divisor:
 * months only kick in past 60 days, so a 30-day-stale asset reads
 * "30 days ago" — the number an on-call engineer cares about — instead of
 * Intl's default "last month".
 */
const UNITS: [Intl.RelativeTimeFormatUnit, number, number][] = [
  ['year', 365 * DAY, 365 * DAY],
  ['month', 30.44 * DAY, 60 * DAY],
  ['day', DAY, DAY],
  ['hour', 3_600_000, 3_600_000],
  ['minute', 60_000, 60_000],
];

/** "30 days ago" / "in 2 hours". Accepts ms epoch or ISO string. */
export function relativeTime(value: number | string, now = Date.now()): string {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';

  const delta = ms - now;
  for (const [unit, size, threshold] of UNITS) {
    if (Math.abs(delta) >= threshold) {
      return rtf.format(Math.round(delta / size), unit);
    }
  }
  return rtf.format(Math.round(delta / 1000), 'second');
}

/** Absolute timestamp for tooltips, where "30 days ago" isn't precise enough. */
export function absoluteTime(value: number | string): string {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : '—';
}

/** "1.4s" / "820ms" — agent runs are seconds-scale, so keep it short. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
