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

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error('[SplitMedia] ' + path + ' must be a boolean');
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('[SplitMedia] ' + path + ' must be a finite number');
    }
  }

  function assertPositiveNumber(value, path) {
    assertNumber(value, path);
    if (value <= 0) throw new Error('[SplitMedia] ' + path + ' must be > 0');
  }

  function assertFillSource(src, path) {
    assertString(src, path);
    const value = src.trim();
    if (!value) throw new Error('[SplitMedia] ' + path + ' must be a non-empty asset URL');
    if (/[\n\r;]/.test(value) || /^javascript:/i.test(value)) {
      throw new Error('[SplitMedia] ' + path + ' contains an invalid URL');
    }
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || /^https?:\/\//i.test(value)) {
      return value;
    }
    throw new Error('[SplitMedia] ' + path + ' must use a relative, absolute-path, or http(s) URL');
  }

  function assertBorderConfig(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertNumber(value.width, path + '.width');
    assertString(value.color, path + '.color');
    if (value.width < 0 || value.width > 12) throw new Error('[SplitMedia] ' + path + '.width must be 0..12');
  }

  function assertShadowConfig(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertBoolean(value.inset, path + '.inset');
    assertNumber(value.x, path + '.x');
    assertNumber(value.y, path + '.y');
    assertNumber(value.blur, path + '.blur');
    assertNumber(value.spread, path + '.spread');
    assertNumber(value.alpha, path + '.alpha');
    assertString(value.color, path + '.color');
    if (value.alpha < 0 || value.alpha > 100) throw new Error('[SplitMedia] ' + path + '.alpha must be 0..100');
  }

  function assertCardWrapper(value, path) {
    assertRecord(value, path);
    assertBoolean(value.radiusLinked, path + '.radiusLinked');
    assertString(value.radius, path + '.radius');
    assertString(value.radiusTL, path + '.radiusTL');
    assertString(value.radiusTR, path + '.radiusTR');
    assertString(value.radiusBR, path + '.radiusBR');
    assertString(value.radiusBL, path + '.radiusBL');
    assertBorderConfig(value.border, path + '.border');
    assertShadowConfig(value.shadow, path + '.shadow');
  }

  function assertCoreSize(value, path) {
    assertRecord(value, path);
    assertEnum(value.mode, path + '.mode', ['auto', 'fixed', 'responsive']);
    assertPositiveNumber(value.fixedHeight, path + '.fixedHeight');
    assertPositiveNumber(value.minHeight, path + '.minHeight');
    assertPositiveNumber(value.preferredVw, path + '.preferredVw');
    assertPositiveNumber(value.maxHeight, path + '.maxHeight');
    if (value.maxHeight < value.minHeight) {
      throw new Error('[SplitMedia] ' + path + '.maxHeight must be >= ' + path + '.minHeight');
    }
  }

  function assertLocaleSwitcher(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertEnum(value.attachTo, path + '.attachTo', ['stage', 'pod']);
    assertEnum(value.position, path + '.position', [
      'top-left',
      'top-center',
      'top-right',
      'right-middle',
      'bottom-right',
      'bottom-center',
      'bottom-left',
      'left-middle',
    ]);
  }

  const SOCIAL_SHARE_CHANNELS = [
    'copy',
    'sms',
    'email',
    'whatsapp',
    'telegram',
    'signal',
    'messenger',
    'wechat',
    'line',
    'slack',
    'teams',
    'discord',
    'x',
    'linkedin',
    'facebook',
    'reddit',
    'instagram',
    'tiktok',
  ];

  function assertSocialShare(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertRecord(value.channels, path + '.channels');
    SOCIAL_SHARE_CHANNELS.forEach((channel) => {
      assertBoolean(value.channels[channel], path + '.channels.' + channel);
    });
  }

  function mediaSource(fill, kind) {
    assertRecord(fill, 'state.splitMedia.media');
    assertEnum(fill.type, 'state.splitMedia.media.type', [kind]);
    const bucket = assertRecord(fill[kind], 'state.splitMedia.media.' + kind);
    return assertFillSource(bucket.src, 'state.splitMedia.media.' + kind + '.src');
  }

  function normalizeState(state) {
    assertRecord(state, 'state');
    assertCoreSize(state.coreSize, 'state.coreSize');
    assertLocaleSwitcher(state.localeSwitcher, 'state.localeSwitcher');
    assertRecord(state.behavior, 'state.behavior');
    assertSocialShare(state.behavior.socialShare, 'state.behavior.socialShare');

    const splitMedia = assertRecord(state.splitMedia, 'state.splitMedia');
    const media = assertRecord(splitMedia.media, 'state.splitMedia.media');
    const kind = assertEnum(media.type, 'state.splitMedia.media.type', ['none', 'image', 'video']);
    if (kind === 'none' && Object.keys(media).some((key) => key !== 'type')) {
      throw new Error('[SplitMedia] state.splitMedia.media empty state must not include media buckets');
    }
    assertCardWrapper(splitMedia.appearance?.cardwrapper, 'state.splitMedia.appearance.cardwrapper');
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

    if (normalized.kind === 'none') {
      media.dataset.empty = 'true';
      media.setAttribute('aria-label', 'No media selected');
      return media;
    }

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
      const normalized = normalizeState(state);

      if (!window.CKStagePod?.applyStagePod) {
        throw new Error('[SplitMedia] Missing CKStagePod.applyStagePod');
      }
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

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
      if (!window.CKSurface?.applyCardWrapper) {
        throw new Error('[SplitMedia] Missing CKSurface.applyCardWrapper');
      }
      window.CKSurface.applyCardWrapper(normalized.appearance.cardwrapper, stage);
      coreEl.replaceChildren(stage);

      if (!window.CKBranding || typeof window.CKBranding.applyBacklink !== 'function') {
        throw new Error('[SplitMedia] Missing CKBranding.applyBacklink');
      }
      window.CKBranding.applyBacklink(widgetRoot, state);

      if (!window.CKSocialShare || typeof window.CKSocialShare.apply !== 'function') {
        throw new Error('[SplitMedia] Missing CKSocialShare.apply');
      }
      window.CKSocialShare.apply(widgetRoot, state, {
        instanceId: resolvedInstanceId,
        widgetType: 'split-media',
        widgetLabel: 'Split Media',
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

    if (runtimeContext.payload) {
      const initialLocale = runtimeContext.locale || '';
      applyState(runtimeContext.state, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
    }
  }

  runtime.register('split-media', initSplitMedia);
})();
