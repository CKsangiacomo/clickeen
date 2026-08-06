export function accountPagesRoot(accountId: string): string {
  return `accounts/${accountId}/pages`;
}

export function accountPageRoot(accountId: string, pageId: string): string {
  return `${accountPagesRoot(accountId)}/${pageId}`;
}

export function accountPageSourceKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/source.json`;
}

export function accountPageServeStateKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/serve-state.json`;
}

export function accountPageServingOverlaysKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/overlays.json`;
}

export function accountPageIndexKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/index.html`;
}

export function accountPageStylesKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/styles.css`;
}

export function accountPageRuntimeKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/runtime.js`;
}

export function accountPageLocaleOverlayKey(accountId: string, pageId: string, locale: string): string {
  return `${accountPageRoot(accountId, pageId)}/overlays/locales/${locale}.json`;
}
