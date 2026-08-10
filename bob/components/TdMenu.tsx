'use client';

import { useMemo, useState } from 'react';
import { BOB_MENU_PANEL_IDS, BOB_PANEL_LABELS, type PanelId } from '../lib/types';
import { dieterIconStyle } from './dieterIcon';

export type Panel = { id: PanelId; label: string; icon?: string };

type TdMenuProps = {
  active?: PanelId;
  onSelect?: (id: PanelId) => void;
  panels?: Panel[];
};

const PANEL_ICONS: Record<PanelId, string> = {
  content: 'square.and.pencil',
  layout: 'circle.grid.2x2',
  appearance: 'paintbrush.pointed',
  typography: 'character.circle',
  translations: 'globe',
  settings: 'gearshape',
};

export const DEFAULT_PANELS: Panel[] = BOB_MENU_PANEL_IDS.map((id) => ({
  id,
  icon: PANEL_ICONS[id],
  label: BOB_PANEL_LABELS[id],
}));

export function TdMenu({ active, onSelect, panels }: TdMenuProps) {
  const items = useMemo(() => panels ?? DEFAULT_PANELS, [panels]);
  const [internalActive, setInternalActive] = useState<PanelId>(
    active ?? items[0]?.id ?? 'appearance',
  );
  const current = (active ?? internalActive) as PanelId;

  const handleSelect = (id: PanelId) => {
    if (onSelect) onSelect(id);
    else setInternalActive(id);
  };

  return (
    <nav className="tdmenu" role="tablist" aria-orientation="vertical" aria-label="Panels">
      {items.map((panel) => {
        const isActive = panel.id === current;
        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={panel.label}
            data-tooltip={panel.label}
            data-tooltip-placement="right"
            onClick={() => handleSelect(panel.id)}
            className="diet-button diet-tooltip"
            data-size="large"
            data-type={isActive ? 'primary' : 'secondary'}
            data-panel={panel.id}
          >
            {panel.icon ? (
              <span
                className="diet-icon"
                data-size="20"
                data-icon={panel.icon}
                style={dieterIconStyle(panel.icon)}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
