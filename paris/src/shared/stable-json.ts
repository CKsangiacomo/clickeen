const UTF8_ENCODER = new TextEncoder();

function stableStringify(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function prettyStableJson(value: any): string {
  const normalized = stableStringify(value);
  const parsed = JSON.parse(normalized);
  return JSON.stringify(parsed, null, 2);
}

export async function sha256Hex(bytes: ArrayBuffer | ArrayBufferView): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function jsonSha256Hex(value: unknown): Promise<string> {
  const bytes = UTF8_ENCODER.encode(prettyStableJson(value));
  return sha256Hex(bytes);
}
