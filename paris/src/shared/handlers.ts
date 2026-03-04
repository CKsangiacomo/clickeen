import type { Env } from './types';
import { json, readJson } from './http';
import { assertDevAuth } from './auth';
import { supabaseFetch } from './supabase';

export async function handleHealthz(): Promise<Response> {
  return json({ up: true });
}

type SchemaProbe = {
  table: string;
  select: string;
};

type SchemaProbeFailure = {
  table: string;
  status: number;
  detail: unknown;
};

const SCHEMA_PROBES: readonly SchemaProbe[] = [
  { table: 'widget_instances', select: 'public_id,account_id' },
  { table: 'curated_widget_instances', select: 'public_id,owner_account_id' },
  { table: 'widget_instance_overlays', select: 'public_id,layer,layer_key,account_id' },
  { table: 'l10n_generate_state', select: 'public_id,layer,layer_key,account_id' },
  { table: 'account_assets', select: 'asset_id,account_id' },
  { table: 'account_business_profiles', select: 'account_id,profile' },
];

async function runSchemaProbe(env: Env, probe: SchemaProbe): Promise<SchemaProbeFailure | null> {
  const params = new URLSearchParams({
    select: probe.select,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/${probe.table}?${params.toString()}`, { method: 'GET' });
  if (res.ok) return null;
  const detail = await readJson(res).catch(() => null);
  return {
    table: probe.table,
    status: res.status,
    detail,
  };
}

export async function handleSchemaHealthz(env: Env): Promise<Response> {
  const failures = (
    await Promise.all(SCHEMA_PROBES.map((probe) => runSchemaProbe(env, probe)))
  ).filter((failure): failure is SchemaProbeFailure => Boolean(failure));

  if (failures.length > 0) {
    return json(
      {
        up: false,
        schema: false,
        checkedAt: new Date().toISOString(),
        failures,
      },
      { status: 503 },
    );
  }

  return json({
    up: true,
    schema: true,
    checkedAt: new Date().toISOString(),
    probes: SCHEMA_PROBES.map((probe) => probe.table),
  });
}

export async function handleNotImplemented(req: Request, env: Env, feature: string): Promise<Response> {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return auth.response;
  return json({ error: 'NOT_IMPLEMENTED', feature }, { status: 501 });
}
