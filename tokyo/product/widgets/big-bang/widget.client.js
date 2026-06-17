(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[BigBang] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function assertRecord(value, path) {
    if (!isRecord(value)) throw new Error('[BigBang] ' + path + ' must be an object');
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error('[BigBang] ' + path + ' must be a string');
    return value;
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error('[BigBang] ' + path + ' must be a boolean');
    return value;
  }

  function assertNumber(value, path, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('[BigBang] ' + path + ' must be a finite number');
    }
    if (value < min || value > max) {
      throw new Error('[BigBang] ' + path + ' must be ' + min + '..' + max);
    }
    return value;
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (!options.includes(value)) {
      throw new Error('[BigBang] ' + path + ' must be one of: ' + options.join(', '));
    }
    return value;
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

  function validateBigBangState(state) {
    assertRecord(state, 'state');
    assertRecord(state.coreSize, 'state.coreSize');
    const localeSwitcher = assertRecord(state.localeSwitcher, 'state.localeSwitcher'); assertBoolean(localeSwitcher.enabled, 'state.localeSwitcher.enabled'); assertEnum(localeSwitcher.attachTo, 'state.localeSwitcher.attachTo', ['stage', 'pod']); assertEnum(localeSwitcher.position, 'state.localeSwitcher.position', ['top-left', 'top-center', 'top-right', 'right-middle', 'bottom-right', 'bottom-center', 'bottom-left', 'left-middle']);
    const bigBang = assertRecord(state.bigBang, 'state.bigBang');
    const statement = assertString(bigBang.statement, 'state.bigBang.statement').trim();
    if (!statement) throw new Error('[BigBang] state.bigBang.statement is required');
    return {
      statement,
      showSupportingCopy: assertBoolean(bigBang.showSupportingCopy, 'state.bigBang.showSupportingCopy'),
      supportingCopy: assertString(bigBang.supportingCopy, 'state.bigBang.supportingCopy').trim(),
      alignment: assertEnum(bigBang.alignment, 'state.bigBang.alignment', ['left', 'center']),
      textWidth: assertNumber(bigBang.textWidth, 'state.bigBang.textWidth', 480, 1280),
      gap: assertNumber(bigBang.gap, 'state.bigBang.gap', 8, 80),
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
      const bigBang = validateBigBangState(state);
      if (!window.CKStagePod?.applyStagePod)
        throw new Error('[BigBang] Missing CKStagePod.applyStagePod');
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

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

      coreEl.dataset.align = bigBang.alignment;
      coreEl.style.setProperty('--ck-bigBang-text-width', bigBang.textWidth + 'px');
      coreEl.style.setProperty('--ck-bigBang-gap', bigBang.gap + 'px');
      statementEl.innerHTML = sanitizeInlineHtml(bigBang.statement);
      supportEl.innerHTML = sanitizeInlineHtml(bigBang.supportingCopy);
      supportEl.hidden = !bigBang.showSupportingCopy || !bigBang.supportingCopy;

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[BigBang] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: bigBangRoot,
      });

      if (!window.CKBranding?.applyBacklink) {
        throw new Error('[BigBang] Missing CKBranding.applyBacklink');
      }
      window.CKBranding.applyBacklink(widgetRoot, state);

      if (!window.CKSocialShare?.apply) {
        throw new Error('[BigBang] Missing CKSocialShare.apply');
      }
      window.CKSocialShare.apply(widgetRoot, state, {
        instanceId: context && context.instanceId,
        widgetType: 'big-bang',
        widgetLabel: document.title || 'Big Bang',
        previewMode: context && context.previewMode,
      });
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
      assertRecord(state, 'state');
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

    if (runtimeContext.payload) {
      const initialLocale = runtimeContext.locale || '';
      applyState(runtimeContext.state, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
    }
  }

  runtime.register('big-bang', initBigBang);
})();
