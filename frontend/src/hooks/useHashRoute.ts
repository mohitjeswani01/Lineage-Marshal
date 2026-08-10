import { useEffect, useState } from 'react';

/**
 * Minimal hash router.
 *
 * The app has exactly two destinations — the landing page and the console — so
 * a routing library would be more configuration than routing. Hash routes also
 * mean any static host serves the app without rewrite rules, which matters
 * given the deployment plan targets a plain static bucket.
 *
 * Returns the normalised route, e.g. `#/console` → `/console`, `` → `/`.
 */
export function useHashRoute(): string {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

function readRoute(): string {
  if (typeof window === 'undefined') return '/';
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}
