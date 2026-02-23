import type { RomaBootstrapDomainKey, RomaMeResponse } from './use-roma-me';

export const ROMA_BOOTSTRAP_DOMAIN_UNAVAILABLE_KEY = 'roma.errors.bootstrap.domain_unavailable';
export const ROMA_BOOTSTRAP_DOMAIN_CONTRACT_VIOLATION_KEY = 'roma.errors.bootstrap.domain_contract_violation';

type RomaBootstrapDomainState =
  | {
      kind: 'ok';
      titleKey: null;
      reasonKey: null;
    }
  | {
      kind: 'degraded' | 'contract_violation';
      titleKey: string;
      reasonKey: string;
    };

export function resolveBootstrapDomainState(args: {
  data: RomaMeResponse | null;
  domainKey: RomaBootstrapDomainKey;
  hasDomainPayload: boolean;
}): RomaBootstrapDomainState {
  const domainError = args.data?.domainErrors?.[args.domainKey] ?? null;
  if (domainError?.reasonKey) {
    return {
      kind: 'degraded',
      titleKey: ROMA_BOOTSTRAP_DOMAIN_UNAVAILABLE_KEY,
      reasonKey: domainError.reasonKey,
    };
  }
  if (args.hasDomainPayload) {
    return {
      kind: 'ok',
      titleKey: null,
      reasonKey: null,
    };
  }
  return {
    kind: 'contract_violation',
    titleKey: ROMA_BOOTSTRAP_DOMAIN_CONTRACT_VIOLATION_KEY,
    reasonKey: ROMA_BOOTSTRAP_DOMAIN_CONTRACT_VIOLATION_KEY,
  };
}
