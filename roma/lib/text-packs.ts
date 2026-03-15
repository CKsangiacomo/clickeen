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
