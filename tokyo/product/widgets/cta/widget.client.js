(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CTA] Missing CKWidgetRuntime.register');
  }

  function initCta(widgetRoot, runtimeContext) {
    const ctaRoot = widgetRoot.querySelector('[data-role="cta"]');
    if (!(ctaRoot instanceof HTMLElement)) throw new Error('[CTA] Missing [data-role="cta"]');
    const resolvedInstanceId = runtimeContext.instanceId;

    function applyState(state, context) {
      if (!state) return;
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
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) {
        throw new Error('[CTA] Missing CKHeader.applyHeader');
      }
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[CTA] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: ctaRoot,
      });

      if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
        window.CKBranding.applyBacklink(widgetRoot, state);
      }
    }

    let previewLocaleRequest = 0;

    async function applyPreviewState(
      state,
      locale,
      instanceId,
      previewMode,
      baseLocale,
      translatedLocaleValues,
    ) {
      if (!state) return;
      const requestId = ++previewLocaleRequest;
      const helper =
        window.CK_PREVIEW_L10N &&
        typeof window.CK_PREVIEW_L10N === 'object' &&
        typeof window.CK_PREVIEW_L10N.loadLocalizedState === 'function'
          ? window.CK_PREVIEW_L10N
          : null;
      let localizedState = state;
      if (helper) {
        try {
          localizedState = await helper.loadLocalizedState({
            instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
            locale,
            baseLocale,
            previewMode,
            baseState: state,
            values: translatedLocaleValues,
          });
        } catch (error) {
          if (requestId === previewLocaleRequest) {
            console.error('[CTA] preview localization load failed', error);
          }
          return;
        }
      }
      if (requestId !== previewLocaleRequest) return;
      applyState(localizedState, {
        locale,
        previewMode,
        composedPage: runtimeContext && runtimeContext.composedPage === true,
        instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
      });
    }

    runtime.bindStateUpdates(
      'cta',
      resolvedInstanceId,
      (data) => {
        void applyPreviewState(
          data.state,
          data.locale,
          data.instanceId,
          data.previewMode,
          data.baseLocale,
          data.translatedLocaleValues,
        );
      },
      { requireWidgetName: true },
    );

    const initialLocale = runtimeContext.locale || '';
    const initialState = runtimeContext.state;
    if (initialState)
      applyState(initialState, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
  }

  runtime.register('cta', initCta);
})();
