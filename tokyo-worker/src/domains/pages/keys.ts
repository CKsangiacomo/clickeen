export function accountPagesRoot(accountId: string): string {
  return `accounts/${accountId}/pages`;
}

export function accountPageRoot(accountId: string, pageId: string): string {
  return `${accountPagesRoot(accountId)}/${pageId}`;
}

export function accountPageSourceKey(accountId: string, pageId: string): string {
  return `${accountPageRoot(accountId, pageId)}/source.json`;
}

export function accountPageLocaleOverlayKey(accountId: string, pageId: string, locale: string): string {
  return `${accountPageRoot(accountId, pageId)}/overlays/locales/${locale}.json`;
}
