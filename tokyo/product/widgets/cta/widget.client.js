(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CTA] Missing CKWidgetRuntime.register');
  }

  function initCta(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;
    const ctaRoot = widgetRoot.querySelector('[data-role="cta"]');
    if (!(ctaRoot instanceof HTMLElement)) throw new Error('[CTA] Missing [data-role="cta"]');

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[CTA] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[CTA] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      ctaRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
        localeSwitcher: { varKey: 'localeSwitcher' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[CTA] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
      throw new Error('[CTA] Missing CKLocaleSwitcher.applyLocaleSwitcher');
    }
    window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
      composedPage: runtimeContext && runtimeContext.composedPage === true,
      locale: runtimeContext && runtimeContext.locale,
      previewMode: runtimeContext && runtimeContext.previewMode,
      typographyScope: ctaRoot,
    });

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('cta', initCta);
})();
