import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';

export function normalizePageId(value: unknown): string | null {
  return isCompactPageId(value) ? value : null;
}
