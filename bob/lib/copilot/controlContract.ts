import { evaluateShowIfExpression } from '../../components/td-menu-content/showIf';
import type { CompiledControl, ControlKind } from '../types';
import { getAt } from '../utils/paths';

export type CopilotControlSnapshotItem = {
  path: string;
  panelId?: string;
  groupId?: string;
  groupLabel?: string;
  type: string;
  kind: Exclude<ControlKind, 'unknown'>;
  label: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  enumValues?: string[];
  min?: number;
  max?: number;
  itemIdPath?: string;
  currentValue: unknown;
  aliases: string[];
  ambiguityGroup?: string;
  choiceLabel: string;
};

export type CopilotControlSnapshot = {
  widgetType: string;
  displayName: string;
  controls: CopilotControlSnapshotItem[];
};

export type CopilotClarificationChoice = {
  label: string;
  path: string;
};

export type BobCopilotDeterministicTurn =
  | {
      handled: true;
      message: string;
      reason: 'capability' | 'clarify' | 'redirect' | 'save' | 'translate' | 'no-control';
      clarificationChoices?: CopilotClarificationChoice[];
    }
  | { handled: false };

export type BobCopilotEditScope =
  | { scoped: true; controls: CopilotControlSnapshotItem[] }
  | { scoped: false; handled: true; message: string }
  | { scoped: false; handled: false };

const CAPABILITY_RE = /\b(what can you edit|what can you change|what can you do|what can i edit|what can i change|how do i use|how does this work|what can i ask)\b/i;
const SAVE_COMMAND_RE = /^(save|publish)(\s+(it|this|the widget))?[.!?]?$/i;
const SAVE_EXPLAIN_RE = /\b(can you|how do i|how can i|where do i)\b[\s\S]{0,40}\b(save|publish)\b/i;
const TRANSLATE_EXPLAIN_RE = /\b(translate|translations?|localize|localise)\b/i;
const OUT_OF_DOMAIN_RE = /\b(are you chatgpt|who are you|what model are you|what do you think|why might conversion be low|conversion advice|best color)\b/i;
const EDIT_VERB_RE = /\b(change|make|set|turn|hide|show|enable|disable|rename|rewrite|write|shorten|longer|bigger|smaller|remove|add)\b/i;
const DEFERRED_ADVICE_RE = /\b(best color|what color should|what do you think|why might conversion|conversion advice)\b/i;
const SLOGAN_RE = /\b(write|make|create)\b[\s\S]{0,30}\b(slogan|headline|tagline)\b/i;
const VISIBILITY_VERB_RE = /\b(hide|show|enable|disable|turn on|turn off)\b/i;
const COLOR_EDIT_RE = /\b(background|color|colour|green|blue|red|white|black|yellow|purple|pink|orange|gray|grey|dark|light|#[0-9a-f]{3,8})\b/i;

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesAlias(normalizedPrompt: string, alias: string): boolean {
  const normalizedAlias = normalizeToken(alias);
  if (!normalizedPrompt || !normalizedAlias) return false;
  return new RegExp(`(?:^| )${escapeRegExp(normalizedAlias)}(?: |$)`).test(normalizedPrompt);
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function isVisibleControl(control: CompiledControl, currentConfig: Record<string, unknown>): boolean {
  if (!control.showIf) return true;
  return evaluateShowIfExpression(control.showIf, currentConfig);
}

export function buildCopilotControlSnapshot(args: {
  widgetType: string;
  displayName: string;
  controls: CompiledControl[];
  currentConfig: Record<string, unknown>;
}): CopilotControlSnapshot {
  const controls: CopilotControlSnapshotItem[] = [];
  args.controls.forEach((control) => {
    if (!control.path || !control.kind || control.kind === 'unknown') return;
    if (!isVisibleControl(control, args.currentConfig)) return;
    const label = (control.label || control.path).trim();
    controls.push({
      path: control.path,
      ...(control.panelId ? { panelId: control.panelId } : {}),
      ...(control.groupId ? { groupId: control.groupId } : {}),
      ...(control.groupLabel ? { groupLabel: control.groupLabel } : {}),
      type: control.type,
      kind: control.kind as Exclude<ControlKind, 'unknown'>,
      label,
      ...(control.options ? { options: control.options } : {}),
      ...(control.enumValues ? { enumValues: control.enumValues } : {}),
      ...(typeof control.min === 'number' ? { min: control.min } : {}),
      ...(typeof control.max === 'number' ? { max: control.max } : {}),
      ...(control.itemIdPath ? { itemIdPath: control.itemIdPath } : {}),
      currentValue: getAt(args.currentConfig, control.path),
      aliases: Array.isArray(control.copilotAliases) ? control.copilotAliases : [],
      ...(control.copilotAmbiguityGroup ? { ambiguityGroup: control.copilotAmbiguityGroup } : {}),
      choiceLabel: control.copilotChoiceLabel || control.groupLabel || label,
    });
  });
  return {
    widgetType: args.widgetType,
    displayName: args.displayName,
    controls,
  };
}

function summarizeEditableAreas(snapshot: CopilotControlSnapshot): string {
  const labels = unique(
    snapshot.controls
      .flatMap((control) => [control.groupLabel ?? '', control.panelId ?? '', control.label])
      .filter(Boolean),
  ).slice(0, 12);
  const areas = labels.length ? labels.join(', ') : 'the visible Builder controls';
  return `I can edit this ${snapshot.displayName || snapshot.widgetType} widget's ${areas}.`;
}

function hasResolvableControl(prompt: string, snapshot: CopilotControlSnapshot): boolean {
  const normalized = normalizeToken(prompt);
  if (!normalized || !EDIT_VERB_RE.test(prompt)) return false;
  if (contextualMatchingControls(prompt, snapshot).length > 0) return true;
  return snapshot.controls.some((control) => control.aliases.some((alias) => matchesAlias(normalized, alias)));
}

function inferControlChoice(control: CopilotControlSnapshotItem): string {
  return control.choiceLabel;
}

function isVisibilityTarget(control: CopilotControlSnapshotItem): boolean {
  const label = normalizeToken(control.label);
  const path = normalizeToken(control.path);
  return (
    control.type === 'toggle' ||
    (control.kind === 'boolean' &&
      (/^(show|hide|enable|disable)\b/.test(label) || /\b(enabled|visible|hidden|show)\b/.test(path)))
  );
}

function isButtonChoice(control: CopilotControlSnapshotItem): boolean {
  const choice = normalizeToken(control.choiceLabel);
  return choice === 'header cta' || choice === 'action button';
}

function isBackgroundTarget(control: CopilotControlSnapshotItem): boolean {
  const label = normalizeToken(control.label);
  const path = normalizeToken(control.path);
  return control.ambiguityGroup === 'background' || label.includes('background') || path.includes('background');
}

function contextualMatchingControls(prompt: string, snapshot: CopilotControlSnapshot): CopilotControlSnapshotItem[] {
  const normalized = normalizeToken(prompt);
  if (!normalized || !EDIT_VERB_RE.test(prompt)) return [];
  if (!/\b(button|cta)\b/i.test(prompt) || !COLOR_EDIT_RE.test(prompt)) return [];

  const buttonBackgrounds = snapshot.controls.filter((control) => isButtonChoice(control) && isBackgroundTarget(control));
  const exactChoiceMatches = buttonBackgrounds.filter((control) => matchesAlias(normalized, control.choiceLabel));
  return exactChoiceMatches.length ? exactChoiceMatches : buttonBackgrounds;
}

function rawMatchingControls(prompt: string, snapshot: CopilotControlSnapshot): CopilotControlSnapshotItem[] {
  const normalized = normalizeToken(prompt);
  if (!normalized || !EDIT_VERB_RE.test(prompt)) return [];
  return snapshot.controls.filter((control) => control.aliases.some((alias) => matchesAlias(normalized, alias)));
}

function matchingControls(prompt: string, snapshot: CopilotControlSnapshot): CopilotControlSnapshotItem[] {
  const contextualMatches = contextualMatchingControls(prompt, snapshot);
  if (contextualMatches.length) return contextualMatches;

  const matches = rawMatchingControls(prompt, snapshot);
  if (!matches.length) return matches;

  if (VISIBILITY_VERB_RE.test(prompt)) {
    const visibilityMatches = matches.filter(isVisibilityTarget);
    if (visibilityMatches.length) return visibilityMatches;
  }

  const nonVisibilityMatches = matches.filter((control) => !isVisibilityTarget(control));
  return nonVisibilityMatches.length ? nonVisibilityMatches : matches;
}

function clarificationFromChoices(message: string, controls: CopilotControlSnapshotItem[]): {
  message: string;
  choices: CopilotClarificationChoice[];
} | null {
  const choices = controls
    .map((control) => ({ label: inferControlChoice(control), path: control.path }))
    .filter((choice) => choice.label && choice.path);
  const uniqueChoices: CopilotClarificationChoice[] = [];
  const seen = new Set<string>();
  choices.forEach((choice) => {
    const key = `${normalizeToken(choice.label)}:${choice.path}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueChoices.push(choice);
  });
  if (uniqueChoices.length <= 1) return null;
  return { message, choices: uniqueChoices.slice(0, 4) };
}

function resolveClarification(prompt: string, snapshot: CopilotControlSnapshot): {
  message: string;
  choices?: CopilotClarificationChoice[];
} | null {
  const normalized = normalizeToken(prompt);
  if (/\bbackground\b/i.test(prompt)) {
    const choices = clarificationFromChoices(
      'Which background should I change?',
      matchingControls(prompt, snapshot).filter(
        (control) => control.ambiguityGroup === 'background' || control.aliases.some((alias) => matchesAlias(normalized, alias)),
      ),
    );
    if (choices) return choices;
  }
  if (/\b(button|cta)\b/i.test(prompt)) {
    const choices = clarificationFromChoices(
      'Which button should I change?',
      matchingControls(prompt, snapshot),
    );
    if (choices) return choices;
  }
  if (/\b(title|headline)\b/i.test(prompt) && /\b(bigger|smaller|size|font|type|typography|text size)\b/i.test(prompt)) {
    const choices = clarificationFromChoices(
      'Do you mean the title text or its typography?',
      snapshot.controls.filter(
        (control) =>
          control.path.startsWith('typography.') ||
          control.ambiguityGroup === 'title' ||
          control.aliases.some((alias) => matchesAlias(normalized, alias)),
      ),
    );
    if (choices) return choices;
  }
  if (/\bsize\b/i.test(prompt)) {
    const choices = clarificationFromChoices('Which size should I change?', matchingControls(prompt, snapshot));
    if (choices) return choices;
  }
  if (/\b(title|headline)\b/i.test(prompt)) {
    const choices = clarificationFromChoices('Which title should I change?', matchingControls(prompt, snapshot));
    if (choices) return choices;
  }
  if (/\b(font|type|typography|text size|title bigger|title smaller)\b/i.test(prompt)) {
    const choices = clarificationFromChoices(
      'Which text should I change?',
      snapshot.controls.filter(
        (control) => control.path.startsWith('typography.') || control.aliases.some((alias) => matchesAlias(normalized, alias)),
      ),
    );
    if (choices) return choices;
  }
  const choices = clarificationFromChoices('Which control should I change?', matchingControls(prompt, snapshot));
  if (choices) return choices;
  return null;
}

export function resolveBobCopilotEditScope(args: {
  prompt: string;
  snapshot: CopilotControlSnapshot;
}): BobCopilotEditScope {
  if (!EDIT_VERB_RE.test(args.prompt)) return { scoped: false, handled: false };
  const controls = matchingControls(args.prompt, args.snapshot);
  if (controls.length > 0) return { scoped: true, controls };
  return {
    scoped: false,
    handled: true,
    message: "I can only edit visible Builder controls for this widget. Name a visible control, like the title, button, background, social share, or Made with Clickeen.",
  };
}

export function resolveBobCopilotDeterministicTurn(args: {
  prompt: string;
  snapshot: CopilotControlSnapshot;
}): BobCopilotDeterministicTurn {
  const prompt = args.prompt.trim();
  if (!prompt) return { handled: false };
  if (DEFERRED_ADVICE_RE.test(prompt)) {
    return {
      handled: true,
      reason: 'no-control',
      message: "I can make concrete Builder edits, but I can't give design advice here. Ask for a specific change, like 'change the button to green'.",
    };
  }
  if (CAPABILITY_RE.test(prompt)) {
    return { handled: true, reason: 'capability', message: summarizeEditableAreas(args.snapshot) };
  }
  if (SLOGAN_RE.test(prompt)) {
    const titleTargets = args.snapshot.controls.filter((control) => control.ambiguityGroup === 'title' || control.aliases.includes('title'));
    const clarification = clarificationFromChoices('Which title should I write into?', titleTargets);
    if (clarification) {
      return {
        handled: true,
        reason: 'clarify',
        message: clarification.message,
        clarificationChoices: clarification.choices,
      };
    }
    if (titleTargets.length === 1) {
      return {
        handled: true,
        reason: 'clarify',
        message: `Should I put that in ${inferControlChoice(titleTargets[0])}?`,
        clarificationChoices: [{ label: inferControlChoice(titleTargets[0]), path: titleTargets[0].path }],
      };
    }
  }
  const resolvesToVisibleControl = hasResolvableControl(prompt, args.snapshot);
  if (TRANSLATE_EXPLAIN_RE.test(prompt) && !resolvesToVisibleControl) {
    return {
      handled: true,
      reason: 'translate',
      message: 'Translations are generated from the Translations panel after you save. I edit the original content only.',
    };
  }
  if ((SAVE_COMMAND_RE.test(prompt) || SAVE_EXPLAIN_RE.test(prompt)) && !resolvesToVisibleControl) {
    return {
      handled: true,
      reason: 'save',
      message: "Copilot edits here in the Builder. To save or publish, use the Builder's Save and Publish controls.",
    };
  }
  const clarification = resolveClarification(prompt, args.snapshot);
  if (clarification) {
    return {
      handled: true,
      reason: 'clarify',
      message: clarification.message,
      ...(clarification.choices ? { clarificationChoices: clarification.choices } : {}),
    };
  }
  if (OUT_OF_DOMAIN_RE.test(prompt) && !hasResolvableControl(prompt, args.snapshot)) {
    return {
      handled: true,
      reason: 'redirect',
      message: "I edit this widget. I can change things like the title, button, colors, layout, and items - try 'make the title bigger' or 'change the button to green'.",
    };
  }
  if (!hasResolvableControl(prompt, args.snapshot) && /\?$/.test(prompt)) {
    return {
      handled: true,
      reason: 'no-control',
      message: "I edit this widget's visible Builder controls. Name a control or ask for a concrete change, like 'hide the Header CTA' or 'make the title bigger'.",
    };
  }
  return { handled: false };
}
