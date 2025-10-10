// Soft AJV loader to avoid hard dependency during builds where ajv may be absent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorObject = any;
let AjvCtor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('module');
  const req = createRequire(__filename);
  AjvCtor = req('ajv');
} catch {
  AjvCtor = null;
}
import type { AdminClient } from '@paris/lib/supabaseAdmin';

type SchemaKey = string; // `${widgetType}:${schemaVersion}`

const ajv = AjvCtor ? new AjvCtor({ allErrors: true, strict: false }) : null;

interface CacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compiled: any;
  expiresAt: number;
}

const SCHEMA_TTL_MS = 10 * 60 * 1000; // 10 minutes
const schemaCache = new Map<SchemaKey, CacheEntry>();

export interface ValidationResult {
  ok: boolean;
  errors?: { path: string; message: string }[];
}

function keyFor(widgetType: string, schemaVersion: string) {
  return `${widgetType}:${schemaVersion}`;
}

async function fetchSchema(client: AdminClient, widgetType: string, schemaVersion: string) {
  const { data, error } = await client
    .from('widget_schemas')
    .select('schema')
    .eq('widget_type', widgetType)
    .eq('schema_version', schemaVersion)
    .maybeSingle();
  if (error) throw error;
  return (data?.schema as Record<string, unknown>) || null;
}

export async function getTemplateDescriptor(client: AdminClient, templateId: string) {
  const { data, error } = await client
    .from('widget_templates')
    .select('widget_type, schema_version, descriptor, defaults')
    .eq('template_id', templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    widgetType: data.widget_type as string,
    schemaVersion: data.schema_version as string,
    descriptor: (data.descriptor as Record<string, unknown>) ?? {},
    defaults: (data.defaults as Record<string, unknown>) ?? {},
  };
}

export async function validateConfig(
  client: AdminClient,
  widgetType: string,
  schemaVersion: string,
  config: unknown,
): Promise<ValidationResult> {
  const now = Date.now();
  const cacheKey = keyFor(widgetType, schemaVersion);
  let entry = schemaCache.get(cacheKey);

  if (!entry || entry.expiresAt <= now) {
    const schema = await fetchSchema(client, widgetType, schemaVersion);
    if (!schema) {
      return { ok: false, errors: [{ path: 'schemaVersion', message: 'unknown schema version' }] };
    }
    if (!ajv) {
      // No AJV available; accept-all fallback (Phase-1 build compatibility)
      // Log loudly to surface misconfiguration in environments where AJV is expected.
      // eslint-disable-next-line no-console
      console.error('[geneva] AJV module unavailable; using permissive fallback validator');
      const compiled: any = ((_: unknown) => true);
      compiled.errors = null;
      entry = { compiled, expiresAt: now + SCHEMA_TTL_MS };
      schemaCache.set(cacheKey, entry);
    } else {
      const compiled = ajv.compile(schema);
      entry = { compiled, expiresAt: now + SCHEMA_TTL_MS };
      schemaCache.set(cacheKey, entry);
    }
  }

  const valid = typeof entry.compiled === 'function' ? entry.compiled(config) : true;
  if (valid) return { ok: true };
  const errors = (entry.compiled.errors as ErrorObject[] | null | undefined)?.map((e) => ({
    path: e.instancePath?.replace(/^\//, '').replace(/\//g, '.') || (e.params as any)?.missingProperty || 'config',
    message: e.message || 'invalid value',
  })) ?? [{ path: 'config', message: 'invalid configuration' }];
  return { ok: false, errors };
}

function flatten(obj: any, prefix = '', acc: string[] = []): string[] {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as any, path, acc);
      else acc.push(path);
    }
  }
  return acc;
}

export async function transformConfig(
  client: AdminClient,
  widgetType: string,
  schemaVersion: string,
  inputConfig: Record<string, any>,
): Promise<{ config: Record<string, any>; dropped: string[]; added: string[]; errors?: { path: string; message: string }[] }>
{
  const schema = await fetchSchema(client, widgetType, schemaVersion);
  if (!schema) {
    return { config: inputConfig, dropped: [], added: [], errors: [{ path: 'schemaVersion', message: 'unknown schema version' }] };
  }
  // Use a separate AJV to transform (drop additional + apply defaults)
  if (!AjvCtor) {
    // No AJV available in this environment; return the original config without transform
    // eslint-disable-next-line no-console
    console.error('[geneva] AJV module unavailable; returning untransformed config');
    return { config: inputConfig, dropped: [], added: [] };
  }
  const ajvTransform = new AjvCtor({ allErrors: true, strict: false, removeAdditional: 'all', useDefaults: true });
  const validate = ajvTransform.compile(schema);
  const beforePaths = flatten(inputConfig);
  const clone = JSON.parse(JSON.stringify(inputConfig));
  const ok = validate(clone);
  const afterPaths = flatten(clone);
  const dropped = beforePaths.filter((p) => !afterPaths.includes(p));
  const added = afterPaths.filter((p) => !beforePaths.includes(p));
  if (!ok) {
    const errors = (validate.errors as ErrorObject[] | null | undefined)?.map((e) => ({
      path: e.instancePath?.replace(/^\//, '').replace(/\//g, '.') || (e.params as any)?.missingProperty || 'config',
      message: e.message || 'invalid value',
    })) ?? [{ path: 'config', message: 'invalid configuration' }];
    return { config: clone, dropped, added, errors };
  }
  return { config: clone, dropped, added };
}
