// Dieter icon registry adapter for Bob (CSS-only pattern)
// Returns inline SVG strings built from the generated icons.json produced by @ck/dieter

// Import the generated registry that the copy step writes into public/dieter/icons
// Next.js supports JSON imports client-side via webpack.
// Path: bob/public/dieter/icons/icons.json (copied from dieter/dist/icons/icons.json)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module typing not present
import registry from '../public/dieter/icons/icons.json';

type Bounds = { x1: number; y1: number; x2: number; y2: number };

export function getIcon(name: string): string {
  const sym = registry?.symbols?.[name]?.regular;
  if (!sym) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(`[dieter-icons] missing icon: ${name}`);
    }
    return '';
  }
  const path: string = sym.path as string;
  const geom = sym.geometry as { width: number; height: number; bounds: Bounds };
  const { width, height, bounds } = geom;
  const vbW = (bounds.x2 - bounds.x1).toFixed(2);
  const vbH = (bounds.y2 - bounds.y1).toFixed(2);
  const viewBox = `${bounds.x1} ${bounds.y1} ${vbW} ${vbH}`;
  return `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"${viewBox}\" width=\"${width}\" height=\"${height}\" fill=\"currentColor\"><path d=\"${path}\" /></svg>`;
}

