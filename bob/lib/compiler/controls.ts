import type {
  CompiledControl,
  CompiledControlOption,
  CompiledPanel,
  ControlKind,
  PanelId,
} from '../types';
import { encodeHtmlEntities, parseTooldrawerAttributes } from '../compiler.shared';
import { getAt } from '../utils/paths';
import { validateShowIfExpression } from '../../components/td-menu-content/showIf';

const TOKEN_SEGMENT = /^__[^.]+__$/;

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

export function expandTooldrawerClusters(html: string, idNamespace = ''): string {
  if (idNamespace && !/^[a-z][a-z0-9-]*$/.test(idNamespace)) {
    throw new Error('[BobCompiler] cluster id namespace is invalid');
  }
  const openTag = '<tooldrawer-cluster';
  const closeTag = '</tooldrawer-cluster>';

  let clusterId = 0;
  let cursor = 0;
  while (cursor < html.length) {
    const lower = html.toLowerCase();
    const start = lower.indexOf(openTag, cursor);
    if (start === -1) break;

    const openEnd = findTagEnd(html, start + openTag.length);
    if (openEnd === -1) break;

    const attrsRaw = html.slice(start + openTag.length, openEnd);
    const attrs = parseTooldrawerAttributes(attrsRaw);
    const label = attrs.label || '';
    const initiallyOpen = parseBooleanAttr(attrs.initiallyOpen || attrs['initially-open']) === true;

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
        const showIf = attrs['show-if'] || '';
        if (showIf) validateShowIfExpression(showIf);

        if (!label) {
          throw new Error('[BobCompiler] <tooldrawer-cluster> requires label');
        }

        if (attrs.gap || attrs['space-after'] || attrs.spaceAfter) {
          throw new Error(
            '[BobCompiler] <tooldrawer-cluster> does not support gap/space-after; use ToolDrawer stack gap + fixed cluster gap',
          );
        }

        const wrapperAttrs: string[] = [
          'class="tdmenucontent__cluster"',
          `data-collapsed="${initiallyOpen ? 'false' : 'true'}"`,
        ];
        if (showIf) wrapperAttrs.push(`data-bob-showif="${encodeHtmlEntities(showIf)}"`);
        const nextClusterId = clusterId;
        clusterId += 1;

        const bodyId = `td-${idNamespace ? `${idNamespace}-` : ''}cluster-body-${nextClusterId}`;
        let headerMarkup = '';
        const labelAttrs: string[] = ['class="overline-small tdmenucontent__cluster-label"'];

        const toggleMarkup = [
          `<button type="button" class="diet-button tdmenucontent__cluster-toggle" data-size="small" data-type="quaternary" aria-label="Toggle section" aria-expanded="${initiallyOpen ? 'true' : 'false'}" aria-controls="${bodyId}">`,
          `  <span class="diet-icon tdmenucontent__cluster-toggle-icon" data-icon="chevron.up" aria-hidden="true" data-size="12"></span>`,
          `</button>`,
        ].join('');

        const labelMarkup = `<div ${labelAttrs.join(' ')}>${encodeHtmlEntities(label)}</div>`;
        headerMarkup = `<div class="tdmenucontent__cluster-header">${labelMarkup}${toggleMarkup}</div>`;

        const bodyAttrs: string[] = ['class="tdmenucontent__cluster-body"', `id="${bodyId}"`];
        if (!initiallyOpen) bodyAttrs.push('hidden');
        const bodyMarkup = `<div ${bodyAttrs.join(' ')}>${inner}</div>`;
        const replacement = `<div ${wrapperAttrs.join(' ')}>${headerMarkup}${bodyMarkup}</div>`;
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.optionsRaw) as unknown;
  } catch {
    throw new Error(`[BobCompiler] Invalid JSON options for control "${args.controlPath}"`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`[BobCompiler] options for control "${args.controlPath}" must be a JSON array`);
  }

  const options: CompiledControlOption[] = [];
  parsed.forEach((opt, index) => {
    if (!opt || typeof opt !== 'object' || Array.isArray(opt)) {
      throw new Error(
        `[BobCompiler] options[${index}] for control "${args.controlPath}" must be an object`,
      );
    }
    if ('isGroupHeader' in opt && (opt as any).isGroupHeader === true) return;
    const label = (opt as any).label;
    const value = (opt as any).value;
    if (typeof label !== 'string' || !label.trim()) {
      throw new Error(
        `[BobCompiler] options[${index}] for control "${args.controlPath}" requires label`,
      );
    }
    if (
      (typeof value !== 'string' || !value.trim()) &&
      (typeof value !== 'number' || !Number.isFinite(value)) &&
      typeof value !== 'boolean'
    ) {
      throw new Error(
        `[BobCompiler] options[${index}] for control "${args.controlPath}" requires value`,
      );
    }
    options.push({ label, value });
  });
  return options.length ? options : undefined;
}

function samplePathForDefaults(pathPattern: string): string {
  const segments = pathPattern.split('.').filter(Boolean);
  return segments.map((segment) => (TOKEN_SEGMENT.test(segment) ? '0' : segment)).join('.');
}

function inferControlMetadata(
  control: CompiledControl,
  defaults: Record<string, unknown>,
): {
  kind: ControlKind;
  enumValues?: string[];
  itemIdPath?: string;
} {
  const samplePath = samplePathForDefaults(control.path);
  const sample = getAt<unknown>(defaults, samplePath);

  if (control.options && control.options.length > 0) {
    if (typeof sample === 'number') return { kind: 'number' };
    if (typeof sample === 'boolean') return { kind: 'boolean' };
    const enumValues = Array.from(
      new Set(
        control.options
          .map((o) => o.value)
          .filter((value): value is string => typeof value === 'string' && Boolean(value)),
      ),
    );
    return { kind: 'enum', enumValues: enumValues.length ? enumValues : undefined };
  }

  if (control.type === 'toggle') return { kind: 'boolean' };
  if (
    control.type === 'textfield' ||
    control.type === 'choice-cards' ||
    control.type === 'choice-tiles' ||
    control.type === 'dropdown-edit'
  )
    return { kind: 'string' };
  if (control.type === 'slider' || control.type === 'valuefield') return { kind: 'number' };
  if (control.type === 'dropdown-fill' || control.type === 'dropdown-upload')
    return { kind: 'json' };

  if (control.type === 'repeater' || control.type === 'object-manager') {
    const itemIdPath =
      control.type === 'object-manager'
        ? 'id'
        : Array.isArray(sample) &&
            sample.some((item) => item && typeof item === 'object' && !Array.isArray(item))
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
  const modes = value.split(',');
  const allowed = new Set(['color', 'gradient', 'image', 'video']);
  if (new Set(modes).size !== modes.length || modes.some((mode) => !allowed.has(mode))) {
    throw new Error('[BobCompiler] dropdown-fill fill-modes are invalid');
  }
  return modes;
}

function collectControlsFromMarkup(markup: string, panelId: PanelId, controls: CompiledControl[]) {
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
    const addDerivedPath = (candidate: string | undefined, label: string | undefined) => {
      if (!candidate) return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (!trimmed.includes('.') && !/__[^.]+__/.test(trimmed)) return;
      controls.push({
        panelId,
        type: 'textfield',
        path: trimmed,
        label: label?.trim() || undefined,
      });
    };

    if (type && path) {
      const min = parseNumberAttr(attrs.min);
      const max = parseNumberAttr(attrs.max);
      const step = parseNumberAttr(attrs.step);
      const required = parseBooleanAttr(attrs.required);
      const fillModes =
        type === 'dropdown-fill' ? parseFillModes(attrs.fillModes || attrs['fill-modes']) : null;
      if (type === 'dropdown-fill' && !fillModes) {
        throw new Error(`[BobCompiler] dropdown-fill control "${path}" requires fill-modes`);
      }
      const showIf = attrs['show-if'] || undefined;
      const explicitGroupLabel =
        typeof (attrs.groupLabel || attrs['group-label']) === 'string'
          ? (attrs.groupLabel || attrs['group-label']).trim()
          : '';
      if (showIf) validateShowIfExpression(showIf);
      controls.push({
        panelId,
        groupId,
        groupLabel: explicitGroupLabel || undefined,
        type,
        path,
        label: attrs.label || undefined,
        showIf,
        options: attrs.options
          ? parseControlOptions({ controlPath: path, optionsRaw: attrs.options })
          : undefined,
        enumValues: fillModes ?? undefined,
        min,
        max,
        step,
        required,
      });
      if (type === 'bulk-edit') {
        const columnsRaw = attrs.columns;
        const columns = columnsRaw ? (JSON.parse(columnsRaw) as unknown) : null;
        if (!Array.isArray(columns)) {
          throw new Error(`[BobCompiler] bulk-edit control "${path}" requires columns`);
        }
        const rowPath = (attrs.rowPath || attrs['row-path'] || '').trim();
        columns.forEach((column, index) => {
          if (!column || typeof column !== 'object' || Array.isArray(column)) {
            throw new Error(
              `[BobCompiler] bulk-edit control "${path}" column ${index} must be an object`,
            );
          }
          const columnPath = String((column as Record<string, unknown>).path || '').trim();
          const columnLabel = String((column as Record<string, unknown>).label || '').trim();
          const columnControl = (column as Record<string, unknown>).control;
          const derivedType =
            columnControl === 'text' ? 'textfield' : columnControl === 'checkbox' ? 'toggle' : '';
          if (!columnPath || !columnLabel || !derivedType) {
            throw new Error(
              `[BobCompiler] bulk-edit control "${path}" column ${index} requires path, label, and text|checkbox control`,
            );
          }
          const itemPath = rowPath
            ? `${path}.__INDEX__.${rowPath}.__INDEX__.${columnPath}`
            : `${path}.__INDEX__.${columnPath}`;
          controls.push({
            panelId,
            groupId,
            groupLabel: explicitGroupLabel || undefined,
            type: derivedType,
            path: itemPath,
            label: columnLabel,
            showIf,
          });
        });
      }
      addDerivedPath(
        attrs.labelPath || attrs['label-path'],
        attrs.labelInputLabel || attrs['label-input-label'],
      );
    }

    if (attrs.template) {
      collectControlsFromMarkup(attrs.template, panelId, controls);
    }
    if (inner) {
      collectControlsFromMarkup(inner, panelId, controls);
    }
  }

  const bobPathRegex = /<[^>]*data-bob-path=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  let bobMatch: RegExpExecArray | null;
  while ((bobMatch = bobPathRegex.exec(markup)) !== null) {
    const pathValue = bobMatch[1] || bobMatch[2];
    if (!pathValue) continue;
    controls.push({
      panelId,
      type: 'textfield',
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
