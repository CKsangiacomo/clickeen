import type { AIGrant, Env } from '../types';
import { executeWidgetCopilotWithRuntime } from './widgetCopilotCore';

export async function executeSdrWidgetCopilot(
  params: { grant: AIGrant; input: unknown },
  env: Env,
) {
  return executeWidgetCopilotWithRuntime(params, env, {
    agentId: 'sdr.widget.copilot.v1',
    role: 'sdr',
    sessionKeyPrefix: 'copilot:sdr:session:',
  });
}
