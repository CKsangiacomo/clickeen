'use client';

import { useMemo, useState } from 'react';
import type { PanelId } from '../lib/types';

export type Panel = { id: PanelId; label: string; icon?: string };

type TdMenuProps = {
  active?: PanelId;
  onSelect?: (id: PanelId) => void;
  panels?: Panel[];
};

// Default order for ToolDrawer panels.
export const DEFAULT_PANELS: Panel[] = [
  { id: 'content', icon: 'square.and.pencil', label: 'Content' },
  { id: 'layout', icon: 'circle.grid.2x2', label: 'Layout' },
  { id: 'appearance', icon: 'paintbrush.pointed', label: 'Appearance' },
  { id: 'typography', icon: 'character.circle', label: 'Typography' },
  { id: 'translations', icon: 'globe', label: 'Translations' },
  { id: 'settings', icon: 'gearshape', label: 'Settings' },
];

export function TdMenu({ active, onSelect, panels }: TdMenuProps) {
  const items = useMemo(() => panels ?? DEFAULT_PANELS, [panels]);
  const [internalActive, setInternalActive] = useState<PanelId>(active ?? items[0]?.id ?? 'appearance');
  const current = (active ?? internalActive) as PanelId;

  const handleSelect = (id: PanelId) => {
    if (onSelect) onSelect(id);
    else setInternalActive(id);
  };

  return (
    <nav
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
            {panel.icon ? (
              <span className="diet-btn-ic__icon" data-icon={panel.icon} aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
