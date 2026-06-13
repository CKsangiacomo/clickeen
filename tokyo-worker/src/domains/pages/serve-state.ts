import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { Env } from '../../types';
import { putJson } from '../storage';
import { accountPageServeStateKey } from './keys';
import { normalizePageId } from './source';
import type { PageServeState } from './types';
import { PageOperationError } from './types';
type PageCoordinate = { accountId: string; pageId: string };
function fail(kind: 'VALIDATION' | 'NOT_FOUND', reasonKey: string): never {
  throw new PageOperationError({ kind, reasonKey });
}
function assertPageCoordinate(args: { accountId: string; pageId: string }): PageCoordinate {
  const accountId = String(args.accountId || '').trim().toUpperCase();
  const pageId = normalizePageId(args.pageId);
  if (!isCompactAccountPublicId(accountId)) fail('VALIDATION', 'tokyo.errors.page.invalidAccount');
  if (!pageId) fail('VALIDATION', 'tokyo.errors.page.invalidPageId');
  return { accountId, pageId };
}
function serveStatePayload(coordinate: PageCoordinate, status: PageServeState, now = new Date().toISOString()) {
  return { v: 1, accountId: coordinate.accountId, pageId: coordinate.pageId, status, ...(status === 'published' ? { publishedAt: now } : {}), updatedAt: now };
}
async function readStoredServeState(env: Env, coordinate: PageCoordinate): Promise<PageServeState> {
  const obj = await env.TOKYO_R2.get(accountPageServeStateKey(coordinate.accountId, coordinate.pageId));
  if (!obj) fail('NOT_FOUND', 'tokyo.errors.page.serveStateMissing');
  const record = await obj.json().catch(() => null) as Record<string, unknown> | null;
  if (!record || Array.isArray(record) || record.v !== 1 || record.accountId !== coordinate.accountId || record.pageId !== coordinate.pageId || (record.status !== 'published' && record.status !== 'unpublished') || typeof record.updatedAt !== 'string' || !record.updatedAt) fail('VALIDATION', 'tokyo.errors.page.serveStateInvalid');
  return record.status;
}
export async function readAccountPageServeState(args: { env: Env; accountId: string; pageId: string }): Promise<PageServeState> {
  return readStoredServeState(args.env, assertPageCoordinate(args));
}
export async function createAccountPageServeState(args: { env: Env; accountId: string; pageId: string; now?: string }): Promise<PageServeState> {
  const coordinate = assertPageCoordinate(args);
  await putJson(args.env, accountPageServeStateKey(coordinate.accountId, coordinate.pageId), serveStatePayload(coordinate, 'unpublished', args.now));
  return 'unpublished';
}
export async function writeAccountPageServeState(args: { env: Env; accountId: string; pageId: string; status: PageServeState; now?: string }): Promise<{ status: PageServeState; changed: boolean }> {
  const coordinate = assertPageCoordinate(args);
  if (args.status !== 'published' && args.status !== 'unpublished') fail('VALIDATION', 'tokyo.errors.page.serveStateInvalid');
  const previous = await readStoredServeState(args.env, coordinate);
  await putJson(args.env, accountPageServeStateKey(coordinate.accountId, coordinate.pageId), serveStatePayload(coordinate, args.status, args.now));
  return { status: args.status, changed: previous !== args.status };
}
