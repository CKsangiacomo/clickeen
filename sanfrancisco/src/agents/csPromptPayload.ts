type ControlSummary = {
  path: string;
  panelId?: string;
  groupLabel?: string;
  kind?: string;
  label?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  currentValue?: unknown;
};

type CsPromptInput = {
  userMessage: string;
  widgetType: string;
  controls: ControlSummary[];
};

const MAX_PROMPT_CHARS = 7_200;

function serializePromptValue(value: unknown): string {
  if (value === undefined) return "[unset]";
  if (value === null) return "null";

  let out: string;
  if (typeof value === "string") {
    out = value;
  } else {
    try {
      const encoded = JSON.stringify(value);
      out = typeof encoded === "string" ? encoded : String(value);
    } catch {
      out = String(value);
    }
  }
  return out;
}

function isContentControl(control: ControlSummary): boolean {
  const text =
    `${control.path || ""} ${control.label || ""} ${control.groupLabel || ""}`.toLowerCase();
  return /question|answer|title|subtitle|cta|label|text|content|description|copy|headline/.test(
    text,
  );
}

function isContentRewriteIntent(prompt: string): boolean {
  const text = String(prompt || "")
    .trim()
    .toLowerCase();
  if (!text) return false;
  const hasContentNoun =
    /\b(question|questions|answer|answers|title|subtitle|headline|section|cta|copy|text|content)\b/.test(
      text,
    );
  if (!hasContentNoun) return false;
  return /\b(rewrite|rephrase|refresh|improve|update|edit|change|adapt|translate|localize|polish|simplify|shorten|expand)\b/.test(
    text,
  );
}

function dedupeByPath(controls: ControlSummary[]): ControlSummary[] {
  const out: ControlSummary[] = [];
  const seen = new Set<string>();
  for (const control of controls) {
    const path = String(control.path || "").trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(control);
  }
  return out;
}

function controlRow(control: ControlSummary): string {
  const label = control.label ? ` | label=${control.label}` : "";
  const kind = control.kind ? ` | kind=${control.kind}` : "";
  const group = control.groupLabel ? ` | group=${control.groupLabel}` : "";
  const panel = control.panelId ? ` | panel=${control.panelId}` : "";
  const enumValues =
    Array.isArray(control.enumValues) && control.enumValues.length
      ? ` | enum=${control.enumValues.join(",")}`
      : "";
  const range =
    typeof control.min === "number" || typeof control.max === "number"
      ? ` | range=${typeof control.min === "number" ? control.min : "-inf"}..${
          typeof control.max === "number" ? control.max : "inf"
        }`
      : "";
  return `- ${control.path}${label}${kind}${panel}${group}${enumValues}${range}`;
}

function valueRows(args: {
  controls: ControlSummary[];
}): string[] {
  const out: string[] = [];

  for (const control of args.controls) {
    const rawPath = String(control.path || "").trim();
    if (!rawPath) continue;
    out.push(`- ${rawPath}: ${serializePromptValue(control.currentValue)}`);
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
    "",
    `User request: ${args.prompt}`,
    "Execution contract: use only the editable controls below; never ask the user for controls JSON, path lists, source files, or config snippets.",
    "",
    "EDITABLE_CONTROLS:",
    args.controlRows.join("\n"),
    "",
    "CURRENT_VALUES:",
    args.valueRows.join("\n"),
  ].join("\n");
}

export function buildCsPromptPayload(input: CsPromptInput): string {
  const controls = dedupeByPath(input.controls);
  const contentFirst = isContentRewriteIntent(input.userMessage)
    ? dedupeByPath([...controls.filter(isContentControl), ...controls])
    : controls;

  const selectedControls = contentFirst;
  const selectedValueRows = valueRows({
    controls: selectedControls,
  });
  const selectedControlRows = selectedControls.map(controlRow);
  const payload = buildPayload({
    widgetType: input.widgetType,
    prompt: input.userMessage,
    controlRows: selectedControlRows,
    valueRows: selectedValueRows,
  });

  if (payload.length <= MAX_PROMPT_CHARS) return payload;
  throw new Error("Builder Copilot context is too large for this turn. Nothing was changed.");
}
