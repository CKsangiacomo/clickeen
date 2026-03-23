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
    const publicId = typeof args?.publicId === 'string' ? args.publicId.trim() : '';
    const locale = normalizeLocale(args?.locale);
    const baseLocale = normalizeLocale(args?.baseLocale);
    const sourceState = args?.baseState;
    if (!sourceState || typeof sourceState !== 'object') return sourceState;
    if (!publicId || !locale) return sourceState;
    if (baseLocale && locale === baseLocale) return sourceState;

    const pointerRes = await fetch(
      '/l10n/instances/' + encodeURIComponent(publicId) + '/live/' + encodeURIComponent(locale) + '.json',
      { method: 'GET', cache: 'no-store', credentials: 'omit' },
    ).catch(() => null);
    if (!pointerRes) throw new Error('ck_preview_l10n_pointer_request_failed');
    if (!pointerRes.ok) throw new Error('ck_preview_l10n_pointer_missing');
    const pointer = await pointerRes.json().catch(() => null);
    const textFp = pointer && typeof pointer.textFp === 'string' ? pointer.textFp.trim() : '';
    if (!textFp) throw new Error('ck_preview_l10n_textfp_missing');

    const textRes = await fetch(
      '/l10n/instances/' +
        encodeURIComponent(publicId) +
        '/packs/' +
        encodeURIComponent(locale) +
        '/' +
        encodeURIComponent(textFp) +
        '.json',
      { method: 'GET', cache: 'force-cache', credentials: 'omit' },
    ).catch(() => null);
    if (!textRes) throw new Error('ck_preview_l10n_pack_request_failed');
    if (!textRes.ok) throw new Error('ck_preview_l10n_pack_missing');
    const textPack = await textRes.json().catch(() => null);
    if (!textPack || typeof textPack !== 'object' || Array.isArray(textPack)) {
      throw new Error('ck_preview_l10n_pack_invalid');
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
