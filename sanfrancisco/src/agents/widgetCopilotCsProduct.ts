import { WIDGET_COPILOT_PROMPT_PROFILES } from "./widgetCopilotPromptProfiles";

type WidgetOpLite =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; index: number; value: unknown }
  | { op: "remove"; path: string; itemId: string }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };

export function messageAsksForInternalControlDump(message: string): boolean {
  const text = String(message || "").toLowerCase();
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

export function finalizeCsOps(args: {
  prompt: string;
  forbidInternalControlDumpPromptLine?: boolean;
  message: string;
  ops: WidgetOpLite[] | undefined;
}): {
  message: string;
  ops: WidgetOpLite[] | undefined;
  overrideToClarify: boolean;
} {
  let message = args.message;
  let ops = args.ops && args.ops.length ? args.ops : undefined;
  let overrideToClarify = false;

  if (
    args.forbidInternalControlDumpPromptLine &&
    !ops &&
    messageAsksForInternalControlDump(message)
  ) {
    message =
      "I can apply this directly without any control dump. " +
      "Choose a tone for the rewrite (professional, friendly, or concise), and I will update the matching editable content fields in one pass.";
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
    "",
    `All user-visible strings MUST be in locale: ${args.language}.`,
    "INPUT: user request + editable controls catalog + current control values.",
    "OUTPUT: JSON with ops + message.",
    "",
    "WHAT YOU MAY DO:",
    "1) Edit any control listed in EDITABLE_CONTROLS by returning valid ops.",
    '2) Use op:"set" for scalar controls and op:"insert"/"remove"/"move" only for array controls.',
    "3) For insert on array controls with itemIdPath, include that item id field in the inserted value.",
    '4) For remove on array controls with itemIdPath, return itemId from the current item. Use index only when the control has no itemIdPath.',
    "5) If a request is ambiguous, ask one short clarifying question.",
    profile.objective,
    "",
    "GUARDRAILS:",
    "- Never invent paths that are not in EDITABLE_CONTROLS.",
    "- Keep edits minimal and directly tied to the request.",
    "- If the user asks for translation or localization, do not translate base content. Return a short message that translations are generated from the Translations panel after save.",
    ...(args.forbidInternalControlDumpPromptLine
      ? [
          "- Never ask the user for editable controls JSON, control lists, or config snippets.",
        ]
      : []),
    profile.focus,
    "",
    "Output MUST be JSON, with this shape:",
    '{ "ops"?: WidgetOp[], "message": string }',
    "",
    "WidgetOp:",
    '{ op:"set"|"insert"|"remove"|"move", path:string, value?:any, itemId?:string, index?:number, from?:number, to?:number }',
    "",
    "Do NOT wrap JSON in markdown fences.",
    "Do NOT include any surrounding text.",
  ].join("\n");
}
