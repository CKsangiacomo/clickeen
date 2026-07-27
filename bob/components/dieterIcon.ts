import type { CSSProperties } from 'react';

export function dieterIconStyle(name: string): CSSProperties {
  return {
    '--diet-icon-source': `url("/dieter/icons/svg/${name}.svg")`,
  } as CSSProperties;
}
