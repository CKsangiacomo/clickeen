import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';

type DebugProbeInput = {
  ping?: string;
};

type DebugProbeResult = {
  ok: true;
  echo?: string;
};

function parseDebugProbeInput(input: unknown): DebugProbeInput {
  if (input == null) return {};
  if (!isRecord(input)) throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid input', issues: [{ path: 'input', message: 'Expected an object' }] });
  const ping = asString((input as any).ping) ?? undefined;
  return ping ? { ping } : {};
}

export async function executeDebugGrantProbe(params: { grant: AIGrant; input: unknown }, _env: Env): Promise<{ result: DebugProbeResult; usage: Usage }> {
  const input = parseDebugProbeInput(params.input);
  const startedAt = Date.now();
  const result: DebugProbeResult = { ok: true, ...(input.ping ? { echo: input.ping } : {}) };
  const usage: Usage = {
    provider: 'sanfrancisco',
    model: 'debug.grantProbe',
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: Date.now() - startedAt,
  };
  return { result, usage };
}

