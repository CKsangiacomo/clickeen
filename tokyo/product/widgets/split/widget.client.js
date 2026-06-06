(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Split] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function mediaSource(media, kind) {
    if (!isRecord(media)) return '';
    if (kind === 'image' && isRecord(media.image) && typeof media.image.src === 'string') return media.image.src.trim();
    if (kind === 'video' && isRecord(media.video) && typeof media.video.src === 'string') return media.video.src.trim();
    return '';
  }

  function mediaAlt(item) {
    if (item.kind === 'image' && isRecord(item.image) && typeof item.image.alt === 'string') return item.image.alt;
    if (item.kind === 'video' && isRecord(item.video) && typeof item.video.alt === 'string') return item.video.alt;
    return '';
  }

  function normalizeItem(raw, index) {
    if (!isRecord(raw)) throw new Error('[Split] core.items[' + index + '] must be an object');
    var kind = raw.kind === 'video' ? 'video' : raw.kind === 'image' ? 'image' : raw.kind === 'instance' ? 'instance' : '';
    if (!kind) throw new Error('[Split] core.items[' + index + '].kind must be image|video|instance');
    var src = kind === 'instance' ? '' : mediaSource(raw.media, kind);
    var instance = isRecord(raw.instance) ? raw.instance : {};
    var instanceId = typeof instance.instanceId === 'string' ? instance.instanceId.trim().toUpperCase() : '';
    if (kind === 'instance' && !instanceId) {
      throw new Error('[Split] core.items[' + index + '].instance.instanceId is required');
    }
    if (kind !== 'instance' && !src) throw new Error('[Split] core.items[' + index + '].media requires a ' + kind + ' asset');
    return {
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : 'item-' + index,
      kind: kind,
      media: raw.media,
      instanceId: instanceId,
      alt: mediaAlt(raw),
    };
  }

  function normalizeState(state) {
    if (!isRecord(state.core)) throw new Error('[Split] state.core must be an object');
    var itemsRaw = Array.isArray(state.core.items) ? state.core.items : [];
    var carousel = isRecord(state.core.carousel) ? state.core.carousel : {};
    var enabled = carousel.enabled === true;
    if (!enabled && itemsRaw.length !== 1) throw new Error('[Split] static Split requires exactly one core item');
    if (enabled && (itemsRaw.length < 2 || itemsRaw.length > 6)) {
      throw new Error('[Split] carousel Split requires 2-6 core items');
    }
    var seen = {};
    var items = itemsRaw.map(function (item, index) {
      var normalized = normalizeItem(item, index);
      if (seen[normalized.id]) throw new Error('[Split] duplicate core item id: ' + normalized.id);
      seen[normalized.id] = true;
      return normalized;
    });
    var media = isRecord(state.core.media) ? state.core.media : {};
    return {
      items: items,
      mediaFit: media.fit === 'contain' ? 'contain' : 'cover',
      mediaPosition: ['top', 'bottom', 'left', 'right', 'center'].indexOf(media.position) >= 0 ? media.position : 'center',
      carousel: {
        enabled: enabled,
        transition: carousel.transition === 'fade' ? 'fade' : 'slide',
        autoplay: carousel.autoplay === true,
        intervalMs:
          typeof carousel.intervalMs === 'number' && Number.isFinite(carousel.intervalMs)
            ? Math.min(Math.max(carousel.intervalMs, 2000), 12000)
            : 5000,
        loop: carousel.loop !== false,
        showArrows: carousel.showArrows !== false,
        showDots: carousel.showDots !== false,
      },
    };
  }

  function renderEmbeddedInstance(item, embeddedInstances) {
    var embedded = embeddedInstances && embeddedInstances[item.instanceId];
    if (!isRecord(embedded) || typeof embedded.htmlRoot !== 'string' || typeof embedded.widgetType !== 'string') {
      throw new Error('[Split] Missing embedded widget package for ' + item.instanceId);
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'ck-split__embedded';
    wrapper.dataset.itemId = item.id;
    wrapper.innerHTML = embedded.htmlRoot;
    var childRoot = wrapper.querySelector('[data-ck-widget][data-role="root"]');
    if (!(childRoot instanceof HTMLElement)) {
      throw new Error('[Split] Embedded widget root missing for ' + item.instanceId);
    }
    childRoot.setAttribute('data-ck-embedded-instance', 'true');
    var init = window.CK_WIDGET_INITIALIZERS && window.CK_WIDGET_INITIALIZERS[embedded.widgetType];
    if (typeof init !== 'function') {
      throw new Error('[Split] Embedded widget initializer missing for ' + embedded.widgetType);
    }
    init(childRoot);
    return wrapper;
  }

  function renderItem(item, fit, position, embeddedInstances) {
    if (item.kind === 'instance') return renderEmbeddedInstance(item, embeddedInstances);

    var media = document.createElement('div');
    media.className = 'ck-split__media';
    media.dataset.itemId = item.id;

    if (item.kind === 'image') {
      var image = document.createElement('img');
      image.src = mediaSource(item.media, 'image');
      image.alt = item.alt || '';
      image.loading = 'lazy';
      image.style.objectFit = fit;
      image.style.objectPosition = position;
      media.appendChild(image);
      return media;
    }

    var videoCfg = isRecord(item.media.video) ? item.media.video : {};
    var video = document.createElement('video');
    video.src = mediaSource(item.media, 'video');
    if (typeof videoCfg.poster === 'string' && videoCfg.poster.trim()) video.poster = videoCfg.poster.trim();
    video.muted = videoCfg.muted !== false;
    video.loop = videoCfg.loop !== false;
    video.autoplay = videoCfg.autoplay !== false;
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
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'ck-split__control';
        button.dataset.dir = dir;
        button.setAttribute('aria-label', dir === 'prev' ? 'Previous visual' : 'Next visual');
        button.textContent = dir === 'prev' ? '‹' : '›';
        button.addEventListener('click', function () {
          setActive(dir === 'prev' ? activeIndex() - 1 : activeIndex() + 1);
        });
        stage.appendChild(button);
      });
    }

    if (carousel.showDots) {
      var dots = document.createElement('div');
      dots.className = 'ck-split__dots';
      dots.setAttribute('role', 'tablist');
      for (var i = 0; i < count; i += 1) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'ck-split__dot';
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

  function initSplit(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;
    const splitRoot = widgetRoot.querySelector('[data-role="split"]');
    const coreEl = widgetRoot.querySelector('[data-role="split-core"]');
    if (!(splitRoot instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split"]');
    if (!(coreEl instanceof HTMLElement)) throw new Error('[Split] Missing [data-role="split-core"]');
    if (widgetRoot.__ckSplitAutoplayTimer) {
      window.clearInterval(widgetRoot.__ckSplitAutoplayTimer);
      widgetRoot.__ckSplitAutoplayTimer = 0;
    }

    if (!window.CKStagePod?.applyStagePod) throw new Error('[Split] Missing CKStagePod.applyStagePod');
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) throw new Error('[Split] Missing CKTypography.applyTypography');
    window.CKTypography.applyTypography(
      state.typography,
      splitRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
        localeSwitcher: { varKey: 'localeSwitcher' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    if (!window.CKHeader?.applyHeader) throw new Error('[Split] Missing CKHeader.applyHeader');
    window.CKHeader.applyHeader(state, widgetRoot);

    if (!window.CKCoreSize?.applyCoreSize) throw new Error('[Split] Missing CKCoreSize.applyCoreSize');
    window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

    if (!window.CKSurface?.applyCardWrapper) throw new Error('[Split] Missing CKSurface.applyCardWrapper');
    window.CKSurface.applyCardWrapper(state.appearance.cardwrapper, coreEl);

    if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
      throw new Error('[Split] Missing CKLocaleSwitcher.applyLocaleSwitcher');
    }
    window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
      composedPage: runtimeContext && runtimeContext.composedPage === true,
      locale: runtimeContext && runtimeContext.locale,
      previewMode: runtimeContext && runtimeContext.previewMode,
      typographyScope: splitRoot,
    });

    var normalized = normalizeState(state);
    var embeddedInstances = runtimeContext && runtimeContext.payload && isRecord(runtimeContext.payload.embeddedInstances)
      ? runtimeContext.payload.embeddedInstances
      : {};
    splitRoot.dataset.transition = normalized.carousel.transition;
    coreEl.style.setProperty('--ck-split-media-fit', normalized.mediaFit);
    coreEl.style.setProperty('--ck-split-media-position', normalized.mediaPosition);

    var stage = document.createElement('div');
    stage.className = 'ck-split__stage';
    stage.setAttribute('role', normalized.carousel.enabled ? 'region' : 'group');
    stage.setAttribute('aria-roledescription', normalized.carousel.enabled ? 'carousel' : 'visual');
    stage.setAttribute('aria-label', 'Split visual');

    var active = 0;
    var slides = normalized.items.map(function (item, index) {
      var slide = renderItem(item, normalized.mediaFit, normalized.mediaPosition, embeddedInstances);
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
      stage.querySelectorAll('.ck-split__dot').forEach(function (dot, index) {
        dot.setAttribute('aria-current', index === active ? 'true' : 'false');
      });
    }

    if (normalized.carousel.enabled) {
      renderControls(stage, slides.length, function () { return active; }, normalized.carousel, applyActive);
      if (normalized.carousel.autoplay && slides.length > 1) {
        widgetRoot.__ckSplitAutoplayTimer = window.setInterval(function () {
          if (!document.body.contains(stage)) {
            window.clearInterval(widgetRoot.__ckSplitAutoplayTimer);
            widgetRoot.__ckSplitAutoplayTimer = 0;
            return;
          }
          applyActive(active + 1);
        }, normalized.carousel.intervalMs);
      }
    }

    coreEl.replaceChildren(stage);
    applyActive(0);

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('split', initSplit);
})();
