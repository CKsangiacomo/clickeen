import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { getGrantMaxTokens, getGrantTimeoutMs } from '../grants';
import { callChatCompletion } from '../ai/chat';
import { extractUrlCandidates, fetchSinglePageText, isBlockedFetchUrl, normalizeUrl } from '../utils/webFetch';
import globalDictionary from '../lexicon/global_dictionary.json';

type ControlSummary = {
  path: string;
  panelId?: string;
  groupId?: string;
  groupLabel?: string;
  type?: string;
  kind?: string;
  label?: string;
  options?: Array<{ label: string; value: string }>;
  enumValues?: string[];
  min?: number;
  max?: number;
  itemIdPath?: string;
};

type WidgetCopilotInput = {
  sessionId: string;
  prompt: string;
  widgetType: string;
  currentConfig: Record<string, unknown>;
  controls: ControlSummary[];
};

type WidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

type WidgetCopilotResult = {
  message: string;
  ops?: WidgetOp[];
  cta?: { text: string; action: 'signup' | 'upgrade' | 'learn-more'; url?: string };
  meta?: {
    intent?: 'edit' | 'explain' | 'clarify';
    outcome?: 'ops_applied' | 'no_ops' | 'invalid_ops';
    promptVersion?: string;
    policyVersion?: string;
    dictionaryHash?: string;
  };
};

type CopilotSession = {
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  successfulEdits: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
  source?: { url: string; fetchedAtMs: number; title?: string };
  pendingPolicy?:
    | {
        kind: 'scope';
        createdAtMs: number;
        ops: WidgetOp[];
        scopes: Array<'stage' | 'pod' | 'content'>;
      }
    | {
        kind: 'group';
        createdAtMs: number;
        ops: WidgetOp[];
        groups: Array<{ key: string; label: string }>;
      };
};

type GlobalDictionary = typeof globalDictionary;

const PROMPT_VERSION = 'sdr.widget.copilot.v1@2025-12-30';
const POLICY_VERSION = 'light_edits.v1';

function fnv1aHashHex(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const DICTIONARY_HASH = fnv1aHashHex(JSON.stringify(globalDictionary));

function baseMeta(
  intent: NonNullable<WidgetCopilotResult['meta']>['intent'],
  outcome: NonNullable<WidgetCopilotResult['meta']>['outcome'],
): NonNullable<WidgetCopilotResult['meta']> {
  return {
    intent,
    outcome,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    dictionaryHash: DICTIONARY_HASH,
  };
}

function looksLikeCloudflareErrorPage(text: string): { status?: number; reason: string } | null {
  const s = text.toLowerCase();
  if (!s) return null;

  // Common Cloudflare 5xx HTML markers.
  const hasCfWrapper = s.includes('id="cf-wrapper"') || s.includes("id='cf-wrapper'");
  const hasCfDetails = s.includes('id="cf-error-details"') || s.includes("id='cf-error-details'");
  const hasCdnCgi = s.includes('/cdn-cgi/') || s.includes('cdn-cgi/styles/main.css');
  const hasLandingLink = s.includes('cloudflare.com/5xx-error-landing');

  if (!(hasCfWrapper || hasCfDetails || hasCdnCgi || hasLandingLink)) return null;

  // Try to extract the numeric status code if present.
  const m = s.match(/error code\s*(\d{3})/);
  const code = m ? Number(m[1]) : undefined;
  return { status: Number.isFinite(code) ? code : undefined, reason: 'cloudflare_error_page' };
}


function parseJsonFromModel(raw: string): unknown {
  const trimmed = raw.trim();
  let cleaned = trimmed;

  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    lines.shift(); // ``` or ```json
    while (lines.length && lines[lines.length - 1]?.trim() === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj >= 0 && lastObj > firstObj) {
      const slice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(slice);
      } catch {
        // continue
      }
    }
    // Fail soft: if the model returned plain text, treat it as an assistant message and
    // apply no ops. This avoids surfacing transient "invalid JSON" as a 502 in the UI.
    const fallback = cleaned.trim();
    const tooLong = fallback.length > 1200;
    const text = (tooLong ? `${fallback.slice(0, 1200)}\n\n[truncated]` : fallback).trim();
    return {
      message:
        text ||
        'I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. “translate the FAQs to French”).',
      _parseFallback: true,
    };
  }
}

function isWidgetOp(value: unknown): value is WidgetOp {
  if (!isRecord(value)) return false;
  const op = asString(value.op);
  const path = asString(value.path);
  if (!op || !path) return false;
  if (op === 'set') return value.value !== undefined;
  if (op === 'insert') return typeof value.index === 'number' && value.value !== undefined;
  if (op === 'remove') return typeof value.index === 'number';
  if (op === 'move') return typeof value.from === 'number' && typeof value.to === 'number';
  return false;
}

function parseWidgetCopilotInput(input: unknown): WidgetCopilotInput {
  if (!isRecord(input)) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input', message: 'Expected an object' }] });
  const sessionId = (asString(input.sessionId) ?? '').trim();
  const prompt = (asString(input.prompt) ?? '').trim();
  const widgetType = (asString(input.widgetType) ?? '').trim();
  const currentConfig = isRecord(input.currentConfig) ? input.currentConfig : null;
  const controls = Array.isArray(input.controls) ? input.controls : null;

  const issues: Array<{ path: string; message: string }> = [];
  if (!sessionId) issues.push({ path: 'input.sessionId', message: 'Missing required value' });
  if (!prompt) issues.push({ path: 'input.prompt', message: 'Missing required value' });
  if (!widgetType) issues.push({ path: 'input.widgetType', message: 'Missing required value' });
  if (!currentConfig) issues.push({ path: 'input.currentConfig', message: 'currentConfig must be an object' });
  if (!controls) issues.push({ path: 'input.controls', message: 'controls must be an array' });
  if (issues.length) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues });

  const safeControls: ControlSummary[] = (controls as any[])
    .filter((c) => isRecord(c) && typeof c.path === 'string' && c.path.trim())
    .map((c) => ({
      path: String(c.path),
      panelId: typeof c.panelId === 'string' ? c.panelId : undefined,
      groupId: typeof c.groupId === 'string' ? c.groupId : undefined,
      groupLabel: typeof c.groupLabel === 'string' ? c.groupLabel : undefined,
      type: typeof c.type === 'string' ? c.type : undefined,
      kind: typeof c.kind === 'string' ? c.kind : undefined,
      label: typeof c.label === 'string' ? c.label : undefined,
      options:
        Array.isArray(c.options) && c.options.every((o: any) => isRecord(o) && typeof o.label === 'string' && typeof o.value === 'string')
          ? (c.options as Array<{ label: string; value: string }>)
          : undefined,
      enumValues: Array.isArray(c.enumValues) && c.enumValues.every((v: unknown) => typeof v === 'string') ? c.enumValues : undefined,
      min: typeof c.min === 'number' ? c.min : undefined,
      max: typeof c.max === 'number' ? c.max : undefined,
      itemIdPath: typeof c.itemIdPath === 'string' ? c.itemIdPath : undefined,
    }));

  return { sessionId, prompt, widgetType, currentConfig: currentConfig as Record<string, unknown>, controls: safeControls };
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function getConcept(dict: GlobalDictionary, id: string) {
  return dict.concepts.find((c) => c.id === id) ?? null;
}

function getScope(dict: GlobalDictionary, id: string) {
  return dict.scopes.find((s) => s.id === id) ?? null;
}

function inferScopeFromPath(controlPath: string): 'stage' | 'pod' | 'content' {
  if (controlPath.startsWith('stage.')) return 'stage';
  if (controlPath.startsWith('pod.')) return 'pod';
  return 'content';
}

function looksLikeExplainIntent(prompt: string): boolean {
  const s = (prompt || '').trim().toLowerCase();
  if (!s) return false;

  const hasEditVerb =
    /\b(change|make|set|update|adjust|edit|add|remove|delete|rewrite|rephrase|translate|localize|style|apply)\b/i.test(s);
  if (hasEditVerb) return false;

  if (s.includes('?')) return true;

  if (/^(what|why|how|when|where|which|who)\b/i.test(s)) return true;
  if (/^(can|could|should|would|do|does|is|are|will)\b/i.test(s)) return true;
  if (/\b(help|explain|meaning|what does)\b/i.test(s)) return true;

  return false;
}

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bestControlMatch(prompt: string, controls: ControlSummary[]): ControlSummary | null {
  const p = normalizeToken(prompt);
  if (!p) return null;
  const pTokens = new Set(p.split(' ').filter(Boolean));
  if (pTokens.size === 0) return null;

  let best: { score: number; control: ControlSummary } | null = null;
  for (const c of controls) {
    const label = typeof c.label === 'string' ? c.label : '';
    const path = typeof c.path === 'string' ? c.path : '';
    const groupLabel = typeof c.groupLabel === 'string' ? c.groupLabel : '';
    const hay = normalizeToken([label, path, groupLabel].filter(Boolean).join(' '));
    if (!hay) continue;
    const hTokens = hay.split(' ').filter(Boolean);
    if (hTokens.length === 0) continue;

    let score = 0;
    for (const t of hTokens) {
      if (pTokens.has(t)) score += 1;
    }
    if (label && p.includes(normalizeToken(label))) score += 3;
    if (path && p.includes(normalizeToken(path))) score += 2;
    if (score <= 0) continue;

    if (!best || score > best.score) best = { score, control: c };
  }

  if (!best || best.score < 2) return null;
  return best.control;
}

function explainMessage(input: WidgetCopilotInput): string {
  const s = normalizeToken(input.prompt);

  if (/\b(what can you do|what can i do|how do i use|how does this work)\b/i.test(input.prompt)) {
    return (
      'I can help you customize this widget by changing the settings that are available in the editable controls. ' +
      'Ask for one small change at a time (title, colors, layout, fonts, or content like questions/answers).'
    );
  }

  if (s.includes('accordion')) {
    return (
      'An accordion shows each FAQ as a collapsible item. Usually you click a question to expand its answer. ' +
      'If you enable multi-open, multiple answers can stay expanded at the same time.'
    );
  }

  if (/\bmulti[-\s]*open\b/i.test(input.prompt) || s.includes('multi open') || s.includes('multiopen')) {
    return '“Multi-open” controls whether multiple FAQ items can be expanded at once (instead of only one at a time).';
  }

  if (/\bexpand[-\s]*all\b/i.test(input.prompt) || s.includes('expand all') || s.includes('expandall')) {
    return '“Expand all” controls whether all FAQ items start expanded (all answers visible).';
  }

  if (/\bexpand[-\s]*first\b/i.test(input.prompt) || s.includes('expand first') || s.includes('expandfirst')) {
    return '“Expand first” controls whether the first FAQ item starts expanded when the widget loads.';
  }

  const matched = bestControlMatch(input.prompt, input.controls);
  if (matched) {
    const label = matched.label?.trim() || matched.path;
    const where = matched.groupLabel?.trim() || matched.panelId || 'the editor';
    const kind = matched.kind ? ` (${matched.kind})` : '';
    if (matched.kind === 'enum' && Array.isArray(matched.enumValues) && matched.enumValues.length > 0) {
      const values = matched.enumValues.slice(0, 12).join(', ');
      return `“${label}”${kind} is an editable setting in ${where}. Allowed values include: ${values}. Tell me what you want it set to and I’ll change it.`;
    }
    if (matched.kind === 'boolean') {
      return `“${label}”${kind} is a toggle in ${where}. Tell me if you want it on or off and I’ll update it.`;
    }
    return `“${label}”${kind} is an editable setting in ${where}. Tell me what you want and I’ll change it.`;
  }

  return (
    "I can explain specific settings if you mention them by name (like “multi-open”, “expand all”, or “show title”). " +
    'Or tell me what you want to change and I’ll apply it.'
  );
}

function bestControlForPath(path: string, controls: ControlSummary[]): ControlSummary | null {
  const target = (path || '').trim();
  if (!target) return null;

  let best: { len: number; control: ControlSummary } | null = null;

  for (const c of controls) {
    const cp = typeof c.path === 'string' ? c.path.trim() : '';
    if (!cp) continue;
    if (cp === target) return c;
    if (target.startsWith(cp + '.')) {
      const len = cp.length;
      if (!best || len > best.len) best = { len, control: c };
      continue;
    }
    if (cp.startsWith(target + '.')) {
      const len = target.length;
      if (!best || len > best.len) best = { len, control: c };
    }
  }

  return best?.control ?? null;
}

function groupForPath(path: string, controls: ControlSummary[]): { key: string; label: string } | null {
  const control = bestControlForPath(path, controls);
  if (!control) return null;
  const key = (control.groupId || control.groupLabel || control.panelId || '').trim();
  if (!key) return null;
  const label = (control.groupLabel || control.panelId || key).trim();
  return { key, label };
}

function pathLooksSensitive(path: string): boolean {
  return /\b(url|href|domain|script|html|embed)\b/i.test(path);
}

type LightEditsDecision =
  | { ok: true }
  | {
      ok: false;
      message: string;
      pendingPolicy?: CopilotSession['pendingPolicy'];
    };

type OpsValidationIssue = { opIndex: number; path: string; message: string };

type OpsValidationResult = { ok: true } | { ok: false; issues: OpsValidationIssue[] };

function isNumericString(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function validateOpsAgainstControls(args: { ops: WidgetOp[]; controls: ControlSummary[] }): OpsValidationResult {
  const issues: OpsValidationIssue[] = [];

  for (let opIndex = 0; opIndex < args.ops.length; opIndex += 1) {
    const op = args.ops[opIndex]!;
    const path = op.path;
    const control = bestControlForPath(path, args.controls);
    if (!control) {
      issues.push({ opIndex, path, message: 'Unknown path (not in editable controls)' });
      continue;
    }
    if (!control.kind) {
      issues.push({ opIndex, path, message: 'Control kind is unknown' });
      continue;
    }

    if (op.op === 'insert' || op.op === 'remove' || op.op === 'move') {
      if (control.kind !== 'array') {
        issues.push({ opIndex, path, message: 'Target must be an array control' });
        continue;
      }
      if (op.op === 'insert' && control.itemIdPath) {
        const item = op.value as any;
        const id = item && typeof item === 'object' && !Array.isArray(item) ? item[control.itemIdPath] : null;
        if (typeof id !== 'string' || !id.trim()) {
          issues.push({ opIndex, path, message: `Inserted item must include a non-empty "${control.itemIdPath}"` });
        }
      }
      continue;
    }

    // set op
    if (op.op === 'set') {
      if (control.kind === 'enum' && Array.isArray(control.enumValues) && control.enumValues.length > 0) {
        if (typeof op.value !== 'string' || !control.enumValues.includes(op.value)) {
          issues.push({ opIndex, path, message: 'Value must be one of the allowed enum values' });
        }
        continue;
      }

      if (control.kind === 'number' || typeof control.min === 'number' || typeof control.max === 'number') {
        let n: number | null = null;
        if (typeof op.value === 'number' && Number.isFinite(op.value)) n = op.value;
        if (typeof op.value === 'string' && isNumericString(op.value)) n = Number(op.value);
        if (n == null || !Number.isFinite(n)) {
          issues.push({ opIndex, path, message: 'Value must be a number' });
          continue;
        }
        if (typeof control.min === 'number' && n < control.min) {
          issues.push({ opIndex, path, message: `Value must be >= ${control.min}` });
        }
        if (typeof control.max === 'number' && n > control.max) {
          issues.push({ opIndex, path, message: `Value must be <= ${control.max}` });
        }
        continue;
      }

      if (control.kind === 'boolean') {
        const ok =
          typeof op.value === 'boolean' ||
          (typeof op.value === 'string' && (op.value.toLowerCase() === 'true' || op.value.toLowerCase() === 'false'));
        if (!ok) issues.push({ opIndex, path, message: 'Value must be true or false' });
        continue;
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

function evaluateLightEditsPolicy(args: { ops: WidgetOp[]; controls: ControlSummary[] }): LightEditsDecision {
  const maxOps = 6;
  const maxUniquePathsTouched = 4;
  const maxScopesTouched = 1;
  const maxGroupsTouched = 1;

  const opsCount = args.ops.length;
  const uniquePaths = new Set(args.ops.map((o) => o.path));
  const scopes = new Set(args.ops.map((o) => inferScopeFromPath(o.path)));
  const groups = new Map<string, { key: string; label: string }>();
  for (const op of args.ops) {
    const g = groupForPath(op.path, args.controls);
    if (g) groups.set(g.key, g);
  }

  const hasSensitive = args.ops.some((o) => pathLooksSensitive(o.path));

  if (opsCount > maxOps) {
    return {
      ok: false,
      message: `That’s a lot to change at once (${opsCount} edits). Please ask for one smaller change (e.g. “change the title” or “make the pod background white”).`,
    };
  }

  if (uniquePaths.size > maxUniquePathsTouched) {
    return {
      ok: false,
      message: `That would touch many settings at once (${uniquePaths.size} paths). Please ask for one smaller change first.`,
    };
  }

  if (scopes.size > maxScopesTouched) {
    const scopeList = Array.from(scopes);
    const labels = scopeList.map((s) => s).join(' + ');
    const picks = scopeList.filter((s) => s === 'stage' || s === 'pod' || s === 'content');
    const pickText = picks.join(' or ');
    const tokenText = picks.join(' | ');
    const msg =
      `That would change multiple areas (${labels}). Which should I change first: ${pickText}?` +
      `\nReply with: ${tokenText}` +
      `\nTo apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: { kind: 'scope', createdAtMs: Date.now(), ops: args.ops, scopes: scopeList },
    };
  }

  if (groups.size > maxGroupsTouched) {
    const groupList = Array.from(groups.values()).slice(0, 6);
    const lines = groupList.map((g, idx) => `${idx + 1}) ${g.label}`).join('\n');
    const msg =
      `That would change multiple panels. Which panel should I start with?\n` +
      `${lines}\n` +
      `Reply with the number (1-${groupList.length}).\n` +
      `To apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: { kind: 'group', createdAtMs: Date.now(), ops: args.ops, groups: groupList },
    };
  }

  if (hasSensitive) {
    return {
      ok: false,
      message:
        'That change would modify a sensitive setting (URL/embed/script). Please confirm by replying exactly: apply across widget',
      pendingPolicy: { kind: 'scope', createdAtMs: Date.now(), ops: args.ops, scopes: Array.from(scopes) },
    };
  }

  return { ok: true };
}

function extractExactToken(prompt: string): string {
  return (prompt || '').trim().toLowerCase();
}

function selectScopeFromPrompt(prompt: string, scopes: Array<'stage' | 'pod' | 'content'>): 'stage' | 'pod' | 'content' | null {
  const token = extractExactToken(prompt);
  if (!token) return null;
  if (token === 'stage' && scopes.includes('stage')) return 'stage';
  if (token === 'pod' && scopes.includes('pod')) return 'pod';
  if (token === 'content' && scopes.includes('content')) return 'content';

  const lower = token;
  const hasStage = lower.includes('stage');
  const hasPod = lower.includes('pod');
  const hasContent = lower.includes('content');
  const count = Number(hasStage) + Number(hasPod) + Number(hasContent);
  if (count !== 1) return null;
  if (hasStage && scopes.includes('stage')) return 'stage';
  if (hasPod && scopes.includes('pod')) return 'pod';
  if (hasContent && scopes.includes('content')) return 'content';
  return null;
}

function filterOpsByScope(ops: WidgetOp[], scope: 'stage' | 'pod' | 'content'): WidgetOp[] {
  return ops.filter((o) => inferScopeFromPath(o.path) === scope);
}

function selectGroupFromPrompt(prompt: string, groups: Array<{ key: string; label: string }>): { key: string; label: string } | null {
  const token = extractExactToken(prompt);
  if (!token) return null;
  const n = Number(token);
  if (Number.isFinite(n) && Number.isInteger(n)) {
    const idx = n - 1;
    if (idx >= 0 && idx < groups.length) return groups[idx] ?? null;
  }
  const normalized = normalizeToken(prompt);
  for (const g of groups) {
    if (normalizeToken(g.label) === normalized) return g;
  }
  return null;
}

function filterOpsByGroup(ops: WidgetOp[], groupKey: string, controls: ControlSummary[]): WidgetOp[] {
  return ops.filter((o) => groupForPath(o.path, controls)?.key === groupKey);
}

function maybeClarify(dict: GlobalDictionary, input: WidgetCopilotInput): string | null {
  const prompt = input.prompt;

  // If user says "based on my website" but doesn't include a URL, don't guess or pivot to styling.
  // Ask for a single page URL (we only fetch one page, no crawling).
  if (/\b(based on|from)\b[\s\S]{0,40}\b(my )?website\b/i.test(prompt)) {
    const hasUrl = extractUrlCandidates(prompt).length > 0;
    if (!hasUrl) {
      return 'Paste a URL to a single page that contains the content you want to base the FAQs on (for example: https://example.com/faq).';
    }
  }

  // "Rewrite the questions" is ambiguous:
  // - rewrite existing Q/A text already present in currentConfig
  // - generate new FAQs based on the user's website/source page
  // Ask one tight clarification to avoid guessing or falling back to unrelated styling changes.
  if (/\b(rewrite|rephrase|modernize|refresh)\b/i.test(prompt) && /\b(faq|question|questions|answer|answers)\b/i.test(prompt)) {
    const sections = (input.currentConfig as any)?.sections;
    const hasExistingFaqs =
      Array.isArray(sections) &&
      sections.some((s) => Array.isArray((s as any)?.faqs) && (s as any).faqs.some((f: any) => typeof f?.question === 'string'));

    if (hasExistingFaqs) {
      return (
        'Do you want me to rewrite the existing FAQ questions/answers that are already in this widget (keeping the same meaning), ' +
        'or generate new FAQs based on your website?\n' +
        'Reply “rewrite existing” to update what’s already here, or paste a URL if you want new FAQs.'
      );
    }
  }

  // Overbroad requests tend to produce brittle edits (and are hard to map to controls deterministically).
  // Ask the user to pick a starting area.
  if (/\b(adjust|change|update|make)\b[\s\S]{0,30}\b(everything|all of it|the whole thing|all settings)\b/i.test(prompt)) {
    return (
      'That’s a broad request. What should I start with?\n' +
      '- Content (FAQ questions/answers)\n' +
      '- Styling (colors/fonts/layout)\n' +
      '\n' +
      'Reply “content” or “styling” and I’ll do that first.'
    );
  }

  const backgroundConcept = getConcept(dict, 'background');
  if (backgroundConcept && containsAny(prompt, backgroundConcept.synonyms)) {
    const hasStageBackground = input.controls.some((c) => inferScopeFromPath(c.path) === 'stage' && c.path.includes('background'));
    const hasPodBackground = input.controls.some((c) => inferScopeFromPath(c.path) === 'pod' && c.path.includes('background'));
    if (hasStageBackground && hasPodBackground) {
      const q =
        dict.clarifications.find((c) => c.conceptId === 'background')?.question ??
        'Do you mean the stage background or the widget container background?';
      return q;
    }
  }

  const languageConcept = getConcept(dict, 'language');
  if (languageConcept && containsAny(prompt, languageConcept.synonyms)) {
    return (
      dict.clarifications.find((c) => c.conceptId === 'language')?.question ??
      'When you ask for a language change, should I translate just the widget content (text), or also adjust styling for that audience?'
    );
  }

  const fontConcept = getConcept(dict, 'font');
  if (fontConcept && containsAny(prompt, fontConcept.synonyms)) {
    const q = dict.clarifications.find((c) => c.conceptId === 'font')?.question ?? 'Which text should I change: everything, the title, questions, or answers?';
    return q;
  }

  return null;
}

async function getSession(env: Env, sessionId: string): Promise<CopilotSession> {
  const key = `sdrw:session:${sessionId}`;
  const existing = await env.SF_KV.get(key, 'json');
  if (!existing) {
    const now = Date.now();
    return { sessionId, createdAtMs: now, lastActiveAtMs: now, successfulEdits: 0, turns: [] };
  }
  if (!isRecord(existing)) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  const turns = Array.isArray(existing.turns) ? existing.turns : null;
  if (!turns) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: 'Session store is corrupted' });
  return existing as CopilotSession;
}

async function putSession(env: Env, session: CopilotSession): Promise<void> {
  const key = `sdrw:session:${session.sessionId}`;
  await env.SF_KV.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 });
}

function systemPrompt(): string {
  const stage = getScope(globalDictionary, 'stage');
  const pod = getScope(globalDictionary, 'pod');
  const content = getScope(globalDictionary, 'content');
  const modern = globalDictionary.intents.find((i) => i.id === 'modern');
  const classic = globalDictionary.intents.find((i) => i.id === 'classic');
  const playful = globalDictionary.intents.find((i) => i.id === 'playful');

  return [
    "You help users customize widgets in Clickeen's playground (Minibob).",
    '',
    'INPUT: user request + current widget config + available editable controls',
    'OUTPUT: JSON with ops array + friendly message + optional conversion CTA',
    '',
    'If SOURCE_PAGE_TEXT is present, it is extracted from exactly one public web page (no crawling). Use it only to inform content edits (e.g., FAQ questions/answers).',
    '',
    'RULES:',
    '1) Generate valid ops that target available control paths only.',
    '2) Respect control constraints:',
    '   - If a control kind is "enum": value MUST be one of enumValues.',
    '   - If min/max exist: keep numeric values within range.',
    '   - If user asks for something not possible, ask a short clarifying question instead of guessing.',
    '3) Keep changes minimal — one thing at a time.',
    '4) If the user asks a question or requests an explanation, return NO ops and answer briefly.',
    '5) Message should confirm what changed (1–2 sentences).',
    '6) If user asks for a paid feature, explain kindly and suggest signup/upgrade.',
    '',
    'GLOBAL VOCABULARY (applies to all widgets):',
    `- Scopes:`,
    `  - stage: ${stage?.description ?? 'background behind the widget'}`,
    `  - pod: ${pod?.description ?? 'widget container'}`,
    `  - content: ${content?.description ?? 'inside the widget'}`,
    `- If user says "background" and both stage + pod backgrounds exist, ask which scope they mean.`,
    `- If user says "font(s)" without specifying a target, default to changing all available typography roles (title, section titles, questions, answers).`,
    `- If user asks to rewrite FAQ questions/answers, rewrite the existing questions/answers in currentConfig (do NOT require a URL unless user explicitly asks to base it on their website).`,
    `- If user asks for a "modern/classic/playful font", pick from enumValues using these candidates:`,
    `  - modern: ${(modern?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    `  - classic: ${(classic?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    `  - playful: ${(playful?.fontCandidates ?? []).slice(0, 12).join(', ')}`,
    '',
    'Output MUST be JSON, with this shape:',
    '{ "ops"?: WidgetOp[], "message": string, "cta"?: { "text": string, "action": "signup"|"upgrade"|"learn-more", "url"?: string } }',
    '',
    'Examples (copy this style exactly):',
    '{"message":"Which should I change: the stage background or the widget container background?"}',
    '{"message":"Translated the FAQ content to French.","ops":[{"op":"set","path":"title","value":"Questions fréquentes"}]}',
    '',
    'WidgetOp:',
    '{ op:"set", path:string, value:any } | { op:"insert", path:string, index:number, value:any } | { op:"remove", path:string, index:number } | { op:"move", path:string, from:number, to:number }',
    '',
    'Do NOT wrap JSON in markdown fences.',
    'Do NOT include any surrounding text.',
  ].join('\n');
}

export async function executeSdrWidgetCopilot(params: { grant: AIGrant; input: unknown }, env: Env): Promise<{ result: WidgetCopilotResult; usage: Usage }> {
  const input = parseWidgetCopilotInput(params.input);
  const session = await getSession(env, input.sessionId);

  const cfError = looksLikeCloudflareErrorPage(input.prompt);
  if (cfError) {
    session.lastActiveAtMs = Date.now();
    const msg =
      'That looks like a Cloudflare error page' +
      (cfError.status ? ` (HTTP ${cfError.status})` : '') +
      ". I can't use it to update FAQs because it doesn't contain your site's content. " +
      'Please share a working URL (that loads the real page) or paste the page text you want me to base the FAQs on.';

    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: msg, meta: baseMeta('clarify', 'no_ops') },
      usage: { provider: 'local', model: 'cloudflare_error_detector', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  if (session.pendingPolicy) {
    const pending = session.pendingPolicy;
    const token = extractExactToken(input.prompt);

    if (token === 'apply across widget') {
      const ops = pending.ops;
      session.pendingPolicy = undefined;
      session.lastActiveAtMs = Date.now();
      const msg = 'Ok — applying across the whole widget.';
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: input.prompt },
        { role: 'assistant' as const, content: msg },
      ].slice(-10) as CopilotSession['turns'];
      await putSession(env, session);
      return {
        result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
        usage: { provider: 'local', model: 'policy_confirm_all', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
      };
    }

    if (pending.kind === 'scope') {
      const chosen = selectScopeFromPrompt(input.prompt, pending.scopes);
      if (chosen) {
        const ops = filterOpsByScope(pending.ops, chosen);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to ${chosen} only.`;
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
          usage: { provider: 'local', model: 'policy_scope_pick', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }
    }

    if (pending.kind === 'group') {
      const chosen = selectGroupFromPrompt(input.prompt, pending.groups);
      if (chosen) {
        const ops = filterOpsByGroup(pending.ops, chosen.key, input.controls);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to “${chosen.label}” only.`;
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);
        return {
          result: { message: msg, ops, meta: baseMeta('edit', 'ops_applied') },
          usage: { provider: 'local', model: 'policy_group_pick', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }
    }

    // If the user didn't answer with an accepted token, drop the pending policy and treat this as a new request.
    session.pendingPolicy = undefined;
  }

  if (looksLikeExplainIntent(input.prompt)) {
    session.lastActiveAtMs = Date.now();
    const msg = explainMessage(input);

    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: msg },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: msg, meta: baseMeta('explain', 'no_ops') },
      usage: { provider: 'local', model: 'router_v1', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const clarification = maybeClarify(globalDictionary, input);
  if (clarification) {
    session.lastActiveAtMs = Date.now();
    session.turns = [
      ...session.turns,
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: clarification },
    ].slice(-10) as CopilotSession['turns'];
    await putSession(env, session);

    return {
      result: { message: clarification, meta: baseMeta('clarify', 'no_ops') },
      usage: { provider: 'local', model: 'global_dictionary', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
    };
  }

  const maxTokens = getGrantMaxTokens(params.grant);
  const timeoutMs = getGrantTimeoutMs(params.grant);

  let sourcePage:
    | { url: string; title?: string; text: string; truncated: boolean; status: number; contentType: string }
    | null = null;
  {
    const candidates = extractUrlCandidates(input.prompt)
      .map(normalizeUrl)
      .filter((u): u is URL => Boolean(u));

    const unique = Array.from(new Map(candidates.map((u) => [u.toString(), u])).values());
    if (unique.length > 1) {
      const msg = `I found multiple URLs in your message. Which single page should I use?\n\n- ${unique.map((u) => u.toString()).join('\n- ')}`;
      session.lastActiveAtMs = Date.now();
      session.turns = [
        ...session.turns,
        { role: 'user' as const, content: input.prompt },
        { role: 'assistant' as const, content: msg },
      ].slice(-10) as CopilotSession['turns'];
      await putSession(env, session);

      return {
        result: { message: msg, meta: baseMeta('clarify', 'no_ops') },
        usage: { provider: 'local', model: 'url_parser', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
      };
    }

    const url = unique[0] ?? null;
    if (url) {
      const blocked = isBlockedFetchUrl(url);
      if (blocked) {
        const msg = `I can only read public web pages. That URL is not allowed (${blocked}). Please share a normal public https URL.`;
        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops') },
          usage: { provider: 'local', model: 'url_guard', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }

      const fetchRes = await fetchSinglePageText({ url, timeoutMs: Math.min(12_000, Math.max(1_500, timeoutMs - 1_000)) });
      if (!fetchRes.ok) {
        const msg =
          `I tried to read ${url.toString()} but couldn't: ${fetchRes.message}` +
          (fetchRes.status ? ` (HTTP ${fetchRes.status})` : '') +
          ' Please share a working URL or paste the page text.';

        session.lastActiveAtMs = Date.now();
        session.turns = [
          ...session.turns,
          { role: 'user' as const, content: input.prompt },
          { role: 'assistant' as const, content: msg },
        ].slice(-10) as CopilotSession['turns'];
        await putSession(env, session);

        return {
          result: { message: msg, meta: baseMeta('clarify', 'no_ops') },
          usage: { provider: 'local', model: 'single_page_fetch', promptTokens: 0, completionTokens: 0, latencyMs: 0 },
        };
      }

      const excerptLimit = 10_000;
      const excerpt = fetchRes.text.length > excerptLimit ? `${fetchRes.text.slice(0, excerptLimit)}\n\n[truncated]` : fetchRes.text;

      sourcePage = {
        url: fetchRes.finalUrl,
        title: fetchRes.title,
        text: excerpt,
        truncated: fetchRes.truncated || fetchRes.text.length > excerptLimit,
        status: fetchRes.status,
        contentType: fetchRes.contentType,
      };

      session.source = { url: fetchRes.finalUrl, fetchedAtMs: Date.now(), ...(fetchRes.title ? { title: fetchRes.title } : {}) };
    }
  }

  const maxRequests = typeof params.grant.budgets?.maxRequests === 'number' ? params.grant.budgets.maxRequests : 1;

  const user = [
    `Widget type: ${input.widgetType}`,
    '',
    `User request: ${input.prompt}`,
    ...(sourcePage
      ? [
          '',
          `SOURCE_PAGE_URL: ${sourcePage.url}`,
          ...(sourcePage.title ? [`SOURCE_PAGE_TITLE: ${sourcePage.title}`] : []),
          'SOURCE_PAGE_TEXT:',
          sourcePage.text,
        ]
      : []),
    '',
    'Editable controls (path → kind, label, constraints):',
    input.controls
      .slice(0, 180)
      .map((c) => {
        const parts: string[] = [];
        parts.push(`- ${c.path}`);
        if (c.kind) parts.push(`(${c.kind})`);
        if (c.label) parts.push(`— ${c.label}`);
        if (c.panelId) parts.push(`[panel:${c.panelId}]`);
        if (c.groupLabel) parts.push(`[group:${c.groupLabel}]`);

        if (c.kind === 'enum' && Array.isArray(c.enumValues) && c.enumValues.length) {
          const values = c.enumValues.slice(0, 24);
          parts.push(`[allowed:${values.join(', ')}${c.enumValues.length > values.length ? ', …' : ''}]`);
        }

        if (typeof c.min === 'number' || typeof c.max === 'number') {
          parts.push(`[range:${typeof c.min === 'number' ? c.min : '-∞'}..${typeof c.max === 'number' ? c.max : '∞'}]`);
        }
        return parts.join(' ');
      })
      .join('\n'),
    '',
    'Current config (JSON):',
    JSON.stringify(input.currentConfig),
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt() },
    ...session.turns,
    { role: 'user', content: user },
  ];

  const overallStartedAt = Date.now();
  const first = await callChatCompletion({
    env,
    grant: params.grant,
    agentId: 'cs.copilot.v1',
    messages,
    temperature: 0.2,
    maxTokens,
    timeoutMs,
  });

  let content = first.content;
  let lastUsage = first.usage;
  let promptTokens = lastUsage.promptTokens;
  let completionTokens = lastUsage.completionTokens;

  let parsed = parseJsonFromModel(content);
  if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output must be an object' });

  let message = (asString(parsed.message) ?? '').trim();
  if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output missing message' });

  let opsRaw = parsed.ops;
  let ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;

  const parseFallback = Boolean((parsed as any)?._parseFallback === true);
  const preValidation = ops && ops.length ? validateOpsAgainstControls({ ops, controls: input.controls }) : ({ ok: true } as const);

  const elapsedMs = Date.now() - overallStartedAt;
  const remainingTimeoutMs = timeoutMs - elapsedMs;
  const canRepair = maxRequests >= 2 && remainingTimeoutMs >= 4_000;

  if (canRepair && (parseFallback || (!preValidation.ok))) {
    let issueText = 'The previous response was invalid.';
    if (parseFallback) {
      issueText = 'Your previous response was not valid JSON.';
    } else if (!preValidation.ok) {
      issueText = `Validation errors:\n${preValidation.issues
        .slice(0, 6)
        .map((i) => `- ${i.path}: ${i.message}`)
        .join('\n')}`;
    }

    const previous = content.length > 2200 ? `${content.slice(0, 2200)}\n\n[truncated]` : content;
    const repairSystem =
      systemPrompt() +
      '\n\nREPAIR MODE:\n- Return ONLY a JSON object (no markdown, no extra text).\n- Fix the schema/validation errors.\n- If you cannot produce valid ops, return message-only (no ops) and ask one short clarifying question.';
    const repairUser = [
      user,
      '',
      'Your previous response was invalid. Please repair it.',
      issueText,
      '',
      'Previous response:',
      previous,
      '',
      'Return corrected JSON only.',
    ].join('\n');

    const repairTimeoutMs = Math.min(4_000, Math.max(1_000, remainingTimeoutMs - 500));
    const repairMaxTokens = Math.min(160, maxTokens);

    const repaired = await callChatCompletion({
      env,
      grant: params.grant,
      agentId: 'cs.copilot.v1',
      messages: [
        { role: 'system', content: repairSystem },
        { role: 'user', content: repairUser },
      ],
      temperature: 0,
      maxTokens: repairMaxTokens,
      timeoutMs: repairTimeoutMs,
    });

    lastUsage = repaired.usage;
    promptTokens += repaired.usage.promptTokens;
    completionTokens += repaired.usage.completionTokens;
    content = repaired.content;

    parsed = parseJsonFromModel(content);
    if (!isRecord(parsed)) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output must be an object' });
    message = (asString(parsed.message) ?? '').trim();
    if (!message) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: lastUsage.provider, message: 'Model output missing message' });
    opsRaw = parsed.ops;
    ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;
  }

  const latencyMs = Date.now() - overallStartedAt;

  const ctaRaw = parsed.cta;
  let cta: WidgetCopilotResult['cta'];
  if (isRecord(ctaRaw)) {
    const text = (asString(ctaRaw.text) ?? '').trim();
    const action = (asString(ctaRaw.action) ?? '').trim();
    const url = (asString(ctaRaw.url) ?? '').trim();
    if (text && (action === 'signup' || action === 'upgrade' || action === 'learn-more')) {
      cta = { text, action, ...(url ? { url } : {}) };
    }
  }

  let finalMessage = message;
  let finalOps = ops && ops.length ? ops : undefined;
  let finalCta: WidgetCopilotResult['cta'] | undefined = cta;
  let finalMeta: WidgetCopilotResult['meta'] = baseMeta(finalOps ? 'edit' : 'clarify', finalOps ? 'ops_applied' : 'no_ops');

  if (finalOps && finalOps.length) {
    const validated = validateOpsAgainstControls({ ops: finalOps, controls: input.controls });
    if (!validated.ok) {
      const details = validated.issues
        .slice(0, 3)
        .map((i) => `- ${i.path}: ${i.message}`)
        .join('\n');
      finalMessage =
        'I tried to apply an edit, but it didn’t match the widget’s editable controls. ' +
        'Please try again and mention the setting you want to change (e.g. “stage background”, “FAQ title”, “accordion multi-open”).' +
        (details ? `\n\nDetails:\n${details}` : '');
      finalOps = undefined;
      finalCta = undefined;
      finalMeta = baseMeta('clarify', 'invalid_ops');
      session.pendingPolicy = undefined;
    } else {
      const policy = evaluateLightEditsPolicy({ ops: finalOps, controls: input.controls });
      if (!policy.ok) {
        finalMessage = policy.message;
        finalOps = undefined;
        finalCta = undefined;
        finalMeta = baseMeta('clarify', 'no_ops');
        session.pendingPolicy = policy.pendingPolicy;
      } else {
        session.pendingPolicy = undefined;
      }
    }
  } else {
    session.pendingPolicy = undefined;
  }

  const hasEdit = Boolean(finalOps && finalOps.length > 0);
  session.lastActiveAtMs = Date.now();
  session.successfulEdits = hasEdit ? session.successfulEdits + 1 : session.successfulEdits;
  session.turns = [
    ...session.turns,
    { role: 'user' as const, content: input.prompt },
    { role: 'assistant' as const, content: finalMessage },
  ].slice(-10) as CopilotSession['turns'];
  await putSession(env, session);

  const result: WidgetCopilotResult = {
    message: finalMessage,
    ...(finalOps && finalOps.length ? { ops: finalOps } : {}),
    ...(finalCta ? { cta: finalCta } : {}),
    meta: finalMeta,
  };

  const usage: Usage = {
    provider: lastUsage.provider,
    model: lastUsage.model,
    promptTokens,
    completionTokens,
    latencyMs,
  };

  return { result, usage };
}
