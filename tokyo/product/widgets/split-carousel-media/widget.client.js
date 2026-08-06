(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[SplitCarouselMedia] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function assertRecord(value, path) {
    if (!isRecord(value)) throw new Error('[SplitCarouselMedia] ' + path + ' must be an object');
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') {
      throw new Error('[SplitCarouselMedia] ' + path + ' must be a string');
    }
    return value;
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') {
      throw new Error('[SplitCarouselMedia] ' + path + ' must be a boolean');
    }
    return value;
  }

  function assertNumber(value, path, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error('[SplitCarouselMedia] ' + path + ' must be ' + min + '..' + max);
    }
    return value;
  }

  function assertPositiveNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error('[SplitCarouselMedia] ' + path + ' must be a positive finite number');
    }
    return value;
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (options.indexOf(value) === -1) {
      throw new Error('[SplitCarouselMedia] ' + path + ' must be one of: ' + options.join(', '));
    }
    return value;
  }

  function assertFillSource(src, path) {
    assertString(src, path);
    const value = src.trim();
    if (!value) throw new Error('[SplitCarouselMedia] ' + path + ' must be a non-empty asset URL');
    if (/[\n\r;]/.test(value) || /^javascript:/i.test(value)) {
      throw new Error('[SplitCarouselMedia] ' + path + ' contains an invalid URL');
    }
    if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || /^https?:\/\//i.test(value)) {
      return value;
    }
    throw new Error('[SplitCarouselMedia] ' + path + ' must use a relative, absolute-path, or http(s) URL');
  }

  function assertBorderConfig(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertNumber(value.width, path + '.width', 0, 12);
    assertString(value.color, path + '.color');
  }

  function assertShadowConfig(value, path) {
    assertRecord(value, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertBoolean(value.inset, path + '.inset');
    assertNumber(value.x, path + '.x', -200, 200);
    assertNumber(value.y, path + '.y', -200, 200);
    assertNumber(value.blur, path + '.blur', 0, 400);
    assertNumber(value.spread, path + '.spread', -200, 200);
    assertNumber(value.alpha, path + '.alpha', 0, 100);
    assertString(value.color, path + '.color');
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
      throw new Error('[SplitCarouselMedia] ' + path + '.maxHeight must be >= ' + path + '.minHeight');
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
    SOCIAL_SHARE_CHANNELS.forEach(function (channel) {
      assertBoolean(value.channels[channel], path + '.channels.' + channel);
    });
  }

  function mediaSource(fill, kind, path) {
    assertRecord(fill, path);
    assertEnum(fill.type, path + '.type', [kind]);
    const bucket = assertRecord(fill[kind], path + '.' + kind);
    return assertFillSource(bucket.src, path + '.' + kind + '.src');
  }

  function normalizeItem(raw, index) {
    const item = assertRecord(raw, 'state.splitCarouselMedia.items[' + index + ']');
    const id = assertString(item.id, 'state.splitCarouselMedia.items[' + index + '].id').trim();
    if (!id) throw new Error('[SplitCarouselMedia] state.splitCarouselMedia.items[' + index + '].id is required');
    const media = assertRecord(item.media, 'state.splitCarouselMedia.items[' + index + '].media');
    const kind = assertEnum(media.type, 'state.splitCarouselMedia.items[' + index + '].media.type', [
      'none',
      'image',
      'video',
    ]);
    if (kind === 'none' && Object.keys(media).some((key) => key !== 'type')) {
      throw new Error(
        '[SplitCarouselMedia] state.splitCarouselMedia.items[' + index + '].media empty state must not include media buckets',
      );
    }
    return {
      id,
      kind,
      fill: media,
      alt: assertString(item.alt, 'state.splitCarouselMedia.items[' + index + '].alt'),
    };
  }

  function normalizeState(state) {
    assertRecord(state, 'state');
    assertCoreSize(state.coreSize, 'state.coreSize');
    assertLocaleSwitcher(state.localeSwitcher, 'state.localeSwitcher');
    assertRecord(state.behavior, 'state.behavior');
    assertSocialShare(state.behavior.socialShare, 'state.behavior.socialShare');

    const splitCarouselMedia = assertRecord(state.splitCarouselMedia, 'state.splitCarouselMedia');
    const itemsRaw = Array.isArray(splitCarouselMedia.items) ? splitCarouselMedia.items : null;
    if (!itemsRaw) throw new Error('[SplitCarouselMedia] state.splitCarouselMedia.items must be an array');
    if (itemsRaw.length < 2 || itemsRaw.length > 6) {
      throw new Error('[SplitCarouselMedia] state.splitCarouselMedia.items must contain 2-6 visuals');
    }
    const seen = {};
    const items = itemsRaw.map(function (item, index) {
      const normalized = normalizeItem(item, index);
      if (seen[normalized.id]) throw new Error('[SplitCarouselMedia] duplicate item id: ' + normalized.id);
      seen[normalized.id] = true;
      return normalized;
    });
    const media = assertRecord(splitCarouselMedia.media, 'state.splitCarouselMedia.media');
    const carousel = assertRecord(splitCarouselMedia.carousel, 'state.splitCarouselMedia.carousel');
    const appearance = assertRecord(splitCarouselMedia.appearance, 'state.splitCarouselMedia.appearance');
    assertCardWrapper(appearance.cardwrapper, 'state.splitCarouselMedia.appearance.cardwrapper');
    return {
      items,
      fit: assertEnum(media.fit, 'state.splitCarouselMedia.media.fit', ['cover', 'contain']),
      position: assertEnum(media.position, 'state.splitCarouselMedia.media.position', [
        'top',
        'bottom',
        'left',
        'right',
        'center',
      ]),
      carousel: {
        transition: assertEnum(carousel.transition, 'state.splitCarouselMedia.carousel.transition', [
          'slide',
          'fade',
        ]),
        autoplay: assertBoolean(carousel.autoplay, 'state.splitCarouselMedia.carousel.autoplay'),
        intervalMs: assertNumber(carousel.intervalMs, 'state.splitCarouselMedia.carousel.intervalMs', 2000, 12000),
        loop: assertBoolean(carousel.loop, 'state.splitCarouselMedia.carousel.loop'),
        showArrows: assertBoolean(carousel.showArrows, 'state.splitCarouselMedia.carousel.showArrows'),
        showDots: assertBoolean(carousel.showDots, 'state.splitCarouselMedia.carousel.showDots'),
      },
      appearance,
    };
  }

  function renderItem(item, fit, position, index) {
    const media = document.createElement('div');
    media.className = 'ck-split-carousel-media__media';
    media.dataset.itemId = item.id;

    if (item.kind === 'none') {
      media.dataset.empty = 'true';
      media.setAttribute('aria-label', 'No media selected');
      return media;
    }

    if (item.kind === 'image') {
      const image = document.createElement('img');
      image.src = mediaSource(
        item.fill,
        'image',
        'state.splitCarouselMedia.items[' + index + '].media',
      );
      image.alt = item.alt;
      image.loading = 'lazy';
      image.style.objectFit = fit;
      image.style.objectPosition = position;
      media.appendChild(image);
      return media;
    }

    const videoFill = assertRecord(
      item.fill.video,
      'state.splitCarouselMedia.items[' + index + '].media.video',
    );
    const video = document.createElement('video');
    video.src = mediaSource(
      item.fill,
      'video',
      'state.splitCarouselMedia.items[' + index + '].media',
    );
    const poster = typeof videoFill.poster === 'string' ? videoFill.poster.trim() : '';
    if (poster) video.poster = poster;
    video.muted = videoFill.muted !== false;
    video.loop = videoFill.loop !== false;
    video.autoplay = videoFill.autoplay !== false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', item.alt || 'Video');
    video.style.objectFit = fit;
    video.style.objectPosition = position;
    media.appendChild(video);
    return media;
  }

  function renderControls(stage, count, activeIndex, carousel, setActive) {
    if (carousel.showArrows) {
      ['prev', 'next'].forEach(function (dir) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ck-split-carousel-media__control';
        button.dataset.dir = dir;
        button.setAttribute('aria-label', dir === 'prev' ? 'Previous visual' : 'Next visual');
        button.textContent = dir === 'prev' ? '<' : '>';
        button.addEventListener('click', function () {
          setActive(dir === 'prev' ? activeIndex() - 1 : activeIndex() + 1);
        });
        stage.appendChild(button);
      });
    }

    if (carousel.showDots) {
      const dots = document.createElement('div');
      dots.className = 'ck-split-carousel-media__dots';
      dots.setAttribute('role', 'tablist');
      for (let i = 0; i < count; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'ck-split-carousel-media__dot';
        dot.setAttribute('aria-label', 'Show visual ' + (i + 1));
        dot.dataset.index = String(i);
        dot.addEventListener('click', function (event) {
          setActive(Number(event.currentTarget.dataset.index || 0));
        });
        dots.appendChild(dot);
      }
      stage.appendChild(dots);
    }
  }

  function initSplitCarouselMedia(widgetRoot, runtimeContext) {
    const splitCarouselMediaRoot = widgetRoot.querySelector('[data-role="split-carousel-media"]');
    const coreEl = widgetRoot.querySelector('[data-role="split-carousel-media-core"]');
    if (!(splitCarouselMediaRoot instanceof HTMLElement)) {
      throw new Error('[SplitCarouselMedia] Missing [data-role="split-carousel-media"]');
    }
    if (!(coreEl instanceof HTMLElement)) {
      throw new Error('[SplitCarouselMedia] Missing [data-role="split-carousel-media-core"]');
    }
    const resolvedInstanceId = runtimeContext.instanceId;

    function clearAutoplay() {
      if (widgetRoot.__ckSplitCarouselMediaAutoplayTimer) {
        window.clearInterval(widgetRoot.__ckSplitCarouselMediaAutoplayTimer);
        widgetRoot.__ckSplitCarouselMediaAutoplayTimer = 0;
      }
    }

    function applyState(state, context) {
      const normalized = normalizeState(state);
      clearAutoplay();

      if (!window.CKStagePod?.applyStagePod) {
        throw new Error('[SplitCarouselMedia] Missing CKStagePod.applyStagePod');
      }
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

      if (!window.CKTypography?.applyTypography) {
        throw new Error('[SplitCarouselMedia] Missing CKTypography.applyTypography');
      }
      window.CKTypography.applyTypography(
        state.typography,
        splitCarouselMediaRoot,
        {
          title: { varKey: 'title' },
          body: { varKey: 'body' },
          button: { varKey: 'button' },
          localeSwitcher: { varKey: 'locale-switcher' },
        },
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) {
        throw new Error('[SplitCarouselMedia] Missing CKHeader.applyHeader');
      }
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKCoreSize?.applyCoreSize) {
        throw new Error('[SplitCarouselMedia] Missing CKCoreSize.applyCoreSize');
      }
      window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[SplitCarouselMedia] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: splitCarouselMediaRoot,
      });

      splitCarouselMediaRoot.dataset.transition = normalized.carousel.transition;
      coreEl.style.setProperty('--ck-split-carousel-media-fit', normalized.fit);
      coreEl.style.setProperty('--ck-split-carousel-media-position', normalized.position);

      const stage = document.createElement('div');
      stage.className = 'ck-split-carousel-media__stage';
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-roledescription', 'carousel');
      stage.setAttribute('aria-label', 'Split carousel media visuals');
      if (!window.CKSurface?.applyCardWrapper) {
        throw new Error('[SplitCarouselMedia] Missing CKSurface.applyCardWrapper');
      }
      window.CKSurface.applyCardWrapper(normalized.appearance.cardwrapper, stage);

      let active = 0;
      const slides = normalized.items.map(function (item, index) {
        const slide = renderItem(item, normalized.fit, normalized.position, index);
        slide.dataset.active = index === 0 ? 'true' : 'false';
        stage.appendChild(slide);
        return slide;
      });

      function applyActive(next) {
        if (next < 0) next = normalized.carousel.loop ? slides.length - 1 : 0;
        if (next >= slides.length) next = normalized.carousel.loop ? 0 : slides.length - 1;
        active = next;
        slides.forEach(function (slide, index) {
          slide.dataset.active = index === active ? 'true' : 'false';
        });
        stage.querySelectorAll('.ck-split-carousel-media__dot').forEach(function (dot, index) {
          dot.setAttribute('aria-current', index === active ? 'true' : 'false');
        });
      }

      renderControls(
        stage,
        slides.length,
        function () {
          return active;
        },
        normalized.carousel,
        applyActive,
      );

      if (normalized.carousel.autoplay && slides.length > 1) {
        widgetRoot.__ckSplitCarouselMediaAutoplayTimer = window.setInterval(function () {
          if (!document.body.contains(stage)) {
            clearAutoplay();
            return;
          }
          applyActive(active + 1);
        }, normalized.carousel.intervalMs);
      }

      coreEl.replaceChildren(stage);
      applyActive(0);

      if (!window.CKBranding || typeof window.CKBranding.applyBacklink !== 'function') {
        throw new Error('[SplitCarouselMedia] Missing CKBranding.applyBacklink');
      }
      window.CKBranding.applyBacklink(widgetRoot, state);

      if (!window.CKSocialShare || typeof window.CKSocialShare.apply !== 'function') {
        throw new Error('[SplitCarouselMedia] Missing CKSocialShare.apply');
      }
      window.CKSocialShare.apply(widgetRoot, state, {
        instanceId: resolvedInstanceId,
        widgetType: 'split-carousel-media',
        widgetLabel: 'Split Carousel Media',
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
            console.error('[SplitCarouselMedia] preview localization load failed', error);
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
      'split-carousel-media',
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

  runtime.register('split-carousel-media', initSplitCarouselMedia);
})();
