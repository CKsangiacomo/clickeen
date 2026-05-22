export function accountInstancesRoot(accountId: string): string {
  return `accounts/${accountId}/instances`;
}

export function accountInstanceRoot(accountId: string, widgetCode: string, instanceId: string): string {
  void widgetCode;
  return `${accountInstancesRoot(accountId)}/${instanceId}`;
}

export function accountInstanceDocumentKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.json`;
}

export function accountInstanceConfigKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.config.json`;
}

export function accountInstanceContentKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/instance.content.json`;
}

export function accountInstanceTranslationGenerationJobKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/translation-generation-job.json`;
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
