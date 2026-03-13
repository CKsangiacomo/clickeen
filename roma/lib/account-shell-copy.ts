const ACCOUNT_SHELL_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to continue.',
  'coreui.errors.auth.contextUnavailable': 'This workspace is unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to view this workspace.',
  'coreui.errors.db.readFailed': 'Loading failed. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving failed. Please try again.',
  'coreui.errors.payload.invalid': 'The server returned invalid data. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
  'coreui.errors.account.memberNotFound': 'That team member could not be found.',
  'coreui.errors.account.invitationNotFound': 'That invitation could not be found.',
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
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.') || normalized.startsWith('roma.')) {
    return fallback;
  }
  return normalized;
}
