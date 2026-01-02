(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const SIZE_PRESETS = new Set(['xs', 's', 'm', 'l', 'xl', 'custom']);

  const curatedFonts = {
    Cookie: 'Cookie',
    'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
    'Crimson Text': 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
    Gabriela: 'Gabriela',
    'Homemade Apple': 'Homemade+Apple',
    Inter: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900',
    Lato: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
    'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400..700;1,400..700',
    Lora: 'Lora:ital,wght@0,400..700;1,400..700',
    Manrope: 'Manrope:wght@200..800',
    Michroma: 'Michroma',
    Montserrat: 'Montserrat:ital,wght@0,100..900;1,100..900',
    'Open Sans': 'Open+Sans:ital,wght@0,300..800;1,300..800',
    'Permanent Marker': 'Permanent+Marker',
    'Playfair Display': 'Playfair+Display:ital,wght@0,400..900;1,400..900',
    Raleway: 'Raleway:ital,wght@0,100..900;1,100..900',
    Roboto: 'Roboto:ital,wght@0,100..900;1,100..900',
    'Shadows Into Light': 'Shadows+Into+Light',
  };

  function allowedWeightsForFamily(family) {
    const spec = curatedFonts[family];
    if (!spec) return null;
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
    const spec = curatedFonts[family];
    if (!spec) return null;
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

  const loadedFonts = new Set();

  function ensureFontLoaded(family) {
    const spec = curatedFonts[family];
    if (!spec) {
      throw new Error(`[CKTypography] Unknown font family "${family}"`);
    }
    if (loadedFonts.has(family)) return;
    const id = `ck-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
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

  function applyTypography(typography, root, roleConfig) {
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

    const roleScales = typography.roleScales;
    if (!roleScales || typeof roleScales !== 'object') {
      throw new Error('[CKTypography] typography.roleScales is required');
    }

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
      const color = role.color;

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

      const scale = roleScales[roleKey];
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
        if (typeof sizeCustom !== 'string' || !sizeCustom.trim()) {
          throw new Error(`[CKTypography] Role "${roleKey}" is missing sizeCustom`);
        }
        if (scaleKind === 'number' && !isNumericString(sizeCustom)) {
          throw new Error(`[CKTypography] Role "${roleKey}" sizeCustom must be a number (no units)`);
        }
        if (scaleKind === 'css-length' && !isCssLengthString(sizeCustom)) {
          throw new Error(`[CKTypography] Role "${roleKey}" sizeCustom must be a CSS length`);
        }
        sizeValue = sizeCustom;
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

      root.style.setProperty(`--typo-${varKey}-family`, family);
      root.style.setProperty(`--typo-${varKey}-size`, sizeValue);
      root.style.setProperty(`--typo-${varKey}-weight`, weight);
      root.style.setProperty(`--typo-${varKey}-style`, fontStyle);
      root.style.setProperty(`--typo-${varKey}-color`, color);
    });
  }

  window.CKTypography = {
    applyTypography,
  };
})();
