import type { AIGrant, Env, Usage } from "../types";
import { HttpError, asString, isRecord } from "../http";
import { getGrantMaxTokens, getGrantTimeoutMs } from "../grants";
import { callChatCompletion, type ChatMessage } from "../ai/chat";
import globalDictionary from "../lexicon/global_dictionary.json";
import {
  buildCsSystemPrompt,
  finalizeCsOps,
  resolveCsPrelude,
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
};

type WidgetCopilotInput = {
  sessionId: string;
  prompt: string;
  widgetType: string;
  currentConfig: Record<string, unknown>;
  controls: ControlSummary[];
  widgetPackage: Record<string, unknown>;
};

type WidgetOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; index: number; value: unknown }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };

type WidgetCopilotResult = {
  message: string;
  ops?: WidgetOp[];
  cta?: {
    text: string;
    action: "signup" | "upgrade" | "learn-more";
    url?: string;
  };
  meta?: {
    intent?: "edit" | "explain" | "clarify";
    outcome?: "ops_applied" | "no_ops" | "invalid_ops";
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
  'I had trouble generating a structured edit. Please try again, or ask for one specific change (e.g. "translate the content to French").';

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
  detail?: string,
): HttpError {
  return new HttpError(502, {
    code: "PROVIDER_ERROR",
    provider,
    message: detail
      ? `${INVALID_STRUCTURED_EDIT_MESSAGE} ${detail}`
      : INVALID_STRUCTURED_EDIT_MESSAGE,
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
  if (op === "remove") return typeof value.index === "number";
  if (op === "move")
    return typeof value.from === "number" && typeof value.to === "number";
  return false;
}

function parseWidgetCopilotInput(input: unknown): WidgetCopilotInput {
  if (!isRecord(input))
    throw new HttpError(400, {
      code: "BAD_REQUEST",
      message: "Invalid input",
      issues: [{ path: "input", message: "Expected an object" }],
    });
  const sessionId = (asString(input.sessionId) ?? "").trim();
  const prompt = (asString(input.prompt) ?? "").trim();
  const widgetType = (asString(input.widgetType) ?? "").trim();
  const currentConfig = isRecord(input.currentConfig)
    ? input.currentConfig
    : null;
  const controls = Array.isArray(input.controls) ? input.controls : null;
  const widgetPackage = isRecord(input.widgetPackage)
    ? input.widgetPackage
    : null;

  const issues: Array<{ path: string; message: string }> = [];
  if (!sessionId)
    issues.push({ path: "input.sessionId", message: "Missing required value" });
  if (!prompt)
    issues.push({ path: "input.prompt", message: "Missing required value" });
  if (!widgetType)
    issues.push({
      path: "input.widgetType",
      message: "Missing required value",
    });
  if (!currentConfig)
    issues.push({
      path: "input.currentConfig",
      message: "currentConfig must be an object",
    });
  if (!controls)
    issues.push({
      path: "input.controls",
      message: "controls must be an array",
    });
  if (!widgetPackage)
    issues.push({
      path: "input.widgetPackage",
      message: "widgetPackage must be an object",
    });
  if (issues.length)
    throw new HttpError(400, {
      code: "BAD_REQUEST",
      message: "Invalid input",
      issues,
    });

  const safeControls: ControlSummary[] = (controls as any[])
    .filter((c) => isRecord(c) && typeof c.path === "string" && c.path.trim())
    .map((c) => ({
      path: String(c.path),
      panelId: typeof c.panelId === "string" ? c.panelId : undefined,
      groupId: typeof c.groupId === "string" ? c.groupId : undefined,
      groupLabel: typeof c.groupLabel === "string" ? c.groupLabel : undefined,
      type: typeof c.type === "string" ? c.type : undefined,
      kind: typeof c.kind === "string" ? c.kind : undefined,
      label: typeof c.label === "string" ? c.label : undefined,
      options:
        Array.isArray(c.options) &&
        c.options.every(
          (o: any) =>
            isRecord(o) &&
            typeof o.label === "string" &&
            typeof o.value === "string",
        )
          ? (c.options as Array<{ label: string; value: string }>)
          : undefined,
      enumValues:
        Array.isArray(c.enumValues) &&
        c.enumValues.every((v: unknown) => typeof v === "string")
          ? c.enumValues
          : undefined,
      min: typeof c.min === "number" ? c.min : undefined,
      max: typeof c.max === "number" ? c.max : undefined,
      itemIdPath: typeof c.itemIdPath === "string" ? c.itemIdPath : undefined,
    }));

  return {
    sessionId,
    prompt,
    widgetType,
    currentConfig: currentConfig as Record<string, unknown>,
    controls: safeControls,
    widgetPackage: widgetPackage as Record<string, unknown>,
  };
}

function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bestControlMatch(
  prompt: string,
  controls: ControlSummary[],
): ControlSummary | null {
  const p = normalizeToken(prompt);
  if (!p) return null;
  const pTokens = new Set(p.split(" ").filter(Boolean));
  if (pTokens.size === 0) return null;

  let best: { score: number; control: ControlSummary } | null = null;
  for (const c of controls) {
    const label = typeof c.label === "string" ? c.label : "";
    const path = typeof c.path === "string" ? c.path : "";
    const groupLabel = typeof c.groupLabel === "string" ? c.groupLabel : "";
    const hay = normalizeToken(
      [label, path, groupLabel].filter(Boolean).join(" "),
    );
    if (!hay) continue;
    const hTokens = hay.split(" ").filter(Boolean);
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

  if (
    /\b(what can you do|what can i do|how do i use|how does this work)\b/i.test(
      input.prompt,
    )
  ) {
    return (
      "I can help you customize this widget by changing the settings that are available in the editable controls. " +
      "Ask for one small change at a time (title, colors, layout, fonts, or content like questions/answers)."
    );
  }

  if (s.includes("accordion")) {
    return (
      "An accordion shows each item as a collapsible row. Usually you click the row title to expand its content. " +
      "If you enable multi-open, multiple rows can stay expanded at the same time."
    );
  }

  if (
    /\bmulti[-\s]*open\b/i.test(input.prompt) ||
    s.includes("multi open") ||
    s.includes("multiopen")
  ) {
    return "“Multi-open” controls whether multiple accordion rows can be expanded at once (instead of only one at a time).";
  }

  if (
    /\bexpand[-\s]*all\b/i.test(input.prompt) ||
    s.includes("expand all") ||
    s.includes("expandall")
  ) {
    return "“Expand all” controls whether all accordion rows start expanded.";
  }

  if (
    /\bexpand[-\s]*first\b/i.test(input.prompt) ||
    s.includes("expand first") ||
    s.includes("expandfirst")
  ) {
    return "“Expand first” controls whether the first accordion row starts expanded when the widget loads.";
  }

  const matched = bestControlMatch(input.prompt, input.controls);
  if (matched) {
    const label = matched.label?.trim() || matched.path;
    const where = matched.groupLabel?.trim() || matched.panelId || "the editor";
    const kind = matched.kind ? ` (${matched.kind})` : "";
    if (
      matched.kind === "enum" &&
      Array.isArray(matched.enumValues) &&
      matched.enumValues.length > 0
    ) {
      const values = matched.enumValues.slice(0, 12).join(", ");
      return `“${label}”${kind} is an editable setting in ${where}. Allowed values include: ${values}. Tell me what you want it set to and I’ll change it.`;
    }
    if (matched.kind === "boolean") {
      return `“${label}”${kind} is a toggle in ${where}. Tell me if you want it on or off and I’ll update it.`;
    }
    return `“${label}”${kind} is an editable setting in ${where}. Tell me what you want and I’ll change it.`;
  }

  return (
    "I can explain specific settings if you mention them by name (like “multi-open”, “expand all”, or “show title”). " +
    "Or tell me what you want to change and I’ll apply it."
  );
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
  const languageInfo = resolveConversationLanguage(session, input.prompt);
  const conversationLanguage = languageInfo.language || "en";
  if (
    !session.conversationLanguage ||
    (session.conversationLanguage !== conversationLanguage &&
      languageInfo.confidence >= 0.85)
  ) {
    session.conversationLanguage = conversationLanguage;
    session.languageConfidence = languageInfo.confidence;
  }

  const cfError = looksLikeCloudflareErrorPage(input.prompt);
  if (cfError) {
    session.lastActiveAtMs = Date.now();
    const msg =
      translateCopilotUi(conversationLanguage, "cloudflareError") +
      (cfError.status ? ` (HTTP ${cfError.status})` : "");

    session.turns = [
      ...session.turns,
      { role: "user" as const, content: input.prompt },
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

  const returnLocalMessage = async (args: {
    message: string;
    usageModel: string;
    intent: NonNullable<WidgetCopilotResult["meta"]>["intent"];
    cta?: WidgetCopilotResult["cta"];
    language?: string;
  }) => {
    await putSession(env, session, runtime.sessionKeyPrefix);
    return {
      result: {
        message: args.message,
        ...(args.cta ? { cta: args.cta } : {}),
        meta: baseMeta(args.intent, "no_ops", {
          language: args.language ?? conversationLanguage,
          languageConfidence: session.languageConfidence,
        }),
      },
      usage: {
        provider: "local",
        model: args.usageModel,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
    };
  };

  const prelude = resolveCsPrelude({
    conversationLanguage,
    session,
    input,
    explainMessage: () => explainMessage(input),
    dict: globalDictionary,
  });
  if (prelude) {
    return returnLocalMessage({
      message: prelude.message,
      usageModel: prelude.usageModel,
      intent: prelude.intent,
    });
  }

  const maxTokens = getGrantMaxTokens(params.grant);
  const timeoutMs = getGrantTimeoutMs(params.grant);

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
    maxTokens,
    timeoutMs,
  });

  let content = first.content;
  let lastUsage = first.usage;
  let promptTokens = lastUsage.promptTokens;
  let completionTokens = lastUsage.completionTokens;

  let parseResult = parseJsonFromModel(content);
  let parsed =
    parseResult.ok && isRecord(parseResult.value) ? parseResult.value : null;
  let message = parsed ? (asString(parsed.message) ?? "").trim() : "";
  let opsRaw = parsed?.ops;
  let ops = Array.isArray(opsRaw) ? opsRaw.filter(isWidgetOp) : undefined;

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

  const latencyMs = Date.now() - overallStartedAt;

  const ctaRaw = parsed.cta;
  let cta: WidgetCopilotResult["cta"];
  if (isRecord(ctaRaw)) {
    const text = (asString(ctaRaw.text) ?? "").trim();
    const action = (asString(ctaRaw.action) ?? "").trim();
    const url = (asString(ctaRaw.url) ?? "").trim();
    if (
      text &&
      (action === "signup" || action === "upgrade" || action === "learn-more")
    ) {
      cta = { text, action, ...(url ? { url } : {}) };
    }
  }

  let finalMessage = message;
  let finalOps = ops && ops.length ? ops : undefined;
  let finalCta: WidgetCopilotResult["cta"] | undefined = cta;
  let finalMeta: WidgetCopilotResult["meta"] = metaWithOps(
    finalOps ? "edit" : "clarify",
    finalOps ? "ops_applied" : "no_ops",
    finalOps,
  );
  const finalizedCs = finalizeCsOps({
    prompt: input.prompt,
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

  if (finalOps && finalOps.length) {
    finalMeta = metaWithOps("edit", "ops_applied", finalOps);
  } else {
    finalMeta = metaWithOps(
      "clarify",
      finalMeta?.outcome ?? "no_ops",
      undefined,
    );
  }

  const hasEdit = Boolean(finalOps && finalOps.length > 0);
  session.lastActiveAtMs = Date.now();
  session.successfulEdits = hasEdit
    ? session.successfulEdits + 1
    : session.successfulEdits;
  session.turns = [
    ...session.turns,
    { role: "user" as const, content: input.prompt },
    { role: "assistant" as const, content: finalMessage },
  ].slice(-10) as CopilotSession["turns"];
  await putSession(env, session, runtime.sessionKeyPrefix);

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
