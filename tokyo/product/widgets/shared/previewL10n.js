(function () {
  if (typeof window === 'undefined') return;

  function normalizeLocale(raw) {
    return typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  }

  function parsePathParts(path) {
    const out = [];
    const raw = String(path || '').trim();
    if (!raw) return out;
    let buf = '';
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '.') {
        if (buf) out.push(buf);
        buf = '';
        continue;
      }
      if (ch === '[') {
        if (buf) out.push(buf);
        buf = '';
        const close = raw.indexOf(']', i + 1);
        if (close < 0) break;
        const inside = raw.slice(i + 1, close).trim();
        if (inside) out.push(inside);
        i = close;
        continue;
      }
      buf += ch;
    }
    if (buf) out.push(buf);
    return out;
  }

  function applyTranslatedValues(state, values) {
    if (!state || typeof state !== 'object') return;
    if (!values || typeof values !== 'object' || Array.isArray(values)) return;
    Object.entries(values).forEach(([path, value]) => {
      if (typeof value !== 'string') return;
      const parts = parsePathParts(path);
      if (!parts.length) return;
      let cur = state;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        const isIndex = /^[0-9]+$/.test(part);
        if (isIndex) {
          const idx = Number(part);
          if (!Array.isArray(cur)) return;
          cur = cur[idx];
          continue;
        }
        if (!cur || typeof cur !== 'object') return;
        cur = cur[part];
      }
      const last = parts[parts.length - 1];
      if (!cur || typeof cur !== 'object') return;
      if (/^[0-9]+$/.test(last)) {
        const idx = Number(last);
        if (!Array.isArray(cur)) return;
        if (typeof cur[idx] !== 'string') return;
        cur[idx] = value;
        return;
      }
      if (typeof cur[last] !== 'string') return;
      cur[last] = value;
    });
  }

  async function loadLocalizedState(args) {
    const instanceId = typeof args?.instanceId === 'string' ? args.instanceId.trim() : '';
    const locale = normalizeLocale(args?.locale);
    const baseLocale = normalizeLocale(args?.baseLocale);
    const previewMode = typeof args?.previewMode === 'string' ? args.previewMode.trim() : '';
    const sourceState = args?.baseState;
    if (!sourceState || typeof sourceState !== 'object') return sourceState;
    if (previewMode !== 'translations') return sourceState;
    if (!instanceId || !locale) return sourceState;
    if (baseLocale && locale === baseLocale) return sourceState;

    const inlineValues =
      args?.values && typeof args.values === 'object' && !Array.isArray(args.values)
        ? args.values
        : null;
    if (inlineValues) {
      const localized =
        typeof structuredClone === 'function'
          ? structuredClone(sourceState)
          : JSON.parse(JSON.stringify(sourceState));
      applyTranslatedValues(localized, inlineValues);
      return localized;
    }

    return sourceState;
  }

  window.CK_PREVIEW_L10N = {
    loadLocalizedState,
  };
})();
