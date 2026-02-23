import type { Policy } from '@clickeen/ck-policy';
import type { WorkspaceRow } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { normalizeLocaleList } from '../../shared/l10n';

function requirePolicyCap(policy: Policy, key: string): number | null {
  if (!(key in policy.caps)) {
    throw new Error(`[ParisWorker] Policy missing cap key: ${key}`);
  }
  return policy.caps[key] as number | null;
}

export function readWorkspaceLocales(workspace: WorkspaceRow): Response | { locales: string[] } {
  const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
  if (!normalized.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.workspace.locales.invalid',
        detail: JSON.stringify(normalized.issues),
      },
      500,
    );
  }
  return { locales: normalized.locales };
}

export function resolveWorkspaceActiveLocales(args: {
  workspace: WorkspaceRow;
}): Response | { locales: string[] } {
  const configured = readWorkspaceLocales(args.workspace);
  if (configured instanceof Response) return configured;
  return configured;
}

export function enforceL10nSelection(policy: Policy, locales: string[]) {
  const maxLocalesTotal = requirePolicyCap(policy, 'l10n.locales.max');
  const maxAdditional = maxLocalesTotal == null ? null : Math.max(0, maxLocalesTotal - 1);
  if (maxAdditional != null && locales.length > maxAdditional) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.capReached',
        upsell: 'UP',
        detail: `l10n.locales.max=${maxLocalesTotal}`,
      },
      403,
    );
  }
  const maxCustom = requirePolicyCap(policy, 'l10n.locales.custom.max');
  if (maxCustom != null) {
    // Some tiers reserve a subset of locale slots for system-chosen locales (e.g. Free = EN + GEO).
    const systemReserved = maxAdditional == null ? 0 : Math.max(0, maxAdditional - maxCustom);
    const customCount = Math.max(0, locales.length - systemReserved);
    if (customCount > maxCustom) {
      return ckError(
        {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.capReached',
          upsell: 'UP',
          detail: `l10n.locales.custom.max=${maxCustom}`,
        },
        403,
      );
    }
  }
  return null;
}

export function enforceLayerEntitlement(_policy: Policy, _layer: string): Response | null {
  return null;
}
