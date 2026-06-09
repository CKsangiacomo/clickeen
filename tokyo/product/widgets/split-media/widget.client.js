(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[SplitMedia] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function assertRecord(value, path) {
    if (!isRecord(value)) throw new Error('[SplitMedia] ' + path + ' must be an object');
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error('[SplitMedia] ' + path + ' must be a string');
    return value;
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (options.indexOf(value) === -1) {
      throw new Error('[SplitMedia] ' + path + ' must be one of: ' + options.join(', '));
    }
    return value;
  }

  function mediaSource(fill, kind) {
    assertRecord(fill, 'state.splitMedia.media');
    assertEnum(fill.type, 'state.splitMedia.media.type', [kind]);
    const bucket = assertRecord(fill[kind], 'state.splitMedia.media.' + kind);
    const src = assertString(bucket.src, 'state.splitMedia.media.' + kind + '.src').trim();
    if (!src) throw new Error('[SplitMedia] state.splitMedia.media requires a ' + kind + ' asset');
    return src;
  }

  function normalizeState(state) {
    const splitMedia = assertRecord(state.splitMedia, 'state.splitMedia');
    const media = assertRecord(splitMedia.media, 'state.splitMedia.media');
    const kind = assertEnum(media.type, 'state.splitMedia.media.type', ['image', 'video']);
    return {
      kind,
      fill: media,
      alt: assertString(splitMedia.alt, 'state.splitMedia.alt'),
      fit: assertEnum(splitMedia.fit, 'state.splitMedia.fit', ['cover', 'contain']),
      position: assertEnum(splitMedia.position, 'state.splitMedia.position', ['top', 'bottom', 'left', 'right', 'center']),
      appearance: assertRecord(splitMedia.appearance, 'state.splitMedia.appearance'),
    };
  }

  function renderMedia(normalized) {
    const media = document.createElement('div');
    media.className = 'ck-split-media__media';

    if (normalized.kind === 'image') {
      const image = document.createElement('img');
      image.src = mediaSource(normalized.fill, 'image');
      image.alt = normalized.alt;
      image.loading = 'lazy';
      image.style.objectFit = normalized.fit;
      image.style.objectPosition = normalized.position;
      media.appendChild(image);
      return media;
    }

    const videoFill = assertRecord(normalized.fill.video, 'state.splitMedia.media.video');
    const video = document.createElement('video');
    video.src = mediaSource(normalized.fill, 'video');
    const poster = typeof videoFill.poster === 'string' ? videoFill.poster.trim() : '';
    if (poster) video.poster = poster;
    video.muted = videoFill.muted !== false;
    video.loop = videoFill.loop !== false;
    video.autoplay = videoFill.autoplay !== false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', normalized.alt || 'Video');
    video.style.objectFit = normalized.fit;
    video.style.objectPosition = normalized.position;
    media.appendChild(video);
    return media;
  }

  function initSplitMedia(widgetRoot, runtimeContext) {
    const splitMediaRoot = widgetRoot.querySelector('[data-role="split-media"]');
    const coreEl = widgetRoot.querySelector('[data-role="split-media-core"]');
    if (!(splitMediaRoot instanceof HTMLElement)) {
      throw new Error('[SplitMedia] Missing [data-role="split-media"]');
    }
    if (!(coreEl instanceof HTMLElement)) {
      throw new Error('[SplitMedia] Missing [data-role="split-media-core"]');
    }
    const resolvedInstanceId = runtimeContext.instanceId;

    function applyState(state, context) {
      if (!state) return;

      if (!window.CKStagePod?.applyStagePod) {
        throw new Error('[SplitMedia] Missing CKStagePod.applyStagePod');
      }
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

      if (!window.CKTypography?.applyTypography) {
        throw new Error('[SplitMedia] Missing CKTypography.applyTypography');
      }
      window.CKTypography.applyTypography(
        state.typography,
        splitMediaRoot,
        {
          title: { varKey: 'title' },
          body: { varKey: 'body' },
          button: { varKey: 'button' },
          localeSwitcher: { varKey: 'localeSwitcher' },
        },
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) throw new Error('[SplitMedia] Missing CKHeader.applyHeader');
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKCoreSize?.applyCoreSize) {
        throw new Error('[SplitMedia] Missing CKCoreSize.applyCoreSize');
      }
      window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

      const normalized = normalizeState(state);
      if (!window.CKSurface?.applyCardWrapper) {
        throw new Error('[SplitMedia] Missing CKSurface.applyCardWrapper');
      }
      window.CKSurface.applyCardWrapper(normalized.appearance.cardwrapper, coreEl);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[SplitMedia] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: splitMediaRoot,
      });

      coreEl.style.setProperty('--ck-split-media-fit', normalized.fit);
      coreEl.style.setProperty('--ck-split-media-position', normalized.position);

      const stage = document.createElement('div');
      stage.className = 'ck-split-media__stage';
      stage.setAttribute('role', 'group');
      stage.setAttribute('aria-roledescription', 'visual');
      stage.setAttribute('aria-label', 'Split media visual');
      stage.appendChild(renderMedia(normalized));
      coreEl.replaceChildren(stage);

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
            console.error('[SplitMedia] preview localization load failed', error);
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
      'split-media',
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
    if (initialState) {
      applyState(initialState, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
    }
  }

  runtime.register('split-media', initSplitMedia);
})();
