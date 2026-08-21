'use client';

import { useState } from 'react';
import type { PanelId } from '../lib/types';
import { dieterIconStyle } from './dieterIcon';
import toolDrawerCopy from '../l10n/tool-drawer/en.json';

export type Panel = { id: PanelId; label: string; icon?: string };

type TdMenuProps = {
  active?: PanelId;
  onSelect?: (id: PanelId) => void;
  panels: Panel[];
};

const PANEL_ICONS: Record<PanelId, string> = {
  content: 'square.and.pencil',
  layout: 'circle.grid.2x2',
  appearance: 'paintbrush.pointed',
  typography: 'character.circle',
  translations: 'globe',
  settings: 'gearshape',
};

export function withPanelIcon(panel: Omit<Panel, 'icon'>): Panel {
  return { ...panel, icon: PANEL_ICONS[panel.id] };
}

export function TdMenu({ active, onSelect, panels }: TdMenuProps) {
  const items = panels;
  const [internalActive, setInternalActive] = useState<PanelId>(
    active ?? items[0]!.id,
  );
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
      aria-label={toolDrawerCopy.navigation.accessibleLabel}
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
            data-tooltip={panel.label}
            data-tooltip-kind="label"
            data-tooltip-placement="right"
            onClick={() => handleSelect(panel.id)}
            className="diet-button diet-tooltip"
            data-size="large"
            data-type={isActive ? 'primary' : 'quaternary'}
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
