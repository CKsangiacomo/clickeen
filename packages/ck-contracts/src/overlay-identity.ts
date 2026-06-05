export const PLATFORM_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const UPPER_BASE36_RE = /^[0-9A-Z]+$/;

export const COMPACT_ACCOUNT_ID_LENGTH = 8;
export const WIDGET_CODE_LENGTH = 3;
export const COMPACT_INSTANCE_ID_LENGTH = 10;
export const COMPACT_PAGE_ID_LENGTH = 10;

type RandomBytesSource = (length: number) => Uint8Array;

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new Error('platform_random_unavailable');
  }
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function isUpperBase36(value: string, width: number): boolean {
  return value.length === width && UPPER_BASE36_RE.test(value);
}

export function createUpperBase36Id(length: number, randomBytes: RandomBytesSource = defaultRandomBytes): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('platform_id_length_invalid');
  }
  let out = '';
  const rejectionLimit = Math.floor(256 / PLATFORM_ID_ALPHABET.length) * PLATFORM_ID_ALPHABET.length;
  while (out.length < length) {
    const bytes = randomBytes(Math.max(16, (length - out.length) * 2));
    for (const byte of bytes) {
      if (byte >= rejectionLimit) continue;
      out += PLATFORM_ID_ALPHABET[byte % PLATFORM_ID_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function createCompactAccountPublicId(randomBytes?: RandomBytesSource): string {
  return createUpperBase36Id(COMPACT_ACCOUNT_ID_LENGTH, randomBytes);
}

export function createCompactInstanceId(randomBytes?: RandomBytesSource): string {
  return createUpperBase36Id(COMPACT_INSTANCE_ID_LENGTH, randomBytes);
}

export function createCompactPageId(randomBytes?: RandomBytesSource): string {
  return createUpperBase36Id(COMPACT_PAGE_ID_LENGTH, randomBytes);
}

export function isCompactAccountPublicId(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, COMPACT_ACCOUNT_ID_LENGTH);
}

export function isCompactInstanceId(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, COMPACT_INSTANCE_ID_LENGTH);
}

export function isCompactPageId(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, COMPACT_PAGE_ID_LENGTH);
}

export function isWidgetOverlayCode(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, WIDGET_CODE_LENGTH);
}
