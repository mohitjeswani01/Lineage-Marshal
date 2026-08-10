/**
 * Bridges the CSS token layer into WebGL.
 *
 * The scene renders outside the DOM, so it can't inherit `var(--color-danger)`
 * the way every other component does. Instead of forking the palette into a
 * second set of hardcoded hexes, we read the resolved custom properties off
 * `<html>` and re-read them when the theme attribute flips — so switching to
 * light mode repaints the graph along with everything else.
 */
import { useEffect, useState } from 'react';
import {
  GRAPH_PALETTE_FALLBACK,
  GRAPH_PALETTE_VARS,
  type GraphPalette,
  type GraphPaletteKey,
} from '@/design';

function readPalette(): GraphPalette {
  if (typeof window === 'undefined') return GRAPH_PALETTE_FALLBACK;

  const computed = getComputedStyle(document.documentElement);
  const entries = Object.entries(GRAPH_PALETTE_VARS) as [
    GraphPaletteKey,
    string,
  ][];

  return entries.reduce((palette, [key, cssVar]) => {
    const value = computed.getPropertyValue(cssVar).trim();
    palette[key] = value || GRAPH_PALETTE_FALLBACK[key];
    return palette;
  }, {} as GraphPalette);
}

/** Current theme's graph colours. Re-reads on `[data-theme]` changes. */
export function useGraphPalette(): GraphPalette {
  const [palette, setPalette] = useState<GraphPalette>(GRAPH_PALETTE_FALLBACK);

  useEffect(() => {
    setPalette(readPalette());

    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}

let webglSupport: boolean | undefined;

/**
 * One-shot WebGL probe. A machine without it (locked-down VM, GPU blocklist)
 * gets the static SVG graph rather than an empty black rectangle.
 */
export function supportsWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  if (typeof document === 'undefined') return (webglSupport = false);

  try {
    const canvas = document.createElement('canvas');
    webglSupport = !!(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    );
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
