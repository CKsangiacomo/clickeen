import { isRecord } from '@clickeen/ck-contracts';
import rawMatrix from '../entitlements.matrix.json';
import type { EntitlementKind, EntitlementsMatrix, PolicyProfile } from './types';

const REQUIRED_TIERS: PolicyProfile[] = ['free', 'tier1', 'tier2', 'tier3', 'tier4'];
const VALID_KINDS: EntitlementKind[] = ['flag', 'limit'];

let cachedMatrix: EntitlementsMatrix | null = null;

function assertTier(value: unknown): PolicyProfile {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('[ck-policy] Entitlements matrix tiers must be non-empty strings');
  }
  const trimmed = value.trim() as PolicyProfile;
  if (!REQUIRED_TIERS.includes(trimmed)) {
    throw new Error(`[ck-policy] Unknown policy tier: ${trimmed}`);
  }
  return trimmed;
}

function assertKind(value: unknown): EntitlementKind {
  if (typeof value !== 'string') {
    throw new Error('[ck-policy] Entitlements matrix entitlement.kind must be a string');
  }
  const trimmed = value.trim() as EntitlementKind;
  if (!VALID_KINDS.includes(trimmed)) {
    throw new Error(`[ck-policy] Unknown entitlement kind: ${trimmed}`);
  }
  return trimmed;
}

function assertMatrix(input: unknown): EntitlementsMatrix {
  if (!isRecord(input)) {
    throw new Error('[ck-policy] Entitlements matrix must be an object');
  }
  if (input.v !== 1) {
    throw new Error('[ck-policy] Entitlements matrix v must be 1');
  }
  const tiersRaw = input.tiers;
  if (!Array.isArray(tiersRaw)) {
    throw new Error('[ck-policy] Entitlements matrix tiers must be an array');
  }
  const tiers = tiersRaw.map(assertTier);
  for (const tier of REQUIRED_TIERS) {
    if (!tiers.includes(tier)) {
      throw new Error(`[ck-policy] Entitlements matrix missing tier: ${tier}`);
    }
  }

  const entitlementsRaw = input.entitlements;
  if (!isRecord(entitlementsRaw)) {
    throw new Error('[ck-policy] Entitlements matrix entitlements must be an object');
  }

  const entitlements: EntitlementsMatrix['entitlements'] = {};
  for (const [key, entry] of Object.entries(entitlementsRaw)) {
    if (!key.trim()) throw new Error('[ck-policy] Entitlements matrix entitlement keys must be non-empty strings');
    if (!isRecord(entry)) {
      throw new Error(`[ck-policy] Entitlements matrix entitlement ${key} must be an object`);
    }
    const kind = assertKind(entry.kind);
    if (!isRecord(entry.values)) {
      throw new Error(`[ck-policy] Entitlements matrix entitlement ${key} values must be an object`);
    }
    const values: Record<PolicyProfile, boolean | number | null> = {} as Record<
      PolicyProfile,
      boolean | number | null
    >;
    for (const tier of REQUIRED_TIERS) {
      const value = entry.values[tier];
      if (kind === 'flag') {
        if (typeof value !== 'boolean') {
          throw new Error(`[ck-policy] Entitlements matrix ${key}.${tier} must be boolean`);
        }
        values[tier] = value;
      } else {
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
          throw new Error(`[ck-policy] Entitlements matrix ${key}.${tier} must be number or null`);
        }
        values[tier] = value as number | null;
      }
    }
    entitlements[key] = { kind, values };
  }

  return { v: 1, tiers, entitlements };
}

export function getEntitlementsMatrix(): EntitlementsMatrix {
  if (!cachedMatrix) {
    cachedMatrix = assertMatrix(rawMatrix);
  }
  return cachedMatrix;
}
