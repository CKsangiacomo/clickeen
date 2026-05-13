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

  function applyTextOverrides(state, textPack) {
    if (!state || typeof state !== 'object') return;
    if (!textPack || typeof textPack !== 'object' || Array.isArray(textPack)) return;
    Object.entries(textPack).forEach(([path, value]) => {
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

    const inlineTextPack =
      args?.textPack && typeof args.textPack === 'object' && !Array.isArray(args.textPack)
        ? args.textPack
        : null;
    if (inlineTextPack) {
      const localized =
        typeof structuredClone === 'function'
          ? structuredClone(sourceState)
          : JSON.parse(JSON.stringify(sourceState));
      applyTextOverrides(localized, inlineTextPack);
      return localized;
    }

    const overlayRes = await fetch(
      '/l10n/widgets/' +
        encodeURIComponent(instanceId) +
        '/' +
        encodeURIComponent(locale) +
        '/overlay.json',
      { method: 'GET', cache: 'no-store', credentials: 'omit' },
    ).catch(() => null);
    if (!overlayRes) throw new Error('ck_preview_l10n_overlay_request_failed');
    if (!overlayRes.ok) throw new Error('ck_preview_l10n_overlay_missing');
    const overlay = await overlayRes.json().catch(() => null);
    const textPack =
      overlay && typeof overlay === 'object' && overlay.textPack && typeof overlay.textPack === 'object'
        ? overlay.textPack
        : null;
    if (!textPack || Array.isArray(textPack)) {
      throw new Error('ck_preview_l10n_overlay_invalid');
    }

    const localized =
      typeof structuredClone === 'function'
        ? structuredClone(sourceState)
        : JSON.parse(JSON.stringify(sourceState));
    applyTextOverrides(localized, textPack);
    return localized;
  }

  window.CK_PREVIEW_L10N = {
    loadLocalizedState,
  };
})();
