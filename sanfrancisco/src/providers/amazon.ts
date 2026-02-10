import { HttpError, asString, isRecord } from '../http';
import type { Env, Usage } from '../types';
import type { ChatMessage } from '../ai/chat';

type BedrockConverseResponse = {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
  usage?: { inputTokens?: number; outputTokens?: number };
};

type NovaApiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasNovaApiKey(env: Env): boolean {
  return Boolean(asTrimmed(env.NOVA_API_KEY));
}

function normalizeModelForNovaApi(modelId: string): string {
  const trimmed = asTrimmed(modelId);
  if (!trimmed) return '';
  const bedrockStyle = trimmed.match(/^(?:[a-z]{2}\.)?amazon\.([a-z0-9.-]+?)(?::\d+)?$/i);
  if (bedrockStyle?.[1]) return bedrockStyle[1];
  return trimmed;
}

function normalizeModelForBedrock(modelId: string): string {
  const trimmed = asTrimmed(modelId);
  if (!trimmed) return '';
  if (/^(?:[a-z]{2}\.)?amazon\.[a-z0-9.-]+(?::\d+)?$/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+$/i.test(trimmed)) return `amazon.${trimmed}:0`;
  return trimmed;
}

function requireAwsCreds(env: Env): {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
} {
  const accessKeyId = env.AMAZON_BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = env.AMAZON_BEDROCK_SECRET_ACCESS_KEY;
  const region = env.AMAZON_BEDROCK_REGION;
  if (!accessKeyId) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Missing AMAZON_BEDROCK_ACCESS_KEY_ID' });
  }
  if (!secretAccessKey) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Missing AMAZON_BEDROCK_SECRET_ACCESS_KEY' });
  }
  if (!region) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Missing AMAZON_BEDROCK_REGION' });
  }
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: env.AMAZON_BEDROCK_SESSION_TOKEN,
    region,
  };
}

function toAmzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString(); // 2026-02-03T12:34:56.789Z
  const amzDate = iso.replace(/[:-]|\.\d{3}/g, ''); // 20260203T123456Z
  const dateStamp = amzDate.slice(0, 8); // 20260203
  return { amzDate, dateStamp };
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < data.length; i += 1) {
    out += data[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(message));
  return bytesToHex(digest);
}

async function hmacSha256(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

async function deriveSigningKey(args: {
  secretAccessKey: string;
  dateStamp: string;
  region: string;
  service: string;
}): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const kDate = await hmacSha256(enc.encode(`AWS4${args.secretAccessKey}`), args.dateStamp);
  const kRegion = await hmacSha256(kDate, args.region);
  const kService = await hmacSha256(kRegion, args.service);
  return await hmacSha256(kService, 'aws4_request');
}

function canonicalizeHeaders(headers: Record<string, string>): { canonical: string; signedHeaders: string } {
  const normalized = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const canonical = normalized.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = normalized.map(([k]) => k).join(';');
  return { canonical, signedHeaders };
}

async function signAwsRequest(args: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  service: string;
  now: Date;
}): Promise<Record<string, string>> {
  const { amzDate, dateStamp } = toAmzDate(args.now);
  const parsed = new URL(args.url);
  const host = parsed.host;
  const canonicalUri = parsed.pathname || '/';
  const canonicalQueryString = ''; // no query params in our usage

  const baseHeaders: Record<string, string> = {
    host,
    'content-type': args.headers['content-type'] ?? 'application/json',
    'x-amz-date': amzDate,
    ...args.headers,
  };
  if (args.sessionToken) {
    baseHeaders['x-amz-security-token'] = args.sessionToken;
  }

  const payloadHash = await sha256Hex(args.body);
  const { canonical: canonicalHeaders, signedHeaders } = canonicalizeHeaders(baseHeaders);

  const canonicalRequest = [
    args.method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${args.region}/${args.service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

  const signingKey = await deriveSigningKey({
    secretAccessKey: args.secretAccessKey,
    dateStamp,
    region: args.region,
    service: args.service,
  });
  const signature = bytesToHex(await hmacSha256(signingKey, stringToSign));

  const authorization = `${algorithm} Credential=${args.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...baseHeaders,
    Authorization: authorization,
  };
}

function toBedrockMessages(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: Array<{ text: string }> }> {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: String(m.content ?? '') }],
    }));
}

function extractSystemPrompt(messages: ChatMessage[]): string | null {
  const system = messages.find((m) => m.role === 'system');
  return system ? String(system.content ?? '') : null;
}

async function callNovaApiChat(args: {
  env: Env;
  modelId: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  const apiKey = asTrimmed(args.env.NOVA_API_KEY);
  if (!apiKey) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Missing NOVA_API_KEY' });
  }

  const baseUrl = (asTrimmed(args.env.NOVA_BASE_URL) || 'https://api.nova.amazon.com/v1').replace(/\/+$/, '');
  const modelId = normalizeModelForNovaApi(args.modelId);
  if (!modelId) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing modelId' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelId,
          messages: args.messages,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: `Upstream error (${res.status}) ${text}`.trim() });
    }

    let responseJson: NovaApiChatResponse;
    try {
      responseJson = (await res.json()) as NovaApiChatResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Invalid upstream JSON' });
    }

    const latencyMs = Date.now() - startedAt;
    const content = responseJson.choices?.[0]?.message?.content ?? '';
    if (!content) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Empty model response' });

    const usage: Usage = {
      provider: 'amazon',
      model: responseJson.model ?? modelId,
      promptTokens: responseJson.usage?.prompt_tokens ?? 0,
      completionTokens: responseJson.usage?.completion_tokens ?? 0,
      latencyMs,
    };

    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

async function callBedrockConverseChat(args: {
  env: Env;
  modelId: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  const { accessKeyId, secretAccessKey, sessionToken, region } = requireAwsCreds(args.env);
  const endpoint =
    (args.env.AMAZON_BEDROCK_ENDPOINT ?? `https://bedrock-runtime.${region}.amazonaws.com`).replace(/\/+$/, '');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const startedAt = Date.now();

  try {
    const modelId = normalizeModelForBedrock(args.modelId);
    if (!modelId) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing modelId' });
    }

    const url = `${endpoint}/model/${encodeURIComponent(modelId)}/converse`;
    const system = extractSystemPrompt(args.messages);
    const body = JSON.stringify({
      system: system ? [{ text: system }] : undefined,
      messages: toBedrockMessages(args.messages),
      inferenceConfig: {
        maxTokens: args.maxTokens,
        temperature: args.temperature,
      },
    });

    const now = new Date();
    const headers = await signAwsRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
      service: 'bedrock',
      now,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body,
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: `Upstream error (${res.status}) ${text}`.trim() });
    }

    let responseJson: BedrockConverseResponse;
    try {
      responseJson = (await res.json()) as BedrockConverseResponse;
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Invalid upstream JSON' });
    }

    const latencyMs = Date.now() - startedAt;
    const content =
      responseJson.output?.message?.content
        ?.map((item) => (typeof item?.text === 'string' ? item.text : ''))
        .join('') ?? '';

    if (!content) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'amazon', message: 'Empty model response' });
    }

    const usage: Usage = {
      provider: 'amazon',
      model: modelId,
      promptTokens: responseJson.usage?.inputTokens ?? 0,
      completionTokens: responseJson.usage?.outputTokens ?? 0,
      latencyMs,
    };

    return { content, usage };
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAmazonBedrockChat(args: {
  env: Env;
  modelId: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ content: string; usage: Usage }> {
  if (hasNovaApiKey(args.env)) {
    return callNovaApiChat(args);
  }
  return callBedrockConverseChat(args);
}
