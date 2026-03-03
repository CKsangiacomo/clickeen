const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function splitPath(path: string): string[] {
  return String(path || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function setExistingStringAtPath(root: unknown, path: string, nextValue: string): void {
  const parts = splitPath(path);
  if (!parts.length) return;
  if (parts.some((seg) => PROHIBITED_SEGMENTS.has(seg))) return;

  let current: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const last = i === parts.length - 1;

    if (isIndex(part)) {
      const idx = Number(part);
      if (!Array.isArray(current)) return;
      if (idx < 0 || idx >= current.length) return;
      if (last) {
        if (typeof current[idx] !== 'string') return;
        current[idx] = nextValue;
        return;
      }
      current = current[idx];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    if (!(part in current)) return;
    if (last) {
      if (typeof current[part] !== 'string') return;
      current[part] = nextValue;
      return;
    }
    current = current[part];
  }
}

export function stripTextFromConfig(config: Record<string, unknown>, textPaths: string[]): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const path of textPaths) {
    if (!path) continue;
    setExistingStringAtPath(cloned, path, '');
  }
  return cloned;
}

export function applyTextPackToConfig(
  config: Record<string, unknown>,
  textPack: Record<string, string>,
): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const [path, value] of Object.entries(textPack)) {
    if (!path) continue;
    if (typeof value !== 'string') continue;
    setExistingStringAtPath(cloned, path, value);
  }
  return cloned;
}

type L10nSetOp = { op: 'set'; path: string; value: unknown };

export function applyL10nOpsToTextPack(
  basePack: Record<string, string>,
  ops: L10nSetOp[] | null | undefined,
): Record<string, string> {
  const next: Record<string, string> = { ...basePack };
  if (!Array.isArray(ops) || ops.length === 0) return next;

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    const path = typeof op.path === 'string' ? op.path.trim() : '';
    if (!path) continue;
    if (!(path in next)) continue;
    if (typeof op.value !== 'string') continue;
    next[path] = op.value;
  }

  return next;
}

export function materializeTextPack(args: {
  basePack: Record<string, string>;
  localeOps?: L10nSetOp[] | null;
  userOps?: L10nSetOp[] | null;
}): Record<string, string> {
  const afterLocale = applyL10nOpsToTextPack(args.basePack, args.localeOps);
  return applyL10nOpsToTextPack(afterLocale, args.userOps);
}
