import { createTranslator, loadI18nCatalog, loadI18nManifest, resolveLocale } from './loader';

type TranslationRef = { $t: string; count?: number; params?: Record<string, unknown> };

function isTranslationRef(value: unknown): value is TranslationRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.$t === 'string' && obj.$t.trim().length > 0;
}

function safeJsonParse(value: string): unknown {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export async function applyI18nToDom(scope: HTMLElement, widgetname: string | null): Promise<void> {
  const locale = resolveLocale();
  const manifest = await loadI18nManifest();
  const dir = manifest.locales?.[locale]?.dir ?? manifest.locales?.en?.dir ?? 'ltr';
  document.documentElement.dir = dir;

  const coreui = await loadI18nCatalog(locale, 'coreui');
  const widget = widgetname ? await loadI18nCatalog(locale, widgetname) : {};
  const t = createTranslator({ locale, coreui, widget });

  const resolveParams = (params: Record<string, unknown>, depth = 0): Record<string, unknown> => {
    if (depth > 4) return params;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (isTranslationRef(v)) {
        const nestedParams = v.params && typeof v.params === 'object' && !Array.isArray(v.params) ? v.params : {};
        const resolvedNested = resolveParams(nestedParams as Record<string, unknown>, depth + 1);
        out[k] = t(v.$t, { ...resolvedNested, ...(typeof v.count === 'number' ? { count: v.count } : {}) });
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-i18n-key]'));
  nodes.forEach((node) => {
    const key = node.getAttribute('data-i18n-key')?.trim();
    if (!key) return;

    const paramsRaw = node.getAttribute('data-i18n-params');
    const parsed = paramsRaw ? safeJsonParse(paramsRaw) : null;
    const params =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    const resolved = resolveParams(params);

    const countAttr = node.getAttribute('data-i18n-count');
    const count = countAttr != null ? Number(countAttr) : undefined;
    const finalParams =
      typeof count === 'number' && Number.isFinite(count) ? { ...resolved, count } : resolved;

    node.textContent = t(key, finalParams);
  });
}

