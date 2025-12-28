// Dieter icon registry adapter for Bob
// Returns inline SVG strings built from the built icons.json served by Tokyo

import registry from '../../tokyo/dieter/icons/icons.json';

type Bounds = { x1: number; y1: number; x2: number; y2: number };

export function getIcon(name: string): string {
  const sym = (registry?.symbols as any)?.[name]?.regular;
  if (!sym) {
    throw new Error(`[dieter-icons] missing icon: ${name}`);
  }
  const path: string = sym.path as string;
  const geom = sym.geometry as { width: number; height: number; bounds: Bounds };
  const { width, height, bounds } = geom;
  const vbW = (bounds.x2 - bounds.x1).toFixed(2);
  const vbH = (bounds.y2 - bounds.y1).toFixed(2);
  const viewBox = `${bounds.x1} ${bounds.y1} ${vbW} ${vbH}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" fill="currentColor"><path d="${path}" /></svg>`;
}
