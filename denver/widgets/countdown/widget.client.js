/**
 * Countdown widget runtime
 * Supports three modes: date, personal, number counter.
 * Applies appearance/layout tokens and handles after-actions.
 */

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const defaultState = {
    widgetname: 'countdown',
    timer: {
      mode: 'personal',
      heading: "Get 50% off before it's too late ⏰",
      countdownToDate: {
        targetDate: '2025-12-31',
        targetTime: '23:59',
        timezone: 'browser',
      },
      personalCountdown: {
        timeAmount: 1,
        timeUnit: 'hours',
        repeatEnabled: false,
        repeatAmount: 1,
        repeatUnit: 'hours',
      },
      numberCounter: {
        targetNumber: 1000,
        startingNumber: 0,
        duration: 5,
      },
    },
    actions: {
      showButtonDuring: false,
      buttonText: 'Purchase now',
      buttonUrl: '',
      buttonStyle: 'primary',
      openInNewTab: true,
      afterAction: 'hide',
      afterButtonText: 'Shop now',
      afterButtonUrl: '',
      expiredMessage: 'Offer ended',
    },
    layout: {
      type: 'full-width',
      alignment: 'center',
      padding: 24,
      gap: 16,
    },
    stage: {
      background: 'var(--color-system-gray-5)',
      alignment: 'center',
      paddingLinked: true,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    pod: {
      background: 'var(--color-system-white)',
      paddingLinked: true,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      widthMode: 'wrap',
      contentWidth: 960,
      radiusLinked: true,
      radius: '6xl',
      radiusTL: '6xl',
      radiusTR: '6xl',
      radiusBR: '6xl',
      radiusBL: '6xl',
    },
    theme: {
      preset: 'custom',
      headingColor: '#FFFFFF',
      timerColor: '#FFFFFF',
      labelsColor: '#FFFFFF',
      buttonColor: '#84CC16',
      buttonTextColor: '#000000',
      timerStyle: 'separated',
      animation: 'none',
      separator: 'colon',
      separatorColor: '#FFFFFF',
      timeFormat: 'DHMS',
      showLabels: true,
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
      headingSize: 22,
      timerSize: 110,
      labelSize: 14,
      buttonSize: 100,
    },
    settings: {
      language: 'en-US',
      customCSS: '',
      customJS: '',
    },
    behavior: {
      showBacklink: true,
    },
  };

  const initial = window.CK_WIDGET?.state || {};
  let state = mergeState(defaultState, initial);
  const widget = document.querySelector('.ck-countdown');
  if (!widget) return;

  let timerInterval = null;
  let numberRAF = null;
  let numberStartTs = null;
  let customCssEl = null;
  let personalTarget = null;

  function toBool(v, fallback) {
    if (v === undefined || v === null) return fallback;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    return Boolean(v);
  }

  function mergeState(base, next) {
    const nextTimer = next?.timer || {};
    const baseTimer = base?.timer || {};
    const mergedTimer = {
      ...baseTimer,
      ...nextTimer,
      countdownToDate: {
        ...(baseTimer.countdownToDate || {}),
        ...(nextTimer.countdownToDate || {}),
      },
      personalCountdown: {
        ...(baseTimer.personalCountdown || {}),
        ...(nextTimer.personalCountdown || {}),
      },
      numberCounter: {
        ...(baseTimer.numberCounter || {}),
        ...(nextTimer.numberCounter || {}),
      },
    };

    const mergedTheme = {
      ...(base.theme || {}),
      ...(next?.theme || {}),
    };

    const mergedLayout = {
      ...(base.layout || {}),
      ...(next?.layout || {}),
    };

    const mergedActions = {
      ...(base.actions || {}),
      ...(next?.actions || {}),
    };

    const mergedStage = {
      ...(base.stage || {}),
      ...(next?.stage || {}),
    };

    const mergedPod = {
      ...(base.pod || {}),
      ...(next?.pod || {}),
    };

    const mergedSettings = {
      ...(base.settings || {}),
      ...(next?.settings || {}),
    };

    const mergedBehavior = {
      ...(base.behavior || {}),
      ...(next?.behavior || {}),
    };

    return {
      ...base,
      ...next,
      timer: mergedTimer,
      actions: mergedActions,
      layout: mergedLayout,
      theme: mergedTheme,
      stage: mergedStage,
      pod: mergedPod,
      settings: mergedSettings,
      behavior: mergedBehavior,
    };
  }

  function clampNumber(v, min, max, fallback) {
    const n = Number(v);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function setCssVars() {
    const { layout = {}, pod = {}, theme = {} } = state;
    const root = widget;
    if (!root) return;
    const palette = resolvePalette(pod, theme);
    const layoutPadding =
      typeof layout.padding === 'number'
        ? layout.padding
        : Number(layout.padding ?? defaultState.layout?.padding ?? 24);
    const layoutGap =
      typeof layout.gap === 'number' ? layout.gap : Number(layout.gap ?? defaultState.layout?.gap ?? 16);
    root.style.setProperty('--padding', `${Number.isFinite(layoutPadding) ? layoutPadding : 24}px`);
    root.style.setProperty('--gap', `${Number.isFinite(layoutGap) ? layoutGap : 16}px`);
    root.style.setProperty('--ck-bg', palette.background);
    root.style.setProperty('--ck-heading-color', palette.headingColor);
    root.style.setProperty('--ck-timer-color', palette.timerColor);
    root.style.setProperty('--ck-labels-color', palette.labelsColor);
    root.style.setProperty('--ck-separator-color', palette.separatorColor);
    root.style.setProperty('--ck-button-color', palette.buttonColor);
    root.style.setProperty('--ck-button-text-color', palette.buttonTextColor);
    root.style.setProperty('--heading-size', `${state.theme?.headingSize || 22}px`);
    root.style.setProperty('--timer-size', `${state.theme?.timerSize || 100}`);
    root.style.setProperty('--label-size', `${state.theme?.labelSize || 14}px`);
    root.style.setProperty('--button-size', `${state.theme?.buttonSize || 100}`);
  }

  function applyLayout() {
    const { layout = {} } = state;
    widget.setAttribute('data-layout', layout.type || 'full-width');
    widget.setAttribute('data-alignment', layout.alignment || 'center');
    widget.setAttribute('data-theme', state.theme?.preset || 'custom');
    widget.setAttribute('data-timer-style', state.theme?.timerStyle || 'separated');
    widget.setAttribute('data-animation', state.theme?.animation || 'none');
    widget.setAttribute('data-mode', state.timer?.mode || 'personal');
  }

  function applyContent() {
    const headingEl = widget.querySelector('[data-role="heading"]');
    if (headingEl) {
      headingEl.textContent = state.timer?.heading || 'Countdown';
    }
    if (document.documentElement) {
      document.documentElement.lang = state.settings?.language || 'en';
    }
  }

  function applyBackdrop() {
    const stageEl = document.querySelector('.stage');
    const podEl = document.querySelector('.pod');
    const stageCfg = state.stage || {};
    const podCfg = state.pod || {};
    if (stageEl) {
      const stageBg = stageCfg.background || defaultState.stage.background;
      stageEl.style.setProperty('--stage-bg', stageBg);
      const stageLinked = toBool(stageCfg.paddingLinked, true);
      if (stageLinked) {
        const pad = stageCfg.padding ?? defaultState.stage.padding ?? 0;
        stageEl.style.padding = `${pad}px`;
      } else {
        const top = stageCfg.paddingTop ?? defaultState.stage.paddingTop ?? stageCfg.padding ?? 0;
        const right = stageCfg.paddingRight ?? defaultState.stage.paddingRight ?? stageCfg.padding ?? 0;
        const bottom = stageCfg.paddingBottom ?? defaultState.stage.paddingBottom ?? stageCfg.padding ?? 0;
        const left = stageCfg.paddingLeft ?? defaultState.stage.paddingLeft ?? stageCfg.padding ?? 0;
        stageEl.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
      const align = stageCfg.alignment || 'center';
      const { justify, alignItems } = resolveStageAlignment(align);
      stageEl.style.justifyContent = justify;
      stageEl.style.alignItems = alignItems;
    }
    if (podEl) {
      const podBg = podCfg.background || defaultState.pod.background;
      podEl.style.setProperty('--pod-bg', podBg);
      const padLinked = toBool(podCfg.paddingLinked, true);
      if (padLinked) {
        const pad = podCfg.padding ?? defaultState.pod.padding ?? 0;
        podEl.style.padding = `${pad}px`;
      } else {
        const top = podCfg.paddingTop ?? defaultState.pod.paddingTop ?? podCfg.padding ?? 0;
        const right = podCfg.paddingRight ?? defaultState.pod.paddingRight ?? podCfg.padding ?? 0;
        const bottom = podCfg.paddingBottom ?? defaultState.pod.paddingBottom ?? podCfg.padding ?? 0;
        const left = podCfg.paddingLeft ?? defaultState.pod.paddingLeft ?? podCfg.padding ?? 0;
        podEl.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
      const linked = toBool(podCfg.radiusLinked, true);
      const resolveRadiusToken = (value, fallback) => {
        if (value === 'none') return '0';
        const v = value || fallback;
        return v ? `var(--control-radius-${v})` : `var(--control-radius-${fallback})`;
      };
      if (linked) {
        podEl.style.setProperty('--pod-radius', resolveRadiusToken(podCfg.radius, defaultState.pod.radius || '6xl'));
      } else {
        const tl = resolveRadiusToken(podCfg.radiusTL, defaultState.pod.radiusTL || defaultState.pod.radius || '6xl');
        const tr = resolveRadiusToken(podCfg.radiusTR, defaultState.pod.radiusTR || defaultState.pod.radius || '6xl');
        const br = resolveRadiusToken(podCfg.radiusBR, defaultState.pod.radiusBR || defaultState.pod.radius || '6xl');
        const bl = resolveRadiusToken(podCfg.radiusBL, defaultState.pod.radiusBL || defaultState.pod.radius || '6xl');
        podEl.style.setProperty('--pod-radius', `${tl} ${tr} ${br} ${bl}`);
      }
      const pPadX = podCfg.paddingX ?? podCfg.padding;
      const pPadY = podCfg.paddingY ?? podCfg.padding;
      if (pPadX != null) podEl.style.setProperty('--pod-padding-x', `${pPadX}px`);
      if (pPadY != null) podEl.style.setProperty('--pod-padding-y', `${pPadY}px`);
      const widthMode = podCfg.widthMode || 'wrap';
      podEl.setAttribute('data-width-mode', widthMode);
      const cw = podCfg.contentWidth;
      if (cw != null && cw !== '') podEl.style.setProperty('--content-width', `${cw}px`);
      else podEl.style.removeProperty('--content-width');
    }
  }

  function applyActionsVisibility() {
    const duringCta = widget.querySelector('[data-role="cta-during"]');
    const duringWrap = widget.querySelector('[data-role="actions-during"]');
    const afterWrap = widget.querySelector('[data-role="actions-after"]');
    const afterCta = widget.querySelector('[data-role="cta-after"]');
    const expiredMsg = widget.querySelector('[data-role="expired-message"]');
    const { actions = {} } = state;

    const showDuring = toBool(actions.showButtonDuring, false);
    if (duringWrap) duringWrap.style.display = showDuring ? '' : 'none';
    if (duringCta) {
      duringCta.textContent = actions.buttonText || 'Purchase now';
      duringCta.setAttribute('href', actions.buttonUrl || '#');
      duringCta.setAttribute('data-variant', actions.buttonStyle || 'primary');
      if (toBool(actions.openInNewTab, true)) {
        duringCta.setAttribute('target', '_blank');
        duringCta.setAttribute('rel', 'noreferrer');
      } else {
        duringCta.removeAttribute('target');
        duringCta.removeAttribute('rel');
      }
    }

    if (expiredMsg) expiredMsg.textContent = actions.expiredMessage || 'Offer ended';
    if (afterCta) {
      afterCta.textContent = actions.afterButtonText || 'Shop now';
      afterCta.setAttribute('href', actions.afterButtonUrl || '#');
      afterCta.setAttribute('data-variant', actions.buttonStyle || 'primary');
      afterCta.setAttribute('target', '_blank');
      afterCta.setAttribute('rel', 'noreferrer');
    }
  }

  function applyTimerVisibility() {
    const { theme = {} } = state;
    const format = theme.timeFormat || 'DHMS';
    const showDays = toBool(theme.showDays, true) && format.includes('D');
    const showHours = toBool(theme.showHours, true) && (format.includes('H') || !format.includes('D'));
    const showMinutes = toBool(theme.showMinutes, true);
    const showSeconds = toBool(theme.showSeconds, true);
    const sep = theme.separator || 'colon';

    const daysEl = widget.querySelector('[data-unit="days"]');
    const hoursEl = widget.querySelector('[data-unit="hours"]');
    const minutesEl = widget.querySelector('[data-unit="minutes"]');
    const secondsEl = widget.querySelector('[data-unit="seconds"]');
    const seps = widget.querySelectorAll('.ck-timer-sep');

    if (daysEl) daysEl.style.display = showDays ? '' : 'none';
    if (hoursEl) hoursEl.style.display = showHours ? '' : 'none';
    if (minutesEl) minutesEl.style.display = showMinutes ? '' : 'none';
    if (secondsEl) secondsEl.style.display = showSeconds ? '' : 'none';

    seps.forEach((sepEl) => {
      sepEl.setAttribute('data-separator', sep);
      sepEl.style.display = sep === 'none' ? 'none' : '';
    });

    // Hide separators that would sit next to hidden units
    const units = Array.from(widget.querySelectorAll('.ck-timer-unit'));
    const visibleUnits = units.filter((u) => u.style.display !== 'none');
    seps.forEach((sepEl, idx) => {
      const leftVisible = visibleUnits[idx] != null;
      const rightVisible = visibleUnits[idx + 1] != null;
      sepEl.style.display = leftVisible && rightVisible && sep !== 'none' ? '' : 'none';
    });

    const showLabels = toBool(theme.showLabels, true);
    const labels = widget.querySelectorAll('.ck-timer-label');
    labels.forEach((label) => {
      label.style.display = showLabels ? '' : 'none';
    });
  }

  function renderNumberCounter(ts) {
    const { numberCounter = {} } = state.timer || {};
    const start = Number(numberCounter.startingNumber || 0);
    const end = Number(numberCounter.targetNumber || 0);
    const durationMs = Math.max(0, Number(numberCounter.duration || 5) * 1000);
    if (durationMs === 0) {
      setNumberValue(end);
      return;
    }
    if (!numberStartTs) numberStartTs = ts || performance.now();
    const elapsed = Math.min(durationMs, (ts || performance.now()) - numberStartTs);
    const progress = elapsed / durationMs;
    const value = Math.floor(start + (end - start) * progress);
    setNumberValue(value);
    if (elapsed < durationMs) {
      numberRAF = requestAnimationFrame(renderNumberCounter);
    } else {
      setNumberValue(end);
    }
  }

  function setNumberValue(val) {
    const el = widget.querySelector('[data-role="number-value"]');
    if (el) el.textContent = String(val);
  }

  function formatUnits(remainingMs) {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    return {
      days,
      hours: totalHours % 24,
      minutes: totalMinutes % 60,
      seconds: totalSeconds % 60,
    };
  }

  function setUnit(unit, value, animate) {
    const unitEl = widget.querySelector(`.ck-timer-unit[data-unit="${unit}"] .ck-timer-value`);
    if (!unitEl) return;
    const prev = unitEl.textContent;
    const next = String(value).padStart(2, '0');
    if (prev !== next) {
      unitEl.textContent = next;
      unitEl.setAttribute('data-animate', animate ? state.theme?.animation : 'none');
    }
  }

  function updateTimer() {
    const now = Date.now();
    const target = resolveTargetTime();
    if (!target) return;
    const remaining = target - now;
    if (remaining <= 0) {
      handleExpire();
      return;
    }
    const units = formatUnits(remaining);
    const format = state.theme?.timeFormat || 'DHMS';
    const showDays = toBool(state.theme?.showDays, true) && format.includes('D');
    const showHours = toBool(state.theme?.showHours, true) && (format.includes('H') || !format.includes('D'));

    if (showDays) setUnit('days', units.days, true);
    if (showHours) setUnit('hours', units.hours, true);
    setUnit('minutes', units.minutes, true);
    setUnit('seconds', units.seconds, true);
  }

  function resolveTargetTime() {
    if (state.timer?.mode === 'date') {
      const { countdownToDate = {} } = state.timer;
      const dateStr = countdownToDate.targetDate;
      const timeStr = countdownToDate.targetTime || '00:00';
      if (!dateStr) return null;
      const tz = countdownToDate.timezone || 'browser';
      return resolveDateWithTimezone(dateStr, timeStr, tz);
    }
    if (state.timer?.mode === 'personal') {
      const now = Date.now();
      if (!personalTarget) {
        const amount = Number(state.timer.personalCountdown?.timeAmount || 1);
        const unit = state.timer.personalCountdown?.timeUnit || 'hours';
        const duration = toMs(amount, unit);
        personalTarget = now + duration;
      }
      return personalTarget;
    }
    return null;
  }

  function toMs(amount, unit) {
    const n = Number(amount) || 0;
    switch (unit) {
      case 'minutes':
        return n * 60 * 1000;
      case 'hours':
        return n * 60 * 60 * 1000;
      case 'days':
        return n * 24 * 60 * 60 * 1000;
      default:
        return n * 1000;
    }
  }

  function resolveDateWithTimezone(dateStr, timeStr, tz) {
    const safeTime = timeStr.includes(':') ? timeStr : `${timeStr}:00`;
    const base = new Date(`${dateStr}T${safeTime}`);
    if (Number.isNaN(base.getTime())) return null;
    if (tz === 'browser') return base.getTime();

    // Approximate conversion using Intl to compute the timezone offset
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
        .formatToParts(base)
        .reduce((acc, part) => {
          if (part.type !== 'literal') acc[part.type] = part.value;
          return acc;
        }, {});

      const year = Number(parts.year);
      const month = Number(parts.month) - 1;
      const day = Number(parts.day);
      const hour = Number(parts.hour);
      const minute = Number(parts.minute);
      const second = Number(parts.second);
      const tzDate = Date.UTC(year, month, day, hour, minute, second);
      const localDate = new Date(Date.UTC(year, month, day, hour, minute, second));
      const offset = localDate.getTime() - tzDate;
      return tzDate + offset;
    } catch (_err) {
      return base.getTime();
    }
  }

  function handleExpire() {
    const { actions = {}, timer = {} } = state;
    if (timer.mode === 'personal' && toBool(timer.personalCountdown?.repeatEnabled, false)) {
      const amount = Number(timer.personalCountdown?.repeatAmount || 1);
      const unit = timer.personalCountdown?.repeatUnit || 'minutes';
      const duration = toMs(amount, unit);
      personalTarget = Date.now() + duration;
      return;
    }

    widget.setAttribute('data-state', 'expired');
    widget.setAttribute('data-after-action', actions.afterAction || 'hide');
    const afterWrap = widget.querySelector('[data-role="actions-after"]');
    if (afterWrap) afterWrap.hidden = false;
    if (timerInterval) clearInterval(timerInterval);
  }

  function applyCustomCss(css) {
    if (!customCssEl) {
      customCssEl = document.createElement('style');
      customCssEl.setAttribute('data-role', 'custom-css');
      document.head.appendChild(customCssEl);
    }
    customCssEl.textContent = css || '';
  }

  function applyCustomJs(code) {
    if (!code) return;
    try {
      const fn = new Function('state', code);
      fn(state);
    } catch (err) {
      // Fail silently to avoid breaking the widget runtime.
      // eslint-disable-next-line no-console
      console.warn('[Countdown] custom JS error', err);
    }
  }

  function start() {
    setCssVars();
    applyLayout();
    applyContent();
    applyBackdrop();
    applyActionsVisibility();
    applyTimerVisibility();
    applyCustomCss(state.settings?.customCSS || '');
    applyCustomJs(state.settings?.customJS || '');
    const backlink = widget.querySelector('[data-role="backlink"]');
    if (backlink instanceof HTMLElement) {
      const show = toBool(state.behavior?.showBacklink, true);
      backlink.style.display = show ? '' : 'none';
      backlink.hidden = !show;
    }

    if (state.timer?.mode === 'number') {
      const timerEl = widget.querySelector('[data-role="units"]');
      const numberEl = widget.querySelector('[data-role="number"]');
      if (timerEl) timerEl.hidden = true;
      if (numberEl) numberEl.hidden = false;
      numberRAF = requestAnimationFrame(renderNumberCounter);
      return;
    }

    // Show timer units for date/personal
    const timerEl = widget.querySelector('[data-role="units"]');
    const numberEl = widget.querySelector('[data-role="number"]');
    if (timerEl) timerEl.hidden = false;
    if (numberEl) numberEl.hidden = true;

    updateTimer();
    timerInterval = window.setInterval(updateTimer, 1000);
  }

  function applyState(next) {
    state = mergeState(state, next || {});
  }

  function restart() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (numberRAF) {
      cancelAnimationFrame(numberRAF);
      numberRAF = null;
    }
    numberStartTs = null;
    personalTarget = null;
    start();
  }

  function resolvePalette(pod = {}, theme = {}) {
    const defaults = defaultState.theme || {};
    const mergedTheme = { ...defaults, ...theme };
    return {
      background: pod.background || defaultState.pod.background,
      headingColor: mergedTheme.headingColor || defaults.headingColor,
      timerColor: mergedTheme.timerColor || defaults.timerColor,
      labelsColor: mergedTheme.labelsColor || defaults.labelsColor,
      separatorColor: mergedTheme.separatorColor || defaults.separatorColor,
      buttonColor: mergedTheme.buttonColor || defaults.buttonColor,
      buttonTextColor: mergedTheme.buttonTextColor || defaults.buttonTextColor,
    };
  }

  function resolveStageAlignment(value) {
    switch (value) {
      case 'left':
        return { justify: 'flex-start', alignItems: 'center' };
      case 'right':
        return { justify: 'flex-end', alignItems: 'center' };
      case 'top':
        return { justify: 'center', alignItems: 'flex-start' };
      case 'bottom':
        return { justify: 'center', alignItems: 'flex-end' };
      case 'center':
      default:
        return { justify: 'center', alignItems: 'center' };
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'ck:state-update') return;
    if (msg.widgetname && msg.widgetname !== 'countdown') return;
    applyState(msg.state || {});
    restart();
  });

  start();
})();
