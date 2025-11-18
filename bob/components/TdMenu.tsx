'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getIcon } from '../lib/icons';
import type { PanelId } from '../lib/types';

export type Panel = { id: PanelId; label: string; icon?: string };

type TdMenuProps = {
  panels?: Panel[];
  active?: PanelId;
  onSelect?: (id: PanelId) => void;
};

// Default order with Appearance first
export const DEFAULT_PANELS: Panel[] = [
  { id: 'content', icon: 'square.and.pencil', label: 'Content' },
  { id: 'layout', icon: 'circle.grid.2x2', label: 'Layout' },
  { id: 'typography', icon: 'character.circle', label: 'Typography' },
  { id: 'appearance', icon: 'circle.dotted', label: 'Appearance' },
  { id: 'settings', icon: 'gearshape', label: 'Settings' },
];

export function TdMenu({ panels, active, onSelect }: TdMenuProps) {
  const navRef = useRef<HTMLElement>(null);
  const items = useMemo(() => (panels && panels.length ? panels : DEFAULT_PANELS), [panels]);
  const [internalActive, setInternalActive] = useState<PanelId>(active ?? items[0]?.id ?? 'appearance');
  const current = (active ?? internalActive) as PanelId;

  // Hydrate Dieter icon placeholders (keeps token-driven icon set without React SVG import churn)
  useEffect(() => {
    if (!navRef.current) return;
    navRef.current.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
      const name = node.getAttribute('data-icon');
      if (!name) return;
      const markup = getIcon(name);
      if (!markup) return;
      node.innerHTML = markup;
      node.removeAttribute('data-icon');
    });
  }, [items]);

  const handleSelect = (id: PanelId) => {
    if (onSelect) onSelect(id);
    else setInternalActive(id);
  };

  return (
    <nav
      ref={navRef}
      className="tdmenu"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Panels"
    >
      {items.map((panel) => {
        const isActive = panel.id === current;
        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={panel.label}
            title={panel.label}
            onClick={() => handleSelect(panel.id)}
            className="diet-btn-ic"
            data-size="lg"
            data-variant={isActive ? 'primary' : 'neutral'}
            data-panel={panel.id}
          >
            <span className="diet-btn-ic__icon" data-icon={panel.icon} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
