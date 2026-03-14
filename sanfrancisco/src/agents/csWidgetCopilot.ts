import type { AIGrant, Env } from '../types';
import { executeWidgetCopilotWithRuntime } from './widgetCopilotCore';

export async function executeCsWidgetCopilot(
  params: { grant: AIGrant; input: unknown },
  env: Env,
) {
  return executeWidgetCopilotWithRuntime(params, env, {
    agentId: 'cs.widget.copilot.v1',
    role: 'cs',
    sessionKeyPrefix: 'copilot:cs:session:',
    forbidInternalControlDumpPromptLine: true,
  });
}
