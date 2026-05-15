export const PLATFORM_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const UPPER_BASE36_RE = /^[0-9A-Z]+$/;
const OVERLAY_PREFIX_RE = /^[0-9A-Z]{33}$/;

export const COMPACT_ACCOUNT_ID_LENGTH = 8;
export const WIDGET_CODE_LENGTH = 3;
export const COMPACT_INSTANCE_ID_LENGTH = 10;
export const OVERLAY_LANGUAGE_CODE_LENGTH = 4;
export const OVERLAY_EXPERIMENT_CODE_LENGTH = 3;
export const OVERLAY_PERSONALIZATION_CODE_LENGTH = 3;
export const OVERLAY_VERSION_LENGTH = 2;
export const OVERLAY_CHECKSUM_LENGTH = 2;

export const DEFAULT_OVERLAY_EXPERIMENT = 'A01';
export const DEFAULT_OVERLAY_PERSONALIZATION = '000';
export const DEFAULT_OVERLAY_VERSION = '00';

export const OVERLAY_ID_PREFIX_LENGTH =
  COMPACT_ACCOUNT_ID_LENGTH +
  WIDGET_CODE_LENGTH +
  COMPACT_INSTANCE_ID_LENGTH +
  OVERLAY_LANGUAGE_CODE_LENGTH +
  OVERLAY_EXPERIMENT_CODE_LENGTH +
  OVERLAY_PERSONALIZATION_CODE_LENGTH +
  OVERLAY_VERSION_LENGTH;

export const OVERLAY_ID_LENGTH = OVERLAY_ID_PREFIX_LENGTH + OVERLAY_CHECKSUM_LENGTH;

export type OverlayIdParts = {
  accountPublicId: string;
  widgetCode: string;
  instanceId: string;
  languageCode: string;
  experiment: string;
  personalization: string;
  version: string;
  checksum: string;
};

export type OverlayIdInput = Omit<OverlayIdParts, 'checksum'>;

export type OverlayIdParseFailure =
  | 'not_string'
  | 'invalid_length'
  | 'invalid_alphabet'
  | 'invalid_segment'
  | 'invalid_checksum';

export type OverlayIdParseResult =
  | { ok: true; value: OverlayIdParts }
  | { ok: false; reason: OverlayIdParseFailure; detail: string };

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

function requireSegment(value: string, width: number, label: string): string {
  if (!isUpperBase36(value, width)) {
    throw new Error(`overlay_id_segment_invalid:${label}`);
  }
  return value;
}

function toBase36Pair(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 36 * 36) {
    throw new Error('overlay_checksum_value_invalid');
  }
  const high = Math.floor(value / 36);
  const low = value % 36;
  return `${PLATFORM_ID_ALPHABET[high]}${PLATFORM_ID_ALPHABET[low]}`;
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

export function isCompactAccountPublicId(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, COMPACT_ACCOUNT_ID_LENGTH);
}

export function isCompactInstanceId(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, COMPACT_INSTANCE_ID_LENGTH);
}

export function isWidgetOverlayCode(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, WIDGET_CODE_LENGTH);
}

export function isOverlayLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, OVERLAY_LANGUAGE_CODE_LENGTH);
}

export function isOverlayExperimentCode(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, OVERLAY_EXPERIMENT_CODE_LENGTH);
}

export function isOverlayPersonalizationCode(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, OVERLAY_PERSONALIZATION_CODE_LENGTH);
}

export function isOverlayVersion(value: unknown): value is string {
  return typeof value === 'string' && isUpperBase36(value, OVERLAY_VERSION_LENGTH);
}

export function crc16XmodemAscii(value: string): number {
  let crc = 0;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= (value.charCodeAt(index) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export function computeOverlayIdChecksum(prefix: string): string {
  if (!OVERLAY_PREFIX_RE.test(prefix)) {
    throw new Error('overlay_id_prefix_invalid');
  }
  return toBase36Pair(crc16XmodemAscii(prefix) % (36 * 36));
}

export function buildOverlayId(input: OverlayIdInput): string {
  const prefix = [
    requireSegment(input.accountPublicId, COMPACT_ACCOUNT_ID_LENGTH, 'accountPublicId'),
    requireSegment(input.widgetCode, WIDGET_CODE_LENGTH, 'widgetCode'),
    requireSegment(input.instanceId, COMPACT_INSTANCE_ID_LENGTH, 'instanceId'),
    requireSegment(input.languageCode, OVERLAY_LANGUAGE_CODE_LENGTH, 'languageCode'),
    requireSegment(input.experiment, OVERLAY_EXPERIMENT_CODE_LENGTH, 'experiment'),
    requireSegment(input.personalization, OVERLAY_PERSONALIZATION_CODE_LENGTH, 'personalization'),
    requireSegment(input.version, OVERLAY_VERSION_LENGTH, 'version'),
  ].join('');
  return `${prefix}${computeOverlayIdChecksum(prefix)}`;
}

export function parseOverlayId(value: unknown): OverlayIdParseResult {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'not_string', detail: 'overlayId must be a string' };
  }
  if (value.length !== OVERLAY_ID_LENGTH) {
    return { ok: false, reason: 'invalid_length', detail: `overlayId must be ${OVERLAY_ID_LENGTH} characters` };
  }
  if (!UPPER_BASE36_RE.test(value)) {
    return { ok: false, reason: 'invalid_alphabet', detail: 'overlayId must use uppercase base36 characters' };
  }

  const parts: OverlayIdParts = {
    accountPublicId: value.slice(0, 8),
    widgetCode: value.slice(8, 11),
    instanceId: value.slice(11, 21),
    languageCode: value.slice(21, 25),
    experiment: value.slice(25, 28),
    personalization: value.slice(28, 31),
    version: value.slice(31, 33),
    checksum: value.slice(33, 35),
  };

  if (
    !isCompactAccountPublicId(parts.accountPublicId) ||
    !isWidgetOverlayCode(parts.widgetCode) ||
    !isCompactInstanceId(parts.instanceId) ||
    !isOverlayLanguageCode(parts.languageCode) ||
    !isOverlayExperimentCode(parts.experiment) ||
    !isOverlayPersonalizationCode(parts.personalization) ||
    !isOverlayVersion(parts.version)
  ) {
    return { ok: false, reason: 'invalid_segment', detail: 'overlayId has an invalid fixed-width segment' };
  }

  const expected = computeOverlayIdChecksum(value.slice(0, OVERLAY_ID_PREFIX_LENGTH));
  if (parts.checksum !== expected) {
    return { ok: false, reason: 'invalid_checksum', detail: `overlayId checksum ${parts.checksum} does not match ${expected}` };
  }

  return { ok: true, value: parts };
}

export function isOverlayId(value: unknown): value is string {
  return parseOverlayId(value).ok;
}

export function assertOverlayId(value: unknown): OverlayIdParts {
  const parsed = parseOverlayId(value);
  if (!parsed.ok) {
    throw new Error(`overlay_id_invalid:${parsed.reason}:${parsed.detail}`);
  }
  return parsed.value;
}
