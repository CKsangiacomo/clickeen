import {
  localePackagePhaseFromRouteFailure,
  type LocalePackagePhase,
} from './account-instance-locale-package';

export type LocalePackageFailureCoordinate = {
  accountId: string;
  instanceId: string;
  locale: string;
  phase: LocalePackagePhase;
  reasonKey: string;
  detail?: string;
};

export function buildLocalePackageDeleteFailureCoordinate(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  reasonKey: string;
  detail?: string;
}): LocalePackageFailureCoordinate {
  return {
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
    phase: localePackagePhaseFromRouteFailure(
      { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: args.reasonKey },
      'locale-package-delete',
    ),
    reasonKey: args.reasonKey,
    ...(args.detail ? { detail: args.detail } : {}),
  };
}
