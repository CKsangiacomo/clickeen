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
    policyVersion?: string;
    dictionaryHash?: string;
    language?: string;
    languageConfidence?: number;
    touchedPaths?: string[];
    touchedControls?: Array<{
      path: string;
      label?: string;
      groupId?: string;
      groupLabel?: string;
    }>;
    touchedScopes?: string[];
    touchedGroups?: Array<{ key: string; label: string }>;
    opsCount?: number;
    uniquePathsTouched?: number;
    validationResult?: "valid" | "invalid" | "not_applicable";
    invalidReason?: string;
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
  pendingPolicy?:
    | {
        kind: "scope";
        createdAtMs: number;
        ops: WidgetOp[];
        scopes: Array<"stage" | "pod" | "content">;
      }
    | {
        kind: "group";
        createdAtMs: number;
        ops: WidgetOp[];
        groups: Array<{ key: string; label: string }>;
      };
};

const PROMPT_VERSION = "widget.copilot.core.v2@2026-02-11";
const POLICY_VERSION_BY_ROLE: Record<WidgetCopilotRole, string> = {
  cs: "widget.copilot.policy.cs.editor.v1@2026-02-11",
};
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
    policyVersion: POLICY_VERSION_BY_ROLE[role],
    dictionaryHash: DICTIONARY_HASH,
    ...(extras ?? {}),
  };
}

function summarizeOpsForLearning(args: {
  ops: WidgetOp[] | undefined;
  controls: ControlSummary[];
  validationResult?: "valid" | "invalid" | "not_applicable";
  invalidReason?: string;
}): Partial<NonNullable<WidgetCopilotResult["meta"]>> {
  const ops = args.ops && args.ops.length ? args.ops : [];
  if (!ops.length) {
    return {
      opsCount: 0,
      uniquePathsTouched: 0,
      validationResult: args.validationResult ?? "not_applicable",
      ...(args.invalidReason ? { invalidReason: args.invalidReason } : {}),
    };
  }

  const controlByPath = new Map(
    args.controls.map((control) => [control.path, control]),
  );
  const pathSet = new Set<string>();
  const scopeSet = new Set<string>();
  const groups = new Map<string, { key: string; label: string }>();
  const controls = new Map<
    string,
    { path: string; label?: string; groupId?: string; groupLabel?: string }
  >();

  for (const op of ops) {
    pathSet.add(op.path);
    scopeSet.add(inferScopeFromPath(op.path));
    const control = controlByPath.get(op.path);
    if (control) {
      controls.set(op.path, {
        path: op.path,
        ...(control.label ? { label: control.label } : {}),
        ...(control.groupId ? { groupId: control.groupId } : {}),
        ...(control.groupLabel ? { groupLabel: control.groupLabel } : {}),
      });
      const group = groupForPath(op.path, args.controls);
      if (group) groups.set(group.key, group);
    }
  }

  return {
    opsCount: ops.length,
    uniquePathsTouched: pathSet.size,
    touchedPaths: Array.from(pathSet),
    touchedScopes: Array.from(scopeSet),
    touchedControls: Array.from(controls.values()),
    touchedGroups: Array.from(groups.values()),
    validationResult: args.validationResult ?? "valid",
    ...(args.invalidReason ? { invalidReason: args.invalidReason } : {}),
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
  };
}

function inferScopeFromPath(controlPath: string): "stage" | "pod" | "content" {
  if (controlPath.startsWith("stage.")) return "stage";
  if (controlPath.startsWith("pod.")) return "pod";
  return "content";
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

function bestControlForPath(
  path: string,
  controls: ControlSummary[],
): ControlSummary | null {
  const target = (path || "").trim();
  if (!target) return null;

  let best: { len: number; control: ControlSummary } | null = null;

  for (const c of controls) {
    const cp = typeof c.path === "string" ? c.path.trim() : "";
    if (!cp) continue;
    if (cp === target) return c;
    if (target.startsWith(cp + ".")) {
      const len = cp.length;
      if (!best || len > best.len) best = { len, control: c };
      continue;
    }
    if (cp.startsWith(target + ".")) {
      const len = target.length;
      if (!best || len > best.len) best = { len, control: c };
    }
  }

  return best?.control ?? null;
}

function groupForPath(
  path: string,
  controls: ControlSummary[],
): { key: string; label: string } | null {
  const control = bestControlForPath(path, controls);
  if (!control) return null;
  const key = (
    control.groupId ||
    control.groupLabel ||
    control.panelId ||
    ""
  ).trim();
  if (!key) return null;
  const label = (control.groupLabel || control.panelId || key).trim();
  return { key, label };
}

function pathLooksSensitive(path: string): boolean {
  // In CS mode we only hard-gate truly sensitive execution surfaces.
  // URL/href/domain edits are normal widget editing actions.
  return /\b(script|html|embed)\b/i.test(path);
}

type LightEditsDecision =
  | { ok: true }
  | {
      ok: false;
      message: string;
      pendingPolicy?: CopilotSession["pendingPolicy"];
    };

type OpsValidationIssue = { opIndex: number; path: string; message: string };

type OpsValidationResult =
  | { ok: true }
  | { ok: false; issues: OpsValidationIssue[] };

function isNumericString(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim());
}

function validateOpsAgainstControls(args: {
  ops: WidgetOp[];
  controls: ControlSummary[];
}): OpsValidationResult {
  const issues: OpsValidationIssue[] = [];

  for (let opIndex = 0; opIndex < args.ops.length; opIndex += 1) {
    const op = args.ops[opIndex]!;
    const path = op.path;
    const control = bestControlForPath(path, args.controls);
    if (!control) {
      issues.push({
        opIndex,
        path,
        message: "Unknown path (not in editable controls)",
      });
      continue;
    }
    if (!control.kind) {
      issues.push({ opIndex, path, message: "Control kind is unknown" });
      continue;
    }

    if (op.op === "insert" || op.op === "remove" || op.op === "move") {
      if (control.kind !== "array") {
        issues.push({
          opIndex,
          path,
          message: "Target must be an array control",
        });
        continue;
      }
      if (op.op === "insert" && control.itemIdPath) {
        const item = op.value as any;
        const id =
          item && typeof item === "object" && !Array.isArray(item)
            ? item[control.itemIdPath]
            : null;
        if (typeof id !== "string" || !id.trim()) {
          issues.push({
            opIndex,
            path,
            message: `Inserted item must include a non-empty "${control.itemIdPath}"`,
          });
        }
      }
      continue;
    }

    // set op
    if (op.op === "set") {
      if (
        control.kind === "enum" &&
        Array.isArray(control.enumValues) &&
        control.enumValues.length > 0
      ) {
        if (
          typeof op.value !== "string" ||
          !control.enumValues.includes(op.value)
        ) {
          issues.push({
            opIndex,
            path,
            message: "Value must be one of the allowed enum values",
          });
        }
        continue;
      }

      if (
        control.kind === "number" ||
        typeof control.min === "number" ||
        typeof control.max === "number"
      ) {
        let n: number | null = null;
        if (typeof op.value === "number" && Number.isFinite(op.value))
          n = op.value;
        if (typeof op.value === "string" && isNumericString(op.value))
          n = Number(op.value);
        if (n == null || !Number.isFinite(n)) {
          issues.push({ opIndex, path, message: "Value must be a number" });
          continue;
        }
        if (typeof control.min === "number" && n < control.min) {
          issues.push({
            opIndex,
            path,
            message: `Value must be >= ${control.min}`,
          });
        }
        if (typeof control.max === "number" && n > control.max) {
          issues.push({
            opIndex,
            path,
            message: `Value must be <= ${control.max}`,
          });
        }
        continue;
      }

      if (control.kind === "boolean") {
        const ok =
          typeof op.value === "boolean" ||
          (typeof op.value === "string" &&
            (op.value.toLowerCase() === "true" ||
              op.value.toLowerCase() === "false"));
        if (!ok)
          issues.push({
            opIndex,
            path,
            message: "Value must be true or false",
          });
        continue;
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

function evaluateLightEditsPolicy(args: {
  ops: WidgetOp[];
  controls: ControlSummary[];
}): LightEditsDecision {
  const opsCount = args.ops.length;
  const uniquePaths = new Set(args.ops.map((o) => o.path));
  const scopes = new Set(args.ops.map((o) => inferScopeFromPath(o.path)));
  const groups = new Map<string, { key: string; label: string }>();
  for (const op of args.ops) {
    const g = groupForPath(op.path, args.controls);
    if (g) groups.set(g.key, g);
  }

  const hasSensitive = args.ops.some((o) => pathLooksSensitive(o.path));
  const isContentOnly = scopes.size === 1 && scopes.has("content");

  // Content personalization needs to update multiple copy fields at once.
  const maxOps = isContentOnly ? 30 : 6;
  const maxUniquePathsTouched = isContentOnly ? 20 : 4;
  const maxScopesTouched = 1;
  const maxGroupsTouched = isContentOnly ? 3 : 1;

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
    const labels = scopeList.map((s) => s).join(" + ");
    const picks = scopeList.filter(
      (s) => s === "stage" || s === "pod" || s === "content",
    );
    const pickText = picks.join(" or ");
    const tokenText = picks.join(" | ");
    const msg =
      `That would change multiple areas (${labels}). Which should I change first: ${pickText}?` +
      `\nReply with: ${tokenText}` +
      `\nTo apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: {
        kind: "scope",
        createdAtMs: Date.now(),
        ops: args.ops,
        scopes: scopeList,
      },
    };
  }

  if (groups.size > maxGroupsTouched) {
    const groupList = Array.from(groups.values()).slice(0, 6);
    const lines = groupList
      .map((g, idx) => `${idx + 1}) ${g.label}`)
      .join("\n");
    const msg =
      `That would change multiple panels. Which panel should I start with?\n` +
      `${lines}\n` +
      `Reply with the number (1-${groupList.length}).\n` +
      `To apply across the whole widget, reply: apply across widget`;
    return {
      ok: false,
      message: msg,
      pendingPolicy: {
        kind: "group",
        createdAtMs: Date.now(),
        ops: args.ops,
        groups: groupList,
      },
    };
  }

  if (hasSensitive) {
    return {
      ok: false,
      message:
        "That change would modify a sensitive setting (URL/embed/script). Please confirm by replying exactly: apply across widget",
      pendingPolicy: {
        kind: "scope",
        createdAtMs: Date.now(),
        ops: args.ops,
        scopes: Array.from(scopes),
      },
    };
  }

  return { ok: true };
}

function extractExactToken(prompt: string): string {
  return (prompt || "").trim().toLowerCase();
}

function selectScopeFromPrompt(
  prompt: string,
  scopes: Array<"stage" | "pod" | "content">,
): "stage" | "pod" | "content" | null {
  const token = extractExactToken(prompt);
  if (!token) return null;
  if (token === "stage" && scopes.includes("stage")) return "stage";
  if (token === "pod" && scopes.includes("pod")) return "pod";
  if (token === "content" && scopes.includes("content")) return "content";

  const lower = token;
  const hasStage = lower.includes("stage");
  const hasPod = lower.includes("pod");
  const hasContent = lower.includes("content");
  const count = Number(hasStage) + Number(hasPod) + Number(hasContent);
  if (count !== 1) return null;
  if (hasStage && scopes.includes("stage")) return "stage";
  if (hasPod && scopes.includes("pod")) return "pod";
  if (hasContent && scopes.includes("content")) return "content";
  return null;
}

function filterOpsByScope(
  ops: WidgetOp[],
  scope: "stage" | "pod" | "content",
): WidgetOp[] {
  return ops.filter((o) => inferScopeFromPath(o.path) === scope);
}

function selectGroupFromPrompt(
  prompt: string,
  groups: Array<{ key: string; label: string }>,
): { key: string; label: string } | null {
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

function filterOpsByGroup(
  ops: WidgetOp[],
  groupKey: string,
  controls: ControlSummary[],
): WidgetOp[] {
  return ops.filter((o) => groupForPath(o.path, controls)?.key === groupKey);
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
        controls: input.controls,
        validationResult: ops && ops.length ? "valid" : "not_applicable",
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

  if (session.pendingPolicy) {
    const pending = session.pendingPolicy;
    const token = extractExactToken(input.prompt);

    if (token === "apply across widget") {
      const ops = pending.ops;
      session.pendingPolicy = undefined;
      session.lastActiveAtMs = Date.now();
      const msg = "Ok — applying across the whole widget.";
      session.turns = [
        ...session.turns,
        { role: "user" as const, content: input.prompt },
        { role: "assistant" as const, content: msg },
      ].slice(-10) as CopilotSession["turns"];
      await putSession(env, session, runtime.sessionKeyPrefix);
      return {
        result: {
          message: msg,
          ops,
          meta: metaWithOps("edit", "ops_applied", ops),
        },
        usage: {
          provider: "local",
          model: "policy_confirm_all",
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
        },
      };
    }

    if (pending.kind === "scope") {
      const chosen = selectScopeFromPrompt(input.prompt, pending.scopes);
      if (chosen) {
        const ops = filterOpsByScope(pending.ops, chosen);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to ${chosen} only.`;
        session.turns = [
          ...session.turns,
          { role: "user" as const, content: input.prompt },
          { role: "assistant" as const, content: msg },
        ].slice(-10) as CopilotSession["turns"];
        await putSession(env, session, runtime.sessionKeyPrefix);
        return {
          result: {
            message: msg,
            ops,
            meta: metaWithOps("edit", "ops_applied", ops),
          },
          usage: {
            provider: "local",
            model: "policy_scope_pick",
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: 0,
          },
        };
      }
    }

    if (pending.kind === "group") {
      const chosen = selectGroupFromPrompt(input.prompt, pending.groups);
      if (chosen) {
        const ops = filterOpsByGroup(pending.ops, chosen.key, input.controls);
        session.pendingPolicy = undefined;
        session.lastActiveAtMs = Date.now();
        const msg = `Ok — applying to “${chosen.label}” only.`;
        session.turns = [
          ...session.turns,
          { role: "user" as const, content: input.prompt },
          { role: "assistant" as const, content: msg },
        ].slice(-10) as CopilotSession["turns"];
        await putSession(env, session, runtime.sessionKeyPrefix);
        return {
          result: {
            message: msg,
            ops,
            meta: metaWithOps("edit", "ops_applied", ops),
          },
          usage: {
            provider: "local",
            model: "policy_group_pick",
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: 0,
          },
        };
      }
    }

    // If the user didn't answer with an accepted token, drop the pending policy and treat this as a new request.
    session.pendingPolicy = undefined;
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
    const validated = validateOpsAgainstControls({
      ops: finalOps,
      controls: input.controls,
    });
    if (!validated.ok) {
      const invalidOps = finalOps;
      const details = validated.issues
        .slice(0, 3)
        .map((i) => `- ${i.path}: ${i.message}`)
        .join("\n");
      finalMessage =
        "I tried to apply an edit, but it didn’t match the widget’s editable controls. " +
        "Please try again and mention the setting you want to change (e.g. “stage background”, “title”, “accordion multi-open”)." +
        (details ? `\n\nDetails:\n${details}` : "");
      finalOps = undefined;
      finalCta = undefined;
      finalMeta = metaWithOps("clarify", "invalid_ops", invalidOps, {
        validationResult: "invalid",
        invalidReason: details || "Ops did not match editable controls",
      });
      session.pendingPolicy = undefined;
    } else {
      const policy = evaluateLightEditsPolicy({
        ops: finalOps,
        controls: input.controls,
      });
      if (!policy.ok) {
        finalMessage = policy.message;
        finalMeta = metaWithOps("clarify", "no_ops", finalOps);
        finalOps = undefined;
        finalCta = undefined;
        session.pendingPolicy = policy.pendingPolicy;
      } else {
        finalMeta = metaWithOps("edit", "ops_applied", finalOps);
        session.pendingPolicy = undefined;
      }
    }
  } else {
    finalMeta = metaWithOps(
      "clarify",
      finalMeta?.outcome ?? "no_ops",
      undefined,
    );
    session.pendingPolicy = undefined;
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
