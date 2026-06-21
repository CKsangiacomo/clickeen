import type { AIGrant, Env } from '../types';
import {
  ProductCopilotInputError,
  executeProductCopilot,
  type ProductCopilotModelMessage,
} from '@clickeen/product-copilot';
import { HttpError } from '../http';
import { callChatCompletion } from '../ai/chat';

export async function executeCsWidgetCopilot(
  params: { grant: AIGrant; input: unknown },
  env: Env,
) {
  try {
    return await executeProductCopilot({
      input: params.input,
      executeModel: async (request: { messages: ProductCopilotModelMessage[]; temperature: number }) => {
        return callChatCompletion({
          env,
          grant: params.grant,
          agentId: 'cs.widget.copilot.v1',
          messages: request.messages,
          temperature: request.temperature,
        });
      },
    });
  } catch (error) {
    if (error instanceof ProductCopilotInputError) {
      throw new HttpError(400, {
        code: 'BAD_REQUEST',
        message: 'Invalid Product Copilot input',
        issues: error.issues,
      });
    }
    throw error;
  }
}
