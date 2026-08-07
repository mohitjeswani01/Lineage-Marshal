import { cn } from '@/lib/cn';

/**
 * Shimmer placeholder. The sweep is a CSS-only pseudo-animation (see
 * `--animate-shimmer`), so a list of 20 skeletons costs nothing on the main
 * thread and is silenced by `prefers-reduced-motion`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-elevated',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-accent-subtle after:to-transparent',
        className,
      )}
    />
  );
}

/** Skeleton shaped like an asset row, so the layout doesn't jump on load. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Skeleton className="size-8 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
