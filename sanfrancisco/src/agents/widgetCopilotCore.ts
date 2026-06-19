import type { AIGrant, Env, Usage } from "../types";
import { HttpError, asString, isRecord } from "../http";
import { callChatCompletion, type ChatMessage } from "../ai/chat";
import {
  buildCsSystemPrompt,
  finalizeCsOps,
} from "./widgetCopilotCsProduct";
import {
  WIDGET_COPILOT_PROMPT_PROFILE_VERSION,
  type WidgetCopilotRole,
} from "./widgetCopilotPromptProfiles";
import { buildCsPromptPayload } from "./csPromptPayload";
import {
  DICTIONARY_HASH,
  resolveConversationLanguage,
  translateCopilotUi,
} from "./widgetCopilotLanguage";
import {
  looksLikeCloudflareErrorPage,
  parseJsonFromModel,
} from "./widgetCopilotParsing";

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
  currentValue?: unknown;
};

type WidgetCopilotInput = {
  sessionId: string;
  userMessage: string;
  widgetType: string;
  activeLocale: string;
  snapshotHash: string;
  turnClass: "resolved_edit" | "multi_op_plan";
  resolvedTarget?: { path: string; valueType: string; currentValue: unknown };
  snapshot: {
    widgetType: string;
    displayName: string;
    controls: ControlSummary[];
  };
  controls: ControlSummary[];
};

type WidgetOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; index: number; value: unknown }
  | { op: "remove"; path: string; itemId: string }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };

type WidgetCopilotResult = {
  message: string;
  ops?: WidgetOp[];
  meta?: {
    intent?: "edit" | "explain" | "clarify";
    outcome?: "ops_applied" | "no_ops";
    promptVersion?: string;
    promptProfileVersion?: string;
    promptRole?: WidgetCopilotRole;
    dictionaryHash?: string;
    language?: string;
    languageConfidence?: number;
    touchedPaths?: string[];
    opsCount?: number;
    uniquePathsTouched?: number;
  };
};

type CopilotSession = {
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  successfulEdits: number;
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  conversationLanguage?: string;
  languageConfidence?: number;
};

const PROMPT_VERSION = "widget.copilot.core.v2@2026-02-11";
const INVALID_STRUCTURED_EDIT_MESSAGE =
  "Copilot couldn't produce a valid edit for this widget. Nothing was changed.";

type WidgetCopilotRuntime = {
  agentId: "cs.widget.copilot.v1";
  role: WidgetCopilotRole;
  sessionKeyPrefix: string;
  forbidInternalControlDumpPromptLine?: boolean;
};

function buildMeta(
  intent: NonNullable<WidgetCopilotResult["meta"]>["intent"],
  outcome: NonNullable<WidgetCopilotResult["meta"]>["outcome"],
  role: WidgetCopilotRole,
  extras?: Partial<NonNullable<WidgetCopilotResult["meta"]>>,
): NonNullable<WidgetCopilotResult["meta"]> {
  return {
    intent,
    outcome,
    promptVersion: PROMPT_VERSION,
    promptProfileVersion: WIDGET_COPILOT_PROMPT_PROFILE_VERSION,
    promptRole: role,
    dictionaryHash: DICTIONARY_HASH,
    ...(extras ?? {}),
  };
}

function summarizeOpsForLearning(args: {
  ops: WidgetOp[] | undefined;
}): Partial<NonNullable<WidgetCopilotResult["meta"]>> {
  const ops = args.ops && args.ops.length ? args.ops : [];
  if (!ops.length) {
    return {
      opsCount: 0,
      uniquePathsTouched: 0,
    };
  }

  const pathSet = new Set<string>();
  for (const op of ops) {
    pathSet.add(op.path);
  }

  return {
    opsCount: ops.length,
    uniquePathsTouched: pathSet.size,
    touchedPaths: Array.from(pathSet),
  };
}

function invalidStructuredEditError(
  provider: string,
  _detail?: string,
): HttpError {
  return new HttpError(502, {
    code: "PROVIDER_ERROR",
    provider,
    message: INVALID_STRUCTURED_EDIT_MESSAGE,
  });
}

function isWidgetOp(value: unknown): value is WidgetOp {
  if (!isRecord(value)) return false;
  const op = asString(value.op);
  const path = asString(value.path);
  if (!op || !path) return false;
  if (op === "set") return value.value !== undefined;
  if (op === "insert")
    return typeof value.index === "number" && value.value !== undefined;
  if (op === "remove") return typeof value.index === "number" || isExactNonEmptyString(value.itemId);
  if (op === "move")
    return typeof value.from === "number" && typeof value.to === "number";
  return false;
}

function controlIssue(index: number, field: string, message: string): {
  path: string;
  message: string;
} {
  return { path: `input.snapshot.controls[${index}].${field}`, message };
}

function isExactNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

const TOKEN_SEGMENT_RE = /^__[^.]+__$/;
const CONTROL_KINDS = new Set(["string", "number", "boolean", "enum", "color", "json", "array", "object"]);
const PROHIBITED_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function controlPathPattern(pathPattern: string): RegExp {
  return new RegExp(
    `^${pathPattern
      .split(".")
      .map((segment) => (TOKEN_SEGMENT_RE.test(segment) ? "\\d+" : escapeRegex(segment)))
      .join("\\.")}$`,
  );
}

function isControlPath(value: unknown): value is string {
  return isExactNonEmptyString(value) &&
    !value.split(".").some((segment) => !segment || PROHIBITED_PATH_SEGMENTS.has(segment));
}

function validateControlSummary(value: unknown, index: number): {
  ok: true;
} | {
  ok: false;
  issue: { path: string; message: string };
} {
  if (!isRecord(value)) {
    return { ok: false, issue: { path: `input.snapshot.controls[${index}]`, message: "control must be an object" } };
  }
  if (!isControlPath(value.path)) {
    return { ok: false, issue: controlIssue(index, "path", "path must be an exact dot path without empty or prohibited segments") };
  }
  for (const field of ["panelId", "groupId", "groupLabel", "type", "kind", "label", "itemIdPath"]) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      return { ok: false, issue: controlIssue(index, field, `${field} must be a string`) };
    }
  }
  if (
    value.options !== undefined &&
    (!Array.isArray(value.options) ||
      !value.options.every((option) => isRecord(option) && typeof option.label === "string" && ["string", "number", "boolean"].includes(typeof option.value)))
  ) {
    return { ok: false, issue: controlIssue(index, "options", "options must be label/value objects") };
  }
  if (value.enumValues !== undefined && (!Array.isArray(value.enumValues) || !value.enumValues.every((entry) => typeof entry === "string"))) {
    return { ok: false, issue: controlIssue(index, "enumValues", "enumValues must be strings") };
  }
  if (value.min !== undefined && (typeof value.min !== "number" || !Number.isFinite(value.min))) {
    return { ok: false, issue: controlIssue(index, "min", "min must be a finite number") };
  }
  if (value.max !== undefined && (typeof value.max !== "number" || !Number.isFinite(value.max))) {
    return { ok: false, issue: controlIssue(index, "max", "max must be a finite number") };
  }
  if (!CONTROL_KINDS.has(String(value.kind || ""))) {
    return { ok: false, issue: controlIssue(index, "kind", "kind must be a supported control kind") };
  }
  if (value.kind === "enum" && !enumValuesForControl(value as ControlSummary)?.length) {
    return { ok: false, issue: controlIssue(index, "enumValues", "enum controls must declare values") };
  }
  return { ok: true };
}

function controlForOpPath(controls: ControlSummary[], path: string): ControlSummary | null {
  for (const control of controls) {
    if (controlPathPattern(control.path).test(path)) return control;
  }
  return null;
}

function enumValuesForControl(control: ControlSummary): string[] | null {
  if (control.enumValues?.length) return control.enumValues;
  const options = control.options?.map((option) => option.value).filter(Boolean);
  return options?.length ? options : null;
}

function valueFitsControl(control: ControlSummary, value: unknown): boolean {
  const kind = control.kind;
  if (!kind || kind === "unknown") return false;
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (typeof control.min === "number" && value < control.min) return false;
    if (typeof control.max === "number" && value > control.max) return false;
    return true;
  }
  if (kind === "enum") return typeof value === "string" && Boolean(value) && Boolean(enumValuesForControl(control)?.includes(value));
  if (kind === "json") return value != null && typeof value !== "string";
  if (kind === "array") return Array.isArray(value);
  if (kind === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (kind === "color") return typeof value === "string" && Boolean(value);
  return typeof value === "string";
}

function valueHasItemId(value: unknown, itemIdPath: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const itemId = (value as Record<string, unknown>)[itemIdPath];
  return isExactNonEmptyString(itemId);
}

function validateModelOpsAgainstControls(
  ops: WidgetOp[] | undefined,
  controls: ControlSummary[],
  provider: string,
): void {
  if (!ops?.length) return;
  for (const [index, op] of ops.entries()) {
    if (!isExactNonEmptyString(op.path)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} has invalid path.`);
    }
    const control = controlForOpPath(controls, op.path);
    if (!control) {
      throw invalidStructuredEditError(provider, `Model output op ${index} targets a path outside editable controls.`);
    }
    if (op.op === "set") {
      if (!valueFitsControl(control, op.value)) {
        throw invalidStructuredEditError(provider, `Model output op ${index} has invalid value for ${op.path}.`);
      }
      continue;
    }
    if (control.kind !== "array") {
      throw invalidStructuredEditError(provider, `Model output op ${index} uses an array operation on a non-array control.`);
    }
    const currentValue = control.currentValue;
    if (!Array.isArray(currentValue)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} targets a non-array value.`);
    }
    if (op.op === "insert" && (!Number.isInteger(op.index) || op.index < 0 || op.value === undefined)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} has invalid insert fields.`);
    }
    if (op.op === "insert" && op.index > currentValue.length) {
      throw invalidStructuredEditError(provider, `Model output op ${index} insert index is out of range.`);
    }
    if (op.op === "insert" && control.itemIdPath && !valueHasItemId(op.value, control.itemIdPath)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} inserted item is missing itemId for ${op.path}.`);
    }
    if (op.op === "remove" && control.itemIdPath) {
      if (!("itemId" in op) || !isExactNonEmptyString(op.itemId)) {
        throw invalidStructuredEditError(provider, `Model output op ${index} must remove by itemId for ${op.path}.`);
      }
      const itemIndex = currentValue.findIndex((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        return (item as Record<string, unknown>)[control.itemIdPath as string] === op.itemId;
      });
      if (itemIndex < 0) {
        throw invalidStructuredEditError(provider, `Model output op ${index} remove itemId is not present in ${op.path}.`);
      }
      continue;
    }
    if (op.op === "remove" && ("itemId" in op)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} uses itemId on an array without item identity.`);
    }
    if (op.op === "remove" && (!("index" in op) || !Number.isInteger(op.index) || op.index < 0)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} has invalid remove index.`);
    }
    if (op.op === "remove" && op.index >= currentValue.length) {
      throw invalidStructuredEditError(provider, `Model output op ${index} remove index is out of range.`);
    }
    if (op.op === "move" && (!Number.isInteger(op.from) || op.from < 0 || !Number.isInteger(op.to) || op.to < 0)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} has invalid move indexes.`);
    }
    if (op.op === "move" && (op.from >= currentValue.length || op.to >= currentValue.length)) {
      throw invalidStructuredEditError(provider, `Model output op ${index} move indexes are out of range.`);
    }
  }
}

function parseWidgetCopilotInput(input: unknown): WidgetCopilotInput {
  if (!isRecord(input))
    throw new HttpError(400, {
      code: "BAD_REQUEST",
      message: "Invalid input",
      issues: [{ path: "input", message: "Expected an object" }],
    });
  const sessionId = (asString(input.sessionId) ?? "").trim();
  const userMessage = (asString(input.userMessage) ?? "").trim();
  const widgetType = (asString(input.widgetType) ?? "").trim();
  const activeLocale = (asString(input.activeLocale) ?? "").trim();
  const snapshotHash = (asString(input.snapshotHash) ?? "").trim();
  const turnClass = (asString(input.turnClass) ?? "").trim();
  const snapshot = isRecord(input.snapshot) ? input.snapshot : null;
  const controls = snapshot && Array.isArray(snapshot.controls) ? snapshot.controls : null;
  const resolvedTarget = isRecord(input.resolvedTarget)
    ? {
        path: (asString(input.resolvedTarget.path) ?? "").trim(),
        valueType: (asString(input.resolvedTarget.valueType) ?? "").trim(),
        currentValue: input.resolvedTarget.currentValue,
      }
    : undefined;
  const issues: Array<{ path: string; message: string }> = [];
  if (!sessionId)
    issues.push({ path: "input.sessionId", message: "Missing required value" });
  if (!userMessage)
    issues.push({ path: "input.userMessage", message: "Missing required value" });
  if (!widgetType)
    issues.push({
      path: "input.widgetType",
      message: "Missing required value",
    });
  if (!activeLocale)
    issues.push({
      path: "input.activeLocale",
      message: "Missing required value",
    });
  if (!snapshotHash)
    issues.push({
      path: "input.snapshotHash",
      message: "Missing required value",
    });
  if (turnClass !== "resolved_edit" && turnClass !== "multi_op_plan")
    issues.push({
      path: "input.turnClass",
      message: "turnClass must be resolved_edit or multi_op_plan",
    });
  if (!snapshot)
    issues.push({
      path: "input.snapshot",
      message: "snapshot must be an object",
    });
  if (!controls)
    issues.push({
      path: "input.snapshot.controls",
      message: "snapshot.controls must be an array",
    });
  if (turnClass === "resolved_edit" && (!resolvedTarget?.path || !resolvedTarget.valueType)) {
    issues.push({ path: "input.resolvedTarget", message: "resolvedTarget is required for resolved_edit" });
  }
  if (issues.length)
    throw new HttpError(400, {
      code: "BAD_REQUEST",
      message: "Invalid input",
      issues,
    });

  const controlIssues = (controls as unknown[])
    .map((control, index) => validateControlSummary(control, index))
    .filter((result): result is { ok: false; issue: { path: string; message: string } } => !result.ok)
    .map((result) => result.issue);
  if (controlIssues.length)
    throw new HttpError(400, {
      code: "BAD_REQUEST",
      message: "Invalid input",
      issues: controlIssues,
    });

  return {
    sessionId,
    userMessage,
    widgetType,
    activeLocale,
    snapshotHash,
    turnClass: turnClass as "resolved_edit" | "multi_op_plan",
    ...(resolvedTarget ? { resolvedTarget } : {}),
    snapshot: snapshot as WidgetCopilotInput["snapshot"],
    controls: controls as ControlSummary[],
  };
}

async function getSession(
  env: Env,
  sessionId: string,
  sessionKeyPrefix: string,
): Promise<CopilotSession> {
  const key = `${sessionKeyPrefix}${sessionId}`;
  const existing = await env.SF_KV.get(key, "json");
  if (!existing) {
    const now = Date.now();
    return {
      sessionId,
      createdAtMs: now,
      lastActiveAtMs: now,
      successfulEdits: 0,
      turns: [],
    };
  }
  if (!isRecord(existing))
    throw new HttpError(500, {
      code: "PROVIDER_ERROR",
      provider: "sanfrancisco",
      message: "Session store is corrupted",
    });
  const turns = Array.isArray(existing.turns) ? existing.turns : null;
  if (!turns)
    throw new HttpError(500, {
      code: "PROVIDER_ERROR",
      provider: "sanfrancisco",
      message: "Session store is corrupted",
    });
  return existing as CopilotSession;
}

async function putSession(
  env: Env,
  session: CopilotSession,
  sessionKeyPrefix: string,
): Promise<void> {
  const key = `${sessionKeyPrefix}${session.sessionId}`;
  await env.SF_KV.put(key, JSON.stringify(session), {
    expirationTtl: 60 * 60 * 24,
  });
}

export async function executeWidgetCopilotWithRuntime(
  params: { grant: AIGrant; input: unknown },
  env: Env,
  runtime: WidgetCopilotRuntime,
): Promise<{ result: WidgetCopilotResult; usage: Usage }> {
  const input = parseWidgetCopilotInput(params.input);
  const session = await getSession(
    env,
    input.sessionId,
    runtime.sessionKeyPrefix,
  );
  const baseMeta = (
    intent: NonNullable<WidgetCopilotResult["meta"]>["intent"],
    outcome: NonNullable<WidgetCopilotResult["meta"]>["outcome"],
    extras?: Pick<
      NonNullable<WidgetCopilotResult["meta"]>,
      "language" | "languageConfidence"
    >,
  ) => buildMeta(intent, outcome, runtime.role, extras);
  const metaWithOps = (
    intent: NonNullable<WidgetCopilotResult["meta"]>["intent"],
    outcome: NonNullable<WidgetCopilotResult["meta"]>["outcome"],
    ops: WidgetOp[] | undefined,
    extras?: Partial<NonNullable<WidgetCopilotResult["meta"]>>,
  ) =>
    buildMeta(intent, outcome, runtime.role, {
      ...summarizeOpsForLearning({
        ops,
      }),
      ...(extras ?? {}),
    });
  const languageInfo = resolveConversationLanguage(session, input.userMessage);
  const conversationLanguage = languageInfo.language || "en";
  if (
    !session.conversationLanguage ||
    (session.conversationLanguage !== conversationLanguage &&
      languageInfo.confidence >= 0.85)
  ) {
    session.conversationLanguage = conversationLanguage;
    session.languageConfidence = languageInfo.confidence;
  }

  const cfError = looksLikeCloudflareErrorPage(input.userMessage);
  if (cfError) {
    session.lastActiveAtMs = Date.now();
    const msg =
      translateCopilotUi(conversationLanguage, "cloudflareError") +
      (cfError.status ? ` (HTTP ${cfError.status})` : "");

    session.turns = [
      ...session.turns,
      { role: "user" as const, content: input.userMessage },
      { role: "assistant" as const, content: msg },
    ].slice(-10) as CopilotSession["turns"];
    await putSession(env, session, runtime.sessionKeyPrefix);

    return {
      result: {
        message: msg,
        meta: baseMeta("clarify", "no_ops", {
          language: conversationLanguage,
          languageConfidence: session.languageConfidence,
        }),
      },
      usage: {
        provider: "local",
        model: "cloudflare_error_detector",
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
    };
  }

  const user = buildCsPromptPayload(input);
  const systemPrompt = buildCsSystemPrompt({
    language: conversationLanguage,
    forbidInternalControlDumpPromptLine:
      runtime.forbidInternalControlDumpPromptLine,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...session.turns,
    { role: "user", content: user },
  ];

  const overallStartedAt = Date.now();
  const first = await callChatCompletion({
    env,
    grant: params.grant,
    agentId: runtime.agentId,
    messages,
    temperature: 0.2,
  });

  let content = first.content;
  let lastUsage = first.usage;
  let promptTokens = lastUsage.promptTokens;
  let completionTokens = lastUsage.completionTokens;

  let parseResult = parseJsonFromModel(content);
  let parsed =
    parseResult.ok && isRecord(parseResult.value) ? parseResult.value : null;
  let message = parsed ? (asString(parsed.message) ?? "").trim() : "";
  const ops = ((raw: unknown) => raw === undefined ? undefined : Array.isArray(raw) && raw.every(isWidgetOp) ? (raw.length ? raw : undefined) : (() => { throw invalidStructuredEditError(lastUsage.provider, "Model output includes invalid ops."); })())(parsed?.ops);

  if (!parseResult.ok) throw invalidStructuredEditError(lastUsage.provider);
  if (!parsed)
    throw invalidStructuredEditError(
      lastUsage.provider,
      "Model output must be a JSON object.",
    );
  if (!message)
    throw invalidStructuredEditError(
      lastUsage.provider,
      "Model output is missing a message.",
    );
  validateModelOpsAgainstControls(ops, input.controls, lastUsage.provider);

  const latencyMs = Date.now() - overallStartedAt;

  let finalMessage = message;
  let finalOps = ops && ops.length ? ops : undefined;
  let finalMeta: WidgetCopilotResult["meta"] = metaWithOps(
    finalOps ? "edit" : "clarify",
    finalOps ? "ops_applied" : "no_ops",
    finalOps,
  );
  const finalizedCs = finalizeCsOps({
    prompt: input.userMessage,
    forbidInternalControlDumpPromptLine:
      runtime.forbidInternalControlDumpPromptLine,
    message: finalMessage,
    ops: finalOps,
  });
  finalMessage = finalizedCs.message;
  finalOps = finalizedCs.ops;
  if (finalizedCs.overrideToClarify) {
    finalMeta = metaWithOps("clarify", "no_ops", undefined);
  }

  if (!finalOps || finalOps.length === 0) {
    throw invalidStructuredEditError(lastUsage.provider);
  }

  finalMeta = metaWithOps("edit", "ops_applied", finalOps);

  const hasEdit = Boolean(finalOps && finalOps.length > 0);
  session.lastActiveAtMs = Date.now();
  session.successfulEdits = hasEdit
    ? session.successfulEdits + 1
    : session.successfulEdits;
  session.turns = [
    ...session.turns,
    { role: "user" as const, content: input.userMessage },
    { role: "assistant" as const, content: finalMessage },
  ].slice(-10) as CopilotSession["turns"];
  await putSession(env, session, runtime.sessionKeyPrefix);

  const result: WidgetCopilotResult = {
    message: finalMessage,
    ...(finalOps && finalOps.length ? { ops: finalOps } : {}),
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
