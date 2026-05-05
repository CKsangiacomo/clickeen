export type TicketConsumeResult<T> =
  | { outcome: 'ok'; ticket: T }
  | { outcome: 'missing' | 'expired' | 'alreadyConsumed' | 'storeUnavailable' };

type TicketKind = 'state' | 'finish';

type TicketValidator<T> = (value: unknown) => T | null;

type TicketStoreEnv = {
  BERLIN_AUTH_TICKETS?: DurableObjectNamespace;
};

type StoredTicket = {
  v: 1;
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
  const version = claimAsNumber(record.v);
  const kind = claimAsString(record.kind);
  const expiresAt = claimAsNumber(record.expiresAt);
  const consumedAt = claimAsNumber(record.consumedAt) || undefined;
  const consumeOutcome = claimAsString(record.consumeOutcome) || undefined;
  const cleanupAt = claimAsNumber(record.cleanupAt);
  if (version !== 1) return null;
  if (kind !== 'state' && kind !== 'finish') return null;
  if (!expiresAt || expiresAt <= 0) return null;
  if (!cleanupAt || cleanupAt <= 0) return null;
  if (consumeOutcome !== undefined && consumeOutcome !== 'consumed' && consumeOutcome !== 'expired') return null;
  return {
    v: 1,
    kind,
    payload: record.payload,
    expiresAt,
    ...(consumedAt ? { consumedAt } : {}),
    ...(consumeOutcome ? { consumeOutcome } : {}),
    cleanupAt,
  };
}

async function readJsonBody(request: Request): Promise<JsonRecord | null> {
  const parsed = (await request.json().catch(() => null)) as unknown;
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
  const body = readObject(await response.json().catch(() => null));
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

  const body = readObject(await response.json().catch(() => null));
  if (!response.ok || !body) return { outcome: 'missing' };

  const outcome = claimAsString(body.outcome);
  if (outcome === 'missing' || outcome === 'expired' || outcome === 'alreadyConsumed') return { outcome };
  if (outcome !== 'ok') return { outcome: 'missing' };

  const ticket = validator(body.ticket);
  if (!ticket) return { outcome: 'missing' };
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
      v: 1,
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

    const current = toStoredTicket(await this.state.storage.get(STORAGE_KEY));
    if (!current || current.kind !== expectedKind) {
      return json({ ok: true, outcome: 'missing' });
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
    const current = toStoredTicket(await this.state.storage.get(STORAGE_KEY));
    if (!current) {
      await this.state.storage.deleteAll().catch(() => undefined);
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
