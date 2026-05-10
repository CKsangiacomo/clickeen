export function accountWidgetsRoot(accountId: string): string {
  return `accounts/${accountId}/widgets`;
}

export function accountWidgetRoot(accountId: string, widgetType: string): string {
  return `${accountWidgetsRoot(accountId)}/${widgetType}`;
}

export function accountWidgetDocumentKey(accountId: string, widgetType: string): string {
  return `${accountWidgetRoot(accountId, widgetType)}/widget.json`;
}

export function accountInstanceRoot(accountId: string, widgetType: string, instanceId: string): string {
  return `${accountWidgetRoot(accountId, widgetType)}/${instanceId}`;
}

export function accountInstanceIndexKey(accountId: string): string {
  return `${accountWidgetsRoot(accountId)}/index.json`;
}

export function accountInstanceDocumentKey(accountId: string, widgetType: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/instance.json`;
}

export function accountInstanceConfigKey(accountId: string, widgetType: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/config.json`;
}

export function accountInstancePublishKey(accountId: string, widgetType: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/publish.json`;
}

export function accountInstancePublishedConfigKey(accountId: string, widgetType: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/published/config.json`;
}

export function accountInstanceL10nBaseSnapshotKey(
  accountId: string,
  widgetType: string,
  instanceId: string,
  baseFingerprint: string,
): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/l10n/base/${baseFingerprint}.snapshot.json`;
}

export function accountInstanceL10nOverlayKey(
  accountId: string,
  widgetType: string,
  instanceId: string,
  locale: string,
): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/overlays/l10n/${locale}/overlay.json`;
}

export function accountInstanceL10nOverlayPrefix(
  accountId: string,
  widgetType: string,
  instanceId: string,
  locale?: string,
): string {
  const root = `${accountInstanceRoot(accountId, widgetType, instanceId)}/overlays/l10n`;
  return locale ? `${root}/${locale}/` : `${root}/`;
}

export function accountInstanceRenderMetaLivePointerKey(accountId: string, widgetType: string, instanceId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/seo/meta/live/${locale}.json`;
}

export function accountInstanceRenderMetaPackKey(accountId: string, widgetType: string, instanceId: string, locale: string, metaFp: string): string {
  return `${accountInstanceRoot(accountId, widgetType, instanceId)}/seo/meta/${locale}/${metaFp}.json`;
}

export function publishedWidgetLookupKey(instanceId: string): string {
  return `published/widgets/${instanceId}.json`;
}
