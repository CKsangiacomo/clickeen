import { NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

const OUTCOME_EVENTS = new Set([
  'signup_started',
  'signup_completed',
  'upgrade_clicked',
  'upgrade_completed',
  'cta_clicked',
  'ux_keep',
  'ux_undo',
]);

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isValidOutcomePayload(value: unknown): value is {
  requestId: string;
  sessionId: string;
  event: string;
  occurredAtMs: number;
  timeToDecisionMs?: number;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as any;

  const requestId = asTrimmedString(v.requestId);
  const sessionId = asTrimmedString(v.sessionId);
  const event = asTrimmedString(v.event);
  const occurredAtMs = v.occurredAtMs;
  const timeToDecisionMs = v.timeToDecisionMs;

  if (!requestId) return false;
  if (!sessionId) return false;
  if (!event || !OUTCOME_EVENTS.has(event)) return false;
  if (typeof occurredAtMs !== 'number' || !Number.isFinite(occurredAtMs)) return false;
  if (timeToDecisionMs !== undefined && (typeof timeToDecisionMs !== 'number' || !Number.isFinite(timeToDecisionMs) || timeToDecisionMs < 0)) {
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!isValidOutcomePayload(body)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid outcome payload' },
        { status: 200, headers: { 'cache-control': 'no-store' } },
      );
    }

    const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/ai/outcome`;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (PARIS_DEV_JWT) headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: text || `Outcome attach failed (${res.status})` },
        { status: 200, headers: { 'cache-control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { ok: true, data: safeJsonParse(text) },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: message || 'Outcome attach failed' },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  }
}

