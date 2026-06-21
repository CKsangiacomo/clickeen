import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAiModelManagementConfig,
  type AiModelManagementConfig,
} from '../../packages/ck-contracts/src/ai-model-management';
import {
  labelAiModel,
  labelAiProvider,
  resolveAiModelCapability,
  type AiModelRef,
  type AiProvider,
} from '../../packages/ck-contracts/src/ai';
import { AI_RUNTIME_MATRIX } from '../../packages/ck-policy/src/ai-runtime';

type ProviderResult =
  | {
      status: 'passed';
      provider: AiProvider;
      model: string;
      returnedModel: string;
      httpStatus: number;
      content: true;
      usage: true;
      latencyMs: number;
    }
  | {
      status: 'failed' | 'blocked';
      provider: AiProvider;
      model: string;
      httpStatus?: number;
      reason: string;
      latencyMs?: number;
    };

type Evidence = {
  v: 1;
  generatedAt: string;
  command: string;
  envSource: string;
  modelSource: '@clickeen/ck-contracts/ai-model-management';
  prompt: 'Reply with exactly: ok';
  results: ProviderResult[];
};

type DriftResult = {
  status: 'failed';
  provider: AiProvider;
  model: string;
  reason: string;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_DIR = path.join(ROOT, 'documentation/ai/model-conformance');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'latest.json');
const MD_OUTPUT = path.join(OUTPUT_DIR, 'latest.md');
const PROMPT = 'Reply with exactly: ok';
const TOKEN_BUDGET = 128;
const TIMEOUT_MS = 45_000;

function parseArgs(argv: string[]): { write: boolean; allowFailures: boolean } {
  return {
    write: argv.includes('--write'),
    allowFailures: argv.includes('--allow-failures'),
  };
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separator = trimmed.indexOf('=');
  if (separator <= 0) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

async function loadLocalEnv(): Promise<string> {
  const envPath = path.join(ROOT, '.env.local');
  let text: string;
  try {
    text = await readFile(envPath, 'utf8');
  } catch {
    return 'process.env';
  }
  for (const line of text.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    const [key, value] = entry;
    if (
      key === 'OPENAI_API_KEY' ||
      key === 'OPENAI_BASE_URL' ||
      key === 'DEEPSEEK_API_KEY' ||
      key === 'DEEPSEEK_BASE_URL'
    ) {
      process.env[key] = value;
    }
  }
  return '.env.local + process.env';
}

function modelKey(model: AiModelRef): string {
  return `${model.provider}:${model.model}`;
}

function uniqueModels(config: AiModelManagementConfig): AiModelRef[] {
  const out = new Map<string, AiModelRef>();
  const add = (model: AiModelRef): void => {
    out.set(modelKey(model), model);
  };
  config.productCopilot.enabledModels.forEach(add);
  config.sdrCopilot.enabledModels.forEach(add);
  Object.values(config.internalAgents).forEach((agent) => {
    agent.routes.forEach((route) => add(route.model));
  });
  return Array.from(out.values()).sort((a, b) => modelKey(a).localeCompare(modelKey(b)));
}

function configuredModelKeys(config: AiModelManagementConfig): Set<string> {
  return new Set(uniqueModels(config).map(modelKey));
}

function findPolicyModelDrift(config: AiModelManagementConfig): DriftResult[] {
  const configured = configuredModelKeys(config);
  const drift: DriftResult[] = [];
  for (const [agentId, byTier] of Object.entries(AI_RUNTIME_MATRIX.agents)) {
    for (const [tier, policy] of Object.entries(byTier)) {
      for (const [provider, modelPolicy] of Object.entries(policy.modelsByProvider) as Array<[
        AiProvider,
        { allowed: string[] } | undefined,
      ]>) {
        for (const model of modelPolicy?.allowed ?? []) {
          if (configured.has(`${provider}:${model}`)) continue;
          drift.push({
            status: 'failed',
            provider,
            model,
            reason: `policy_model_missing_from_managed_config:${agentId}/${tier}`,
          });
        }
      }
    }
  }
  return drift;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join('\n').trim();
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return extractText(record.text ?? record.value ?? record.content);
}

function safeReason(provider: AiProvider, status: number, body: unknown): string {
  if (!body || typeof body !== 'object') return `${provider} returned HTTP ${status}`;
  const error = (body as { error?: { type?: unknown; code?: unknown } }).error;
  const type = typeof error?.type === 'string' ? error.type : null;
  const code = typeof error?.code === 'string' ? error.code : null;
  return [type, code].filter(Boolean).join(':') || `${provider} returned HTTP ${status}`;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<{
  status: number;
  ok: boolean;
  body: unknown;
  latencyMs: number;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      status: response.status,
      ok: response.ok,
      body,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkModel(model: AiModelRef): Promise<ProviderResult> {
  const capability = resolveAiModelCapability(model.provider, model.model);
  if (!capability) {
    return {
      status: 'failed',
      provider: model.provider,
      model: model.model,
      reason: 'model_missing_from_catalog',
    };
  }

  const key =
    model.provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.DEEPSEEK_API_KEY;
  if (!key?.trim()) {
    return {
      status: 'blocked',
      provider: model.provider,
      model: model.model,
      reason: 'missing_provider_key',
    };
  }

  const baseUrl =
    model.provider === 'openai'
      ? (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com')
      : (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com');
  const tokenBudget =
    capability.tokenParam === 'max_completion_tokens'
      ? { max_completion_tokens: TOKEN_BUDGET }
      : { max_tokens: TOKEN_BUDGET };
  const body = {
    model: model.model,
    messages: [{ role: 'user', content: PROMPT }],
    ...(capability.supportsTemperature ? { temperature: 0 } : {}),
    ...(capability.reasoningEffort ? { reasoning_effort: capability.reasoningEffort } : {}),
    ...tokenBudget,
  };

  let response: Awaited<ReturnType<typeof fetchJson>>;
  try {
    response = await fetchJson(
      `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      TIMEOUT_MS,
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    return {
      status: name === 'AbortError' ? 'failed' : 'blocked',
      provider: model.provider,
      model: model.model,
      reason: name === 'AbortError' ? 'provider_timeout' : 'provider_request_failed',
    };
  }

  if (!response.ok) {
    return {
      status: response.status === 401 ? 'blocked' : 'failed',
      provider: model.provider,
      model: model.model,
      httpStatus: response.status,
      reason: safeReason(model.provider, response.status, response.body),
      latencyMs: response.latencyMs,
    };
  }

  const record = response.body && typeof response.body === 'object'
    ? response.body as Record<string, unknown>
    : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === 'object'
    ? choices[0] as { message?: unknown }
    : {};
  const content = extractText(
    first.message && typeof first.message === 'object'
      ? (first.message as Record<string, unknown>).content
      : undefined,
  );
  const usage = record.usage && typeof record.usage === 'object'
    ? record.usage as Record<string, unknown>
    : {};
  const returnedModel = typeof record.model === 'string' ? record.model.trim() : '';
  const hasUsage =
    typeof usage.prompt_tokens === 'number' &&
    typeof usage.completion_tokens === 'number';

  if (!content || !hasUsage || !returnedModel) {
    return {
      status: 'failed',
      provider: model.provider,
      model: model.model,
      httpStatus: response.status,
      reason: 'incomplete_provider_response',
      latencyMs: response.latencyMs,
    };
  }

  return {
    status: 'passed',
    provider: model.provider,
    model: model.model,
    returnedModel,
    httpStatus: response.status,
    content: true,
    usage: true,
    latencyMs: response.latencyMs,
  };
}

function renderMarkdown(evidence: Evidence): string {
  const rows = evidence.results.map((result) => {
    const provider = labelAiProvider(result.provider);
    const label = labelAiModel(result.model, result.provider);
    if (result.status === 'passed') {
      return `| ${provider} | \`${result.model}\` | ${label} | passed | ${result.httpStatus} | yes | yes | \`${result.returnedModel}\` | |`;
    }
    return `| ${provider} | \`${result.model}\` | ${label} | ${result.status} | ${result.httpStatus ?? ''} | no | no | | ${result.reason} |`;
  });

  return `# AI Model Conformance - Latest

Generated: ${evidence.generatedAt}

Source: \`${evidence.modelSource}\`

This file is generated by \`${evidence.command}\`. It is evidence only. Normal
product work must not call this proof path or depend on a runtime test ritual.

## Result

| Provider | Model | Label | Status | HTTP status | Content | Usage | Returned model | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Proof Shape

Each configured model is called through its provider chat-completions endpoint
with one user message:

\`\`\`text
${PROMPT}
\`\`\`

No provider response body, API key, or raw upstream error is stored in this
report.
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const envSource = await loadLocalEnv();
  const config = getAiModelManagementConfig();
  const models = uniqueModels(config);
  const results: ProviderResult[] = [];
  const drift = findPolicyModelDrift(config);
  for (const model of models) {
    results.push(await checkModel(model));
  }

  const evidence: Evidence = {
    v: 1,
    generatedAt: new Date().toISOString(),
    command: 'pnpm ai:model-conformance -- --write',
    envSource,
    modelSource: '@clickeen/ck-contracts/ai-model-management',
    prompt: PROMPT,
    results: [...results, ...drift],
  };

  if (args.write) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(JSON_OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`);
    await writeFile(MD_OUTPUT, renderMarkdown(evidence));
  }

  const failed = evidence.results.filter((result) => result.status !== 'passed');
  for (const result of evidence.results) {
    const suffix = result.status === 'passed'
      ? `returned=${result.returnedModel}`
      : `reason=${result.reason}`;
    console.log(`${result.status.toUpperCase()} ${result.provider}:${result.model} ${suffix}`);
  }
  if (failed.length && !args.allowFailures) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
