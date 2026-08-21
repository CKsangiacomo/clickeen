const ASSET_REF_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

function isExactAccountAssetRef(value: unknown): value is string {
  return typeof value === 'string' && ASSET_REF_SEGMENT_RE.test(value);
}

export function isAccountAssetRef(value: unknown): value is string {
  return isExactAccountAssetRef(value);
}
