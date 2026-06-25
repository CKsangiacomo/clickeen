import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord, normalizeRequestId } from '@clickeen/ck-contracts';
import {
  ProductCopilotInputError,
  executeProductCopilot,
  type ProductCopilotModelMessage,
  type ProductCopilotModelUsage,
} from './index';

const PRODUCT_COPILOT_AGENT_ID = 'product.copilot';

type Env = {
  ENVIRONMENT?: string;
  SANFRANCISCO_AI_ENGINE?: Fetcher;
};

type ProductCopilotWorkerRequest = {
  grant: string;
  agentId?: string;
  input: unknown;
  trace?: {
    requestId?: string;
    client?: 'roma';
  };
};

class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(isRecord(payload) && typeof payload.message === 'string' ? payload.message : `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(value), { ...init, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } });
  }
}

function isWorkerRequest(value: unknown): value is ProductCopilotWorkerRequest {
  if (!isRecord(value)) return false;
  const grant = asTrimmedString(value.grant);
  if (!grant) return false;
  if (value.agentId !== undefined && value.agentId !== PRODUCT_COPILOT_AGENT_ID) return false;
  return Object.prototype.hasOwnProperty.call(value, 'input');
}

function resolveRequestId(request: Request, body: ProductCopilotWorkerRequest): string {
  return (
    normalizeRequestId(request.headers.get(CK_REQUEST_ID_HEADER)) ??
    normalizeRequestId(body.trace?.requestId) ??
    crypto.randomUUID()
  );
}

async function callSanFranciscoModel(args: {
  env: Env;
  requestId: string;
  grant: string;
  messages: ProductCopilotModelMessage[];
  temperature: number;
}): Promise<{ content: string; usage: ProductCopilotModelUsage }> {
  const body = JSON.stringify({
    grant: args.grant,
    agentId: PRODUCT_COPILOT_AGENT_ID,
    messages: args.messages,
    temperature: args.temperature,
    trace: { client: 'product-copilot', requestId: args.requestId },
  });

  const headers = {
    'content-type': 'application/json',
    [CK_REQUEST_ID_HEADER]: args.requestId,
  };

  if (!args.env.SANFRANCISCO_AI_ENGINE) {
    throw new HttpError(500, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'product-copilot',
        message: 'Missing SANFRANCISCO_AI_ENGINE service binding for Product Copilot model execution.',
      },
    });
  }

  const response = await args.env.SANFRANCISCO_AI_ENGINE.fetch('https://sanfrancisco.internal/model/chat', {
    method: 'POST',
    headers,
    body,
  });

  const text = await response.text().catch(() => '');
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) as unknown : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new HttpError(response.status, isRecord(payload) ? payload : { error: { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: text || `San Francisco model execution failed (${response.status})` } });
  }
  if (!isRecord(payload) || typeof payload.content !== 'string' || !isRecord(payload.usage)) {
    throw new HttpError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'sanfrancisco',
        message: 'San Francisco returned an invalid model execution response.',
      },
    });
  }
  return {
    content: payload.content,
    usage: payload.usage as ProductCopilotModelUsage,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') {
      return json({
        ok: true,
        service: 'product-copilot',
        env: env.ENVIRONMENT ?? 'unknown',
        ts: Date.now(),
      });
    }

    try {
      if (request.method !== 'POST' || url.pathname !== '/execute') {
        throw new HttpError(404, { error: { code: 'BAD_REQUEST', message: 'Not found' } });
      }

      const body = await readJson(request);
      if (!isWorkerRequest(body)) {
        throw new HttpError(400, {
          error: {
            code: 'BAD_REQUEST',
            reasonKey: 'coreui.errors.copilot.invalidRequest',
            message: 'Invalid Product Copilot worker request',
            issues: [{ path: '', message: 'Expected { grant, agentId?, input }' }],
          },
        });
      }

      const requestId = resolveRequestId(request, body);
      const executed = await executeProductCopilot({
        input: body.input,
        executeModel: async (modelRequest) => callSanFranciscoModel({
          env,
          requestId,
          grant: body.grant,
          messages: modelRequest.messages,
          temperature: modelRequest.temperature,
        }),
      });

      return json({
        requestId,
        agentId: PRODUCT_COPILOT_AGENT_ID,
        result: executed.result,
        usage: executed.usage,
      });
    } catch (error) {
      if (error instanceof ProductCopilotInputError) {
        return json(
          {
            error: {
              code: 'BAD_REQUEST',
              reasonKey: 'coreui.errors.copilot.invalidRequest',
              message: 'Invalid Product Copilot input',
              issues: error.issues,
            },
          },
          { status: 400 },
        );
      }
      if (error instanceof HttpError) {
        return json(error.payload, { status: error.status });
      }
      console.error('[product-copilot] Unhandled error', error);
      return json(
        {
          error: {
            code: 'PROVIDER_ERROR',
            provider: 'product-copilot',
            message: 'Product Copilot failed unexpectedly.',
          },
        },
        { status: 500 },
      );
    }
  },
};
