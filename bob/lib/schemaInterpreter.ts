// Temporary interpreter that reads from ui-schemas while Geneva UI sections are wired.
import { MOCK_UI_SCHEMA } from '@bob/lib/ui-schemas';

export type ControlSpec =
  | { type: 'textfield'; configPath: string; label: string; placeholder?: string }
  | { type: 'dropdown'; configPath: string; triggerLabel: (val: any) => string; options: Array<{ label: string; value: string }> }
  | { type: 'rangeslider'; configPath: string; label: string; min: number; max: number; unit?: string }
  | { type: 'segmented'; configPath: string; options: Array<{ label: string; value: string }> }
  | { type: 'toggle'; configPath: string; label: string }
  | { type: 'color'; configPath: string; cssVar?: string; label: string }
  | { type: 'repeater'; configPath: string; label: string }
  | { type: 'expander'; label: string; children: Array<{ type: 'textarea'; configPath: string }> };

export interface ControlPanel {
  id: string;
  title: string;
  controls: ControlSpec[];
}

export interface ToolDrawerSpec {
  tabs: Array<{ id: string; icon: string; label: string }>;
  panels: Record<string, ControlPanel>;
  // Abstract UI assets each panel needs (used to load drawer CSS on demand)
  requiresByPanel: Record<string, Set<string>>;
}

export function interpretSchema(widgetType?: string | null): ToolDrawerSpec | null {
  if (!widgetType) return null;
  const raw = (MOCK_UI_SCHEMA as any)[widgetType];
  if (!raw) return null;
  const tabs = (raw.tdmenu || []).map((t: any) => ({ id: String(t.id), icon: String(t.icon), label: String(t.label) }));
  const panels: Record<string, ControlPanel> = {};
  const requiresByPanel: Record<string, Set<string>> = {};
  const content = raw.tdmenucontent || {};
  Object.keys(content).forEach((key) => {
    const p = content[key];
    panels[key] = { id: key, title: String(p.title || key), controls: p.controls || [] };
    // Derive abstract UI assets from control types (component-agnostic identifiers)
    const req = new Set<string>();
    (p.controls || []).forEach((c: any) => {
      switch (String(c.type)) {
        case 'textfield':
          req.add('textfield');
          break;
        case 'dropdown':
          req.add('dropdown');
          break;
        case 'rangeslider':
          req.add('rangeslider');
          break;
        case 'segmented':
          req.add('segmented');
          break;
        case 'toggle':
          req.add('toggle');
          break;
        case 'color':
          // color pickers typically compose text inputs/triggers
          req.add('textfield');
          break;
        case 'repeater':
          // no direct UI asset; inner items define their own needs
          break;
        case 'expander':
          req.add('expander');
          break;
        default:
          break;
      }
    });
    requiresByPanel[key] = req;
  });
  return { tabs, panels, requiresByPanel };
}
