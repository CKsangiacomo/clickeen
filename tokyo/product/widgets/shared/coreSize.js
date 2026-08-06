(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function numberOr(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyCoreSize(raw, coreEl) {
    if (!(coreEl instanceof HTMLElement)) {
      throw new Error('[CKCoreSize] coreEl must be an HTMLElement');
    }
    var size = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    var mode = typeof size.mode === 'string' ? size.mode : 'auto';

    coreEl.style.removeProperty('height');
    coreEl.style.removeProperty('min-height');

    if (mode === 'auto') {
      coreEl.dataset.coreSizeMode = 'auto';
      return;
    }

    if (mode === 'fixed') {
      coreEl.dataset.coreSizeMode = 'fixed';
      coreEl.style.height = clamp(numberOr(size.fixedHeight, 0), 0, 2000) + 'px';
      return;
    }

    if (mode === 'responsive') {
      coreEl.dataset.coreSizeMode = 'responsive';
      var minHeight = clamp(numberOr(size.minHeight, 0), 0, 2000);
      var preferredVw = clamp(numberOr(size.preferredVw, 40), 0, 200);
      var maxHeight = clamp(numberOr(size.maxHeight, Math.max(minHeight, 720)), minHeight, 2400);
      coreEl.style.minHeight = 'clamp(' + minHeight + 'px, ' + preferredVw + 'vw, ' + maxHeight + 'px)';
      return;
    }

    throw new Error('[CKCoreSize] coreSize.mode must be auto|fixed|responsive');
  }

  window.CKCoreSize = window.CKCoreSize || {};
  window.CKCoreSize.applyCoreSize = applyCoreSize;
})();
