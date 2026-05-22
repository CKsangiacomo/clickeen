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

export function accountInstanceTranslationGenerationJobKey(accountId: string, widgetCode: string, instanceId: string): string {
  return `${accountInstanceRoot(accountId, widgetCode, instanceId)}/translation-generation-job.json`;
}
