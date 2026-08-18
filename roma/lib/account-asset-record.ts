const ASSET_REF_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

function isExactAccountAssetRef(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 240) return false;
  if (value.trim() !== value || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..' && ASSET_REF_SEGMENT_RE.test(segment));
}

export function isAccountAssetRef(value: unknown): value is string {
  return isExactAccountAssetRef(value);
}
