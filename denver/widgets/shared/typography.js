(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const sizePresetMap = {
    s: '14px',
    m: '16px',
    l: '18px',
    xl: '20px',
  };

  const curatedFonts = {
    Inter: 'Inter:wght@400;500;600;700',
    Roboto: 'Roboto:wght@400;500;600;700',
    'Open Sans': 'Open+Sans:wght@400;600;700',
    'Google Sans': 'Google+Sans:wght@400;500;600;700',
    'Playfair Display': 'Playfair+Display:wght@400;600;700',
    Ubuntu: 'Ubuntu:wght@400;500;700',
    Rubik: 'Rubik:wght@400;500;600;700',
    'Roboto Slab': 'Roboto+Slab:wght@400;500;600;700',
    'DM Sans': 'DM+Sans:wght@400;500;600;700',
    Merriweather: 'Merriweather:wght@400;600;700',
    'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
    Barlow: 'Barlow:wght@400;500;600;700',
    'Bebas Neue': 'Bebas+Neue',
    'DM Serif Text': 'DM+Serif+Text:ital@0;1',
    'Zalando Sans Expanded': 'Zalando+Sans+Expanded:wght@400;600;700',
    Caprasimo: 'Caprasimo',
    Pacifico: 'Pacifico',
  };

  const loadedFonts = new Set();

  function ensureFontLoaded(family) {
    const spec = curatedFonts[family];
    if (!spec) return;
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

    const globalFamily = typography.globalFamily;
    if (typeof globalFamily !== 'string' || !globalFamily.trim()) {
      throw new Error('[CKTypography] typography.globalFamily is required');
    }
    ensureFontLoaded(globalFamily);

    const roles = typography.roles;
    if (!roles || typeof roles !== 'object') {
      throw new Error('[CKTypography] typography.roles is required');
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
      const sizeMap = cfg.sizeMap && typeof cfg.sizeMap === 'object' ? cfg.sizeMap : sizePresetMap;

      const family = role.family;
      const sizePreset = role.sizePreset;
      const weight = role.weight;

      if (typeof family !== 'string' || !family.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing family`);
      }
      if (typeof sizePreset !== 'string' || !sizePreset.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing sizePreset`);
      }
      if (typeof weight !== 'string' || !weight.trim()) {
        throw new Error(`[CKTypography] Role "${roleKey}" is missing weight`);
      }

      ensureFontLoaded(family);
      const sizeValue = sizeMap[sizePreset];
      if (!sizeValue) {
        throw new Error(`[CKTypography] Unknown sizePreset "${sizePreset}" for role "${roleKey}"`);
      }

      root.style.setProperty(`--typo-${varKey}-family`, family);
      root.style.setProperty(`--typo-${varKey}-size`, sizeValue);
      root.style.setProperty(`--typo-${varKey}-weight`, weight);
    });
  }

  window.CKTypography = {
    applyTypography,
    sizePresetMap,
  };
})();
