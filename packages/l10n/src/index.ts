const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;

export function normalizeLocaleToken(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value) return null;
  if (!LOCALE_PATTERN.test(value)) return null;
  return value;
}

export function localeCandidates(raw: unknown, supported?: Iterable<string>): string[] {
  const normalized = normalizeLocaleToken(raw);
  if (!normalized) return [];
  const base = normalized.split('-')[0] || '';
  if (!base) return [];

  const candidates = normalized === base ? [base] : [normalized, base];
  if (!supported) return candidates;

  const allowed = new Set(
    Array.from(supported)
      .map((value) => normalizeLocaleToken(value))
      .filter((value): value is string => Boolean(value)),
  );

  return candidates.filter((value) => allowed.has(value));
}

export type CanonicalLocaleEntry = {
  code: string;
  nativeLabel?: string;
  labels?: Record<string, string>;
};

export function normalizeCanonicalLocalesFile(raw: unknown): CanonicalLocaleEntry[] {
  if (!Array.isArray(raw)) return [];

  const out: CanonicalLocaleEntry[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry === 'string') {
      const code = normalizeLocaleToken(entry);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push({ code });
      continue;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const code = normalizeLocaleToken((entry as any).code);
    if (!code || seen.has(code)) continue;

    const nativeLabelRaw = typeof (entry as any).nativeLabel === 'string' ? (entry as any).nativeLabel.trim() : '';
    const nativeLabel = nativeLabelRaw ? nativeLabelRaw : undefined;

    const labelsRaw = (entry as any).labels;
    const labels: Record<string, string> = {};
    if (labelsRaw && typeof labelsRaw === 'object' && !Array.isArray(labelsRaw)) {
      for (const [rawKey, rawValue] of Object.entries(labelsRaw)) {
        const key = normalizeLocaleToken(rawKey);
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (!key || !value) continue;
        labels[key] = value;
      }
    }

    seen.add(code);
    out.push({
      code,
      nativeLabel,
      labels: Object.keys(labels).length ? labels : undefined,
    });
  }

  return out;
}

export function resolveLocaleLabel(args: {
  locales: CanonicalLocaleEntry[];
  uiLocale: string;
  targetLocale: string;
}): string {
  const target = normalizeLocaleToken(args.targetLocale);
  if (!target) return String(args.targetLocale || '').trim() || 'Unknown';

  const ui = normalizeLocaleToken(args.uiLocale) ?? 'en';
  const entry = args.locales.find((item) => normalizeLocaleToken(item.code) === target) ?? null;

  const candidates = entry?.labels ? localeCandidates(ui, Object.keys(entry.labels)) : [];
  for (const candidate of candidates) {
    const label = entry?.labels?.[candidate];
    if (label) return label;
  }

  if (entry?.nativeLabel) return entry.nativeLabel;

  try {
    const display = new Intl.DisplayNames([ui], { type: 'language' });
    const label = display.of(target);
    return label || target;
  } catch {
    return target;
  }
}
