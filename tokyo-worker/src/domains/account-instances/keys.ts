export function accountInstancesRoot(accountId: string): string {
  return `accounts/${accountId}/instances`;
}

export function accountInstanceRoot(accountId: string, widgetCode: string, instanceId: string): string {
  void widgetCode;
  return `${accountInstancesRoot(accountId)}/${instanceId}`;
}

export function accountInstanceConfigKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.config.json`;
}

export function accountInstanceContentKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.content.json`;
}

export function accountInstanceServeStateKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/serve-state.json`;
}

export function accountInstanceLocaleOverlayKey(accountId: string, widgetCode: string, instanceId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/overlays/locales/${locale}.json`;
}

export function accountInstanceLocaleOverlaysPrefix(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/overlays/locales/`;
}

export function accountInstanceLocalePackageRoot(accountId: string, widgetCode: string, instanceId: string, locale: string): string {
  void widgetCode;
  return `${accountInstanceRoot(accountId, '', instanceId)}/locales/${locale}`;
}

export function accountInstanceLocalePackageFileKey(
  accountId: string,
  widgetCode: string,
  instanceId: string,
  locale: string,
  fileName: 'index.html' | 'styles.css' | 'runtime.js',
): string {
  return `${accountInstanceLocalePackageRoot(accountId, widgetCode, instanceId, locale)}/${fileName}`;
}
