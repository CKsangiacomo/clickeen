export function accountInstancesRoot(accountId: string): string {
  return `accounts/${accountId}/instances`;
}

export function accountInstanceRoot(accountId: string, instanceId: string): string {
  return `${accountInstancesRoot(accountId)}/${instanceId}`;
}

export function accountInstanceSourceKey(accountId: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, instanceId)}/instance.source.json`;
}

export function accountInstanceServeStateKey(accountId: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, instanceId)}/serve-state.json`;
}

export function accountInstanceLocaleOverlayKey(accountId: string, instanceId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, instanceId)}/overlays/locales/${locale}.json`;
}

export function accountInstanceLocaleOverlaysPrefix(accountId: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, instanceId)}/overlays/locales/`;
}

export function accountInstanceCacheTag(accountId: string, instanceId: string): string {
  return `clk-instance-${accountId}-${instanceId}`;
}
