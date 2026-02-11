type ControlSummary = {
  path: string;
  panelId?: string;
  groupLabel?: string;
  kind?: string;
  label?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
};

type CsPromptInput = {
  prompt: string;
  widgetType: string;
  currentConfig: Record<string, unknown>;
  controls: ControlSummary[];
};

const MAX_PROMPT_CHARS = 7_200;
const TOKEN_SEGMENT = /^__[^.]+__$/;

function normalizeToken(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitPathSegments(pathStr: string): string[] {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg: string): boolean {
  return /^\d+$/.test(seg);
}

function isTokenSegment(seg: string): boolean {
  return TOKEN_SEGMENT.test(seg);
}

function getValueAtPath(root: unknown, pathStr: string): unknown {
  const segments = splitPathSegments(pathStr);
  let current: unknown = root;
  for (const seg of segments) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      if (!isNumericSegment(seg)) return undefined;
      current = current[Number(seg)];
      continue;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[seg];
      continue;
    }
    return undefined;
  }
  return current;
}

function expandControlPathPattern(args: { root: unknown; pathPattern: string; maxPaths?: number }): string[] {
  const { root, pathPattern } = args;
  const maxPaths = typeof args.maxPaths === 'number' && args.maxPaths > 0 ? Math.floor(args.maxPaths) : 120;
  const segments = splitPathSegments(pathPattern);
  if (!segments.length) return [];

  const out: string[] = [];
  const visit = (node: unknown, segIndex: number, built: string[]) => {
    if (out.length >= maxPaths) return;
    if (segIndex >= segments.length) {
      if (built.length > 0) out.push(built.join('.'));
      return;
    }
    const seg = segments[segIndex];
    if (isTokenSegment(seg)) {
      if (!Array.isArray(node)) return;
      for (let idx = 0; idx < node.length; idx += 1) {
        visit(node[idx], segIndex + 1, [...built, String(idx)]);
        if (out.length >= maxPaths) return;
      }
      return;
    }
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const next = (node as Record<string, unknown>)[seg];
    if (next === undefined) return;
    visit(next, segIndex + 1, [...built, seg]);
  };

  visit(root, 0, []);
  return out;
}

function serializePromptValue(value: unknown, maxLen = 120): string {
  if (value === undefined) return '[unset]';
  if (value === null) return 'null';

  let out: string;
  if (typeof value === 'string') {
    out = value;
  } else {
    try {
      const encoded = JSON.stringify(value);
      out = typeof encoded === 'string' ? encoded : String(value);
    } catch {
      out = String(value);
    }
  }
  if (typeof out !== 'string') out = String(out);
  if (out.length <= maxLen) return out;
  return out.slice(0, maxLen);
}

function scoreControlForPrompt(args: { promptTokens: Set<string>; promptNorm: string; control: ControlSummary }): number {
  const { promptTokens, promptNorm, control } = args;
  if (!promptTokens.size) return 0;
  const label = normalizeToken(control.label || '');
  const path = normalizeToken(control.path || '');
  const group = normalizeToken(control.groupLabel || '');
  const panel = normalizeToken(control.panelId || '');
  const hay = [label, path, group, panel].filter(Boolean).join(' ');
  if (!hay) return 0;
  const hayTokens = hay.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const token of hayTokens) {
    if (promptTokens.has(token)) score += 1;
  }
  if (label && promptNorm.includes(label)) score += 5;
  if (path && promptNorm.includes(path)) score += 3;
  if (group && promptNorm.includes(group)) score += 1;
  if (panel && promptNorm.includes(panel)) score += 1;
  return score;
}

function isContentControl(control: ControlSummary): boolean {
  const text = `${control.path || ''} ${control.label || ''} ${control.groupLabel || ''}`.toLowerCase();
  return /question|answer|title|subtitle|cta|label|text|content|description/.test(text);
}

function isContentRewriteIntent(prompt: string): boolean {
  const text = String(prompt || '').trim().toLowerCase();
  if (!text) return false;
  const hasContentNoun = /\b(faq|q&a|qa|question|questions|answer|answers|title|subtitle|section|cta|copy|text|content)\b/.test(text);
  if (!hasContentNoun) return false;
  const hasEditVerb = /\b(rewrite|rephrase|refresh|improve|update|edit|change|adapt|translate|localize|polish|simplify|shorten|expand)\b/.test(
    text,
  );
  const hasBulkSignal = /\b(all|entire|whole|every|each)\b/.test(text);
  return hasEditVerb || hasBulkSignal;
}

function dedupeByPath(controls: ControlSummary[]): ControlSummary[] {
  const out: ControlSummary[] = [];
  const seen = new Set<string>();
  for (const control of controls) {
    const path = String(control.path || '').trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(control);
  }
  return out;
}

function buildConcreteValueRows(args: {
  controls: ControlSummary[];
  currentConfig: Record<string, unknown>;
  maxRows: number;
  valueMaxLen?: number;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const maxRows = Math.max(1, Math.floor(args.maxRows));
  const valueMaxLen = typeof args.valueMaxLen === 'number' && args.valueMaxLen > 0 ? Math.floor(args.valueMaxLen) : 96;

  for (const control of args.controls) {
    const rawPath = String(control.path || '').trim();
    if (!rawPath) continue;
    const expanded = expandControlPathPattern({
      root: args.currentConfig,
      pathPattern: rawPath,
      maxPaths: Math.max(maxRows * 2, 40),
    });
    const concretePaths = expanded.length ? expanded : [rawPath];
    for (const path of concretePaths) {
      if (seen.has(path)) continue;
      seen.add(path);
      const value = getValueAtPath(args.currentConfig, path);
      out.push(`- ${path}: ${serializePromptValue(value, valueMaxLen)}`);
      if (out.length >= maxRows) return out;
    }
  }

  return out;
}

function buildPayload(args: {
  widgetType: string;
  prompt: string;
  controlRows: string[];
  valueRows: string[];
}): string {
  return [
    `Widget type: ${args.widgetType}`,
    '',
    `User request: ${args.prompt}`,
    'Execution contract: use provided controls/context; never ask the user for controls JSON, path lists, or config snippets.',
    '',
    'EDITABLE_CONTROLS:',
    args.controlRows.join('\n'),
    '',
    'CURRENT_VALUES:',
    args.valueRows.join('\n'),
  ].join('\n');
}

function buildMinimalPayload(input: CsPromptInput, controls: ControlSummary[]): string {
  const minimalControls = controls.slice(0, 12).map((control) => {
    const label = control.label ? ` | label=${control.label}` : '';
    const kind = control.kind ? ` | kind=${control.kind}` : '';
    return `- ${control.path}${label}${kind}`;
  });
  const minimalValues =
    buildConcreteValueRows({
      controls: dedupeByPath(controls.filter(isContentControl)),
      currentConfig: input.currentConfig,
      maxRows: 10,
      valueMaxLen: 90,
    }).slice(0, 10) ||
    [];
  const valueRows =
    minimalValues.length > 0
      ? minimalValues
      : minimalControls.slice(0, 6).map((row) => {
          const path = row.replace(/^\-\s*/, '').split(' | ')[0];
          const value = getValueAtPath(input.currentConfig, path);
          return `- ${path}: ${serializePromptValue(value, 90)}`;
        });
  return [
    `Widget type: ${input.widgetType}`,
    '',
    `User request: ${input.prompt}`,
    'Execution contract: use provided controls/context; never ask the user for controls JSON, path lists, or config snippets.',
    '',
    'EDITABLE_CONTROLS:',
    minimalControls.join('\n'),
    '',
    'CURRENT_VALUES:',
    valueRows.join('\n'),
  ].join('\n');
}

export function buildCsPromptPayload(input: CsPromptInput): string {
  const promptNorm = normalizeToken(input.prompt);
  const promptTokens = new Set(promptNorm.split(/\s+/).filter(Boolean));

  const ranked = input.controls
    .map((control) => ({ control, score: scoreControlForPrompt({ promptTokens, promptNorm, control }) }))
    .sort((a, b) => b.score - a.score);

  const bestMatches = ranked.filter((entry) => entry.score > 0).map((entry) => entry.control);
  const rewriteLike = isContentRewriteIntent(input.prompt);
  const contentControls = dedupeByPath(input.controls.filter(isContentControl));

  const merged = dedupeByPath(
    rewriteLike
      ? [...contentControls, ...bestMatches.slice(0, 36), ...input.controls.slice(0, 16)]
      : [...(bestMatches.length ? bestMatches.slice(0, 24) : input.controls.slice(0, 20)), ...contentControls.slice(0, 14), ...input.controls.slice(0, 8)],
  );

  const selectedControls = merged.slice(0, rewriteLike ? 140 : 48);
  const controlRows = selectedControls.map((control) => {
    const label = control.label ? ` | label=${control.label}` : '';
    const kind = control.kind ? ` | kind=${control.kind}` : '';
    const group = control.groupLabel ? ` | group=${control.groupLabel}` : '';
    const panel = control.panelId ? ` | panel=${control.panelId}` : '';
    const enumValues =
      Array.isArray(control.enumValues) && control.enumValues.length
        ? ` | enum=${control.enumValues.slice(0, 8).join(',')}`
        : '';
    const range =
      typeof control.min === 'number' || typeof control.max === 'number'
        ? ` | range=${typeof control.min === 'number' ? control.min : '-inf'}..${
            typeof control.max === 'number' ? control.max : 'inf'
          }`
        : '';
    return `- ${control.path}${label}${kind}${panel}${group}${enumValues}${range}`;
  });

  const valueRows = rewriteLike
    ? buildConcreteValueRows({
        controls: contentControls.length ? contentControls : selectedControls,
        currentConfig: input.currentConfig,
        maxRows: 180,
        valueMaxLen: 120,
      })
    : buildConcreteValueRows({
        controls: selectedControls.filter((control) => !/shadow|border|radius|opacity|blur/i.test(control.path)),
        currentConfig: input.currentConfig,
        maxRows: 28,
        valueMaxLen: 96,
      });

  let trimmedControlRows = controlRows.slice();
  let trimmedValueRows = valueRows.slice();
  let payload = buildPayload({
    widgetType: input.widgetType,
    prompt: input.prompt,
    controlRows: trimmedControlRows,
    valueRows: trimmedValueRows,
  });

  if (rewriteLike) {
    while (payload.length > MAX_PROMPT_CHARS && trimmedControlRows.length > 18) {
      trimmedControlRows = trimmedControlRows.slice(0, -1);
      payload = buildPayload({
        widgetType: input.widgetType,
        prompt: input.prompt,
        controlRows: trimmedControlRows,
        valueRows: trimmedValueRows,
      });
    }
    while (payload.length > MAX_PROMPT_CHARS && trimmedValueRows.length > 12) {
      trimmedValueRows = trimmedValueRows.slice(0, -1);
      payload = buildPayload({
        widgetType: input.widgetType,
        prompt: input.prompt,
        controlRows: trimmedControlRows,
        valueRows: trimmedValueRows,
      });
    }
  } else {
    while (payload.length > MAX_PROMPT_CHARS && trimmedValueRows.length > 8) {
      trimmedValueRows = trimmedValueRows.slice(0, -1);
      payload = buildPayload({
        widgetType: input.widgetType,
        prompt: input.prompt,
        controlRows: trimmedControlRows,
        valueRows: trimmedValueRows,
      });
    }
    while (payload.length > MAX_PROMPT_CHARS && trimmedControlRows.length > 12) {
      trimmedControlRows = trimmedControlRows.slice(0, -1);
      payload = buildPayload({
        widgetType: input.widgetType,
        prompt: input.prompt,
        controlRows: trimmedControlRows,
        valueRows: trimmedValueRows,
      });
    }
  }

  if (payload.length <= MAX_PROMPT_CHARS) return payload;

  // Fall back to a compact payload rather than emitting "[truncated]" markers
  // that can cause the model to ask the user for raw JSON dumps.
  const minimal = buildMinimalPayload(input, selectedControls);
  if (minimal.length <= MAX_PROMPT_CHARS) return minimal;
  return minimal.slice(0, MAX_PROMPT_CHARS);
}
