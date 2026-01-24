import type { CuratedInstanceKind, CuratedInstanceRow, Env, InstanceKind, InstanceRow } from './types';
import { asTrimmedString } from './validation';

export function assertWidgetType(widgetType: unknown) {
  const value = asTrimmedString(widgetType);
  if (!value) return { ok: false as const, issues: [{ path: 'widgetType', message: 'widgetType is required' }] };
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    return { ok: false as const, issues: [{ path: 'widgetType', message: 'invalid widgetType format' }] };
  }
  return { ok: true as const, value };
}

export function assertPublicId(publicId: unknown) {
  const value = asTrimmedString(publicId);
  if (!value) return { ok: false as const, issues: [{ path: 'publicId', message: 'publicId is required' }] };
  const okMain = /^wgt_main_[a-z0-9][a-z0-9_-]*$/.test(value);
  const okCurated =
    /^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/.test(value);
  const okUser = /^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$/.test(value);
  if (!okMain && !okCurated && !okUser) {
    return { ok: false as const, issues: [{ path: 'publicId', message: 'invalid publicId format' }] };
  }
  return { ok: true as const, value };
}

export function inferInstanceKindFromPublicId(publicId: string): InstanceKind {
  if (/^wgt_curated_/.test(publicId)) return 'curated';
  if (/^wgt_main_[a-z0-9][a-z0-9_-]*$/.test(publicId)) return 'curated';
  return 'user';
}

export function isCuratedPublicId(publicId: string): boolean {
  return inferInstanceKindFromPublicId(publicId) === 'curated';
}

export function allowCuratedWrites(env: Env): boolean {
  const stage = (asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev').toLowerCase();
  return stage === 'local' || stage === 'cloud-dev';
}

export function isCuratedInstanceRow(instance: InstanceRow | CuratedInstanceRow): instance is CuratedInstanceRow {
  return 'widget_type' in instance;
}

export function resolveCuratedRowKind(publicId: string): CuratedInstanceKind {
  return publicId.startsWith('wgt_main_') ? 'baseline' : 'curated';
}

export function resolveInstanceKind(instance: InstanceRow | CuratedInstanceRow): InstanceKind {
  if (isCuratedInstanceRow(instance)) return 'curated';
  const inferred = inferInstanceKindFromPublicId(instance.public_id);
  if (inferred === 'curated') return 'curated';
  if (instance.kind === 'curated' || instance.kind === 'user') return instance.kind;
  return inferred;
}

export function resolveInstanceWorkspaceId(instance: InstanceRow | CuratedInstanceRow): string | null {
  if (isCuratedInstanceRow(instance)) return null;
  return instance.workspace_id ?? null;
}
