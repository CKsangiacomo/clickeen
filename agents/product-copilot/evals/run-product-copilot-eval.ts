import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ProductCopilotOutputKind,
  ProductCopilotRequestEnvelope,
  ProductCopilotWidgetOp,
} from '@clickeen/ck-contracts/ai';
import { executeProductCopilot } from '../src/index';

type EvalCase = {
  id: string;
  prompt: string;
  expectedKind: ProductCopilotOutputKind;
  expectedValidationRetryCount?: number;
  expectedOps?: ProductCopilotWidgetOp[];
  modelResponses: unknown[];
};

type EvalFile = {
  version: 1;
  cases: EvalCase[];
};

const evalPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'product-copilot-v1.json');
const evalFile = JSON.parse(readFileSync(evalPath, 'utf8')) as EvalFile;

function baseInput(testCase: EvalCase): ProductCopilotRequestEnvelope {
  return {
    instanceId: `eval-${testCase.id}`,
    sessionId: `session-${testCase.id}`,
    userMessage: testCase.prompt,
    context: {
      version: 'product-copilot.context.v1',
      instanceId: `eval-${testCase.id}`,
      widgetType: 'bigbang',
      displayName: 'Big Bang',
      activeLocale: 'en',
      draftSignature: `draft-${testCase.id}`,
      controls: [
        {
          path: 'content.title',
          panelId: 'content',
          type: 'textfield',
          kind: 'string',
          label: 'Title',
          currentValue: 'Old title',
        },
        {
          path: 'content.supportingCopy',
          panelId: 'content',
          type: 'textarea',
          kind: 'string',
          label: 'Supporting copy',
          currentValue: 'Old supporting copy',
        },
      ],
      availableActions: ['draft_edit'],
      unavailableCapabilities: ['saved-product-mutation', 'publish', 'analytics-lookup'],
      traceRequestId: `trace-${testCase.id}`,
    },
    conversationHistory: [{ role: 'assistant', text: 'You are editing this widget in Builder.' }],
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

async function runCase(testCase: EvalCase): Promise<void> {
  let callIndex = 0;
  const execution = await executeProductCopilot({
    input: baseInput(testCase),
    executeModel: async () => {
      const response = testCase.modelResponses[callIndex];
      callIndex += 1;
      if (!response) throw new Error(`[${testCase.id}] missing mocked model response ${callIndex}`);
      return {
        content: JSON.stringify(response),
        usage: {
          provider: 'eval',
          model: 'fixture',
          promptTokens: 1,
          completionTokens: 1,
          latencyMs: 1,
        },
      };
    },
  });

  if (execution.result.kind !== testCase.expectedKind) {
    throw new Error(`[${testCase.id}] expected ${testCase.expectedKind}, got ${execution.result.kind}`);
  }
  const actualRetryCount = execution.result.meta?.validationRetryCount ?? 0;
  const expectedRetryCount = testCase.expectedValidationRetryCount ?? 0;
  if (actualRetryCount !== expectedRetryCount) {
    throw new Error(`[${testCase.id}] expected retry count ${expectedRetryCount}, got ${actualRetryCount}`);
  }
  if (testCase.expectedOps) {
    const actualOps = execution.result.draftEdit?.ops ?? [];
    if (stableJson(actualOps) !== stableJson(testCase.expectedOps)) {
      throw new Error(`[${testCase.id}] ops mismatch: ${stableJson(actualOps)}`);
    }
    const message = execution.result.message.toLowerCase();
    if (message.includes('applied') || message.includes('saved') || message.includes('published')) {
      throw new Error(`[${testCase.id}] draft edit message claims terminal product success`);
    }
  }
}

async function main(): Promise<void> {
  for (const testCase of evalFile.cases) {
    await runCase(testCase);
  }
  console.log(`[product-copilot-eval] PASS ${evalFile.cases.length} cases`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
