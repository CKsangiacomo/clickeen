import { WIDGET_COPILOT_PROMPT_PROFILES } from './widgetCopilotPromptProfiles';

type ControlSummaryLite = { path: string };
type WidgetCopilotInputLite = {
  prompt: string;
  controls: ControlSummaryLite[];
};
type CsSessionLike = {
  lastActiveAtMs: number;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
};
type WidgetOpLite =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };

export function looksLikeExplainIntent(prompt: string): boolean {
  return /\b(explain|what can you (do|change)|what are you able to change|what can i ask|how does this work)\b/i.test(prompt);
}

export function pathLooksLinkLike(path: string): boolean {
  return /\b(url|href|link|domain)\b/i.test(path);
}

export function promptAsksForLinkChange(prompt: string): boolean {
  return /\b(url|href|link|website|domain|open in new tab|new tab|target)\b/i.test(prompt || '');
}

export function messageAsksForInternalControlDump(message: string): boolean {
  const text = String(message || '').toLowerCase();
  if (!text.trim()) return false;
  return (
    /\beditable controls\b/.test(text) ||
    /\bcontrols list\b/.test(text) ||
    /\bcontrols?\s+snippet\b/.test(text) ||
    /\bconfig\s+snippet\b/.test(text) ||
    /\bshare the remaining\b/.test(text) ||
    (/\bnot included\b/.test(text) && /\bcontrols?\b/.test(text)) ||
    (/\bprovide\b/.test(text) && /\bcontrols?\b/.test(text))
  );
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function inferScopeFromPath(controlPath: string): 'stage' | 'pod' | 'content' {
  if (controlPath.startsWith('stage.')) return 'stage';
  if (controlPath.startsWith('pod.')) return 'pod';
  return 'content';
}

export function maybeClarifyCs(args: {
  dict: {
    concepts: Array<{ id: string; synonyms: string[] }>;
    clarifications: Array<{ conceptId: string; question: string }>;
  };
  input: WidgetCopilotInputLite;
}): string | null {
  const prompt = args.input.prompt;

  if (/\b(adjust|change|update|make)\b[\s\S]{0,30}\b(everything|all of it|the whole thing|all settings)\b/i.test(prompt)) {
    return (
      'That’s a broad request. What should I start with?\n' +
      '- Content\n' +
      '- Styling\n' +
      '\n' +
      'Reply “content” or “styling” and I’ll do that first.'
    );
  }

  const backgroundConcept = args.dict.concepts.find((concept) => concept.id === 'background') ?? null;
  if (backgroundConcept && containsAny(prompt, backgroundConcept.synonyms)) {
    const hasStageBackground = args.input.controls.some((c) => inferScopeFromPath(c.path) === 'stage' && c.path.includes('background'));
    const hasPodBackground = args.input.controls.some((c) => inferScopeFromPath(c.path) === 'pod' && c.path.includes('background'));
    if (hasStageBackground && hasPodBackground) {
      return (
        args.dict.clarifications.find((entry) => entry.conceptId === 'background')?.question ??
        'Do you mean the stage background or the widget container background?'
      );
    }
  }

  const fontConcept = args.dict.concepts.find((concept) => concept.id === 'font') ?? null;
  if (fontConcept && containsAny(prompt, fontConcept.synonyms)) {
    return (
      args.dict.clarifications.find((entry) => entry.conceptId === 'font')?.question ??
      'Which text should I change: everything, the title, questions, or answers?'
    );
  }

  return null;
}

export function resolveCsPrelude(args: {
  conversationLanguage: string;
  session: CsSessionLike;
  input: WidgetCopilotInputLite;
  explainMessage: () => string;
  dict: {
    concepts: Array<{ id: string; synonyms: string[] }>;
    clarifications: Array<{ conceptId: string; question: string }>;
  };
}): { message: string; usageModel: string; intent: 'explain' | 'clarify' } | null {
  if (args.conversationLanguage === 'en' && looksLikeExplainIntent(args.input.prompt)) {
    const message = args.explainMessage();
    args.session.lastActiveAtMs = Date.now();
    args.session.turns = [
      ...args.session.turns,
      { role: 'user' as const, content: args.input.prompt },
      { role: 'assistant' as const, content: message },
    ].slice(-10);
    return { message, usageModel: 'cs_router', intent: 'explain' };
  }

  const clarification = maybeClarifyCs({ dict: args.dict, input: args.input });
  if (!clarification) return null;
  args.session.lastActiveAtMs = Date.now();
  args.session.turns = [
    ...args.session.turns,
    { role: 'user' as const, content: args.input.prompt },
    { role: 'assistant' as const, content: clarification },
  ].slice(-10);
  return { message: clarification, usageModel: 'cs_clarifier', intent: 'clarify' };
}

export function finalizeCsOps(args: {
  prompt: string;
  forbidInternalControlDumpPromptLine?: boolean;
  message: string;
  ops: WidgetOpLite[] | undefined;
}): { message: string; ops: WidgetOpLite[] | undefined; overrideToClarify: boolean } {
  let message = args.message;
  let ops = args.ops && args.ops.length ? args.ops : undefined;
  let overrideToClarify = false;

  if (ops && !promptAsksForLinkChange(args.prompt)) {
    ops = ops.filter((op) => !pathLooksLinkLike(op.path));
  }

  if (args.forbidInternalControlDumpPromptLine && !ops && messageAsksForInternalControlDump(message)) {
    message =
      'I can apply this directly without any control dump. ' +
      'Choose a tone for the rewrite (professional, friendly, or conversion-focused), and I will update all FAQ questions/answers plus title, subtitle, CTA, and section headings in one pass.';
    overrideToClarify = true;
  }

  return { message, ops, overrideToClarify };
}

export function buildCsSystemPrompt(args: {
  language: string;
  forbidInternalControlDumpPromptLine?: boolean;
}): string {
  const profile = WIDGET_COPILOT_PROMPT_PROFILES.cs;
  return [
    profile.intro,
    '',
    `All user-visible strings MUST be in locale: ${args.language}.`,
    'INPUT: user request + editable controls catalog + current control values.',
    'OUTPUT: JSON with ops + message + optional conversion CTA.',
    '',
    'WHAT YOU MAY DO:',
    '1) Edit any control listed in EDITABLE_CONTROLS by returning valid ops.',
    '2) Use op:"set" for scalar controls and op:"insert"/"remove"/"move" only for array controls.',
    '3) If a request is ambiguous, ask one short clarifying question.',
    profile.objective,
    '',
    'GUARDRAILS:',
    '- Never invent paths that are not in EDITABLE_CONTROLS.',
    '- Keep edits minimal and directly tied to the request.',
    '- If the user asks for localization/language changes, apply content edits directly when possible.',
    ...(args.forbidInternalControlDumpPromptLine
      ? ['- Never ask the user for editable controls JSON, control lists, or config snippets.']
      : []),
    profile.focus,
    '',
    'Output MUST be JSON, with this shape:',
    '{ "ops"?: WidgetOp[], "message": string, "cta"?: { "text": string, "action": "signup"|"upgrade"|"learn-more", "url"?: string } }',
    '',
    'WidgetOp:',
    '{ op:"set"|"insert"|"remove"|"move", path:string, value?:any, index?:number, from?:number, to?:number }',
    '',
    'Do NOT wrap JSON in markdown fences.',
    'Do NOT include any surrounding text.',
  ].join('\n');
}
