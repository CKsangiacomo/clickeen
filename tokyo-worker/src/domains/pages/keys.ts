export function accountWebsiteRoot(accountId: string): string {
  return `accounts/${accountId}/website`;
}

export function accountPagesRoot(accountId: string): string {
  return `${accountWebsiteRoot(accountId)}/pages`;
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

export function accountPagesIndexKey(accountId: string): string {
  return `${accountPagesRoot(accountId)}/index.json`;
}

export function accountWebsiteIndexesRoot(accountId: string): string {
  return `${accountWebsiteRoot(accountId)}/indexes`;
}

export function accountPlacementIndexKey(accountId: string, instanceId: string): string {
  return `${accountWebsiteIndexesRoot(accountId)}/placements/${instanceId}.json`;
}

export function accountPagePublishRoot(accountId: string, pageId: string): string {
  return `${accountWebsiteRoot(accountId)}/publishes/${pageId}`;
}

export function accountPagePublishFileKey(accountId: string, pageId: string, fileName: 'index.html' | 'styles.css' | 'runtime.js'): string {
  return `${accountPagePublishRoot(accountId, pageId)}/${fileName}`;
}
