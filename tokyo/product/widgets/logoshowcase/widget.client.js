// LogoShowcase widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[LogoShowcase] Missing CKWidgetRuntime.register');
  }

  function initLogoShowcase(widgetRoot, runtimeContext) {
  const lsRoot = widgetRoot.querySelector('[data-role="logoshowcase"]');
  if (!(lsRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="logoshowcase"] root');
  }

  const stripsEl = lsRoot.querySelector('[data-role="logoshowcase-core"]');
  if (!(stripsEl instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="logoshowcase-core"]');
  }

  widgetRoot.style.setProperty('--ls-icon-prev', 'url("/dieter/icons/svg/chevron.left.svg")');
  widgetRoot.style.setProperty('--ls-icon-next', 'url("/dieter/icons/svg/chevron.right.svg")');

  const resolvedInstanceId = runtimeContext.instanceId;
  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error(`[LogoShowcase] ${path} must be a boolean`);
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[LogoShowcase] ${path} must be a finite number`);
    }
  }

  function assertNonNegativeNumber(value, path) {
    assertNumber(value, path);
    if (value < 0) throw new Error(`[LogoShowcase] ${path} must be >= 0`);
  }

  function assertPositiveNumber(value, path) {
    assertNumber(value, path);
    if (value <= 0) throw new Error(`[LogoShowcase] ${path} must be > 0`);
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error(`[LogoShowcase] ${path} must be a string`);
  }

  function assertNonEmptyString(value, path) {
    assertString(value, path);
    if (!value.trim()) throw new Error(`[LogoShowcase] ${path} must be a non-empty string`);
  }

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[LogoShowcase] ${path} must be an object`);
    }
  }

  function assertFill(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[LogoShowcase] ${path} must be a fill`);
    }
    if (typeof value.type !== 'string' || !value.type.trim()) {
      throw new Error(`[LogoShowcase] ${path}.type must be a string`);
    }
  }

  function assertArray(value, path) {
    if (!Array.isArray(value)) throw new Error(`[LogoShowcase] ${path} must be an array`);
  }

  function assertEnum(value, path, allowed) {
    assertString(value, path);
    if (!allowed.includes(value)) {
      throw new Error(`[LogoShowcase] ${path} must be one of: ${allowed.join('|')}`);
    }
  }

  function assertBorderConfig(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertNumber(value.width, `${path}.width`);
    assertString(value.color, `${path}.color`);
    if (value.width < 0 || value.width > 12) {
      throw new Error(`[LogoShowcase] ${path}.width must be 0..12`);
    }
  }

  function assertLogoFill(value, path) {
    assertString(value, path);
    const v = value.trim();
    if (v === 'transparent' || v === 'none') return;

    const match = v.match(/^url\((["']?)([^"')]+)\1\)\s+center\s*\/\s*contain\s+no-repeat$/i);
    if (!match) {
      throw new Error(`[LogoShowcase] ${path} must be transparent or a materialized logo image fill`);
    }

    const url = match[2].trim();
    if (!url || /[\n\r;]/.test(url) || /^javascript:/i.test(url)) {
      throw new Error(`[LogoShowcase] ${path} contains an invalid URL`);
    }
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../') || /^https?:\/\//i.test(url)) return;
    throw new Error(`[LogoShowcase] ${path} must use a relative, absolute-path, or http(s) URL`);
  }

  function assertCoreSize(value, path) {
    assertObject(value, path);
    assertEnum(value.mode, `${path}.mode`, ['auto', 'fixed', 'responsive']);
    assertPositiveNumber(value.fixedHeight, `${path}.fixedHeight`);
    assertPositiveNumber(value.minHeight, `${path}.minHeight`);
    assertPositiveNumber(value.preferredVw, `${path}.preferredVw`);
    assertPositiveNumber(value.maxHeight, `${path}.maxHeight`);
    if (value.maxHeight < value.minHeight) {
      throw new Error(`[LogoShowcase] ${path}.maxHeight must be >= ${path}.minHeight`);
    }
  }

  function assertLocaleSwitcher(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertBoolean(value.byIp, `${path}.byIp`);
    assertString(value.alwaysShowLocale, `${path}.alwaysShowLocale`);
    assertEnum(value.attachTo, `${path}.attachTo`, ['stage', 'pod']);
    assertEnum(value.position, `${path}.position`, [
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
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertObject(value.channels, `${path}.channels`);
    SOCIAL_SHARE_CHANNELS.forEach((channel) => {
      assertBoolean(value.channels[channel], `${path}.channels.${channel}`);
    });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function assertLogoShowcaseState(state) {
    assertObject(state, 'state');
    assertObject(state.logoshowcase, 'state.logoshowcase');
    assertCoreSize(state.coreSize, 'state.coreSize');

    assertObject(state.header, 'state.header');
    assertBoolean(state.header.enabled, 'state.header.enabled');
    assertString(state.header.title, 'state.header.title');
    assertBoolean(state.header.showSubtitle, 'state.header.showSubtitle');
    assertString(state.header.subtitleHtml, 'state.header.subtitleHtml');
    assertString(state.header.alignment, 'state.header.alignment');
    if (!['left', 'center', 'right'].includes(state.header.alignment)) {
      throw new Error('[LogoShowcase] state.header.alignment must be left|center|right');
    }
    assertString(state.header.placement, 'state.header.placement');
    if (!['top', 'bottom', 'left', 'right'].includes(state.header.placement)) {
      throw new Error('[LogoShowcase] state.header.placement must be top|bottom|left|right');
    }
    assertString(state.header.ctaPlacement, 'state.header.ctaPlacement');
    if (!['right', 'below'].includes(state.header.ctaPlacement)) {
      throw new Error('[LogoShowcase] state.header.ctaPlacement must be right|below');
    }

    assertArray(state.logoshowcase.strips, 'state.logoshowcase.strips');
    if (state.logoshowcase.strips.length < 1) {
      throw new Error('[LogoShowcase] state.logoshowcase.strips must contain at least one strip');
    }
    const stripIds = new Set();
    state.logoshowcase.strips.forEach((strip, stripIdx) => {
      assertObject(strip, `state.logoshowcase.strips[${stripIdx}]`);
      assertNonEmptyString(strip.id, `state.logoshowcase.strips[${stripIdx}].id`);
      if (stripIds.has(strip.id)) {
        throw new Error(`[LogoShowcase] duplicate strip id: ${strip.id}`);
      }
      stripIds.add(strip.id);
      assertArray(strip.logos, `state.logoshowcase.strips[${stripIdx}].logos`);
      if (strip.logos.length < 1) {
        throw new Error(`[LogoShowcase] state.logoshowcase.strips[${stripIdx}].logos must contain at least one logo`);
      }
      const logoIds = new Set();
      strip.logos.forEach((logo, logoIdx) => {
        assertObject(logo, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}]`);
        assertNonEmptyString(logo.id, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].id`);
        if (logoIds.has(logo.id)) {
          throw new Error(`[LogoShowcase] duplicate logo id in strip ${strip.id}: ${logo.id}`);
        }
        logoIds.add(logo.id);
        assertString(logo.name, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].name`);
        assertLogoFill(logo.logoFill, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].logoFill`);
        if (logo.asset != null) {
          assertObject(logo.asset, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].asset`);
          if (logo.asset.assetRef != null) {
            assertNonEmptyString(
              logo.asset.assetRef,
              `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].asset.assetRef`,
            );
          }
        }
        assertString(logo.href, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].href`);
        assertBoolean(logo.targetBlank, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].targetBlank`);
        assertBoolean(logo.nofollow, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].nofollow`);
        assertString(logo.alt, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].alt`);
        assertString(logo.title, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].title`);
        assertString(logo.caption, `state.logoshowcase.strips[${stripIdx}].logos[${logoIdx}].caption`);
      });
    });

    assertObject(state.headerCta, 'state.headerCta');
    assertBoolean(state.headerCta.enabled, 'state.headerCta.enabled');
    assertString(state.headerCta.label, 'state.headerCta.label');
    assertString(state.headerCta.href, 'state.headerCta.href');
    assertEnum(state.headerCta.openMode, 'state.headerCta.openMode', ['same-tab', 'new-tab', 'new-window']);
    assertBoolean(state.headerCta.iconEnabled, 'state.headerCta.iconEnabled');
    assertString(state.headerCta.iconName, 'state.headerCta.iconName');
    assertString(state.headerCta.iconPlacement, 'state.headerCta.iconPlacement');
    if (!['left', 'right'].includes(state.headerCta.iconPlacement)) {
      throw new Error('[LogoShowcase] state.headerCta.iconPlacement must be left|right');
    }

    if (!['grid', 'carousel'].includes(state.logoshowcase.type)) {
      throw new Error('[LogoShowcase] state.logoshowcase.type must be grid|carousel');
    }

    assertObject(state.logoshowcase.typeConfig, 'state.logoshowcase.typeConfig');
    assertObject(state.logoshowcase.typeConfig.carousel, 'state.logoshowcase.typeConfig.carousel');
    if (!['paged', 'continuous'].includes(state.logoshowcase.typeConfig.carousel.mode)) {
      throw new Error('[LogoShowcase] state.logoshowcase.typeConfig.carousel.mode must be paged|continuous');
    }
    if (!['logo', 'page'].includes(state.logoshowcase.typeConfig.carousel.step)) {
      throw new Error('[LogoShowcase] state.logoshowcase.typeConfig.carousel.step must be logo|page');
    }
    assertBoolean(state.logoshowcase.typeConfig.carousel.showArrows, 'state.logoshowcase.typeConfig.carousel.showArrows');
    assertBoolean(state.logoshowcase.typeConfig.carousel.allowSwipe, 'state.logoshowcase.typeConfig.carousel.allowSwipe');
    assertBoolean(state.logoshowcase.typeConfig.carousel.autoplay, 'state.logoshowcase.typeConfig.carousel.autoplay');
    assertBoolean(state.logoshowcase.typeConfig.carousel.pauseOnHover, 'state.logoshowcase.typeConfig.carousel.pauseOnHover');
    assertNonNegativeNumber(state.logoshowcase.typeConfig.carousel.autoSlideDelayMs, 'state.logoshowcase.typeConfig.carousel.autoSlideDelayMs');
    assertNonNegativeNumber(state.logoshowcase.typeConfig.carousel.transitionMs, 'state.logoshowcase.typeConfig.carousel.transitionMs');
    assertPositiveNumber(state.logoshowcase.typeConfig.carousel.speed, 'state.logoshowcase.typeConfig.carousel.speed');
    if (!['left', 'right'].includes(state.logoshowcase.typeConfig.carousel.direction)) {
      throw new Error('[LogoShowcase] state.logoshowcase.typeConfig.carousel.direction must be left|right');
    }

    assertObject(state.appearance, 'state.appearance');
    assertObject(state.logoshowcase.appearance, 'state.logoshowcase.appearance');
    if (!['original', 'grayscale'].includes(state.logoshowcase.appearance.logoLook)) {
      throw new Error('[LogoShowcase] state.logoshowcase.appearance.logoLook must be original|grayscale');
    }
    assertNumber(state.logoshowcase.appearance.logoOpacity, 'state.logoshowcase.appearance.logoOpacity');
    if (state.logoshowcase.appearance.logoOpacity < 0 || state.logoshowcase.appearance.logoOpacity > 1) {
      throw new Error('[LogoShowcase] state.logoshowcase.appearance.logoOpacity must be 0..1');
    }

    assertFill(state.logoshowcase.appearance.itemBackground, 'state.logoshowcase.appearance.itemBackground');
    assertObject(state.logoshowcase.appearance.cardwrapper, 'state.logoshowcase.appearance.cardwrapper');

    assertBoolean(state.logoshowcase.appearance.cardwrapper.radiusLinked, 'state.logoshowcase.appearance.cardwrapper.radiusLinked');
    assertString(state.logoshowcase.appearance.cardwrapper.radius, 'state.logoshowcase.appearance.cardwrapper.radius');
    assertString(state.logoshowcase.appearance.cardwrapper.radiusTL, 'state.logoshowcase.appearance.cardwrapper.radiusTL');
    assertString(state.logoshowcase.appearance.cardwrapper.radiusTR, 'state.logoshowcase.appearance.cardwrapper.radiusTR');
    assertString(state.logoshowcase.appearance.cardwrapper.radiusBR, 'state.logoshowcase.appearance.cardwrapper.radiusBR');
    assertString(state.logoshowcase.appearance.cardwrapper.radiusBL, 'state.logoshowcase.appearance.cardwrapper.radiusBL');

    assertObject(state.logoshowcase.appearance.cardwrapper.border, 'state.logoshowcase.appearance.cardwrapper.border');
    assertBoolean(state.logoshowcase.appearance.cardwrapper.border.enabled, 'state.logoshowcase.appearance.cardwrapper.border.enabled');
    assertNumber(state.logoshowcase.appearance.cardwrapper.border.width, 'state.logoshowcase.appearance.cardwrapper.border.width');
    assertString(state.logoshowcase.appearance.cardwrapper.border.color, 'state.logoshowcase.appearance.cardwrapper.border.color');

    assertObject(state.logoshowcase.appearance.cardwrapper.shadow, 'state.logoshowcase.appearance.cardwrapper.shadow');
    assertBoolean(state.logoshowcase.appearance.cardwrapper.shadow.enabled, 'state.logoshowcase.appearance.cardwrapper.shadow.enabled');
    assertBoolean(state.logoshowcase.appearance.cardwrapper.shadow.inset, 'state.logoshowcase.appearance.cardwrapper.shadow.inset');
    assertNumber(state.logoshowcase.appearance.cardwrapper.shadow.x, 'state.logoshowcase.appearance.cardwrapper.shadow.x');
    assertNumber(state.logoshowcase.appearance.cardwrapper.shadow.y, 'state.logoshowcase.appearance.cardwrapper.shadow.y');
    assertNumber(state.logoshowcase.appearance.cardwrapper.shadow.blur, 'state.logoshowcase.appearance.cardwrapper.shadow.blur');
    assertNumber(state.logoshowcase.appearance.cardwrapper.shadow.spread, 'state.logoshowcase.appearance.cardwrapper.shadow.spread');
    assertString(state.logoshowcase.appearance.cardwrapper.shadow.color, 'state.logoshowcase.appearance.cardwrapper.shadow.color');
    assertNumber(state.logoshowcase.appearance.cardwrapper.shadow.alpha, 'state.logoshowcase.appearance.cardwrapper.shadow.alpha');
    if (state.logoshowcase.appearance.cardwrapper.shadow.alpha < 0 || state.logoshowcase.appearance.cardwrapper.shadow.alpha > 100) {
      throw new Error('[LogoShowcase] state.logoshowcase.appearance.cardwrapper.shadow.alpha must be 0..100');
    }

    assertObject(state.appearance.headerCta, 'state.appearance.headerCta');
    assertFill(state.appearance.headerCta.background, 'state.appearance.headerCta.background');
    assertFill(state.appearance.headerCta.textColor, 'state.appearance.headerCta.textColor');
    assertBorderConfig(state.appearance.headerCta.border, 'state.appearance.headerCta.border');
    assertString(state.appearance.headerCta.radius, 'state.appearance.headerCta.radius');
    assertString(state.appearance.headerCta.sizePreset, 'state.appearance.headerCta.sizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.headerCta.sizePreset)) {
      throw new Error('[LogoShowcase] state.appearance.headerCta.sizePreset must be xs|s|m|l|xl|custom');
    }
    assertBoolean(state.appearance.headerCta.paddingLinked, 'state.appearance.headerCta.paddingLinked');
    assertNumber(state.appearance.headerCta.paddingInline, 'state.appearance.headerCta.paddingInline');
    assertNumber(state.appearance.headerCta.paddingBlock, 'state.appearance.headerCta.paddingBlock');
    assertString(state.appearance.headerCta.iconSizePreset, 'state.appearance.headerCta.iconSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.headerCta.iconSizePreset)) {
      throw new Error('[LogoShowcase] state.appearance.headerCta.iconSizePreset must be xs|s|m|l|xl|custom');
    }
    assertNumber(state.appearance.headerCta.iconSize, 'state.appearance.headerCta.iconSize');

    assertObject(state.logoshowcase.spacing, 'state.logoshowcase.spacing');
    assertNumber(state.logoshowcase.spacing.gap, 'state.logoshowcase.spacing.gap');
    assertNumber(state.logoshowcase.spacing.rowGap, 'state.logoshowcase.spacing.rowGap');
    assertNumber(state.logoshowcase.spacing.stripGap, 'state.logoshowcase.spacing.stripGap');
    assertNumber(state.logoshowcase.spacing.logoHeight, 'state.logoshowcase.spacing.logoHeight');
    assertNumber(state.logoshowcase.spacing.mobileGap, 'state.logoshowcase.spacing.mobileGap');
    assertNumber(state.logoshowcase.spacing.mobileStripGap, 'state.logoshowcase.spacing.mobileStripGap');

    assertObject(state.behavior, 'state.behavior');
    assertObject(state.logoshowcase.behavior, 'state.logoshowcase.behavior');
    assertBoolean(state.logoshowcase.behavior.randomOrder, 'state.logoshowcase.behavior.randomOrder');
    assertBoolean(state.behavior.showBacklink, 'state.behavior.showBacklink');
    assertSocialShare(state.behavior.socialShare, 'state.behavior.socialShare');

    assertObject(state.stage, 'state.stage');
    assertObject(state.pod, 'state.pod');
    assertObject(state.typography, 'state.typography');
    assertLocaleSwitcher(state.localeSwitcher, 'state.localeSwitcher');
  }

  function normalizeHttpUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;
    try {
      const parsed = new URL(v);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (_error) {
      return null;
    }
  }

  function fnv1a32(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      // 32-bit FNV-1a: hash *= 16777619
      hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    return hash >>> 0;
  }

  function xorshift32(seed) {
    let x = seed >>> 0;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function shuffleWithSeed(items, seed) {
    const out = items.slice();
    const rand = xorshift32(seed);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function resolveAppearanceHelpers() {
    if (!window.CKAppearance || typeof window.CKAppearance.toCssBackground !== 'function') {
      throw new Error('[LogoShowcase] Missing CKAppearance fill helpers');
    }
    return window.CKAppearance;
  }

  function applyLayoutVars(state) {
    lsRoot.style.setProperty('--ls-gap', `${state.logoshowcase.spacing.gap}px`);
    lsRoot.style.setProperty('--ls-gap-mobile', `${state.logoshowcase.spacing.mobileGap}px`);
    lsRoot.style.setProperty('--ls-strip-gap', `${state.logoshowcase.spacing.stripGap}px`);
    lsRoot.style.setProperty('--ls-strip-gap-mobile', `${state.logoshowcase.spacing.mobileStripGap}px`);
    lsRoot.style.setProperty('--ls-row-gap', `${state.logoshowcase.spacing.rowGap}px`);
    lsRoot.style.setProperty('--ls-logo-h', `${state.logoshowcase.spacing.logoHeight}px`);
    lsRoot.style.setProperty('--ls-logo-h-mobile', `${state.logoshowcase.spacing.logoHeight}px`);
  }

  function applyAppearanceVars(state) {
    lsRoot.style.setProperty('--ls-logo-opacity', String(state.logoshowcase.appearance.logoOpacity));
    lsRoot.style.setProperty('--ls-logo-filter', state.logoshowcase.appearance.logoLook === 'grayscale' ? 'grayscale(1)' : 'none');

    lsRoot.style.setProperty('--ls-item-bg', resolveAppearanceHelpers().toCssBackground(state.logoshowcase.appearance.itemBackground));
    if (!window.CKSurface?.applyCardWrapper) {
      throw new Error('[LogoShowcase] Missing CKSurface.applyCardWrapper');
    }
    window.CKSurface.applyCardWrapper(state.logoshowcase.appearance.cardwrapper, lsRoot);
  }

  function renderLogoTile(logo) {
    const href = normalizeHttpUrl(logo.href);
    const isClickable = Boolean(href);

    const tileEl = isClickable ? document.createElement('a') : document.createElement('div');
    tileEl.className = 'ck-logoshowcase__logo';
    tileEl.setAttribute('data-role', 'logo');

    const altText = String(logo.alt || '').trim();
    const nameText = String(logo.name || '').trim();
    const aria = altText || nameText;
    if (aria) tileEl.setAttribute('aria-label', aria);

    const titleText = String(logo.title || '').trim();
    if (titleText) tileEl.setAttribute('title', titleText);

    if (isClickable) {
      tileEl.setAttribute('href', href);
      if (logo.targetBlank === true) tileEl.setAttribute('target', '_blank');
      else tileEl.removeAttribute('target');

      const rel = logo.nofollow === true ? 'nofollow noopener noreferrer' : 'noopener noreferrer';
      tileEl.setAttribute('rel', rel);
    }

    const visualEl = document.createElement('div');
    visualEl.className = 'ck-logoshowcase__logo-visual';
    visualEl.setAttribute('data-role', 'logo-visual');
    visualEl.setAttribute('role', 'img');
    if (aria) visualEl.setAttribute('aria-label', aria);

    const logoFill = String(logo.logoFill || '').trim();
    if (logoFill) {
      visualEl.style.background = logoFill;
    } else {
      visualEl.style.background = 'transparent';
    }

    const captionEl = document.createElement('div');
    captionEl.className = 'ck-logoshowcase__logo-caption';
    captionEl.setAttribute('data-role', 'logo-caption');
    const captionText = String(logo.caption || '').trim() || nameText;
    captionEl.textContent = captionText;
    captionEl.hidden = !captionText;

    tileEl.appendChild(visualEl);
    tileEl.appendChild(captionEl);
    return tileEl;
  }

  function renderStrips(state) {
    // Clean up existing per-strip motion bindings before DOM churn.
    Array.from(stripsEl.querySelectorAll('[data-role="strip"]')).forEach((stripEl) => cleanupStrip(stripEl));

    stripsEl.innerHTML = '';

    state.logoshowcase.strips.forEach((strip) => {
      const stripEl = document.createElement('div');
      stripEl.className = 'ck-logoshowcase__strip';
      stripEl.setAttribute('data-role', 'strip');
      stripEl.setAttribute('data-strip-id', strip.id);

      const viewportEl = document.createElement('div');
      viewportEl.className = 'ck-logoshowcase__strip-viewport';
      viewportEl.setAttribute('data-role', 'strip-viewport');

      const trackEl = document.createElement('div');
      trackEl.className = 'ck-logoshowcase__strip-track';
      trackEl.setAttribute('data-role', 'strip-track');

      const logos = (() => {
        if (state.logoshowcase.behavior.randomOrder !== true) return strip.logos;
        const seedString = `${strip.id}|${strip.logos.map((l) => l.id).join(',')}`;
        return shuffleWithSeed(strip.logos, fnv1a32(seedString));
      })();

      const isContinuous = state.logoshowcase.type === 'carousel' && state.logoshowcase.typeConfig.carousel.mode === 'continuous';
      if (isContinuous) {
        const copyA = document.createElement('div');
        copyA.className = 'ck-logoshowcase__ticker-copy';
        copyA.setAttribute('data-role', 'ticker-a');

        const copyB = document.createElement('div');
        copyB.className = 'ck-logoshowcase__ticker-copy';
        copyB.setAttribute('data-role', 'ticker-b');

        const listA = document.createElement('div');
        listA.className = 'ck-logoshowcase__logos';
        listA.setAttribute('data-role', 'logos');

        const listB = document.createElement('div');
        listB.className = 'ck-logoshowcase__logos';
        listB.setAttribute('data-role', 'logos');

        logos.forEach((logo) => {
          listA.appendChild(renderLogoTile(logo));
          listB.appendChild(renderLogoTile(logo));
        });

        copyA.appendChild(listA);
        copyB.appendChild(listB);
        trackEl.appendChild(copyA);
        trackEl.appendChild(copyB);
      } else {
        const listEl = document.createElement('div');
        listEl.className = 'ck-logoshowcase__logos';
        listEl.setAttribute('data-role', 'logos');
        logos.forEach((logo) => listEl.appendChild(renderLogoTile(logo)));
        trackEl.appendChild(listEl);
      }

      viewportEl.appendChild(trackEl);
      stripEl.appendChild(viewportEl);

      const navEl = document.createElement('div');
      navEl.className = 'ck-logoshowcase__nav';
      navEl.setAttribute('data-role', 'nav');

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'diet-btn-ic ck-logoshowcase__arrow';
      prevBtn.setAttribute('data-size', 'md');
      prevBtn.setAttribute('data-variant', 'neutral');
      prevBtn.setAttribute('data-role', 'arrow');
      prevBtn.setAttribute('data-dir', 'prev');
      prevBtn.setAttribute('aria-label', 'Previous');
      prevBtn.innerHTML = '<span class="diet-btn-ic__icon"></span>';

      const dotsEl = document.createElement('div');
      dotsEl.className = 'ck-logoshowcase__dots';
      dotsEl.setAttribute('data-role', 'dots');

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'diet-btn-ic ck-logoshowcase__arrow';
      nextBtn.setAttribute('data-size', 'md');
      nextBtn.setAttribute('data-variant', 'neutral');
      nextBtn.setAttribute('data-role', 'arrow');
      nextBtn.setAttribute('data-dir', 'next');
      nextBtn.setAttribute('aria-label', 'Next');
      nextBtn.innerHTML = '<span class="diet-btn-ic__icon"></span>';

      navEl.appendChild(prevBtn);
      navEl.appendChild(dotsEl);
      navEl.appendChild(nextBtn);
      stripEl.appendChild(navEl);

      stripsEl.appendChild(stripEl);
    });
  }

  function isMobile() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function animateScrollLeft(el, targetLeft, durationMs, runtime) {
    if (!(el instanceof HTMLElement)) return;
    const to = Math.max(0, Math.round(targetLeft));
    const duration = Math.max(0, Math.round(durationMs));

    if (runtime.raf) cancelAnimationFrame(runtime.raf);
    runtime.raf = 0;

    if (duration <= 0) {
      el.scrollLeft = to;
      return;
    }

    const start = el.scrollLeft;
    const delta = to - start;
    const startTime = performance.now();

    const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const tick = (now) => {
      const t = clamp((now - startTime) / duration, 0, 1);
      el.scrollLeft = start + delta * easeInOutQuad(t);
      if (t < 1) runtime.raf = requestAnimationFrame(tick);
      else runtime.raf = 0;
    };

    runtime.raf = requestAnimationFrame(tick);
  }

  const stripBindings = new WeakMap();

  function cleanupStrip(stripEl) {
    const runtime = stripBindings.get(stripEl);
    if (!runtime) return;
    try {
      runtime.cleanup();
    } finally {
      stripBindings.delete(stripEl);
    }
  }

  function bindPagedMotion(stripEl, state) {
    const viewportEl = stripEl.querySelector('[data-role="strip-viewport"]');
    const navEl = stripEl.querySelector('[data-role="nav"]');
    const dotsEl = stripEl.querySelector('[data-role="dots"]');
    const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
    const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');

    if (!(viewportEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing paged strip viewport');
    if (!(navEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing paged strip nav');
    if (!(dotsEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing paged strip dots');
    if (!(prevBtn instanceof HTMLButtonElement)) throw new Error('[LogoShowcase] Missing paged previous button');
    if (!(nextBtn instanceof HTMLButtonElement)) throw new Error('[LogoShowcase] Missing paged next button');

    const cfg = state.logoshowcase.typeConfig.carousel;

    stripEl.dataset.swipe = cfg.allowSwipe === true ? 'true' : 'false';
    stripEl.dataset.pauseOnHover = 'false';

    prevBtn.hidden = cfg.showArrows !== true;
    nextBtn.hidden = cfg.showArrows !== true;
    dotsEl.hidden = true;
    navEl.hidden = cfg.showArrows !== true;
    navEl.dataset.dots = 'false';
    navEl.dataset.arrows = cfg.showArrows === true ? 'true' : 'false';

    let hovering = false;
    const onEnter = () => {
      hovering = true;
    };
    const onLeave = () => {
      hovering = false;
    };
    stripEl.addEventListener('mouseenter', onEnter);
    stripEl.addEventListener('mouseleave', onLeave);

    const runtime = {
      raf: 0,
      interval: 0,
      ro: null,
      cleanup: () => {},
    };

    const getPaging = () => {
      const itemCount = stripEl.querySelectorAll('[data-role="logos"] [data-role="logo"]').length;
      const first = stripEl.querySelector('[data-role="logos"] [data-role="logo"]');
      const tileW = first instanceof HTMLElement ? first.getBoundingClientRect().width : 0;
      const gap = isMobile() ? state.logoshowcase.spacing.mobileGap : state.logoshowcase.spacing.gap;
      const viewportW = viewportEl.clientWidth;
      const perPage = tileW > 0 ? Math.max(1, Math.floor((viewportW + gap) / (tileW + gap))) : 1;
      const stepMode = cfg.step === 'logo' ? 'logo' : 'page';
      const pageCount =
        stepMode === 'logo' ? Math.max(1, itemCount) : Math.max(1, Math.ceil(itemCount / perPage));
      const stepPx = (stepMode === 'logo' ? 1 : perPage) * (tileW + gap);
      const pageIndex = stepPx > 0 ? clamp(Math.round(viewportEl.scrollLeft / stepPx), 0, pageCount - 1) : 0;
      return { itemCount, tileW, viewportW, perPage, pageCount, stepPx, pageIndex };
    };

    const syncUi = () => {
      const { pageCount, pageIndex } = getPaging();
      if (cfg.showArrows === true) {
        prevBtn.disabled = pageIndex <= 0;
        nextBtn.disabled = pageIndex >= pageCount - 1;
      }
    };

    const scrollToPage = (targetIndex, animate) => {
      const { pageCount, stepPx } = getPaging();
      if (pageCount <= 1 || stepPx <= 0) return;
      const idx = clamp(targetIndex, 0, pageCount - 1);
      const targetLeft = idx * stepPx;
      if (animate) animateScrollLeft(viewportEl, targetLeft, cfg.transitionMs, runtime);
      else viewportEl.scrollLeft = targetLeft;
      syncUi();
    };

    const onClickPrev = () => {
      const { pageIndex } = getPaging();
      scrollToPage(pageIndex - 1, true);
    };
    const onClickNext = () => {
      const { pageIndex } = getPaging();
      scrollToPage(pageIndex + 1, true);
    };

    prevBtn.addEventListener('click', onClickPrev);
    nextBtn.addEventListener('click', onClickNext);

    const onScroll = () => syncUi();
    viewportEl.addEventListener('scroll', onScroll, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      runtime.ro = new ResizeObserver(() => {
        const { pageIndex } = getPaging();
        scrollToPage(pageIndex, false);
      });
      runtime.ro.observe(viewportEl);
    }

    if (cfg.autoplay === true && cfg.autoSlideDelayMs > 0) {
      runtime.interval = window.setInterval(() => {
        if (cfg.pauseOnHover === true && hovering) return;
        const { pageIndex, pageCount } = getPaging();
        if (pageCount <= 1) return;
        scrollToPage((pageIndex + 1) % pageCount, true);
      }, Math.round(cfg.autoSlideDelayMs));
    }

    runtime.cleanup = () => {
      if (runtime.raf) cancelAnimationFrame(runtime.raf);
      runtime.raf = 0;
      if (runtime.interval) clearInterval(runtime.interval);
      runtime.interval = 0;
      if (runtime.ro) runtime.ro.disconnect();
      runtime.ro = null;

      stripEl.removeEventListener('mouseenter', onEnter);
      stripEl.removeEventListener('mouseleave', onLeave);
      prevBtn.removeEventListener('click', onClickPrev);
      nextBtn.removeEventListener('click', onClickNext);
      viewportEl.removeEventListener('scroll', onScroll);
    };

    stripBindings.set(stripEl, runtime);
    syncUi();
  }

  function bindContinuousMotion(stripEl, state) {
    const viewportEl = stripEl.querySelector('[data-role="strip-viewport"]');
    const trackEl = stripEl.querySelector('[data-role="strip-track"]');
    const navEl = stripEl.querySelector('[data-role="nav"]');
    const dotsEl = stripEl.querySelector('[data-role="dots"]');
    const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
    const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');

    if (!(viewportEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing continuous strip viewport');
    if (!(trackEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing continuous strip track');
    if (!(navEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing continuous strip nav');
    if (!(dotsEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing continuous strip dots');
    if (!(prevBtn instanceof HTMLButtonElement)) throw new Error('[LogoShowcase] Missing continuous previous button');
    if (!(nextBtn instanceof HTMLButtonElement)) throw new Error('[LogoShowcase] Missing continuous next button');

    const cfg = state.logoshowcase.typeConfig.carousel;

    stripEl.dataset.swipe = 'false';
    stripEl.dataset.pauseOnHover = cfg.pauseOnHover === true ? 'true' : 'false';
    navEl.hidden = true;
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    dotsEl.hidden = true;

    const runtime = {
      ro: null,
      cleanup: () => {},
    };

    const applyTickerVars = () => {
      const listEl = stripEl.querySelector('[data-role="ticker-a"] [data-role="logos"]');
      if (!(listEl instanceof HTMLElement)) throw new Error('[LogoShowcase] Missing continuous ticker list');
      const distancePx = Math.max(0, Math.ceil(listEl.scrollWidth));
      const speed = cfg.speed;
      const durationSec = distancePx / speed;

      trackEl.style.setProperty('--ls-ticker-duration', `${durationSec}s`);
      const signed = -distancePx;
      if (cfg.direction === 'right') {
        trackEl.style.setProperty('--ls-ticker-from', `${signed}px`);
        trackEl.style.setProperty('--ls-ticker-to', `0px`);
      } else {
        trackEl.style.setProperty('--ls-ticker-from', `0px`);
        trackEl.style.setProperty('--ls-ticker-to', `${signed}px`);
      }
    };

    applyTickerVars();

    if (typeof ResizeObserver !== 'undefined') {
      runtime.ro = new ResizeObserver(() => applyTickerVars());
      runtime.ro.observe(viewportEl);
    }

    runtime.cleanup = () => {
      if (runtime.ro) runtime.ro.disconnect();
      runtime.ro = null;
    };

    stripBindings.set(stripEl, runtime);
  }

  function bindMotion(state) {
    Array.from(stripsEl.querySelectorAll('[data-role="strip"]')).forEach((stripEl) => {
      cleanupStrip(stripEl);
      if (!(stripEl instanceof HTMLElement)) return;
      if (state.logoshowcase.type === 'carousel') {
        if (state.logoshowcase.typeConfig.carousel.mode === 'continuous') bindContinuousMotion(stripEl, state);
        else bindPagedMotion(stripEl, state);
      } else {
        // grid: no motion bindings
        const navEl = stripEl.querySelector('[data-role="nav"]');
        const dotsEl = stripEl.querySelector('[data-role="dots"]');
        const prevBtn = stripEl.querySelector('[data-role="arrow"][data-dir="prev"]');
        const nextBtn = stripEl.querySelector('[data-role="arrow"][data-dir="next"]');
        if (navEl instanceof HTMLElement) navEl.hidden = true;
        if (dotsEl instanceof HTMLElement) dotsEl.hidden = true;
        if (prevBtn instanceof HTMLElement) prevBtn.hidden = true;
        if (nextBtn instanceof HTMLElement) nextBtn.hidden = true;
        stripEl.dataset.swipe = 'false';
        stripEl.dataset.pauseOnHover = 'false';
      }
    });
  }

  let lastStripsSignature = '';

  function applyState(state, runtimeContext) {
    assertLogoShowcaseState(state);

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[LogoShowcase] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[LogoShowcase] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      lsRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        button: { varKey: 'button' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: resolvedInstanceId },
    );

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[LogoShowcase] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    if (!window.CKCoreSize?.applyCoreSize) {
      throw new Error('[LogoShowcase] Missing CKCoreSize.applyCoreSize');
    }
    window.CKCoreSize.applyCoreSize(state.coreSize, stripsEl);

    if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
      throw new Error('[LogoShowcase] Missing CKLocaleSwitcher.applyLocaleSwitcher');
    }
    window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
      composedPage: runtimeContext && runtimeContext.composedPage === true,
      locale: runtimeContext && runtimeContext.locale,
      previewMode: runtimeContext && runtimeContext.previewMode,
      typographyScope: lsRoot,
    });

    lsRoot.setAttribute('data-type', state.logoshowcase.type);
    if (state.logoshowcase.type === 'carousel') {
      lsRoot.setAttribute('data-motion', state.logoshowcase.typeConfig.carousel.mode);
    } else {
      lsRoot.removeAttribute('data-motion');
    }

    applyLayoutVars(state);
    applyAppearanceVars(state);

    const nextSignature = JSON.stringify([
      state.logoshowcase.type,
      state.logoshowcase.type === 'carousel' ? state.logoshowcase.typeConfig.carousel.mode : 'grid',
      state.logoshowcase.behavior.randomOrder === true,
      state.logoshowcase.strips,
    ]);
    if (nextSignature !== lastStripsSignature) {
      lastStripsSignature = nextSignature;
      renderStrips(state);
    }

    bindMotion(state);

    if (!window.CKBranding || typeof window.CKBranding.applyBacklink !== 'function') {
      throw new Error('[LogoShowcase] Missing CKBranding.applyBacklink');
    }
    window.CKBranding.applyBacklink(widgetRoot, state);

    if (!window.CKSocialShare || typeof window.CKSocialShare.apply !== 'function') {
      throw new Error('[LogoShowcase] Missing CKSocialShare.apply');
    }
    window.CKSocialShare.apply(widgetRoot, state, {
      instanceId: resolvedInstanceId,
      widgetType: 'logoshowcase',
      widgetLabel: 'Logo Showcase',
      previewMode: runtimeContext && runtimeContext.previewMode,
    });
  }

  let previewLocaleRequest = 0;

  async function applyPreviewState(state, locale, instanceId, previewMode, baseLocale) {
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
        });
      } catch (error) {
        if (requestId === previewLocaleRequest) {
          console.error('[LogoShowcase] preview localization load failed', error);
        }
        return;
      }
    }
    if (requestId !== previewLocaleRequest) return;
    applyState(localizedState, { locale, previewMode });
  }

  runtime.bindStateUpdates('logoshowcase', resolvedInstanceId, (msg) => {
    void applyPreviewState(
      msg.state,
      msg.locale,
      msg.instanceId,
      msg.previewMode,
      msg.baseLocale,
    );
  });

  if (runtimeContext.payload) {
    const initialLocale = runtimeContext.locale || '';
    applyState(runtimeContext.state, { locale: initialLocale });
  }
  }

  runtime.register('logoshowcase', initLogoShowcase);
})();
