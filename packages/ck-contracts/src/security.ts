const TEXT_ENCODER = new TextEncoder();

function bytesFromInput(input: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (typeof input === 'string') return TEXT_ENCODER.encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

export function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export function timingSafeEqualString(left: string, right: string): boolean {
  return timingSafeEqualBytes(TEXT_ENCODER.encode(left), TEXT_ENCODER.encode(right));
}

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = bytesFromInput(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
