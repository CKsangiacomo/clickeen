import type { Env, SanfranciscoCommandName, SanfranciscoCommandQueueJob } from './types';
import { json, readJson } from './http';
import { asTrimmedString, isRecord } from './validation';

type SanfranciscoAuthMode = 'paris-dev-bearer' | 'none';

function resolveSanfranciscoBaseUrl(env: Env): { ok: true; baseUrl: string } | { ok: false; response: Response } {
  const baseUrl = asTrimmedString(env.SANFRANCISCO_BASE_URL);
  if (!baseUrl) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing SANFRANCISCO_BASE_URL' }, { status: 503 }) };
  }
  return { ok: true, baseUrl };
}

function resolveSanfranciscoDevBearer(env: Env): { ok: true; token: string } | { ok: false; response: Response } {
  const token = asTrimmedString(env.PARIS_DEV_JWT);
  if (!token) {
    return { ok: false, response: json({ error: 'MISCONFIGURED', message: 'Missing PARIS_DEV_JWT' }, { status: 503 }) };
  }
  return { ok: true, token };
}

export async function callSanfranciscoJson(args: {
  env: Env;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  auth?: SanfranciscoAuthMode;
}): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; response: Response }
> {
  const base = resolveSanfranciscoBaseUrl(args.env);
  if (!base.ok) return base;

  const authMode = args.auth ?? 'paris-dev-bearer';
  const headers = new Headers(args.headers || {});
  if (authMode === 'paris-dev-bearer') {
    const bearer = resolveSanfranciscoDevBearer(args.env);
    if (!bearer.ok) return bearer;
    headers.set('authorization', `Bearer ${bearer.token}`);
  }

  let body: BodyInit | undefined;
  if (args.body !== undefined) {
    if (typeof args.body === 'string') {
      body = args.body;
    } else {
      body = JSON.stringify(args.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
  }

  const res = await fetch(new URL(args.path, base.baseUrl).toString(), {
    method: args.method ?? 'GET',
    headers,
    body,
  });
  const payload = await readJson(res);
  if (!res.ok) {
    return {
      ok: false,
      response: json({ error: 'UPSTREAM_ERROR', upstream: 'sanfrancisco', status: res.status, details: payload }, { status: 502 }),
    };
  }
  return { ok: true, payload };
}

export async function dispatchSanfranciscoCommand(args: {
  env: Env;
  path: string;
  command: SanfranciscoCommandName;
  payload: unknown;
  auth?: SanfranciscoAuthMode;
  headers?: HeadersInit;
}): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; response: Response }
> {
  if (args.env.SANFRANCISCO_COMMANDS_QUEUE) {
    if (!isRecord(args.payload)) {
      return {
        ok: false,
        response: json(
          {
            error: 'INTERNAL',
            message: 'SanFrancisco command payload must be an object',
            detail: args.command,
          },
          { status: 500 },
        ),
      };
    }

    const message: SanfranciscoCommandQueueJob = {
      v: 1,
      kind: 'sf.command',
      command: args.command,
      payload: args.payload as Record<string, unknown>,
    };
    try {
      await args.env.SANFRANCISCO_COMMANDS_QUEUE.send(message);
      return {
        ok: true,
        payload: {
          accepted: true,
          transport: 'queue',
          command: args.command,
        },
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(
        `[paris.sanfrancisco] queue dispatch failed command=${args.command}; falling back to HTTP: ${detail}`,
      );
    }
  }

  return callSanfranciscoJson({
    env: args.env,
    path: args.path,
    method: 'POST',
    auth: args.auth,
    headers: args.headers,
    body: {
      command: args.command,
      payload: args.payload,
    },
  });
}
