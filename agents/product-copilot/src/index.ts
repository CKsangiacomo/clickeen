import type {
  ProductCopilotContextCapsule,
  ProductCopilotControl,
  ProductCopilotRequestEnvelope,
  ProductCopilotResponse,
  ProductCopilotWidgetOp,
} from '@clickeen/ck-contracts/ai';

export type ProductCopilotModelMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ProductCopilotModelUsage = {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export type ProductCopilotModelResult = {
  content: string;
  usage: ProductCopilotModelUsage;
};

export type ProductCopilotModelExecutor = (args: {
  messages: ProductCopilotModelMessage[];
  temperature: number;
}) => Promise<ProductCopilotModelResult>;

export type ProductCopilotExecutionResult = {
  result: ProductCopilotResponse;
  usage: ProductCopilotModelUsage;
};

export class ProductCopilotInputError extends Error {
  readonly issues: Array<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    super('Invalid Product Copilot input');
    this.name = 'ProductCopilotInputError';
    this.issues = issues;
  }
}

const PROMPT_VERSION = 'product-copilot.brain.v1@2026-06-20';
const MAX_CONVERSATION_HISTORY_MESSAGES = 8;
const MAX_CONVERSATION_HISTORY_CHARS = 2000;
const MAX_CONTEXT_PROMPT_CHARS = 18_000;
const CONTROL_KINDS = new Set(['string', 'number', 'boolean', 'enum', 'color', 'json', 'array', 'object']);
const PROHIBITED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const TOKEN_SEGMENT_RE = /^__[^.]+__$/;
const EDIT_CONTEXT_UNAVAILABLE_MESSAGE = 'Draft editing is unavailable for this turn because Builder sent an invalid edit context. You can still answer conversationally, ask a clarification, suggest next steps, refuse, or return an error.';

type ValidatedProductCopilotInput = {
  envelope: ProductCopilotRequestEnvelope;
  editContext: {
    available: boolean;
    controls: ProductCopilotControl[];
    issues: Array<{ path: string; message: string }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isExactNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isControlPath(value: unknown): value is string {
  return (
    isExactNonEmptyString(value) &&
    !value.split('.').some((segment) => !segment || PROHIBITED_PATH_SEGMENTS.has(segment))
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function controlPathPattern(pathPattern: string): RegExp {
  return new RegExp(
    `^${pathPattern
      .split('.')
      .map((segment) => (TOKEN_SEGMENT_RE.test(segment) ? '\\d+' : escapeRegex(segment)))
      .join('\\.')}$`,
  );
}

function enumValuesForControl(control: ProductCopilotControl): string[] | null {
  if (control.enumValues?.length) return control.enumValues;
  const options = control.options?.map((option) => option.value).filter((value): value is string => typeof value === 'string' && value.length > 0);
  return options?.length ? options : null;
}

function controlForOpPath(controls: ProductCopilotControl[], path: string): ProductCopilotControl | null {
  for (const control of controls) {
    if (controlPathPattern(control.path).test(path)) return control;
  }
  return null;
}

function valueHasItemId(value: unknown, itemIdPath: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return isExactNonEmptyString((value as Record<string, unknown>)[itemIdPath]);
}

function valueFitsControl(control: ProductCopilotControl, value: unknown): boolean {
  if (control.kind === 'boolean') return typeof value === 'boolean';
  if (control.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (typeof control.min === 'number' && value < control.min) return false;
    if (typeof control.max === 'number' && value > control.max) return false;
    return true;
  }
  if (control.kind === 'enum') return typeof value === 'string' && Boolean(enumValuesForControl(control)?.includes(value));
  if (control.kind === 'json') return value != null && typeof value !== 'string';
  if (control.kind === 'array') return Array.isArray(value);
  if (control.kind === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (control.kind === 'color') return typeof value === 'string' && value.length > 0;
  return typeof value === 'string';
}

function validateOpAgainstControls(op: ProductCopilotWidgetOp, index: number, controls: ProductCopilotControl[]): string | null {
  if (!isExactNonEmptyString(op.path)) return `draftEdit.ops[${index}].path must be an exact path`;
  const control = controlForOpPath(controls, op.path);
  if (!control) return `draftEdit.ops[${index}] targets a path outside the context capsule`;
  if (op.op === 'set') {
    return valueFitsControl(control, op.value) ? null : `draftEdit.ops[${index}].value does not fit ${op.path}`;
  }
  if (control.kind !== 'array') return `draftEdit.ops[${index}] uses an array operation on a non-array control`;
  const currentValue = control.currentValue;
  if (!Array.isArray(currentValue)) return `draftEdit.ops[${index}] targets a non-array value`;
  if (op.op === 'insert') {
    if (!Number.isInteger(op.index) || op.index < 0 || op.index > currentValue.length || op.value === undefined) {
      return `draftEdit.ops[${index}] has invalid insert fields`;
    }
    if (control.itemIdPath && !valueHasItemId(op.value, control.itemIdPath)) {
      return `draftEdit.ops[${index}] inserted item is missing item identity`;
    }
    return null;
  }
  if (op.op === 'remove') {
    if (control.itemIdPath) {
      if (!('itemId' in op) || !isExactNonEmptyString(op.itemId)) return `draftEdit.ops[${index}] must remove by itemId`;
      const exists = currentValue.some((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>)[control.itemIdPath as string] === op.itemId);
      return exists ? null : `draftEdit.ops[${index}].itemId is not present`;
    }
    if (!('index' in op) || !Number.isInteger(op.index) || op.index < 0 || op.index >= currentValue.length) {
      return `draftEdit.ops[${index}] has invalid remove index`;
    }
    return null;
  }
  if (op.op === 'move') {
    if (!Number.isInteger(op.from) || !Number.isInteger(op.to) || op.from < 0 || op.to < 0 || op.from >= currentValue.length || op.to >= currentValue.length) {
      return `draftEdit.ops[${index}] has invalid move indexes`;
    }
    return null;
  }
  return `draftEdit.ops[${index}].op is invalid`;
}

function isWidgetOp(value: unknown): value is ProductCopilotWidgetOp {
  if (!isRecord(value)) return false;
  const op = value.op;
  const path = value.path;
  if (!isControlPath(path)) return false;
  if (op === 'set') return value.value !== undefined;
  if (op === 'insert') return typeof value.index === 'number' && value.value !== undefined;
  if (op === 'remove') return typeof value.index === 'number' || isExactNonEmptyString(value.itemId);
  if (op === 'move') return typeof value.from === 'number' && typeof value.to === 'number';
  return false;
}

function validateControl(control: unknown, index: number): Array<{ path: string; message: string }> {
  if (!isRecord(control)) return [{ path: `context.controls[${index}]`, message: 'control must be an object' }];
  const issues: Array<{ path: string; message: string }> = [];
  if (!isControlPath(control.path)) issues.push({ path: `context.controls[${index}].path`, message: 'path must be an exact dot path without empty or prohibited segments' });
  for (const field of ['panelId', 'groupId', 'groupLabel', 'type', 'kind', 'label', 'itemIdPath']) {
    if (control[field] !== undefined && typeof control[field] !== 'string') issues.push({ path: `context.controls[${index}].${field}`, message: `${field} must be a string` });
  }
  if (!CONTROL_KINDS.has(String(control.kind || ''))) issues.push({ path: `context.controls[${index}].kind`, message: 'kind must be a supported control kind' });
  if (control.options !== undefined && (!Array.isArray(control.options) || !control.options.every((option) => isRecord(option) && typeof option.label === 'string' && ['string', 'number', 'boolean'].includes(typeof option.value)))) {
    issues.push({ path: `context.controls[${index}].options`, message: 'options must be label/value objects' });
  }
  if (control.enumValues !== undefined && (!Array.isArray(control.enumValues) || !control.enumValues.every((entry) => typeof entry === 'string'))) {
    issues.push({ path: `context.controls[${index}].enumValues`, message: 'enumValues must be strings' });
  }
  if (control.kind === 'enum' && !enumValuesForControl(control as ProductCopilotControl)?.length) {
    issues.push({ path: `context.controls[${index}].enumValues`, message: 'enum controls must declare values' });
  }
  if (control.min !== undefined && (typeof control.min !== 'number' || !Number.isFinite(control.min))) issues.push({ path: `context.controls[${index}].min`, message: 'min must be finite' });
  if (control.max !== undefined && (typeof control.max !== 'number' || !Number.isFinite(control.max))) issues.push({ path: `context.controls[${index}].max`, message: 'max must be finite' });
  return issues;
}

function validateConversationHistory(value: unknown): Array<{ path: string; message: string }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [{ path: 'conversationHistory', message: 'conversationHistory must be an array' }];
  if (value.length > MAX_CONVERSATION_HISTORY_MESSAGES) return [{ path: 'conversationHistory', message: `conversationHistory must contain at most ${MAX_CONVERSATION_HISTORY_MESSAGES} messages` }];
  const issues: Array<{ path: string; message: string }> = [];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ path: `conversationHistory[${index}]`, message: 'message must be an object' });
      return;
    }
    if (entry.role !== 'user' && entry.role !== 'assistant') issues.push({ path: `conversationHistory[${index}].role`, message: 'role must be user or assistant' });
    const text = asString(entry.text)?.trim() ?? '';
    if (!text) issues.push({ path: `conversationHistory[${index}].text`, message: 'text is required' });
    if (text.length > MAX_CONVERSATION_HISTORY_CHARS) issues.push({ path: `conversationHistory[${index}].text`, message: `text must be at most ${MAX_CONVERSATION_HISTORY_CHARS} characters` });
  });
  return issues;
}

export function validateProductCopilotRequest(input: unknown): ValidatedProductCopilotInput {
  if (!isRecord(input)) throw new ProductCopilotInputError([{ path: 'input', message: 'input must be an object' }]);
  const issues: Array<{ path: string; message: string }> = [];
  const editContextIssues: Array<{ path: string; message: string }> = [];
  if (!isExactNonEmptyString(input.instanceId)) issues.push({ path: 'instanceId', message: 'instanceId is required' });
  if (!isExactNonEmptyString(input.sessionId)) issues.push({ path: 'sessionId', message: 'sessionId is required' });
  if (!isExactNonEmptyString(input.userMessage)) issues.push({ path: 'userMessage', message: 'userMessage is required' });
  const context = isRecord(input.context) ? input.context : null;
  if (!context) {
    issues.push({ path: 'context', message: 'context must be an object' });
  } else {
    if (context.version !== 'product-copilot.context.v1') issues.push({ path: 'context.version', message: 'unsupported context version' });
    for (const field of ['instanceId', 'widgetType', 'displayName', 'activeLocale', 'draftSignature', 'traceRequestId']) {
      if (!isExactNonEmptyString(context[field])) issues.push({ path: `context.${field}`, message: `${field} is required` });
    }
    if (context.instanceId !== input.instanceId) issues.push({ path: 'context.instanceId', message: 'context instance must match envelope instance' });
    if (!Array.isArray(context.controls)) {
      editContextIssues.push({ path: 'context.controls', message: 'context.controls must be an array for draft editing' });
    } else if (context.controls.length === 0) {
      editContextIssues.push({ path: 'context.controls', message: 'context.controls must contain at least one editable control for draft editing' });
    } else {
      context.controls.forEach((control, index) => editContextIssues.push(...validateControl(control, index)));
    }
    if (!Array.isArray(context.availableActions)) {
      issues.push({ path: 'context.availableActions', message: 'availableActions must be an array' });
    } else if (context.availableActions.some((entry) => entry !== 'draft_edit')) {
      issues.push({ path: 'context.availableActions', message: 'availableActions contains an unsupported action' });
    }
    if (!Array.isArray(context.unavailableCapabilities) || !context.unavailableCapabilities.every((entry) => typeof entry === 'string')) {
      issues.push({ path: 'context.unavailableCapabilities', message: 'unavailableCapabilities must be a string array' });
    }
    if (context.selectedControlPath !== undefined && !isControlPath(context.selectedControlPath)) {
      issues.push({ path: 'context.selectedControlPath', message: 'selectedControlPath must be an exact path when present' });
    }
  }
  issues.push(...validateConversationHistory(input.conversationHistory));
  if (issues.length) throw new ProductCopilotInputError(issues);
  const envelope = input as ProductCopilotRequestEnvelope;
  const controls = editContextIssues.length ? [] : envelope.context.controls;
  return {
    envelope,
    editContext: {
      available: controls.length > 0 && envelope.context.availableActions.includes('draft_edit'),
      controls,
      issues: editContextIssues,
    },
  };
}

function serializePromptValue(value: unknown): string {
  if (value === undefined) return '[unset]';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === 'string' ? encoded : String(value);
  } catch {
    return String(value);
  }
}

function controlLine(control: ProductCopilotControl): string {
  const extras = [
    control.label ? `label=${control.label}` : '',
    control.groupLabel ? `group=${control.groupLabel}` : '',
    `kind=${control.kind}`,
    control.enumValues?.length ? `enum=${control.enumValues.join(',')}` : '',
    typeof control.min === 'number' || typeof control.max === 'number'
      ? `range=${typeof control.min === 'number' ? control.min : '-inf'}..${typeof control.max === 'number' ? control.max : 'inf'}`
      : '',
  ].filter(Boolean);
  return `- ${control.path}${extras.length ? ` | ${extras.join(' | ')}` : ''} | current=${serializePromptValue(control.currentValue)}`;
}

function formatIssue(issue: { path: string; message: string }): string {
  return `${issue.path}: ${issue.message}`;
}

function buildContextPrompt(
  context: ProductCopilotContextCapsule,
  userMessage: string,
  editContext: ValidatedProductCopilotInput['editContext'],
): string {
  const availableActions = editContext.available ? context.availableActions.join(', ') : '[none]';
  const unavailableCapabilities = [
    ...context.unavailableCapabilities,
    ...(editContext.available ? [] : ['draft-edit-context-invalid']),
  ];
  const payload = [
    `User request: ${userMessage}`,
    '',
    'Context capsule:',
    `- version: ${context.version}`,
    `- widgetType: ${context.widgetType}`,
    `- displayName: ${context.displayName}`,
    `- activeLocale: ${context.activeLocale}`,
    `- draftSignature: ${context.draftSignature}`,
    `- selectedControlPath: ${context.selectedControlPath ?? '[none]'}`,
    `- availableActions: ${availableActions}`,
    `- unavailableCapabilities: ${unavailableCapabilities.length ? unavailableCapabilities.join(', ') : '[none]'}`,
    '',
    editContext.available
      ? 'Editable draft controls:'
      : 'Editable draft controls are unavailable for this turn.',
    editContext.available
      ? editContext.controls.map(controlLine).join('\n')
      : `Reason: ${editContext.issues.length ? editContext.issues.map(formatIssue).join('; ') : 'No editable controls were available.'}`,
  ].join('\n');
  if (payload.length > MAX_CONTEXT_PROMPT_CHARS) {
    throw new ProductCopilotInputError([{ path: 'context', message: 'context capsule is too large for this turn' }]);
  }
  return payload;
}

function buildSystemPrompt(activeLocale: string): string {
  return [
    'You are Product Copilot for Clickeen Builder.',
    'You are a real conversational product agent, not an edit-only control matcher.',
    `All user-visible strings must be in locale: ${activeLocale}.`,
    '',
    'Reason first. Then choose exactly one output kind:',
    'answer | clarification | suggestion | draft_edit | refusal | error',
    '',
    'Behavior:',
    '- You may answer normal conversation and product questions helpfully.',
    '- When the user is casual or off-topic, respond naturally and guide them back to useful Clickeen work.',
    '- You may suggest copy, design, layout, or workflow improvements without editing.',
    '- You may return draft_edit only when the requested edit is clear enough and can be represented using the provided editable controls.',
    '- Never invent control paths. Never claim a draft edit succeeded unless you return valid draftEdit.ops.',
    '- If context is missing, stale, too large, or the request is unsafe/unavailable, return clarification, refusal, or error.',
    '- Translations are generated from the Translations workflow after save; do not localize base content here.',
    '',
    'Output must be JSON only:',
    '{ "kind": "answer|clarification|suggestion|draft_edit|refusal|error", "message": string, "draftEdit"?: { "ops": WidgetOp[] } }',
    '',
    'WidgetOp:',
    '{ "op":"set"|"insert"|"remove"|"move", "path":string, "value"?:any, "itemId"?:string, "index"?:number, "from"?:number, "to"?:number }',
  ].join('\n');
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const direct = JSON.parse(trimmed);
    return isRecord(direct) ? direct : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const extracted = JSON.parse(trimmed.slice(start, end + 1));
      return isRecord(extracted) ? extracted : null;
    } catch {
      return null;
    }
  }
}

function validateModelResponse(
  value: Record<string, unknown> | null,
  editContext: ValidatedProductCopilotInput['editContext'],
): {
  ok: true;
  response: ProductCopilotResponse;
} | {
  ok: false;
  message: string;
} {
  if (!value) return { ok: false, message: 'Model output must be a JSON object.' };
  const kind = value.kind;
  const message = asString(value.message)?.trim() ?? '';
  if (kind !== 'answer' && kind !== 'clarification' && kind !== 'suggestion' && kind !== 'draft_edit' && kind !== 'refusal' && kind !== 'error') {
    return { ok: false, message: 'Model output kind is invalid.' };
  }
  if (!message) return { ok: false, message: 'Model output message is required.' };
  const draftEdit = isRecord(value.draftEdit) ? value.draftEdit : null;
  const rawOps = draftEdit?.ops;
  if (kind === 'draft_edit') {
    if (!editContext.available) return { ok: false, message: EDIT_CONTEXT_UNAVAILABLE_MESSAGE };
    if (!Array.isArray(rawOps) || rawOps.length === 0) return { ok: false, message: 'draft_edit requires non-empty draftEdit.ops.' };
    if (!rawOps.every(isWidgetOp)) return { ok: false, message: 'draftEdit.ops contains malformed operations.' };
    for (const [index, op] of rawOps.entries()) {
      const issue = validateOpAgainstControls(op, index, editContext.controls);
      if (issue) return { ok: false, message: issue };
    }
    return {
      ok: true,
      response: {
        kind,
        message,
        draftEdit: { ops: rawOps },
      },
    };
  }
  if (draftEdit !== null || rawOps !== undefined) return { ok: false, message: 'Only draft_edit may include draftEdit.' };
  return { ok: true, response: { kind, message } };
}

function responseMeta(args: {
  response: ProductCopilotResponse;
  retryCount: number;
}): NonNullable<ProductCopilotResponse['meta']> {
  const ops = args.response.draftEdit?.ops ?? [];
  const touchedPaths = Array.from(new Set(ops.map((op) => op.path)));
  return {
    promptVersion: PROMPT_VERSION,
    contextVersion: 'product-copilot.context.v1',
    validationRetryCount: args.retryCount,
    ...(ops.length
      ? {
          opsCount: ops.length,
          uniquePathsTouched: touchedPaths.length,
          touchedPaths,
        }
      : {
          opsCount: 0,
          uniquePathsTouched: 0,
        }),
  };
}

export async function executeProductCopilot(args: {
  input: unknown;
  executeModel: ProductCopilotModelExecutor;
}): Promise<ProductCopilotExecutionResult> {
  const validatedInput = validateProductCopilotRequest(args.input);
  const input = validatedInput.envelope;
  const contextPrompt = buildContextPrompt(input.context, input.userMessage, validatedInput.editContext);
  const messages: ProductCopilotModelMessage[] = [
    { role: 'system', content: buildSystemPrompt(input.context.activeLocale) },
    ...(input.conversationHistory ?? []).map((message) => ({ role: message.role, content: message.text }) as ProductCopilotModelMessage),
    { role: 'user', content: contextPrompt },
  ];

  const first = await args.executeModel({ messages, temperature: 0.2 });
  const firstParsed = validateModelResponse(parseJsonObject(first.content), validatedInput.editContext);
  if (firstParsed.ok) {
    return {
      result: {
        ...firstParsed.response,
        meta: responseMeta({ response: firstParsed.response, retryCount: 0 }),
      },
      usage: first.usage,
    };
  }

  const retryMessages: ProductCopilotModelMessage[] = [
    ...messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content: `Your previous output failed Product Copilot structural validation: ${firstParsed.message}\nReturn corrected JSON using the same output union. Do not add markdown or prose outside JSON.`,
    },
  ];
  const second = await args.executeModel({ messages: retryMessages, temperature: 0.2 });
  const secondParsed = validateModelResponse(parseJsonObject(second.content), validatedInput.editContext);
  if (secondParsed.ok) {
    return {
      result: {
        ...secondParsed.response,
        meta: responseMeta({ response: secondParsed.response, retryCount: 1 }),
      },
      usage: {
        provider: second.usage.provider,
        model: second.usage.model,
        promptTokens: first.usage.promptTokens + second.usage.promptTokens,
        completionTokens: first.usage.completionTokens + second.usage.completionTokens,
        latencyMs: first.usage.latencyMs + second.usage.latencyMs,
      },
    };
  }

  const editContextBlocked =
    !validatedInput.editContext.available &&
    (firstParsed.message === EDIT_CONTEXT_UNAVAILABLE_MESSAGE ||
      secondParsed.message === EDIT_CONTEXT_UNAVAILABLE_MESSAGE);
  const response: ProductCopilotResponse = {
    kind: 'error',
    message: editContextBlocked
      ? "I can keep talking, but I can't edit this widget right now because Builder edit context is invalid. Nothing was changed."
      : "Copilot couldn't produce a valid response for this turn. Nothing was changed.",
  };
  return {
    result: {
      ...response,
      meta: responseMeta({ response, retryCount: 1 }),
    },
    usage: {
      provider: second.usage.provider,
      model: second.usage.model,
      promptTokens: first.usage.promptTokens + second.usage.promptTokens,
      completionTokens: first.usage.completionTokens + second.usage.completionTokens,
      latencyMs: first.usage.latencyMs + second.usage.latencyMs,
    },
  };
}
