export type PublicPackageServeMetadataObject = {
  httpMetadata?: { contentType?: string | null } | null;
};

export function publicPackageContentType(object: PublicPackageServeMetadataObject): string | null {
  const contentType = object.httpMetadata?.contentType;
  return typeof contentType === 'string' && contentType.length > 0 && contentType === contentType.trim()
    ? contentType
    : null;
}
