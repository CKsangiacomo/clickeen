'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listWidgetShellAccountDefaultMetadataPaths } from '@clickeen/widget-shell';
import { useRomaAccountApi } from './account-api';
import { getCompiledWidget } from './compiled-widget-cache';

type AccountWidgetDefaultsDocument = {
  v: 1;
  accountId: string;
  shell: Record<string, unknown>;
  widgets: Record<
    string,
    {
      core: Record<string, unknown>;
    }
  >;
  seededAt: string;
  updatedAt: string;
};

type WidgetDefaultsPayload = {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
};

type CompiledControlOption = {
  label: string;
  value: string;
};

type DefaultsControl = {
  order: number;
  panelId: string;
  groupId?: string;
  groupLabel?: string;
  type: string;
  path: string;
  label?: string;
  showIf?: string;
  options?: CompiledControlOption[];
};

type ControlGroup = {
  key: string;
  label: string;
  controls: DefaultsControl[];
};

const PANEL_ORDER = ['content', 'layout', 'appearance', 'typography', 'settings'];
const SHELL_TOP_LEVEL_PATHS = new Set([
  'header',
  'headerCta',
  'stage',
  'pod',
  'coreSize',
  'localeSwitcher',
]);
const SHELL_TYPOGRAPHY_ROLES = new Set(['title', 'body', 'button', 'localeSwitcher']);
const SHELL_SOFTWARE_METADATA_PATHS = new Set(listWidgetShellAccountDefaultMetadataPaths());
const CORE_SOFTWARE_METADATA_PATHS = new Set(['uiLabels.core', 'typography.roleScales']);

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaults(value: AccountWidgetDefaultsDocument): AccountWidgetDefaultsDocument {
  return JSON.parse(JSON.stringify(value)) as AccountWidgetDefaultsDocument;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fieldLabel(path: string): string {
  const leaf = path.split('.').at(-1) ?? path;
  return leaf
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function panelLabel(panelId: string): string {
  return fieldLabel(panelId || 'defaults');
}

function widgetLabel(widgetType: string): string {
  const labels: Record<string, string> = {
    'big-bang': 'Big Bang',
    calltoaction: 'Call to Action',
    cards: 'Cards',
    countdown: 'Countdown',
    faq: 'FAQ',
    logoshowcase: 'Logo Showcase',
    split: 'Split',
  };
  return labels[widgetType] ?? fieldLabel(widgetType);
}

function panelSortValue(panelId: string): number {
  const index = PANEL_ORDER.indexOf(panelId);
  return index >= 0 ? index : PANEL_ORDER.length;
}

function readPathValue(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[Number(part)];
      continue;
    }
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function pathExists(root: Record<string, unknown>, path: string): boolean {
  return typeof readPathValue(root, path) !== 'undefined';
}

function setPathValue(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const next = cloneValue(root);
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = next;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const nextPart = parts[index + 1];
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return next;
      const offset = Number(part);
      if (last) {
        cursor[offset] = value;
        return next;
      }
      if (cursor[offset] == null) cursor[offset] = /^\d+$/.test(nextPart ?? '') ? [] : {};
      cursor = cursor[offset];
      continue;
    }
    if (!isRecord(cursor)) return next;
    if (last) {
      cursor[part] = value;
      return next;
    }
    if (!isRecord(cursor[part]) && !Array.isArray(cursor[part])) {
      cursor[part] = /^\d+$/.test(nextPart ?? '') ? [] : {};
    }
    cursor = cursor[part];
  }
  return next;
}

function isShellTypographyPath(parts: string[]): boolean {
  if (parts[0] !== 'typography') return false;
  if (parts[1] === 'globalFamily') return true;
  if (parts[1] === 'roles' || parts[1] === 'roleScales') {
    return SHELL_TYPOGRAPHY_ROLES.has(parts[2] ?? '');
  }
  return false;
}

function isShellAppearancePath(parts: string[]): boolean {
  if (parts[0] !== 'appearance') return false;
  const joined = parts.join('.');
  return (
    joined.startsWith('appearance.headerCta.') ||
    joined.startsWith('appearance.localeSwitcher') ||
    joined === 'appearance.podBorder'
  );
}

function isShellBehaviorPath(parts: string[]): boolean {
  const joined = parts.join('.');
  return joined === 'behavior.showBacklink' || joined.startsWith('behavior.socialShare.');
}

function isShellControlPath(path: string): boolean {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return false;
  if (SHELL_TOP_LEVEL_PATHS.has(parts[0]!)) return true;
  if (isShellTypographyPath(parts)) return true;
  if (isShellAppearancePath(parts)) return true;
  if (isShellBehaviorPath(parts)) return true;
  return false;
}

function normalizeOptions(value: unknown): CompiledControlOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const label = typeof entry.label === 'string' ? entry.label : '';
      const optionValue = typeof entry.value === 'string' ? entry.value : '';
      return label && optionValue ? { label, value: optionValue } : null;
    })
    .filter((entry): entry is CompiledControlOption => Boolean(entry));
  return options.length > 0 ? options : undefined;
}

function normalizeCompiledControl(raw: unknown, order: number): DefaultsControl | null {
  if (!isRecord(raw)) return null;
  const panelId = typeof raw.panelId === 'string' ? raw.panelId : '';
  const type = typeof raw.type === 'string' ? raw.type : '';
  const path = typeof raw.path === 'string' ? raw.path : '';
  if (!panelId || !type || !path) return null;
  return {
    order,
    panelId,
    type,
    path,
    ...(typeof raw.groupId === 'string' && raw.groupId ? { groupId: raw.groupId } : {}),
    ...(typeof raw.groupLabel === 'string' && raw.groupLabel ? { groupLabel: raw.groupLabel } : {}),
    ...(typeof raw.label === 'string' && raw.label ? { label: raw.label } : {}),
    ...(typeof raw.showIf === 'string' && raw.showIf ? { showIf: raw.showIf } : {}),
    ...(normalizeOptions(raw.options) ? { options: normalizeOptions(raw.options) } : {}),
  };
}

function compiledControlsFromPayload(payload: unknown): DefaultsControl[] {
  if (!isRecord(payload) || !Array.isArray(payload.controls)) return [];
  return payload.controls
    .map((control, index) => normalizeCompiledControl(control, index))
    .filter((control): control is DefaultsControl => Boolean(control))
    .sort(
      (left, right) =>
        panelSortValue(left.panelId) - panelSortValue(right.panelId) || left.order - right.order,
    );
}

function uniqueControls(controls: DefaultsControl[]): DefaultsControl[] {
  const seen = new Set<string>();
  const unique: DefaultsControl[] = [];
  for (const control of controls) {
    const key = control.path;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(control);
  }
  return unique;
}

function isPathCoveredByControl(path: string, controlPaths: Set<string>): boolean {
  for (const controlPath of controlPaths) {
    if (path === controlPath || path.startsWith(`${controlPath}.`)) return true;
  }
  return false;
}

function isPathCoveredByMetadata(path: string, metadataPaths: Set<string>): boolean {
  for (const metadataPath of metadataPaths) {
    if (path === metadataPath || path.startsWith(`${metadataPath}.`)) return true;
  }
  return false;
}

function collectDefaultPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return prefix ? [prefix] : [];
  if (!isRecord(value)) return prefix ? [prefix] : [];
  const paths = Object.entries(value).flatMap(([key, child]) =>
    collectDefaultPaths(child, prefix ? `${prefix}.${key}` : key),
  );
  return paths.length > 0 ? paths : prefix ? [prefix] : [];
}

function groupControls(controls: DefaultsControl[]): ControlGroup[] {
  const groups = new Map<string, ControlGroup>();
  for (const control of controls) {
    const groupKey = `${control.panelId}:${control.groupId ?? control.groupLabel ?? control.path.split('.')[0] ?? 'defaults'}`;
    const group = groups.get(groupKey) ?? {
      key: groupKey,
      label: `${panelLabel(control.panelId)} / ${control.groupLabel || fieldLabel(control.groupId ?? control.path.split('.')[0] ?? 'Defaults')}`,
      controls: [],
    };
    group.controls.push(control);
    groups.set(groupKey, group);
  }
  return Array.from(groups.values());
}

function parseShowIfLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const quoted = trimmed.match(/^['"]([\s\S]*)['"]$/);
  return quoted ? quoted[1] : trimmed;
}

function evaluateShowIfCondition(condition: string, values: Record<string, unknown>): boolean {
  const notEqual = condition.split('!=');
  if (notEqual.length === 2) {
    return readPathValue(values, notEqual[0]!.trim()) !== parseShowIfLiteral(notEqual[1]!);
  }
  const equal = condition.split('==');
  if (equal.length === 2) {
    return readPathValue(values, equal[0]!.trim()) === parseShowIfLiteral(equal[1]!);
  }
  return Boolean(readPathValue(values, condition.trim()));
}

function isControlVisible(control: DefaultsControl, values: Record<string, unknown>): boolean {
  if (!control.showIf) return true;
  return control.showIf
    .split('&&')
    .map((condition) => condition.trim())
    .filter(Boolean)
    .every((condition) => evaluateShowIfCondition(condition, values));
}

function JsonDefaultsField(args: {
  control: DefaultsControl;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(args.value ?? null, null, 2));

  useEffect(() => {
    setText(JSON.stringify(args.value ?? null, null, 2));
  }, [args.value]);

  const commit = () => {
    try {
      args.onChange(args.control.path, JSON.parse(text) as unknown);
    } catch {
      setText(JSON.stringify(args.value ?? null, null, 2));
    }
  };

  return (
    <label className="widget-defaults-field widget-defaults-field--json">
      <span className="body-s">{args.control.label || fieldLabel(args.control.path)}</span>
      <textarea
        className="widget-defaults-input widget-defaults-textarea"
        value={text}
        onBlur={commit}
        onChange={(event) => setText(event.currentTarget.value)}
      />
    </label>
  );
}

function DefaultsField(args: {
  control: DefaultsControl;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
}) {
  const { control, values, onChange } = args;
  if (!isControlVisible(control, values)) return null;
  const value = readPathValue(values, control.path);
  const label = control.label || fieldLabel(control.path);

  if (control.type === 'toggle' || typeof value === 'boolean') {
    return (
      <label className="widget-defaults-field widget-defaults-field--toggle">
        <span className="body-s">{label}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(control.path, event.currentTarget.checked)}
        />
      </label>
    );
  }

  if (control.options?.length) {
    const selected = typeof value === 'string' ? value : '';
    return (
      <label className="widget-defaults-field">
        <span className="body-s">{label}</span>
        <select
          className="widget-defaults-input"
          value={selected}
          onChange={(event) => onChange(control.path, event.currentTarget.value)}
        >
          {selected && !control.options.some((option) => option.value === selected) ? (
            <option value={selected}>{selected}</option>
          ) : null}
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (control.type === 'valuefield' || typeof value === 'number') {
    return (
      <label className="widget-defaults-field">
        <span className="body-s">{label}</span>
        <input
          className="widget-defaults-input"
          type="number"
          value={typeof value === 'number' && Number.isFinite(value) ? String(value) : '0'}
          onChange={(event) => onChange(control.path, Number(event.currentTarget.value))}
        />
      </label>
    );
  }

  if (Array.isArray(value) || isRecord(value)) {
    return <JsonDefaultsField control={control} value={value} onChange={onChange} />;
  }

  const text = typeof value === 'string' ? value : '';
  const multiline =
    control.type === 'textedit' ||
    control.type === 'dropdown-edit' ||
    text.length > 72 ||
    /<[^>]+>/.test(text);
  return (
    <label className="widget-defaults-field">
      <span className="body-s">{label}</span>
      {multiline ? (
        <textarea
          className="widget-defaults-input widget-defaults-textarea"
          value={text}
          onChange={(event) => onChange(control.path, event.currentTarget.value)}
        />
      ) : (
        <input
          className="widget-defaults-input"
          type="text"
          value={text}
          onChange={(event) => onChange(control.path, event.currentTarget.value)}
        />
      )}
    </label>
  );
}

function DefaultsGroup(args: {
  group: ControlGroup;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <details className="widget-defaults-group" open>
      <summary className="label-s">{args.group.label}</summary>
      <div className="widget-defaults-fields">
        {args.group.controls.map((control) => (
          <DefaultsField
            key={`${control.panelId}:${control.path}:${control.type}`}
            control={control}
            values={args.values}
            onChange={args.onChange}
          />
        ))}
      </div>
    </details>
  );
}

export function WidgetDefaultsDomain() {
  const accountApi = useRomaAccountApi();
  const [baseline, setBaseline] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [draft, setDraft] = useState<AccountWidgetDefaultsDocument | null>(null);
  const [compiledControls, setCompiledControls] = useState<Record<string, DefaultsControl[]>>({});
  const [loading, setLoading] = useState(true);
  const [compiledLoading, setCompiledLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const widgetTypes = useMemo(
    () =>
      draft ? Object.keys(draft.widgets).sort((left, right) => left.localeCompare(right)) : [],
    [draft],
  );
  const widgetTypesKey = widgetTypes.join('\n');
  const dirty = Boolean(baseline && draft && stableJson(baseline) !== stableJson(draft));
  const controlsLoaded =
    widgetTypes.length > 0 &&
    widgetTypes.every((widgetType) => Array.isArray(compiledControls[widgetType]));

  const loadDefaults = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsPayload>(
        '/api/account/widget-defaults',
        { method: 'GET' },
      );
      setBaseline(cloneDefaults(payload.widgetDefaults));
      setDraft(cloneDefaults(payload.widgetDefaults));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Loading widget defaults failed.');
    } finally {
      setLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    void loadDefaults();
  }, [loadDefaults]);

  useEffect(() => {
    const requestedWidgetTypes = widgetTypesKey.split('\n').filter(Boolean);
    if (!requestedWidgetTypes.length) return;
    let cancelled = false;
    setCompiledLoading(true);
    setError('');
    Promise.all(
      requestedWidgetTypes.map(async (widgetType) => {
        const { payload } = await getCompiledWidget(widgetType);
        return [widgetType, compiledControlsFromPayload(payload)] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setCompiledControls(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (cancelled) return;
        setError(error instanceof Error ? error.message : 'Loading Builder controls failed.');
      })
      .finally(() => {
        if (!cancelled) setCompiledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [widgetTypesKey]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const link = target?.closest('a[href]');
      if (!link) return;
      if (window.confirm('You have unsaved widget defaults. Leave and discard them?')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const shellGroups = useMemo(() => {
    if (!draft) return [];
    const compiledShellControls = uniqueControls(
      Object.values(compiledControls)
        .flat()
        .filter(
          (control) => isShellControlPath(control.path) && pathExists(draft.shell, control.path),
        ),
    );
    return groupControls(compiledShellControls);
  }, [compiledControls, draft]);

  const widgetEntries = useMemo(() => {
    if (!draft) return [];
    return widgetTypes.map((widgetType) => {
      const core = draft.widgets[widgetType]?.core ?? {};
      const compiledCoreControls = uniqueControls(
        (compiledControls[widgetType] ?? []).filter(
          (control) => !isShellControlPath(control.path) && pathExists(core, control.path),
        ),
      );
      return [widgetType, core, groupControls(compiledCoreControls)] as const;
    });
  }, [compiledControls, draft, widgetTypes]);

  const unmappedDefaultPaths = useMemo(() => {
    if (!draft || !controlsLoaded) return [];
    const compiledShellControls = uniqueControls(
      Object.values(compiledControls)
        .flat()
        .filter(
          (control) => isShellControlPath(control.path) && pathExists(draft.shell, control.path),
        ),
    );
    const shellControlPaths = new Set(compiledShellControls.map((control) => control.path));
    const shellPaths = collectDefaultPaths(draft.shell)
      .filter((path) => !isPathCoveredByControl(path, shellControlPaths))
      .filter((path) => !isPathCoveredByMetadata(path, SHELL_SOFTWARE_METADATA_PATHS))
      .map((path) => `Shell: ${path}`);

    const corePaths = widgetTypes.flatMap((widgetType) => {
      const core = draft.widgets[widgetType]?.core ?? {};
      const compiledCoreControls = uniqueControls(
        (compiledControls[widgetType] ?? []).filter(
          (control) => !isShellControlPath(control.path) && pathExists(core, control.path),
        ),
      );
      const coreControlPaths = new Set(compiledCoreControls.map((control) => control.path));
      return collectDefaultPaths(core)
        .filter((path) => !isPathCoveredByControl(path, coreControlPaths))
        .filter((path) => !isPathCoveredByMetadata(path, CORE_SOFTWARE_METADATA_PATHS))
        .map((path) => `${widgetLabel(widgetType)}: ${path}`);
    });

    return [...shellPaths, ...corePaths].sort((left, right) => left.localeCompare(right));
  }, [compiledControls, controlsLoaded, draft, widgetTypes]);

  const updateShellPath = useCallback((path: string, value: unknown) => {
    setDraft((current) =>
      current ? { ...current, shell: setPathValue(current.shell, path, value) } : current,
    );
  }, []);

  const updateWidgetPath = useCallback((widgetType: string, path: string, value: unknown) => {
    setDraft((current) => {
      if (!current) return current;
      const existing = current.widgets[widgetType];
      if (!existing) return current;
      return {
        ...current,
        widgets: {
          ...current.widgets,
          [widgetType]: {
            core: setPathValue(existing.core, path, value),
          },
        },
      };
    });
  }, []);

  const discard = useCallback(() => {
    if (!baseline) return;
    setDraft(cloneDefaults(baseline));
    setError('');
  }, [baseline]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    const snapshot = stableJson(draft);
    setSaving(true);
    setError('');
    try {
      const payload = await accountApi.fetchJson<WidgetDefaultsPayload>(
        '/api/account/widget-defaults',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ widgetDefaults: draft }),
        },
      );
      const saved = cloneDefaults(payload.widgetDefaults);
      setBaseline(saved);
      setDraft((current) =>
        current && stableJson(current) !== snapshot ? current : cloneDefaults(saved),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Saving widget defaults failed.');
    } finally {
      setSaving(false);
    }
  }, [accountApi, draft, saving]);

  if (loading) {
    return <section className="roma-module-surface body-m">Loading widget defaults...</section>;
  }

  if (!draft) {
    return (
      <section className="roma-module-surface">
        <p className="body-m">{error || 'Widget defaults are unavailable.'}</p>
        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void loadDefaults()}
          >
            <span className="diet-btn-txt__label body-m">Reload</span>
          </button>
        </div>
      </section>
    );
  }

  if (compiledLoading || !controlsLoaded) {
    return <section className="roma-module-surface body-m">Loading Builder controls...</section>;
  }

  if (unmappedDefaultPaths.length > 0) {
    return (
      <section className="roma-module-surface widget-defaults-contract-error">
        <div>
          <h2 className="heading-4">Widget Defaults Contract Error</h2>
          {error ? <p className="body-s widget-defaults-error">{error}</p> : null}
        </div>
        <p className="body-m">
          Account defaults contain paths that are not exposed by the compiled Builder control
          contract. Fix Widget Shell or the widget spec before editing defaults.
        </p>
        <pre className="widget-defaults-contract-error__paths">
          {unmappedDefaultPaths.join('\n')}
        </pre>
      </section>
    );
  }

  return (
    <section className="widget-defaults">
      <div className="widget-defaults-toolbar">
        <div>
          <h2 className="heading-4">Global Shell Defaults</h2>
          {compiledLoading ? <p className="body-s">Loading Builder controls...</p> : null}
          {error ? <p className="body-s widget-defaults-error">{error}</p> : null}
        </div>
        <div className="widget-defaults-actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            disabled={!dirty || saving}
            onClick={discard}
          >
            <span className="diet-btn-txt__label body-m">Discard</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            <span className="diet-btn-txt__label body-m">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      <div className="widget-defaults-section">
        {shellGroups.map((group) => (
          <DefaultsGroup
            key={group.key}
            group={group}
            values={draft.shell}
            onChange={updateShellPath}
          />
        ))}
      </div>

      <div className="widget-defaults-toolbar widget-defaults-toolbar--secondary">
        <h2 className="heading-4">Widget Defaults</h2>
      </div>
      <div className="widget-defaults-widgets">
        {widgetEntries.map(([widgetType, core, groups]) => (
          <section className="widget-defaults-widget" key={widgetType}>
            <h3 className="heading-5">{widgetLabel(widgetType)}</h3>
            {groups.map((group) => (
              <DefaultsGroup
                key={`${widgetType}:${group.key}`}
                group={group}
                values={core}
                onChange={(path, value) => updateWidgetPath(widgetType, path, value)}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}
