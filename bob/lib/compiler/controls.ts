import type { CompiledControl, CompiledControlOption, CompiledPanel, ControlKind } from '../types';
import { parseTooldrawerAttributes } from '../compiler.shared';
import { getAt } from '../utils/paths';

const TOKEN_SEGMENT = /^__[^.]+__$/;

export function groupKeyToLabel(key: string): string {
  const map: Record<string, string> = {
    wgtappearance: 'Widget appearance',
    wgtlayout: 'Widget layout',
    podstageappearance: 'Stage/Pod appearance',
    podstagelayout: 'Stage/Pod layout',
  };
  return map[key] || key.replace(/-/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function findTagEnd(source: string, startIndex: number): number {
  let quote: '"' | "'" | null = null;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

export function expandTooldrawerClusters(html: string): string {
  const openTag = '<tooldrawer-cluster';
  const closeTag = '</tooldrawer-cluster>';

  let cursor = 0;
  while (cursor < html.length) {
    const lower = html.toLowerCase();
    const start = lower.indexOf(openTag, cursor);
    if (start === -1) break;

    const openEnd = findTagEnd(html, start + openTag.length);
    if (openEnd === -1) break;

    const attrsRaw = html.slice(start + openTag.length, openEnd);
    const attrs = parseTooldrawerAttributes(attrsRaw);

    let depth = 1;
    let searchPos = openEnd + 1;

    while (searchPos < html.length) {
      const lowerSearch = html.toLowerCase();
      const nextOpen = lowerSearch.indexOf(openTag, searchPos);
      const nextClose = lowerSearch.indexOf(closeTag, searchPos);
      if (nextClose === -1) {
        depth = 0;
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        const nextOpenEnd = findTagEnd(html, nextOpen + openTag.length);
        if (nextOpenEnd === -1) {
          depth = 0;
          break;
        }
        searchPos = nextOpenEnd + 1;
        continue;
      }

      depth -= 1;
      if (depth === 0) {
        const inner = html.slice(openEnd + 1, nextClose);
        const showIf = attrs['show-if'];

        if (attrs.gap || attrs['space-after'] || attrs.spaceAfter) {
          throw new Error(
            "[BobCompiler] <tooldrawer-cluster> does not support gap/space-after; use ToolDrawer stack gap + fixed cluster gap",
          );
        }

        const wrapperAttrs: string[] = ['class="tdmenucontent__cluster"'];
        if (showIf) wrapperAttrs.push(`data-bob-showif="${showIf}"`);

        const replacement = `<div ${wrapperAttrs.join(' ')}>${inner}</div>`;
        html = html.slice(0, start) + replacement + html.slice(nextClose + closeTag.length);
        cursor = start + replacement.length;
        break;
      }

      searchPos = nextClose + closeTag.length;
    }

    if (depth !== 0) {
      cursor = openEnd + 1;
    }
  }

  return html;
}

function parseControlOptions(args: {
  controlPath: string;
  optionsRaw: string;
}): CompiledControlOption[] | undefined {
  const decoded = decodeHtmlEntities(args.optionsRaw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    throw new Error(`[BobCompiler] Invalid JSON options for control "${args.controlPath}"`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`[BobCompiler] options for control "${args.controlPath}" must be a JSON array`);
  }

  const options = parsed
    .map((opt) => {
      if (!opt || typeof opt !== 'object') return null;
      const label = 'label' in opt ? String((opt as any).label) : '';
      const value = 'value' in opt ? String((opt as any).value) : '';
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((opt): opt is CompiledControlOption => Boolean(opt));
  return options.length ? options : undefined;
}

function samplePathForDefaults(pathPattern: string): string {
  const segments = pathPattern.split('.').filter(Boolean);
  return segments.map((segment) => (TOKEN_SEGMENT.test(segment) ? '0' : segment)).join('.');
}

function inferControlMetadata(control: CompiledControl, defaults: Record<string, unknown>): {
  kind: ControlKind;
  enumValues?: string[];
  itemIdPath?: string;
} {
  if (control.options && control.options.length > 0) {
    const enumValues = Array.from(new Set(control.options.map((o) => o.value).filter(Boolean)));
    return { kind: 'enum', enumValues: enumValues.length ? enumValues : undefined };
  }

  if (control.type === 'toggle') return { kind: 'boolean' };
  if (control.type === 'slider') return { kind: 'number' };
  if (control.type === 'dropdown-fill') return { kind: 'json' };
  const samplePath = samplePathForDefaults(control.path);
  const sample = getAt<unknown>(defaults, samplePath);

  if (control.type === 'repeater' || control.type === 'object-manager') {
    const itemIdPath =
      control.type === 'object-manager'
        ? 'id'
        : Array.isArray(sample) && sample.some((item) => item && typeof item === 'object' && !Array.isArray(item))
          ? 'id'
          : undefined;
    return { kind: 'array', itemIdPath };
  }
  if (typeof sample === 'boolean') return { kind: 'boolean' };
  if (typeof sample === 'number') return { kind: 'number' };
  if (typeof sample === 'string') return { kind: 'string' };
  if (Array.isArray(sample)) return { kind: 'array' };
  if (sample && typeof sample === 'object') return { kind: 'object' };

  return { kind: 'unknown' };
}

function parseBooleanAttr(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function parseNumberAttr(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

function parseFillModes(value: string | undefined): string[] | null {
  if (!value) return null;
  const modes = value
    .split(',')
    .map((mode) => mode.trim().toLowerCase())
    .filter(Boolean);
  return modes.length ? modes : null;
}

function collectControlsFromMarkup(markup: string, panelId: string, controls: CompiledControl[]) {
  // Allow '>' inside quoted attribute values (e.g., template strings) and match both self-closing and open/close.
  const tdRegex =
    /<tooldrawer-field(?:-([a-z0-9-]+))?((?:[^>"']|"[^"]*"|'[^']*')*)(?:\/>|>([\s\S]*?)<\/tooldrawer-field>)/gi;
  let match: RegExpExecArray | null;

  while ((match = tdRegex.exec(markup)) !== null) {
    const groupId = match[1];
    const attrsRaw = match[2] || '';
    const inner = match[3];
    const attrs = parseTooldrawerAttributes(attrsRaw);
    const type = attrs.type;
    const path = attrs.path;
    const addDerivedPath = (candidate: string | undefined) => {
      if (!candidate) return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (!trimmed.includes('.') && !/__[^.]+__/.test(trimmed)) return;
      controls.push({
        panelId,
        type: 'field',
        path: trimmed,
      });
    };

    if (type && path) {
      const min = parseNumberAttr(attrs.min);
      const max = parseNumberAttr(attrs.max);
      const fillModes = type === 'dropdown-fill' ? parseFillModes(attrs.fillModes || attrs['fill-modes']) : null;
      const allowImageOverride = parseBooleanAttr(attrs.allowImage || attrs['allow-image']);
      const inferredAllowsImage = (() => {
        const pathLower = path.toLowerCase();
        if (pathLower.includes('background')) return true;
        const labelLower = (attrs.label || '').toLowerCase();
        return labelLower.includes('background');
      })();
      const allowImageFromModes = fillModes ? fillModes.some((mode) => mode === 'image' || mode === 'video') : undefined;
      const allowImage =
        type === 'dropdown-fill' ? (allowImageOverride ?? allowImageFromModes ?? inferredAllowsImage) : undefined;
      controls.push({
        panelId,
        groupId,
        groupLabel: groupId ? groupKeyToLabel(groupId) : undefined,
        type,
        path,
        label: attrs.label,
        showIf: attrs['show-if'],
        options: attrs.options ? parseControlOptions({ controlPath: path, optionsRaw: attrs.options }) : undefined,
        allowImage,
        min,
        max,
      });
      addDerivedPath(attrs.labelPath);
      addDerivedPath(attrs.reorderLabelPath || attrs['reorder-label-path']);
    }

    if (attrs.template) {
      const decodedTemplate = decodeHtmlEntities(attrs.template);
      collectControlsFromMarkup(decodedTemplate, panelId, controls);
    }
    if (inner) {
      collectControlsFromMarkup(inner, panelId, controls);
    }
  }

  const bobPathRegex = /data-bob-path=(?:"([^"]+)"|'([^']+)')/gi;
  let bobMatch: RegExpExecArray | null;
  while ((bobMatch = bobPathRegex.exec(markup)) !== null) {
    const pathValue = bobMatch[1] || bobMatch[2];
    if (!pathValue) continue;
    controls.push({
      panelId,
      type: 'field',
      path: pathValue,
    });
  }
}

export function compileControlsFromPanels(args: {
  panels: CompiledPanel[];
  defaults: Record<string, unknown>;
}): CompiledControl[] {
  const rawControls = args.panels.flatMap((panel) => {
    const panelControls: CompiledControl[] = [];
    collectControlsFromMarkup(panel.html, panel.id, panelControls);
    return panelControls;
  });

  const score = (control: CompiledControl) =>
    (control.options && control.options.length ? 100 : 0) +
    (control.type === 'field' ? 0 : 10) +
    (control.label ? 1 : 0);

  const deduped = new Map<string, CompiledControl>();
  rawControls.forEach((control) => {
    const key = `${control.panelId}|${control.path}`;
    const existing = deduped.get(key);
    if (!existing || score(control) > score(existing)) {
      deduped.set(key, control);
    }
  });

  const controls = Array.from(deduped.values()).map((control) => {
    const meta = inferControlMetadata(control, args.defaults);
    return { ...control, ...meta };
  });

  const unknownControl = controls.find((control) => !control.kind || control.kind === 'unknown');
  if (unknownControl) {
    throw new Error(`[BobCompiler] Control "${unknownControl.path}" is missing kind metadata`);
  }

  return controls;
}
