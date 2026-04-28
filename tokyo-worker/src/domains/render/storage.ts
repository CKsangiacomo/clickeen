import type { Env } from '../../types';
import { encodeStableJson } from './utils';

export async function putJson(env: Env, key: string, payload: unknown): Promise<void> {
  const bytes = encodeStableJson(payload);
  await env.TOKYO_R2.put(key, bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function loadJson<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.TOKYO_R2.get(key);
  if (!obj) return null;
  const json = (await obj.json().catch(() => null)) as T | null;
  return json ?? null;
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
