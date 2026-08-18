const ACCOUNT_SHELL_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to continue.',
  'coreui.errors.auth.contextUnavailable': 'This account is unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to view this account.',
  'coreui.errors.db.readFailed': 'Loading failed. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving failed. Please try again.',
  'coreui.errors.payload.invalid': 'Something did not load correctly. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.instance.publishInProgress':
    'Another Publish is finishing. Please try again in a moment.',
  'coreui.errors.account.memberNotFound': 'That team member could not be found.',
  'coreui.errors.account.invitationNotFound': 'That invitation could not be found.',
  'roma.errors.proxy.tokyo_unavailable': 'Widget delivery is unavailable right now. Please try again.',
  'tokyo.errors.publicCache.purgeConfigMissing':
    'Public delivery cache is not configured. Please try again after it is configured.',
  'tokyo.errors.publicCache.purgeFailed':
    'Public delivery could not be refreshed. Please try again.',
};

export function resolveAccountShellReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

export function resolveAccountShellErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = ACCOUNT_SHELL_REASON_COPY[normalized];
  if (mapped) return mapped;
  return fallback;
}

export function resolveCommittedPublicationFailureCopy(
  status: 'published' | 'unpublished',
  reason: string,
  fallback: string,
): string {
  if (reason === 'tokyo.errors.publicCache.purgeConfigMissing') {
    return status === 'published'
      ? 'Published, but public delivery cache is not configured. Republish after it is configured.'
      : 'Unpublished, but public delivery cache is not configured. Retry public delivery after it is configured.';
  }
  if (reason === 'tokyo.errors.publicCache.purgeFailed') {
    return status === 'published'
      ? 'Published, but public delivery could not be refreshed. Republish to retry.'
      : 'Unpublished, but public delivery could not be refreshed. Retry public delivery.';
  }
  return fallback;
}
