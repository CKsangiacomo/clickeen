import type { Env } from '../types';
import { encodeStableJson } from './account-instances/utils';

export async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  const bytes = encodeStableJson(payload);
  await env.TOKYO_R2.put(key, bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function putJsonIfUnchanged(
  env: Env,
  key: string,
  payload: unknown,
  httpEtag: string,
): Promise<boolean> {
  const bytes = encodeStableJson(payload);
  const result = await env.TOKYO_R2.put(key, bytes, {
    onlyIf: { etagMatches: normalizeConditionalEtag(httpEtag) },
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
  return result != null;
}

function normalizeConditionalEtag(httpEtag: string): string {
  const trimmed = httpEtag.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  try {
    const json = (await obj.json()) as T | null;
    if (json == null) throw new Error('json_null');
    return json;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`tokyo.storage.json_invalid:${key}:${detail}`);
  }
}

export async function loadJsonObject<T>(
  env: Env,
  key: string,
): Promise<{ value: T; httpEtag: string } | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  try {
    const json = (await obj.json()) as T | null;
    if (json == null) throw new Error('json_null');
    return { value: json, httpEtag: obj.httpEtag };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`tokyo.storage.json_invalid:${key}:${detail}`);
  }
}

export async function deletePrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined = undefined;
  do {
    const listed = await env.TOKYO_R2.list({ prefix, cursor });
    const keys = listed.objects.map((obj) => obj.key).filter((key) => Boolean(key));
    if (keys.length) {
      await env.TOKYO_R2.delete(keys);
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}
