// Countdown widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const countdownDom = window.CK_COUNTDOWN_DOM;
  if (!countdownDom || typeof countdownDom.resolve !== 'function') throw new Error('[Countdown] Missing DOM resolver');
  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Countdown] Missing CKWidgetRuntime.register');
  }

  function initCountdown(widgetRoot, runtimeContext) {
  const dom = countdownDom.resolve(widgetRoot, runtimeContext);
  if (!dom) return;
  const {
    widgetRoot: resolvedWidgetRoot,
    countdownRoot,
    coreEl,
    timerEl,
    numberDisplayEl,
    numberValueEl,
    unitsDisplayEl,
    ctaEl,
    afterMsgEl,
    afterLinkEl,
    stageEl,
    podEl,
    resolvedInstanceId,
  } = dom;
  widgetRoot = resolvedWidgetRoot;

  const TIMER_UNIT_KEYS = ['days', 'hours', 'minutes', 'seconds'];

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') {
      throw new Error(`[Countdown] ${path} must be a boolean`);
    }
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[Countdown] ${path} must be a finite number`);
    }
  }

  function assertString(value, path) {
    if (typeof value !== 'string') {
      throw new Error(`[Countdown] ${path} must be a string`);
    }
  }

  function assertNonEmptyString(value, path) {
    assertString(value, path);
    if (!value.trim()) {
      throw new Error(`[Countdown] ${path} must not be empty`);
    }
  }

  function assertEnum(value, path, options) {
    assertString(value, path);
    if (!options.includes(value)) {
      throw new Error(`[Countdown] ${path} must be one of: ${options.join(', ')}`);
    }
  }

  function assertPositiveNumber(value, path) {
    assertNumber(value, path);
    if (value <= 0) {
      throw new Error(`[Countdown] ${path} must be > 0`);
    }
  }

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[Countdown] ${path} must be an object`);
    }
  }

  function assertFill(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[Countdown] ${path} must be a fill`);
    }
    if (typeof value.type !== 'string' || !value.type.trim()) {
      throw new Error(`[Countdown] ${path}.type must be a string`);
    }
  }

  function resolveActionHref(raw, path, options) {
    const required = options && options.required === true;
    assertString(raw, path);
    const value = raw.trim();
    if (!value) {
      if (required) throw new Error(`[Countdown] ${path} must not be empty`);
      return '';
    }
    if (value === '#') return value;
    if (value.startsWith('/')) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^mailto:[^\s]+$/i.test(value)) return value;
    if (/^tel:[+0-9().\-\s]+$/i.test(value)) return value;
    throw new Error(`[Countdown] ${path} must be empty, #, root-relative, http(s), mailto, or tel`);
  }

  function assertBorderConfig(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertNumber(value.width, `${path}.width`);
    assertString(value.color, `${path}.color`);
    if (value.width < 0 || value.width > 12) {
      throw new Error(`[Countdown] ${path}.width must be 0..12`);
    }
  }

  function assertShadowConfig(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertBoolean(value.inset, `${path}.inset`);
    assertNumber(value.x, `${path}.x`);
    assertNumber(value.y, `${path}.y`);
    assertNumber(value.blur, `${path}.blur`);
    assertNumber(value.spread, `${path}.spread`);
    assertNumber(value.alpha, `${path}.alpha`);
    assertString(value.color, `${path}.color`);
    if (value.alpha < 0 || value.alpha > 100) {
      throw new Error(`[Countdown] ${path}.alpha must be 0..100`);
    }
  }

  function assertCoreSize(value, path) {
    assertObject(value, path);
    assertEnum(value.mode, `${path}.mode`, ['auto', 'fixed', 'responsive']);
    assertPositiveNumber(value.fixedHeight, `${path}.fixedHeight`);
    assertPositiveNumber(value.minHeight, `${path}.minHeight`);
    assertPositiveNumber(value.preferredVw, `${path}.preferredVw`);
    assertPositiveNumber(value.maxHeight, `${path}.maxHeight`);
    if (value.maxHeight < value.minHeight) {
      throw new Error(`[Countdown] ${path}.maxHeight must be >= ${path}.minHeight`);
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

  function parseTargetDate(raw) {
    const value = String(raw || '').trim();
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      throw new Error('[Countdown] state.countdown.timer.targetDate must be ISO YYYY-MM-DDTHH:MM(:SS)');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] ? Number(match[6]) : 0;
    if (month < 1 || month > 12) throw new Error('[Countdown] state.countdown.timer.targetDate month must be 1..12');
    if (day < 1 || day > 31) throw new Error('[Countdown] state.countdown.timer.targetDate day must be 1..31');
    if (hour < 0 || hour > 23) throw new Error('[Countdown] state.countdown.timer.targetDate hour must be 0..23');
    if (minute < 0 || minute > 59) throw new Error('[Countdown] state.countdown.timer.targetDate minute must be 0..59');
    if (second < 0 || second > 59) throw new Error('[Countdown] state.countdown.timer.targetDate second must be 0..59');
    const calendarDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day ||
      calendarDate.getUTCHours() !== hour ||
      calendarDate.getUTCMinutes() !== minute ||
      calendarDate.getUTCSeconds() !== second
    ) {
      throw new Error('[Countdown] state.countdown.timer.targetDate must be a real calendar date');
    }
    return { year, month, day, hour, minute, second };
  }

  function isValidTimeZone(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  function assertCountdownState(state) {
    assertObject(state, 'state');
    assertObject(state.countdown, 'state.countdown');

    assertObject(state.header, 'state.header');
    assertBoolean(state.header.enabled, 'state.header.enabled');
    assertString(state.header.title, 'state.header.title');
    assertBoolean(state.header.showSubtitle, 'state.header.showSubtitle');
    assertString(state.header.subtitleHtml, 'state.header.subtitleHtml');
    assertString(state.header.alignment, 'state.header.alignment');
    if (!['left', 'center', 'right'].includes(state.header.alignment)) {
      throw new Error('[Countdown] state.header.alignment must be left|center|right');
    }
    assertString(state.header.placement, 'state.header.placement');
    if (!['top', 'bottom', 'left', 'right'].includes(state.header.placement)) {
      throw new Error('[Countdown] state.header.placement must be top|bottom|left|right');
    }
    assertString(state.header.ctaPlacement, 'state.header.ctaPlacement');
    if (!['right', 'below'].includes(state.header.ctaPlacement)) {
      throw new Error('[Countdown] state.header.ctaPlacement must be right|below');
    }

    assertObject(state.headerCta, 'state.headerCta');
    assertBoolean(state.headerCta.enabled, 'state.headerCta.enabled');
    assertString(state.headerCta.label, 'state.headerCta.label');
    assertString(state.headerCta.href, 'state.headerCta.href');
    assertBoolean(state.headerCta.iconEnabled, 'state.headerCta.iconEnabled');
    assertString(state.headerCta.iconName, 'state.headerCta.iconName');
    assertString(state.headerCta.iconPlacement, 'state.headerCta.iconPlacement');
    if (!['left', 'right'].includes(state.headerCta.iconPlacement)) {
      throw new Error('[Countdown] state.headerCta.iconPlacement must be left|right');
    }
    assertString(state.headerCta.openMode, 'state.headerCta.openMode');
    if (!['same-tab', 'new-tab', 'new-window'].includes(state.headerCta.openMode)) {
      throw new Error('[Countdown] state.headerCta.openMode must be same-tab|new-tab|new-window');
    }

    assertObject(state.countdown.timer, 'state.countdown.timer');
    if (!['date', 'personal', 'number'].includes(state.countdown.timer.mode)) {
      throw new Error('[Countdown] state.countdown.timer.mode must be date|personal|number');
    }
    assertObject(state.countdown.timer.labels, 'state.countdown.timer.labels');
    TIMER_UNIT_KEYS.forEach((unit) => {
      assertNonEmptyString(state.countdown.timer.labels[unit], `state.countdown.timer.labels.${unit}`);
    });

    if (state.countdown.timer.mode === 'date') {
      assertString(state.countdown.timer.targetDate, 'state.countdown.timer.targetDate');
      assertString(state.countdown.timer.timezone, 'state.countdown.timer.timezone');
      parseTargetDate(state.countdown.timer.targetDate);
      if (state.countdown.timer.timezone !== 'browser' && !isValidTimeZone(state.countdown.timer.timezone)) {
        throw new Error('[Countdown] state.countdown.timer.timezone must be a valid IANA timezone or "browser"');
      }
    } else if (state.countdown.timer.mode === 'personal') {
      assertNumber(state.countdown.timer.timeAmount, 'state.countdown.timer.timeAmount');
      if (state.countdown.timer.timeAmount <= 0) {
        throw new Error('[Countdown] state.countdown.timer.timeAmount must be > 0');
      }
      if (!['minutes', 'hours', 'days', 'weeks', 'months'].includes(state.countdown.timer.timeUnit)) {
        throw new Error('[Countdown] state.countdown.timer.timeUnit must be minutes|hours|days|weeks|months');
      }
      if (!['never', '1 minute', '5 minutes', '1 hour', '1 day', '1 week'].includes(state.countdown.timer.repeat)) {
        throw new Error('[Countdown] state.countdown.timer.repeat must be never|1 minute|5 minutes|1 hour|1 day|1 week');
      }
    } else if (state.countdown.timer.mode === 'number') {
      assertNumber(state.countdown.timer.targetNumber, 'state.countdown.timer.targetNumber');
      assertNumber(state.countdown.timer.startingNumber, 'state.countdown.timer.startingNumber');
      assertNumber(state.countdown.timer.countDuration, 'state.countdown.timer.countDuration');
      if (state.countdown.timer.countDuration <= 0) {
        throw new Error('[Countdown] state.countdown.timer.countDuration must be > 0');
      }
    }
    assertObject(state.appearance, 'state.appearance');
    assertObject(state.countdown.appearance, 'state.countdown.appearance');
    assertString(state.countdown.appearance.timerStyle, 'state.countdown.appearance.timerStyle');
    if (!['separated', 'inline'].includes(state.countdown.appearance.timerStyle)) {
      throw new Error('[Countdown] state.countdown.appearance.timerStyle must be separated|inline');
    }
    assertString(state.countdown.appearance.timeFormat, 'state.countdown.appearance.timeFormat');
    if (!['auto', 'D:H:M:S', 'H:M:S'].includes(state.countdown.appearance.timeFormat)) {
      throw new Error('[Countdown] state.countdown.appearance.timeFormat must be auto|D:H:M:S|H:M:S');
    }
    assertBoolean(state.countdown.appearance.showLabels, 'state.countdown.appearance.showLabels');
    assertFill(state.countdown.appearance.textColor, 'state.countdown.appearance.textColor');
    assertFill(state.countdown.appearance.itemBackground, 'state.countdown.appearance.itemBackground');
    assertString(state.countdown.appearance.separator, 'state.countdown.appearance.separator');
    assertObject(state.appearance.headerCta, 'state.appearance.headerCta');
    assertFill(state.appearance.headerCta.background, 'state.appearance.headerCta.background');
    assertFill(state.appearance.headerCta.textColor, 'state.appearance.headerCta.textColor');
    assertBorderConfig(state.appearance.headerCta.border, 'state.appearance.headerCta.border');
    assertString(state.appearance.headerCta.radius, 'state.appearance.headerCta.radius');
    assertString(state.appearance.headerCta.sizePreset, 'state.appearance.headerCta.sizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.headerCta.sizePreset)) {
      throw new Error('[Countdown] state.appearance.headerCta.sizePreset must be xs|s|m|l|xl|custom');
    }
    assertBoolean(state.appearance.headerCta.paddingLinked, 'state.appearance.headerCta.paddingLinked');
    assertNumber(state.appearance.headerCta.paddingInline, 'state.appearance.headerCta.paddingInline');
    assertNumber(state.appearance.headerCta.paddingBlock, 'state.appearance.headerCta.paddingBlock');
    assertString(state.appearance.headerCta.iconSizePreset, 'state.appearance.headerCta.iconSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.headerCta.iconSizePreset)) {
      throw new Error('[Countdown] state.appearance.headerCta.iconSizePreset must be xs|s|m|l|xl|custom');
    }
    assertNumber(state.appearance.headerCta.iconSize, 'state.appearance.headerCta.iconSize');
    assertFill(state.appearance.localeSwitcherBackground, 'state.appearance.localeSwitcherBackground');
    assertFill(state.appearance.localeSwitcherTextColor, 'state.appearance.localeSwitcherTextColor');
    assertBorderConfig(state.appearance.localeSwitcherBorder, 'state.appearance.localeSwitcherBorder');
    assertString(state.appearance.localeSwitcherRadius, 'state.appearance.localeSwitcherRadius');
    assertNumber(state.appearance.localeSwitcherPaddingInline, 'state.appearance.localeSwitcherPaddingInline');
    assertNumber(state.appearance.localeSwitcherPaddingBlock, 'state.appearance.localeSwitcherPaddingBlock');
    assertObject(state.countdown.appearance.cardwrapper, 'state.countdown.appearance.cardwrapper');
    assertBoolean(state.countdown.appearance.cardwrapper.radiusLinked, 'state.countdown.appearance.cardwrapper.radiusLinked');
    assertString(state.countdown.appearance.cardwrapper.radius, 'state.countdown.appearance.cardwrapper.radius');
    assertString(state.countdown.appearance.cardwrapper.radiusTL, 'state.countdown.appearance.cardwrapper.radiusTL');
    assertString(state.countdown.appearance.cardwrapper.radiusTR, 'state.countdown.appearance.cardwrapper.radiusTR');
    assertString(state.countdown.appearance.cardwrapper.radiusBR, 'state.countdown.appearance.cardwrapper.radiusBR');
    assertString(state.countdown.appearance.cardwrapper.radiusBL, 'state.countdown.appearance.cardwrapper.radiusBL');
    assertBorderConfig(state.countdown.appearance.cardwrapper.border, 'state.countdown.appearance.cardwrapper.border');
    assertShadowConfig(state.countdown.appearance.cardwrapper.shadow, 'state.countdown.appearance.cardwrapper.shadow');
    assertBorderConfig(state.appearance.podBorder, 'state.appearance.podBorder');
    assertObject(state.behavior, 'state.behavior');
    assertBoolean(state.behavior.showBacklink, 'state.behavior.showBacklink');
    assertSocialShare(state.behavior.socialShare, 'state.behavior.socialShare');
    assertObject(state.countdown.actions, 'state.countdown.actions');
    assertObject(state.countdown.actions.during, 'state.countdown.actions.during');
    assertString(state.countdown.actions.during.url, 'state.countdown.actions.during.url');
    assertString(state.countdown.actions.during.text, 'state.countdown.actions.during.text');
    if (!['primary', 'secondary'].includes(state.countdown.actions.during.style)) {
      throw new Error('[Countdown] state.countdown.actions.during.style must be primary|secondary');
    }
    assertBoolean(state.countdown.actions.during.newTab, 'state.countdown.actions.during.newTab');
    assertObject(state.countdown.actions.after, 'state.countdown.actions.after');
    if (!['hide', 'link'].includes(state.countdown.actions.after.type)) {
      throw new Error('[Countdown] state.countdown.actions.after.type must be hide|link');
    }
    assertString(state.countdown.actions.after.url, 'state.countdown.actions.after.url');
    assertString(state.countdown.actions.after.text, 'state.countdown.actions.after.text');
    assertObject(state.stage, 'state.stage');
    assertEnum(state.stage.alignment, 'state.stage.alignment', ['left', 'center', 'right', 'top', 'bottom']);
    assertObject(state.pod, 'state.pod');
    assertCoreSize(state.coreSize, 'state.coreSize');
    assertLocaleSwitcher(state.localeSwitcher, 'state.localeSwitcher');
    assertObject(state.typography, 'state.typography');
    resolveActionHref(state.countdown.actions.during.url, 'state.countdown.actions.during.url', { required: false });
    if (state.countdown.actions.during.url.trim()) {
      assertNonEmptyString(state.countdown.actions.during.text, 'state.countdown.actions.during.text');
    }
    if (state.countdown.actions.after.type === 'link') {
      resolveActionHref(state.countdown.actions.after.url, 'state.countdown.actions.after.url', { required: true });
      assertNonEmptyString(state.countdown.actions.after.text, 'state.countdown.actions.after.text');
    } else {
      resolveActionHref(state.countdown.actions.after.url, 'state.countdown.actions.after.url', { required: false });
    }
  }

  function getTimeZoneOffset(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    parts.forEach((part) => {
      if (part.type === 'literal') return;
      map[part.type] = part.value;
    });
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return asUtc - date.getTime();
  }

  function resolveTargetTimestamp(parts, timeZone) {
    const { year, month, day, hour, minute, second } = parts;
    if (timeZone === 'browser') {
      return new Date(year, month - 1, day, hour, minute, second).getTime();
    }
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const offset = getTimeZoneOffset(utcDate, timeZone);
    return utcDate.getTime() - offset;
  }

  function getDurationSeconds(amount, unit) {
    const multipliers = {
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
      months: 2592000,
    };
    return amount * (multipliers[unit] || 3600);
  }

  function getRepeatSeconds(value) {
    const map = {
      never: 0,
      '1 minute': 60,
      '5 minutes': 300,
      '1 hour': 3600,
      '1 day': 86400,
      '1 week': 604800,
    };
    return map[value] || 0;
  }

  function resolveStorageKey(state) {
    const instanceId = typeof state.instanceId === 'string' ? state.instanceId.trim() : '';
    if (instanceId) return instanceId;
    if (resolvedInstanceId) return resolvedInstanceId;
    return null;
  }

  let currentState = null;
  let currentPhase = 'active';
  let timerKey = '';
  let currentAnimationFrame = null;
  let timerInterval = null;
  let hasDuringCta = false;
  let hasAfterLink = false;

  function applyState(state, runtimeContext) {
    assertCountdownState(state);
    currentState = state;

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[Countdown] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[Countdown] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      countdownRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        timer: { varKey: 'timer' },
        label: { varKey: 'label' },
        button: { varKey: 'button' },
        localeSwitcher: { varKey: 'localeSwitcher' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: resolvedInstanceId },
    );

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[Countdown] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    if (!window.CKCoreSize?.applyCoreSize) {
      throw new Error('[Countdown] Missing CKCoreSize.applyCoreSize');
    }
    window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

    if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
      throw new Error('[Countdown] Missing CKLocaleSwitcher.applyLocaleSwitcher');
    }
    window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
      composedPage: runtimeContext && runtimeContext.composedPage === true,
      locale: runtimeContext && runtimeContext.locale,
      previewMode: runtimeContext && runtimeContext.previewMode,
      typographyScope: countdownRoot,
    });

    applyAppearanceVars(state);
    applyLayoutVars(state);
    applyUnitLabels(state.countdown.timer);

    applyActionsDuring(state);
    applyAfterMessage(state);

    countdownRoot.setAttribute('data-mode', state.countdown.timer.mode);

    if (state.countdown.timer.mode === 'number') {
      numberDisplayEl.hidden = false;
      unitsDisplayEl.hidden = true;
    } else {
      numberDisplayEl.hidden = true;
      unitsDisplayEl.hidden = false;
    }

    if (!window.CKBranding?.applyBacklink) {
      throw new Error('[Countdown] Missing CKBranding.applyBacklink');
    }
    window.CKBranding.applyBacklink(widgetRoot, state);

    if (!window.CKSocialShare?.apply) {
      throw new Error('[Countdown] Missing CKSocialShare.apply');
    }
    window.CKSocialShare.apply(widgetRoot, state, {
      instanceId: runtimeContext && runtimeContext.instanceId || resolvedInstanceId,
      widgetType: 'countdown',
      widgetLabel: document.title || 'Countdown',
      previewMode: runtimeContext && runtimeContext.previewMode,
    });
  }

  function resolveAppearanceHelpers() {
    if (
      !window.CKAppearance ||
      typeof window.CKAppearance.toCssBackground !== 'function' ||
      typeof window.CKAppearance.toCssColor !== 'function'
    ) {
      throw new Error('[Countdown] Missing CKAppearance fill helpers');
    }
    return window.CKAppearance;
  }

  function applyAppearanceVars(state) {
    const helpers = resolveAppearanceHelpers();
    const textColor = helpers.toCssColor(state.countdown.appearance.textColor);
    const itemBackground = helpers.toCssBackground(state.countdown.appearance.itemBackground);

    countdownRoot.setAttribute('data-timer-style', state.countdown.appearance.timerStyle);
    countdownRoot.setAttribute('data-show-labels', state.countdown.appearance.showLabels ? 'true' : 'false');
    countdownRoot.style.setProperty('--countdown-text-color', textColor);
    countdownRoot.style.setProperty('--countdown-item-bg', itemBackground);

    if (!window.CKSurface?.applyCardWrapper) {
      throw new Error('[Countdown] Missing CKSurface.applyCardWrapper');
    }
    window.CKSurface.applyCardWrapper(state.countdown.appearance.cardwrapper, countdownRoot);

    timerEl.querySelectorAll('[data-role="separator"]').forEach((el) => {
      el.textContent = state.countdown.appearance.separator;
    });
  }

  function resolveTimerLabels(timerState) {
    return timerState.labels;
  }

  function applyUnitLabels(timerState) {
    const labels = resolveTimerLabels(timerState);
    TIMER_UNIT_KEYS.forEach((unit) => {
      const unitEl = timerEl.querySelector(`[data-unit="${unit}"]`);
      if (!unitEl) return;
      const labelEl = unitEl.querySelector('[data-role="label"]');
      if (!labelEl) return;
      labelEl.textContent = labels[unit];
    });
  }

  function applyLayoutVars(state) {
    countdownRoot.setAttribute('data-layout-position', 'inline');
    countdownRoot.setAttribute('data-layout-align', 'center');
    stageEl.setAttribute('data-layout-position', 'inline');
    countdownRoot.style.removeProperty('--countdown-content-width');
    countdownRoot.removeAttribute('data-layout-width');
  }



  function applyActionsDuring(state) {
    const href = resolveActionHref(state.countdown.actions.during.url, 'state.countdown.actions.during.url', { required: false });
    hasDuringCta = Boolean(href);

    ctaEl.setAttribute('data-variant', state.countdown.actions.during.style);
    ctaEl.textContent = state.countdown.actions.during.text;

    if (!hasDuringCta) {
      ctaEl.removeAttribute('href');
      ctaEl.removeAttribute('target');
      ctaEl.removeAttribute('rel');
      return;
    }

    ctaEl.setAttribute('href', href);
    if (state.countdown.actions.during.newTab) {
      ctaEl.setAttribute('target', '_blank');
      ctaEl.setAttribute('rel', 'noopener');
    } else {
      ctaEl.setAttribute('target', '_self');
      ctaEl.removeAttribute('rel');
    }
  }

  function applyAfterMessage(state) {
    const href = resolveActionHref(state.countdown.actions.after.url, 'state.countdown.actions.after.url', {
      required: state.countdown.actions.after.type === 'link',
    });
    hasAfterLink = state.countdown.actions.after.type === 'link' && Boolean(href);

    afterLinkEl.textContent = state.countdown.actions.after.text;

    if (!hasAfterLink) {
      afterLinkEl.removeAttribute('href');
      afterLinkEl.removeAttribute('target');
      afterLinkEl.removeAttribute('rel');
      return;
    }

    afterLinkEl.setAttribute('href', href);
    afterLinkEl.setAttribute('target', '_self');
    afterLinkEl.removeAttribute('rel');
  }

  function renderPhase(state, phase) {
    if (phase === 'active') {
      stageEl.hidden = false;
      coreEl.hidden = false;
      timerEl.hidden = false;
      afterMsgEl.hidden = true;
      ctaEl.hidden = !hasDuringCta;
      return;
    }

    if (state.countdown.actions.after.type === 'hide') {
      stageEl.hidden = false;
      coreEl.hidden = true;
      return;
    }

    stageEl.hidden = false;
    coreEl.hidden = false;
    timerEl.hidden = true;
    ctaEl.hidden = true;
    afterMsgEl.hidden = !hasAfterLink;
  }

  function resolveTimerKey(state) {
    if (state.countdown.timer.mode === 'date') {
      return `date|${state.countdown.timer.targetDate}|${state.countdown.timer.timezone}`;
    }
    if (state.countdown.timer.mode === 'personal') {
      const storageKey = resolveStorageKey(state) || '';
      return `personal|${storageKey}|${state.countdown.timer.timeAmount}|${state.countdown.timer.timeUnit}|${state.countdown.timer.repeat}`;
    }
    if (state.countdown.timer.mode === 'number') {
      return `number|${state.countdown.timer.startingNumber}|${state.countdown.timer.targetNumber}|${state.countdown.timer.countDuration}`;
    }
    return String(state.countdown.timer.mode || '');
  }

  function syncTimerScheduler(state) {
    const nextKey = resolveTimerKey(state);
    if (nextKey === timerKey) {
      renderPhase(currentState || state, currentPhase);
      return;
    }
    timerKey = nextKey;

    if (currentAnimationFrame) cancelAnimationFrame(currentAnimationFrame);
    if (timerInterval) clearInterval(timerInterval);
    currentAnimationFrame = null;
    timerInterval = null;

    if (state.countdown.timer.mode === 'date') {
      const targetParts = parseTargetDate(state.countdown.timer.targetDate);
      const targetTimeMs = resolveTargetTimestamp(targetParts, state.countdown.timer.timezone);

      const tick = () => {
        const totalSeconds = Math.max(0, Math.floor((targetTimeMs - Date.now()) / 1000));
        updateUnits(totalSeconds);
        currentPhase = totalSeconds === 0 ? 'ended' : 'active';
        renderPhase(currentState || state, currentPhase);
      };

      tick();
      timerInterval = setInterval(tick, 1000);
      return;
    }

    if (state.countdown.timer.mode === 'personal') {
      const storageKey = resolveStorageKey(state);
      if (!storageKey) {
        throw new Error('[Countdown] personal timer requires an instance id');
      }
      let startMs;
      let stored;
      try {
        stored = localStorage.getItem(`countdown_${storageKey}`);
      } catch {
        throw new Error('[Countdown] personal timer storage is unavailable');
      }
      if (stored) {
        startMs = Number(stored);
        if (!Number.isFinite(startMs)) {
          throw new Error('[Countdown] personal timer stored start is invalid');
        }
      } else {
        startMs = Date.now();
        try {
          localStorage.setItem(`countdown_${storageKey}`, String(startMs));
        } catch {
          throw new Error('[Countdown] personal timer storage is unavailable');
        }
      }

      const durationSeconds = getDurationSeconds(state.countdown.timer.timeAmount, state.countdown.timer.timeUnit);
      const repeatSeconds = getRepeatSeconds(state.countdown.timer.repeat);
      const cycleSeconds = repeatSeconds > 0 ? durationSeconds + repeatSeconds : durationSeconds;

      const tick = () => {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        if (repeatSeconds > 0) {
          const cycleElapsed = elapsedSeconds % cycleSeconds;
          if (cycleElapsed < durationSeconds) {
            const remaining = Math.max(0, durationSeconds - cycleElapsed);
            updateUnits(remaining);
            currentPhase = 'active';
            renderPhase(currentState || state, currentPhase);
            return;
          }
          updateUnits(0);
          currentPhase = 'ended';
          renderPhase(currentState || state, currentPhase);
          return;
        }

        const remaining = Math.max(0, durationSeconds - elapsedSeconds);
        updateUnits(remaining);
        currentPhase = remaining === 0 ? 'ended' : 'active';
        renderPhase(currentState || state, currentPhase);
      };

      tick();
      timerInterval = setInterval(tick, 1000);
      return;
    }

    if (state.countdown.timer.mode === 'number') {
      const start = state.countdown.timer.startingNumber;
      const end = state.countdown.timer.targetNumber;
      const durationMs = state.countdown.timer.countDuration * 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const current = start + (end - start) * progress;
        updateNumber(current);
        if (progress < 1) {
          currentAnimationFrame = requestAnimationFrame(animate);
        } else {
          currentPhase = 'ended';
          renderPhase(currentState || state, currentPhase);
        }
      };

      currentPhase = 'active';
      renderPhase(currentState || state, currentPhase);
      animate();
    }
  }

  function updateUnits(totalSeconds) {
    const time = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
    ['days', 'hours', 'minutes', 'seconds'].forEach((unit) => {
      const unitEl = timerEl.querySelector(`[data-unit="${unit}"]`);
      if (!unitEl) return;
      const valueEl = unitEl.querySelector('[data-role="value"]');
      if (!valueEl) return;
      valueEl.textContent = String(time[unit]).padStart(2, '0');

      // timeFormat logic
      const format = currentState && currentState.countdown.appearance && currentState.countdown.appearance.timeFormat || 'auto';
      let show = true;
      if (format === 'H:M:S' && unit === 'days') show = false;
      if (format === 'auto' && unit === 'days' && time.days === 0) show = false;
      
      if (show) {
        unitEl.hidden = false;
        unitEl.style.display = '';
      } else {
        unitEl.hidden = true;
        unitEl.style.display = 'none';
      }
    });
  }

  function updateNumber(value) {
    numberValueEl.textContent = String(Math.round(value));
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
          console.error('[Countdown] preview localization load failed', error);
        }
        return;
      }
    }
    if (requestId !== previewLocaleRequest) return;
    applyState(localizedState, { locale, previewMode });
    syncTimerScheduler(localizedState);
  }

  runtime.bindStateUpdates('countdown', resolvedInstanceId, (data) => {
    void applyPreviewState(
      data.state,
      data.locale,
      data.instanceId,
      data.previewMode,
      data.baseLocale,
    );
  }, { requireWidgetName: true });

  if (runtimeContext.payload) {
    const initialLocale = runtimeContext.locale || '';
    applyState(runtimeContext.state, { locale: initialLocale });
    syncTimerScheduler(runtimeContext.state);
  }
  }

  runtime.register('countdown', initCountdown);
})();
