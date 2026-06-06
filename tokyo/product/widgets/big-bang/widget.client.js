(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[BigBang] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR']);
    wrapper.querySelectorAll('*').forEach(function (node) {
      const el = node;
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      Array.from(el.attributes).forEach(function (attr) {
        el.removeAttribute(attr.name);
      });
    });
    return wrapper.innerHTML;
  }

  function normalizeBigBang(state) {
    const bigBang = isRecord(state.bigBang) ? state.bigBang : {};
    const textWidth =
      typeof bigBang.textWidth === 'number' && Number.isFinite(bigBang.textWidth)
        ? Math.min(Math.max(bigBang.textWidth, 480), 1280)
        : 880;
    const gap =
      typeof bigBang.gap === 'number' && Number.isFinite(bigBang.gap)
        ? Math.min(Math.max(bigBang.gap, 8), 80)
        : 24;
    return {
      statement: String(bigBang.statement || '').trim(),
      showSupportingCopy: bigBang.showSupportingCopy !== false,
      supportingCopy: String(bigBang.supportingCopy || '').trim(),
      alignment: bigBang.alignment === 'center' ? 'center' : 'left',
      textWidth: textWidth,
      gap: gap,
    };
  }

  function initBigBang(widgetRoot, runtimeContext) {
    const bigBangRoot = widgetRoot.querySelector('[data-role="big-bang"]');
    const coreEl = widgetRoot.querySelector('[data-role="big-bang-core"]');
    const statementEl = widgetRoot.querySelector('[data-role="big-bang-statement"]');
    const supportEl = widgetRoot.querySelector('[data-role="big-bang-support"]');
    if (!(bigBangRoot instanceof HTMLElement))
      throw new Error('[BigBang] Missing [data-role="big-bang"]');
    if (!(coreEl instanceof HTMLElement))
      throw new Error('[BigBang] Missing [data-role="big-bang-core"]');
    if (!(statementEl instanceof HTMLElement))
      throw new Error('[BigBang] Missing [data-role="big-bang-statement"]');
    if (!(supportEl instanceof HTMLElement))
      throw new Error('[BigBang] Missing [data-role="big-bang-support"]');
    const resolvedInstanceId = runtimeContext.instanceId;

    function applyState(state, context) {
      if (!state) return;
      if (!window.CKStagePod?.applyStagePod)
        throw new Error('[BigBang] Missing CKStagePod.applyStagePod');
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

      if (!window.CKTypography?.applyTypography)
        throw new Error('[BigBang] Missing CKTypography.applyTypography');
      window.CKTypography.applyTypography(
        state.typography,
        bigBangRoot,
        {
          title: { varKey: 'title' },
          body: { varKey: 'body' },
          button: { varKey: 'button' },
          localeSwitcher: { varKey: 'localeSwitcher' },
          bigBang: { varKey: 'bigBang' },
        },
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) throw new Error('[BigBang] Missing CKHeader.applyHeader');
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKCoreSize?.applyCoreSize)
        throw new Error('[BigBang] Missing CKCoreSize.applyCoreSize');
      window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[BigBang] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: bigBangRoot,
      });

      const bigBang = normalizeBigBang(state);
      if (!bigBang.statement) throw new Error('[BigBang] bigBang.statement is required');
      coreEl.dataset.align = bigBang.alignment;
      coreEl.style.setProperty('--ck-bigBang-text-width', bigBang.textWidth + 'px');
      coreEl.style.setProperty('--ck-bigBang-gap', bigBang.gap + 'px');
      statementEl.innerHTML = sanitizeInlineHtml(bigBang.statement);
      supportEl.innerHTML = sanitizeInlineHtml(bigBang.supportingCopy);
      supportEl.hidden = !bigBang.showSupportingCopy || !bigBang.supportingCopy;

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
            console.error('[BigBang] preview localization load failed', error);
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
      'big-bang',
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

  runtime.register('big-bang', initBigBang);
})();
