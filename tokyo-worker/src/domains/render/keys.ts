export function accountWidgetsRoot(accountId: string): string {
  return `accounts/${accountId}/widgets`;
}

export function accountWidgetRoot(accountId: string, widgetCode: string): string {
  return `${accountWidgetsRoot(accountId)}/${widgetCode}`;
}

export function accountWidgetDocumentKey(accountId: string, widgetCode: string): string {
  return `${accountWidgetRoot(accountId, widgetCode)}/widget.json`;
}

export function accountInstanceRoot(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountWidgetRoot(accountId, widgetCode)}/${instanceId}`;
}

export function accountInstanceIndexKey(accountId: string): string {
  return `${accountWidgetsRoot(accountId)}/index.json`;
}

export function accountInstanceDocumentKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.json`;
}

export function accountInstanceConfigKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/config.json`;
}

export function accountInstancePublishKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/publish.json`;
}

export function accountInstancePublishedConfigKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/published/config.json`;
}

export function accountInstanceOverlayObjectKey(
  accountId: string,
  widgetCode: string,
  instanceId: string,
  overlayId: string,
): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/overlays/${overlayId}.json`;
}

export function accountInstanceOverlayObjectPrefix(
  accountId: string,
  widgetCode: string,
  instanceId: string,
  overlayIdPrefix = '',
): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/overlays/${overlayIdPrefix}`;
}

export function accountInstanceSelectedOverlayKey(
  accountId: string,
  widgetCode: string,
  instanceId: string,
  languageCode: string,
  experiment: string,
  personalization: string,
): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/selected-overlays/${languageCode}/${experiment}/${personalization}.json`;
}

export function accountInstanceSelectedOverlayPrefix(
  accountId: string,
  widgetCode: string,
  instanceId: string,
): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/selected-overlays/`;
}

export function accountInstanceRenderMetaLivePointerKey(accountId: string, widgetCode: string, instanceId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/seo/meta/live/${locale}.json`;
}

export function accountInstanceRenderMetaPackKey(accountId: string, widgetCode: string, instanceId: string, locale: string, metaFp: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/seo/meta/${locale}/${metaFp}.json`;
}

export function publishedWidgetLookupKey(instanceId: string): string {
  return `published/widgets/${instanceId}.json`;
}
