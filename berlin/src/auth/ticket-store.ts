import { CK_REQUEST_ID_HEADER, serializeCkLogEvent } from '@clickeen/ck-contracts';
import { readJsonPayload } from '../utils/primitives';

export type TicketConsumeResult<T> =
  | { outcome: 'ok'; ticket: T }
  | { outcome: 'missing' | 'expired' | 'alreadyConsumed' | 'storeUnavailable' | 'corrupt' };

type TicketKind = 'state' | 'finish';

type TicketValidator<T> = (value: unknown) => T | null;

type TicketStoreEnv = {
  BERLIN_AUTH_TICKETS?: DurableObjectNamespace;
};

type StoredTicket = {
  kind: TicketKind;
  payload: unknown;
  expiresAt: number;
  consumedAt?: number;
  consumeOutcome?: 'consumed' | 'expired';
  cleanupAt: number;
};

type JsonRecord = Record<string, unknown>;

const STORAGE_KEY = 'ticket';
const CONSUME_MARKER_TTL_SECONDS = 60 * 60;

function json(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  });
}

function resolveTicketLogRequestId(source?: Request | Response | null): string {
  const fromHeader = String(source?.headers.get(CK_REQUEST_ID_HEADER) || '').trim();
  return fromHeader || crypto.randomUUID();
}

function logTicketStoreWarning(args: {
  boundary: string;
  detail: string;
  source?: Request | Response | null;
}): void {
  console.warn(
    serializeCkLogEvent({
      event: 'boundary.operation_failed',
      service: 'berlin',
      stage: 'unknown',
      requestId: resolveTicketLogRequestId(args.source),
      boundary: args.boundary,
      detail: args.detail,
    }),
  );
}

function logTicketStoreIntegrityError(args: { boundary: string; detail: string; source?: Request | Response | null }): void {
  console.error(
    serializeCkLogEvent({
      event: 'boundary.integrity_failed',
      service: 'berlin',
      stage: 'unknown',
      requestId: resolveTicketLogRequestId(args.source),
      boundary: args.boundary,
      detail: args.detail,
    }),
  );
}

async function readTicketStoreJson(response: Response, boundary: string): Promise<unknown | null> {
  try {
    return await response.json();
  } catch (error) {
    logTicketStoreWarning({
      boundary,
      source: response,
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function claimAsString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function claimAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readObject(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function toStoredTicket(value: unknown): StoredTicket | null {
  const record = readObject(value);
  if (!record) return null;
  const kind = claimAsString(record.kind);
  const expiresAt = claimAsNumber(record.expiresAt);
  const consumedAt = claimAsNumber(record.consumedAt) || undefined;
  const consumeOutcome = claimAsString(record.consumeOutcome) || undefined;
  const cleanupAt = claimAsNumber(record.cleanupAt);
  if (kind !== 'state' && kind !== 'finish') return null;
  if (!expiresAt || expiresAt <= 0) return null;
  if (!cleanupAt || cleanupAt <= 0) return null;
  if (consumeOutcome !== undefined && consumeOutcome !== 'consumed' && consumeOutcome !== 'expired') return null;
  return {
    kind,
    payload: record.payload,
    expiresAt,
    ...(consumedAt ? { consumedAt } : {}),
    ...(consumeOutcome ? { consumeOutcome } : {}),
    cleanupAt,
  };
}

async function readJsonBody(request: Request): Promise<JsonRecord | null> {
  const parsed = await readJsonPayload(request);
  return readObject(parsed);
}

function resolveTicketStub(env: TicketStoreEnv, kind: TicketKind, id: string): DurableObjectStub | null {
  const namespace = env.BERLIN_AUTH_TICKETS;
  if (!namespace) return null;
  return namespace.get(namespace.idFromName(`${kind}:${id}`));
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function storeAuthTicket(
  env: TicketStoreEnv,
  kind: TicketKind,
  id: string,
  payload: unknown,
  expiresAt: number,
): Promise<boolean> {
  const stub = resolveTicketStub(env, kind, id);
  if (!stub) return false;
  const response = await stub.fetch('https://ticket/store', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ kind, payload, expiresAt }),
  });
  const body = readObject(await readTicketStoreJson(response, 'auth.ticket.store.responseJson'));
  return Boolean(response.ok && body?.ok === true);
}

export async function consumeAuthTicket<T>(
  env: TicketStoreEnv,
  kind: TicketKind,
  id: string,
  validator: TicketValidator<T>,
): Promise<TicketConsumeResult<T>> {
  const stub = resolveTicketStub(env, kind, id);
  if (!stub) return { outcome: 'storeUnavailable' };

  const response = await stub.fetch('https://ticket/consume', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ kind }),
  });

  const body = readObject(await readTicketStoreJson(response, 'auth.ticket.consume.responseJson'));
  if (!body) return { outcome: 'corrupt' };
  if (!response.ok) {
    return claimAsString(body.error) === 'ticket_store_corrupt' ? { outcome: 'corrupt' } : { outcome: 'storeUnavailable' };
  }

  const outcome = claimAsString(body.outcome);
  if (outcome === 'missing' || outcome === 'expired' || outcome === 'alreadyConsumed') return { outcome };
  if (outcome !== 'ok') return { outcome: 'corrupt' };

  const ticket = validator(body.ticket);
  if (!ticket) return { outcome: 'corrupt' };
  return { outcome: 'ok', ticket };
}

export class BerlinAuthTicketDO {
  constructor(private readonly state: DurableObjectState) {}

  private async store(request: Request): Promise<Response> {
    const body = await readJsonBody(request);
    const kind = claimAsString(body?.kind);
    const expiresAt = claimAsNumber(body?.expiresAt);
    if ((kind !== 'state' && kind !== 'finish') || !expiresAt || expiresAt <= 0) {
      return json({ error: 'invalid_request' }, { status: 422 });
    }
    const record: StoredTicket = {
      kind,
      payload: body?.payload,
      expiresAt,
      cleanupAt: expiresAt + CONSUME_MARKER_TTL_SECONDS,
    };
    await this.state.storage.put(STORAGE_KEY, record);
    await this.state.storage.setAlarm(record.cleanupAt * 1000).catch(() => undefined);
    return json({ ok: true });
  }

  private async consume(request: Request): Promise<Response> {
    const body = await readJsonBody(request);
    const expectedKind = claimAsString(body?.kind);
    if (expectedKind !== 'state' && expectedKind !== 'finish') {
      return json({ error: 'invalid_request' }, { status: 422 });
    }

    const stored = await this.state.storage.get(STORAGE_KEY);
    if (stored == null) {
      return json({ ok: true, outcome: 'missing' });
    }

    const current = toStoredTicket(stored);
    if (!current || current.kind !== expectedKind) {
      logTicketStoreIntegrityError({
        boundary: 'auth.ticket.consume.storage',
        source: request,
        detail: !current ? 'stored_ticket_malformed' : 'stored_ticket_kind_mismatch',
      });
      return json({ error: 'ticket_store_corrupt' }, { status: 500 });
    }

    if (current.consumedAt) {
      if (current.consumeOutcome === 'expired') return json({ ok: true, outcome: 'expired' });
      return json({ ok: true, outcome: 'alreadyConsumed' });
    }

    const nowSec = nowSeconds();
    if (current.expiresAt <= nowSec) {
      const next: StoredTicket = {
        ...current,
        consumedAt: nowSec,
        consumeOutcome: 'expired',
        cleanupAt: nowSec + CONSUME_MARKER_TTL_SECONDS,
      };
      await this.state.storage.put(STORAGE_KEY, next);
      await this.state.storage.setAlarm(next.cleanupAt * 1000).catch(() => undefined);
      return json({ ok: true, outcome: 'expired' });
    }

    const next: StoredTicket = {
      ...current,
      consumedAt: nowSec,
      consumeOutcome: 'consumed',
      cleanupAt: nowSec + CONSUME_MARKER_TTL_SECONDS,
    };
    await this.state.storage.put(STORAGE_KEY, next);
    await this.state.storage.setAlarm(next.cleanupAt * 1000).catch(() => undefined);
    return json({ ok: true, outcome: 'ok', ticket: current.payload });
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (request.method === 'POST' && pathname === '/store') return this.store(request);
    if (request.method === 'POST' && pathname === '/consume') return this.consume(request);
    return json({ error: 'not_found' }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const stored = await this.state.storage.get(STORAGE_KEY);
    if (stored == null) {
      await this.state.storage.deleteAll().catch(() => undefined);
      return;
    }

    const current = toStoredTicket(stored);
    if (!current) {
      logTicketStoreIntegrityError({
        boundary: 'auth.ticket.alarm.storage',
        detail: 'stored_ticket_malformed',
      });
      return;
    }

    const nowSec = nowSeconds();
    if (nowSec >= current.cleanupAt) {
      await this.state.storage.deleteAll().catch(() => undefined);
      return;
    }

    await this.state.storage.setAlarm(current.cleanupAt * 1000).catch(() => undefined);
  }
}
