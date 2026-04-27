(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const SIZE_PRESETS = new Set(['xs', 's', 'm', 'l', 'xl', 'custom']);
  const LOCALE_PARAM = 'locale';
  const GLOBAL_ROLE_SCALES = Object.freeze({
    title: Object.freeze({ xs: '20px', s: '28px', m: '36px', l: '44px', xl: '60px' }),
    body: Object.freeze({ xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' }),
    section: Object.freeze({ xs: '12px', s: '13px', m: '14px', l: '16px', xl: '18px' }),
    question: Object.freeze({ xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' }),
    answer: Object.freeze({ xs: '14px', s: '16px', m: '18px', l: '22px', xl: '24px' }),
    button: Object.freeze({ xs: '13px', s: '15px', m: '18px', l: '20px', xl: '24px' }),
  });
  const TRACKING_PRESETS = Object.freeze({
    tighter: '-0.03em',
    tight: '-0.015em',
    normal: '0em',
    wide: '0.015em',
    wider: '0.03em',
    custom: null,
  });
  const LINE_HEIGHT_PRESETS = Object.freeze({
    snug: '1',
    tight: '1.15',
    normal: null,
    relaxed: '1.4',
    loose: '1.6',
    custom: null,
  });
  const DEFAULT_ROLE_LINE_HEIGHT = Object.freeze({
    title: 'var(--lh-tight)',
    body: 'var(--lh-body)',
    section: 'var(--lh-tight)',
    question: 'var(--lh-tight)',
    answer: 'var(--lh-body)',
    heading: 'var(--lh-tight)',
    timer: '1',
    label: 'var(--lh-tight)',
    button: 'var(--lh-tight)',
  });

  const SCRIPT_TYPOGRAPHY_PROFILES = Object.freeze({
    latin: Object.freeze({
      preferScriptFirst: false,
      normalLineHeights: Object.freeze({}),
    }),
    japanese: Object.freeze({
      preferScriptFirst: true,
      normalLineHeights: Object.freeze({
        title: '1.28',
        section: '1.3',
        question: '1.38',
        body: '1.58',
        answer: '1.62',
        button: '1.24',
      }),
    }),
    korean: Object.freeze({
      preferScriptFirst: true,
      normalLineHeights: Object.freeze({
        title: '1.26',
        section: '1.3',
        question: '1.36',
        body: '1.54',
        answer: '1.58',
        button: '1.22',
      }),
    }),
    zhHans: Object.freeze({
      preferScriptFirst: true,
      normalLineHeights: Object.freeze({
        title: '1.24',
        section: '1.28',
        question: '1.34',
        body: '1.52',
        answer: '1.56',
        button: '1.2',
      }),
    }),
    zhHant: Object.freeze({
      preferScriptFirst: true,
      normalLineHeights: Object.freeze({
        title: '1.24',
        section: '1.28',
        question: '1.34',
        body: '1.52',
        answer: '1.56',
        button: '1.2',
      }),
    }),
  });

  const curatedFonts = {
    Inter: Object.freeze({
      source: 'google',
      spec: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900',
      familyClass: 'sans',
    }),
    Manrope: Object.freeze({
      source: 'google',
      spec: 'Manrope:wght@200..800',
      familyClass: 'sans',
    }),
    'Open Sans': Object.freeze({
      source: 'google',
      spec: 'Open+Sans:ital,wght@0,300..800;1,300..800',
      familyClass: 'sans',
    }),
    Lato: Object.freeze({
      source: 'google',
      spec: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
      familyClass: 'sans',
    }),
    Roboto: Object.freeze({
      source: 'google',
      spec: 'Roboto:ital,wght@0,100..900;1,100..900',
      familyClass: 'sans',
    }),
    Montserrat: Object.freeze({
      source: 'google',
      spec: 'Montserrat:ital,wght@0,100..900;1,100..900',
      familyClass: 'sans',
    }),
    Raleway: Object.freeze({
      source: 'google',
      spec: 'Raleway:ital,wght@0,100..900;1,100..900',
      familyClass: 'sans',
    }),
    'Libre Baskerville': Object.freeze({
      source: 'google',
      spec: 'Libre+Baskerville:ital,wght@0,400..700;1,400..700',
      familyClass: 'serif',
    }),
    Lora: Object.freeze({
      source: 'google',
      spec: 'Lora:ital,wght@0,400..700;1,400..700',
      familyClass: 'serif',
    }),
    'Cormorant Garamond': Object.freeze({
      source: 'google',
      spec: 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
      familyClass: 'serif',
    }),
    'Crimson Text': Object.freeze({
      source: 'google',
      spec: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
      familyClass: 'serif',
    }),
    Gabriela: Object.freeze({
      source: 'google',
      spec: 'Gabriela',
      familyClass: 'serif',
    }),
    Michroma: Object.freeze({
      source: 'google',
      spec: 'Michroma',
      familyClass: 'sans',
    }),
    'Playfair Display': Object.freeze({
      source: 'google',
      spec: 'Playfair+Display:ital,wght@0,400..900;1,400..900',
      familyClass: 'serif',
    }),
    Cookie: Object.freeze({
      source: 'google',
      spec: 'Cookie',
      familyClass: 'sans',
    }),
    'Homemade Apple': Object.freeze({
      source: 'google',
      spec: 'Homemade+Apple',
      familyClass: 'sans',
    }),
    'Permanent Marker': Object.freeze({
      source: 'google',
      spec: 'Permanent+Marker',
      familyClass: 'sans',
    }),
    'Shadows Into Light': Object.freeze({
      source: 'google',
      spec: 'Shadows+Into+Light',
      familyClass: 'sans',
    }),
    Frari: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Frari.woff2',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    Giudecca: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Giudecca.woff',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    Marin: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Marin.woff',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    Orio: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Orio.woff',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    Pachuka: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Pachuka.woff2',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    'Pachuka Line': Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Pachuka_line.woff2',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
    Rialto: Object.freeze({
      source: 'tokyo',
      filePath: '/fonts/special/Rialto.woff2',
      weights: Object.freeze(['400']),
      styles: Object.freeze(['normal']),
      familyClass: 'serif',
    }),
  };

  const scriptFonts = {
    'Noto Sans': 'Noto+Sans:wght@100..900',
    'Noto Serif': 'Noto+Serif:wght@100..900',
    'Noto Sans JP': 'Noto+Sans+JP:wght@100..900',
    'Noto Serif JP': 'Noto+Serif+JP:wght@200..900',
    'Noto Sans KR': 'Noto+Sans+KR:wght@100..900',
    'Noto Serif KR': 'Noto+Serif+KR:wght@200..900',
    'Noto Sans SC': 'Noto+Sans+SC:wght@100..900',
    'Noto Serif SC': 'Noto+Serif+SC:wght@200..900',
    'Noto Sans TC': 'Noto+Sans+TC:wght@100..900',
    'Noto Serif TC': 'Noto+Serif+TC:wght@200..900',
    'Noto Sans Arabic': 'Noto+Sans+Arabic:wght@100..900',
    'Noto Naskh Arabic': 'Noto+Naskh+Arabic:wght@400..700',
    'Noto Sans Hebrew': 'Noto+Sans+Hebrew:wght@100..900',
    'Noto Serif Hebrew': 'Noto+Serif+Hebrew:wght@100..900',
    'Noto Sans Thai': 'Noto+Sans+Thai:wght@100..900',
    'Noto Serif Thai': 'Noto+Serif+Thai:wght@100..900',
    'Noto Sans Devanagari': 'Noto+Sans+Devanagari:wght@100..900',
    'Noto Serif Devanagari': 'Noto+Serif+Devanagari:wght@100..900',
    'Noto Sans Bengali': 'Noto+Sans+Bengali:wght@100..900',
    'Noto Serif Bengali': 'Noto+Serif+Bengali:wght@100..900',
  };

  function scriptProfile(preloadFamilies, fallbackFamilies) {
    return Object.freeze({
      preloadFamilies: Object.freeze(preloadFamilies),
      fallbackFamilies: Object.freeze(fallbackFamilies),
    });
  }

  const SCRIPT_FALLBACK_MATRIX = Object.freeze({
    latin: Object.freeze({
      sans: scriptProfile([], []),
      serif: scriptProfile([], []),
    }),
    japanese: Object.freeze({
      sans: scriptProfile(
        ['Noto Sans JP'],
        ['Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'MS PGothic'],
      ),
      serif: scriptProfile(['Noto Serif JP'], ['Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho']),
    }),
    korean: Object.freeze({
      sans: scriptProfile(['Noto Sans KR'], ['Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'AppleGothic']),
      serif: scriptProfile(['Noto Serif KR'], ['Noto Serif KR', 'Batang', 'AppleMyungjo', 'Malgun Gothic']),
    }),
    zhHans: Object.freeze({
      sans: scriptProfile(['Noto Sans SC'], ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', 'SimHei']),
      serif: scriptProfile(['Noto Serif SC'], ['Noto Serif SC', 'Songti SC', 'STSong', 'SimSun']),
    }),
    zhHant: Object.freeze({
      sans: scriptProfile(
        ['Noto Sans TC'],
        ['Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', 'PMingLiU'],
      ),
      serif: scriptProfile(['Noto Serif TC'], ['Noto Serif TC', 'PMingLiU', 'MingLiU', 'Songti TC']),
    }),
    arabic: Object.freeze({
      sans: scriptProfile(['Noto Sans Arabic'], ['Noto Sans Arabic', 'Tahoma', 'Arial']),
      serif: scriptProfile(['Noto Naskh Arabic'], ['Noto Naskh Arabic', 'Amiri', 'Traditional Arabic']),
    }),
    hebrew: Object.freeze({
      sans: scriptProfile(['Noto Sans Hebrew'], ['Noto Sans Hebrew', 'Arial']),
      serif: scriptProfile(['Noto Serif Hebrew'], ['Noto Serif Hebrew', 'Times New Roman']),
    }),
    thai: Object.freeze({
      sans: scriptProfile(['Noto Sans Thai'], ['Noto Sans Thai', 'Tahoma', 'Arial']),
      serif: scriptProfile(['Noto Serif Thai'], ['Noto Serif Thai', 'Tahoma', 'Arial']),
    }),
    devanagari: Object.freeze({
      sans: scriptProfile(['Noto Sans Devanagari'], ['Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'Arial']),
      serif: scriptProfile(['Noto Serif Devanagari'], ['Noto Serif Devanagari', 'Nirmala UI', 'Mangal', 'Arial']),
    }),
    bengali: Object.freeze({
      sans: scriptProfile(['Noto Sans Bengali'], ['Noto Sans Bengali', 'Nirmala UI', 'Vrinda', 'Arial']),
      serif: scriptProfile(['Noto Serif Bengali'], ['Noto Serif Bengali', 'Nirmala UI', 'Vrinda', 'Arial']),
    }),
    cyrillic: Object.freeze({
      sans: scriptProfile(['Noto Sans'], ['Noto Sans', 'Arial']),
      serif: scriptProfile(['Noto Serif'], ['Noto Serif', 'Georgia', 'Times New Roman']),
    }),
  });

  const ARABIC_LANGS = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ku', 'ckb', 'ks']);
  const HEBREW_LANGS = new Set(['he', 'yi']);
  const THAI_LANGS = new Set(['th']);
  const DEVANAGARI_LANGS = new Set(['hi', 'mr', 'ne', 'sa']);
  const BENGALI_LANGS = new Set(['bn', 'as']);
  const CYRILLIC_LANGS = new Set([
    'ru',
    'uk',
    'bg',
    'mk',
    'sr',
    'be',
    'kk',
    'ky',
    'mn',
    'tg',
    'tt',
  ]);

  function allowedWeightsForFamily(family) {
    const meta = curatedFonts[family];
    if (!meta) return null;
    if (Array.isArray(meta.weights) && meta.weights.length) {
      return Array.from(new Set(meta.weights)).sort((a, b) => Number(a) - Number(b));
    }
    const spec = meta.spec;
    if (typeof spec !== 'string' || !spec) return ['400'];
    const idx = spec.indexOf('wght@');
    if (idx === -1) return ['400'];
    const segment = spec.slice(idx + 'wght@'.length);
    const weights = new Set();
    segment
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((token) => {
        const last = token.split(',').pop() || '';
        const rangeMatch = last.match(/(\d+)\.\.(\d+)/);
        if (rangeMatch) {
          const min = Number(rangeMatch[1]);
          const max = Number(rangeMatch[2]);
          if (!Number.isFinite(min) || !Number.isFinite(max)) return;
          const lo = Math.min(min, max);
          const hi = Math.max(min, max);
          const start = Math.ceil(lo / 100) * 100;
          const end = Math.floor(hi / 100) * 100;
          for (let w = start; w <= end; w += 100) weights.add(String(w));
          return;
        }

        const match = last.match(/^\s*(\d+)\s*$/);
        if (match) weights.add(match[1]);
      });
    if (weights.size === 0) return ['400'];
    return Array.from(weights).sort((a, b) => Number(a) - Number(b));
  }

  function allowedStylesForFamily(family) {
    const meta = curatedFonts[family];
    if (!meta) return null;
    if (Array.isArray(meta.styles) && meta.styles.length) {
      return Array.from(new Set(meta.styles));
    }
    const spec = meta.spec;
    if (typeof spec !== 'string' || !spec) return ['normal'];
    const supportsItalic = spec.includes('ital,') || spec.includes('ital@');
    return supportsItalic ? ['normal', 'italic'] : ['normal'];
  }

  const NUMERIC_STRING = /^-?\d+(?:\.\d+)?$/;

  function isNumericString(value) {
    return typeof value === 'string' && NUMERIC_STRING.test(value.trim());
  }

  function isCssLengthString(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed === '0' || trimmed === '0.0' || trimmed === '0.00') return true;
    if (/^var\(.+\)$/.test(trimmed)) return true;
    if (/^(?:calc|clamp|min|max)\(.+\)$/.test(trimmed)) return true;
    return /^-?\d+(?:\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/.test(trimmed);
  }

  function inferScaleKind(scale) {
    if (!scale || typeof scale !== 'object') return null;
    const keys = ['xs', 's', 'm', 'l', 'xl'];
    let numericCount = 0;
    let lengthCount = 0;
    for (const key of keys) {
      const v = scale[key];
      if (typeof v !== 'string' || !v.trim()) return null;
      if (isNumericString(v)) numericCount += 1;
      else if (isCssLengthString(v)) lengthCount += 1;
      else return null;
    }
    if (numericCount === keys.length) return 'number';
    if (lengthCount === keys.length) return 'css-length';
    return null;
  }

  function resolveTrackingValue(roleKey, role) {
    const presetValue =
      typeof role.trackingPreset === 'string' && role.trackingPreset.trim() ? role.trackingPreset.trim() : 'normal';
    if (!Object.prototype.hasOwnProperty.call(TRACKING_PRESETS, presetValue)) {
      throw new Error(`[CKTypography] Unknown trackingPreset "${presetValue}" for role "${roleKey}"`);
    }

    if (presetValue !== 'custom') {
      return TRACKING_PRESETS[presetValue];
    }

    const customValue = role.trackingCustom;
    if (typeof customValue === 'number' && Number.isFinite(customValue)) {
      return `${String(customValue)}em`;
    }

    if (typeof customValue === 'string' && customValue.trim()) {
      const trimmed = customValue.trim();
      if (isNumericString(trimmed)) return `${trimmed}em`;
      if (isCssLengthString(trimmed)) return trimmed;
    }

    throw new Error(`[CKTypography] Role "${roleKey}" trackingCustom must be a number or CSS length`);
  }

  function resolveScriptTypographyProfile(script) {
    return SCRIPT_TYPOGRAPHY_PROFILES[script] || SCRIPT_TYPOGRAPHY_PROFILES.latin;
  }

  function resolveScriptNormalLineHeight(script, roleKey) {
    const profile = resolveScriptTypographyProfile(script);
    if (!profile || !profile.normalLineHeights) return null;
    const value = profile.normalLineHeights[roleKey];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function resolveLineHeightValue(roleKey, role, script) {
    const presetValue =
      typeof role.lineHeightPreset === 'string' && role.lineHeightPreset.trim()
        ? role.lineHeightPreset.trim()
        : 'normal';
    if (!Object.prototype.hasOwnProperty.call(LINE_HEIGHT_PRESETS, presetValue)) {
      throw new Error(`[CKTypography] Unknown lineHeightPreset "${presetValue}" for role "${roleKey}"`);
    }

    if (presetValue === 'normal') {
      const scriptValue = resolveScriptNormalLineHeight(script, roleKey);
      if (scriptValue) return scriptValue;
      return DEFAULT_ROLE_LINE_HEIGHT[roleKey] || 'normal';
    }
    if (presetValue !== 'custom') {
      return LINE_HEIGHT_PRESETS[presetValue];
    }

    const customValue = role.lineHeightCustom;
    if (typeof customValue === 'number' && Number.isFinite(customValue)) {
      if (customValue <= 0) {
        throw new Error(`[CKTypography] Role "${roleKey}" lineHeightCustom must be > 0`);
      }
      return String(customValue);
    }

    if (typeof customValue === 'string' && customValue.trim()) {
      const trimmed = customValue.trim();
      if (isNumericString(trimmed)) {
        if (Number(trimmed) <= 0) {
          throw new Error(`[CKTypography] Role "${roleKey}" lineHeightCustom must be > 0`);
        }
        return trimmed;
      }
      if (trimmed === 'normal') return 'normal';
      if (isCssLengthString(trimmed)) return trimmed;
    }

    throw new Error(`[CKTypography] Role "${roleKey}" lineHeightCustom must be a number or CSS length`);
  }

  const loadedFonts = new Set();

  function normalizeLocaleTag(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().replace(/_/g, '-');
  }

  function toFontFamilyToken(family) {
    const trimmed = String(family || '').trim();
    if (!trimmed) return '';
    if (
      trimmed.includes(',') ||
      trimmed.startsWith('"') ||
      trimmed.startsWith("'") ||
      trimmed.startsWith('var(') ||
      trimmed.startsWith('calc(') ||
      trimmed.startsWith('clamp(')
    ) {
      return trimmed;
    }
    return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
  }

  function ensureGoogleFontLoaded(family, spec) {
    if (!spec) return;
    if (loadedFonts.has(family)) return;
    const id = `ck-font-${String(family).replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) {
      loadedFonts.add(family);
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(family);
  }

  function resolveTokyoFontUrl(filePath) {
    const normalizedPath = String(filePath || '').trim();
    if (!normalizedPath) return '';
    const absoluteLike = /^https?:\/\//i.test(normalizedPath);
    if (absoluteLike) return normalizedPath;
    const rootedPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    try {
      const baseEl = document.querySelector('base[href]');
      if (baseEl && typeof baseEl.href === 'string' && baseEl.href.trim()) {
        return new URL(rootedPath, baseEl.href).toString();
      }
    } catch {}
    try {
      return new URL(rootedPath, window.location.origin).toString();
    } catch {
      return rootedPath;
    }
  }

  function resolveFontFormat(filePath) {
    const extMatch = String(filePath || '').toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
    const ext = extMatch ? extMatch[1] : '';
    if (ext === 'woff2') return 'woff2';
    if (ext === 'woff') return 'woff';
    if (ext === 'ttf') return 'truetype';
    if (ext === 'otf') return 'opentype';
    return '';
  }

  function ensureTokyoFontLoaded(family, filePath) {
    const url = resolveTokyoFontUrl(filePath);
    if (!url) return;
    if (loadedFonts.has(family)) return;
    const id = `ck-font-face-${String(family).replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) {
      loadedFonts.add(family);
      return;
    }

    const style = document.createElement('style');
    style.id = id;
    const nonce =
      window.CK_CSP_NONCE && typeof window.CK_CSP_NONCE === 'string' ? window.CK_CSP_NONCE.trim() : '';
    if (nonce) style.setAttribute('nonce', nonce);
    const format = resolveFontFormat(url);
    const src = format ? `url("${url}") format("${format}")` : `url("${url}")`;
    style.textContent = `@font-face{font-family:${toFontFamilyToken(family)};src:${src};font-style:normal;font-weight:400;font-display:swap;}`;
    document.head.appendChild(style);
    loadedFonts.add(family);
  }

  function ensureFontLoaded(family) {
    const meta = curatedFonts[family];
    if (!meta) {
      throw new Error(`[CKTypography] Unknown font family "${family}"`);
    }
    if (meta.source === 'tokyo') {
      if (!meta.filePath) {
        throw new Error(`[CKTypography] Missing Tokyo font filePath for family "${family}"`);
      }
      ensureTokyoFontLoaded(family, meta.filePath);
      return;
    }
    ensureGoogleFontLoaded(family, meta.spec);
  }

  function ensureScriptFontLoaded(family) {
    const spec = scriptFonts[family];
    if (!spec) return;
    ensureGoogleFontLoaded(family, spec);
  }

  function normalizePublicId(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  function resolvePublicId(root, runtimeContext) {
    const fromContext = normalizePublicId(runtimeContext && runtimeContext.publicId);
    if (fromContext) return fromContext;

    const own = normalizePublicId(root.getAttribute('data-ck-public-id'));
    if (own) return own;

    const rootNode = root.getRootNode();
    if (rootNode instanceof ShadowRoot && rootNode.host instanceof HTMLElement) {
      const fromHost = normalizePublicId(rootNode.host.getAttribute('data-ck-public-id'));
      if (fromHost) return fromHost;
    }

    const ancestor = root.closest('[data-ck-public-id]');
    if (ancestor instanceof HTMLElement) {
      const fromAncestor = normalizePublicId(ancestor.getAttribute('data-ck-public-id'));
      if (fromAncestor) return fromAncestor;
    }

    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    if (global) {
      const fromGlobal = normalizePublicId(global.publicId);
      if (fromGlobal) return fromGlobal;
    }

    return '';
  }

  function readLocaleFromElement(el) {
    if (!(el instanceof HTMLElement)) return '';
    const ckLocale = normalizeLocaleTag(el.getAttribute('data-ck-locale'));
    if (ckLocale) return ckLocale;
    return normalizeLocaleTag(el.getAttribute('data-locale'));
  }

  function resolveLocaleFromQuery() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return normalizeLocaleTag(params.get(LOCALE_PARAM));
    } catch {
      return '';
    }
  }

  function resolveLocaleFromPayload(publicId) {
    if (publicId && window.CK_WIDGETS && typeof window.CK_WIDGETS === 'object') {
      const keyed = window.CK_WIDGETS[publicId];
      if (keyed && typeof keyed === 'object') {
        const fromKeyed = normalizeLocaleTag(keyed.locale);
        if (fromKeyed) return fromKeyed;
      }
    }

    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    return normalizeLocaleTag(global && global.locale);
  }

  function resolveRuntimeLocale(root, runtimeContext) {
    const fromContext = normalizeLocaleTag(runtimeContext && runtimeContext.locale);
    if (fromContext) return fromContext;

    const fromRoot = readLocaleFromElement(root);
    if (fromRoot) return fromRoot;

    const ancestor = root.closest('[data-ck-locale], [data-locale]');
    if (ancestor instanceof HTMLElement) {
      const fromAncestor = readLocaleFromElement(ancestor);
      if (fromAncestor) return fromAncestor;
    }

    const docEl = root.ownerDocument && root.ownerDocument.documentElement;
    if (docEl instanceof HTMLElement) {
      const fromDocAttr = normalizeLocaleTag(docEl.getAttribute('data-locale'));
      if (fromDocAttr) return fromDocAttr;
    }

    const fromPayload = resolveLocaleFromPayload(resolvePublicId(root, runtimeContext));
    if (fromPayload) return fromPayload;

    const fromQuery = resolveLocaleFromQuery();
    if (fromQuery) return fromQuery;

    if (docEl instanceof HTMLElement) {
      const fromDocLang = normalizeLocaleTag(docEl.lang);
      if (fromDocLang) return fromDocLang;
    }

    return '';
  }

  function resolveScriptProfile(locale) {
    const normalized = normalizeLocaleTag(locale);
    if (!normalized) return 'latin';

    const parts = normalized.split('-').filter(Boolean);
    if (parts.includes('hans')) return 'zhHans';
    if (parts.includes('hant')) return 'zhHant';
    if (parts.includes('jpan')) return 'japanese';
    if (parts.includes('kore')) return 'korean';
    if (parts.includes('arab')) return 'arabic';
    if (parts.includes('hebr')) return 'hebrew';
    if (parts.includes('thai')) return 'thai';
    if (parts.includes('deva')) return 'devanagari';
    if (parts.includes('beng')) return 'bengali';
    if (parts.includes('cyrl')) return 'cyrillic';

    const primary = parts[0] || '';
    if (primary === 'ja') return 'japanese';
    if (primary === 'ko') return 'korean';
    if (primary === 'zh') {
      if (parts.includes('tw') || parts.includes('hk') || parts.includes('mo')) return 'zhHant';
      return 'zhHans';
    }
    if (ARABIC_LANGS.has(primary)) return 'arabic';
    if (HEBREW_LANGS.has(primary)) return 'hebrew';
    if (THAI_LANGS.has(primary)) return 'thai';
    if (DEVANAGARI_LANGS.has(primary)) return 'devanagari';
    if (BENGALI_LANGS.has(primary)) return 'bengali';
    if (CYRILLIC_LANGS.has(primary)) return 'cyrillic';
    return 'latin';
  }

  function uniqueFontStack(tokens) {
    const out = [];
    const seen = new Set();
    tokens.forEach((token) => {
      const trimmed = String(token || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(trimmed);
    });
    return out;
  }

  function resolveFamilyClass(family) {
    const meta = curatedFonts[family];
    if (!meta) return 'sans';
    return meta.familyClass === 'serif' ? 'serif' : 'sans';
  }

  function resolveScriptClassProfile(script, familyClass) {
    const matrix = SCRIPT_FALLBACK_MATRIX[script] || SCRIPT_FALLBACK_MATRIX.latin;
    return matrix[familyClass] || matrix.sans || SCRIPT_FALLBACK_MATRIX.latin.sans;
  }

  function resolveFallbackTailTokens(familyClass) {
    if (familyClass === 'serif') return ['serif'];
    return ['var(--font-ui)', 'sans-serif'];
  }

  function resolveFamilyValue(family, script) {
    const familyClass = resolveFamilyClass(family);
    const profile = resolveScriptClassProfile(script, familyClass);
    const typoProfile = resolveScriptTypographyProfile(script);
    profile.preloadFamilies.forEach((fallbackFamily) => ensureScriptFontLoaded(fallbackFamily));

    const selectedToken = toFontFamilyToken(family);
    const scriptTokens = profile.fallbackFamilies.map((fallbackFamily) => toFontFamilyToken(fallbackFamily));
    const headTokens = typoProfile.preferScriptFirst ? [...scriptTokens, selectedToken] : [selectedToken, ...scriptTokens];
    const tokens = uniqueFontStack([...headTokens, ...resolveFallbackTailTokens(familyClass)]);
    return tokens.join(', ');
  }

  function applyTypography(typography, root, roleConfig, runtimeContext) {
    if (!(root instanceof HTMLElement)) {
      throw new Error('[CKTypography] root must be an HTMLElement');
    }
    if (!typography || typeof typography !== 'object') {
      throw new Error('[CKTypography] Missing typography');
    }
    if (!roleConfig || typeof roleConfig !== 'object') {
      throw new Error('[CKTypography] roleConfig is required');
    }
    if (!window.CSS || typeof window.CSS.supports !== 'function') {
      throw new Error('[CKTypography] Missing CSS.supports');
    }

    const runtimeLocale = resolveRuntimeLocale(root, runtimeContext);
    if (runtimeLocale) {
      root.setAttribute('data-ck-locale', runtimeLocale);
      const docEl = root.ownerDocument && root.ownerDocument.documentElement;
      if (docEl instanceof HTMLElement) docEl.lang = runtimeLocale;
    }

    const runtimeScript = resolveScriptProfile(runtimeLocale);

    const globalFamily = typography.globalFamily;
    if (typeof globalFamily !== 'string' || !globalFamily.trim()) {
      throw new Error('[CKTypography] typography.globalFamily is required');
    }
    if (!curatedFonts[globalFamily]) {
      throw new Error(`[CKTypography] Unknown font family "${globalFamily}"`);
    }
    ensureFontLoaded(globalFamily);

    const roles = typography.roles;
    if (!roles || typeof roles !== 'object') {
      throw new Error('[CKTypography] typography.roles is required');
    }

    const roleScales =
      typography.roleScales && typeof typography.roleScales === 'object' ? typography.roleScales : {};

    Object.keys(roleConfig).forEach((roleKey) => {
      const cfg = roleConfig[roleKey];
      if (!cfg || typeof cfg !== 'object') {
        throw new Error(`[CKTypography] roleConfig for "${roleKey}" must be an object`);
      }
      const role = roles[roleKey];
      if (!role || typeof role !== 'object') {
        throw new Error(`[CKTypography] Missing role "${roleKey}"`);
      }

      const varKey = typeof cfg.varKey === 'string' && cfg.varKey.trim() ? cfg.varKey : roleKey;

      const family = role.family;
      const sizePreset = role.sizePreset;
      const weight = role.weight;
      const fontStyle = role.fontStyle;
      const rawColor = role.color;
      const color =
        window.CKFill && typeof window.CKFill.toCssColor === 'function' ? window.CKFill.toCssColor(rawColor) : rawColor;

      if (typeof family !== 'string' || !family.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing family`);
      }
      if (typeof sizePreset !== 'string' || !sizePreset.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing sizePreset`);
      }
      if (typeof weight !== 'string' || !weight.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing weight`);
      }
      if (typeof fontStyle !== 'string' || !fontStyle.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing fontStyle`);
      }
      if (typeof color !== 'string' || !color.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing color`);
      }
      if (!window.CSS.supports('color', color)) {
        throw new Error(`[CKTypography] Role "${roleKey}" has invalid color "${color}"`);
      }

      ensureFontLoaded(family);
      const allowedWeights = allowedWeightsForFamily(family);
      if (!allowedWeights) {
        throw new Error(`[CKTypography] Unknown font family "${family}"`);
      }
      if (!allowedWeights.includes(weight)) {
        throw new Error(
          `[CKTypography] Invalid weight "${weight}" for family "${family}" (allowed: ${allowedWeights.join(', ')})`,
        );
      }
      const allowedStyles = allowedStylesForFamily(family);
      if (!allowedStyles) {
        throw new Error(`[CKTypography] Unknown font family "${family}"`);
      }
      if (!allowedStyles.includes(fontStyle)) {
        throw new Error(
          `[CKTypography] Invalid fontStyle "${fontStyle}" for family "${family}" (allowed: ${allowedStyles.join(', ')})`,
        );
      }
      if (!SIZE_PRESETS.has(sizePreset)) {
        throw new Error(`[CKTypography] Unknown sizePreset "${sizePreset}" for role "${roleKey}"`);
      }

      const scale = GLOBAL_ROLE_SCALES[roleKey] || roleScales[roleKey];
      if (!scale || typeof scale !== 'object') {
        throw new Error(`[CKTypography] Missing roleScales for "${roleKey}"`);
      }

      const scaleKind = inferScaleKind(scale);
      if (!scaleKind) {
        throw new Error(`[CKTypography] Invalid roleScales for "${roleKey}" (expected numbers or CSS lengths)`);
      }

      let sizeValue = null;
      if (sizePreset === 'custom') {
        const sizeCustom = role.sizeCustom;
        if (typeof sizeCustom === 'number' && Number.isFinite(sizeCustom)) {
          if (sizeCustom < 0) {
            throw new Error(`[CKTypography] Role "${roleKey}" sizeCustom must be >= 0`);
          }
          // For editor ergonomics, allow sizeCustom as a plain number (interpreted as px).
          sizeValue = scaleKind === 'number' ? String(sizeCustom) : `${String(sizeCustom)}px`;
        } else {
          if (typeof sizeCustom !== 'string' || !sizeCustom.trim()) {
            throw new Error(`[CKTypography] Role "${roleKey}" is missing sizeCustom`);
          }
          const trimmed = sizeCustom.trim();
          if (scaleKind === 'number') {
            if (!isNumericString(trimmed)) {
              throw new Error(`[CKTypography] Role "${roleKey}" sizeCustom must be a number (no units)`);
            }
            sizeValue = trimmed;
          } else {
            if (isNumericString(trimmed)) {
              sizeValue = `${trimmed}px`;
            } else {
              if (!isCssLengthString(trimmed)) {
                throw new Error(`[CKTypography] Role "${roleKey}" sizeCustom must be a CSS length`);
              }
              sizeValue = trimmed;
            }
          }
        }
      } else {
        sizeValue = scale[sizePreset];
        if (typeof sizeValue !== 'string' || !sizeValue.trim()) {
          throw new Error(`[CKTypography] Missing roleScales.${roleKey}.${sizePreset}`);
        }
        if (scaleKind === 'number' && !isNumericString(sizeValue)) {
          throw new Error(`[CKTypography] Role "${roleKey}" roleScales.${sizePreset} must be a number`);
        }
        if (scaleKind === 'css-length' && !isCssLengthString(sizeValue)) {
          throw new Error(`[CKTypography] Role "${roleKey}" roleScales.${sizePreset} must be a CSS length`);
        }
      }

      // For numeric scales, interpret values as px so widget CSS can consume `--typo-*-size` as a valid font-size.
      if (scaleKind === 'number') {
        sizeValue = `${String(sizeValue).trim()}px`;
      }
      const trackingValue = resolveTrackingValue(roleKey, role);
      const lineHeightValue = resolveLineHeightValue(roleKey, role, runtimeScript);

      const familyValue = resolveFamilyValue(family, runtimeScript);
      root.style.setProperty(`--typo-${varKey}-family`, familyValue);
      root.style.setProperty(`--typo-${varKey}-size`, sizeValue);
      root.style.setProperty(`--typo-${varKey}-weight`, weight);
      root.style.setProperty(`--typo-${varKey}-style`, fontStyle);
      root.style.setProperty(`--typo-${varKey}-color`, color);
      root.style.setProperty(`--typo-${varKey}-tracking`, trackingValue);
      root.style.setProperty(`--typo-${varKey}-line-height`, lineHeightValue);
    });
  }

  window.CKTypography = {
    applyTypography,
  };
})();
