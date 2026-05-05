export type WidgetCopilotRole = 'cs';

export type WidgetCopilotPromptProfile = {
  role: WidgetCopilotRole;
  intro: string;
  objective: string;
  focus: string;
};

export const WIDGET_COPILOT_PROMPT_PROFILE_VERSION = 'widget.copilot.prompt-profiles.v1@2026-02-11';

export const WIDGET_COPILOT_PROMPT_PROFILES: Record<WidgetCopilotRole, WidgetCopilotPromptProfile> = {
  cs: {
    role: 'cs',
    intro: "You are Clickeen's CS (Customer Success) widget copilot.",
    objective: '3) Optionally return a conversion CTA (signup/publish/upgrade) only when it naturally fits the conversation.',
    focus: '- Keep edits minimal and user-goal focused.',
  },
};
