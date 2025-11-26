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
    position: {
      layout: 'full-width',
      contentWidth: 960,
      alignment: 'center',
      padding: 24,
      gap: 16,
    },
    stage: {
      background: 'transparent',
    },
    pod: {
      background: 'transparent',
    },
    theme: {
      preset: 'custom',
      background: '#6B21A8',
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
  };

  const data = window.CK_WIDGET?.state || window.ckeenInstanceData || {};
  let state = mergeState(defaultState, data);
  const widget = document.querySelector('.ck-countdown');
  if (!widget) return;

  let timerInterval = null;
  let numberRAF = null;
  let numberStartTs = null;
  let customCssEl = null;

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

    const mergedPosition = {
      ...(base.position || {}),
      ...(next?.position || {}),
    };

    const mergedActions = {
      ...(base.actions || {}),
      ...(next?.actions || {}),
    };

    const mergedSettings = {
      ...(base.settings || {}),
      ...(next?.settings || {}),
    };

    return {
      ...base,
      ...next,
      timer: mergedTimer,
      actions: mergedActions,
      position: mergedPosition,
      theme: mergedTheme,
      settings: mergedSettings,
    };
  }

  function clampNumber(v, min, max, fallback) {
    const n = Number(v);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function setCssVars() {
    const { position = {}, theme = {} } = state;
    const root = widget;
    if (!root) return;
    const palette = resolvePalette(theme);
    root.style.setProperty('--content-width', `${position.contentWidth || 960}px`);
    root.style.setProperty('--padding', `${position.padding || 24}px`);
    root.style.setProperty('--gap', `${position.gap || 16}px`);
    root.style.setProperty('--ck-bg', palette.background);
    root.style.setProperty('--ck-heading-color', palette.headingColor);
    root.style.setProperty('--ck-timer-color', palette.timerColor);
    root.style.setProperty('--ck-labels-color', palette.labelsColor);
    root.style.setProperty('--ck-separator-color', palette.separatorColor);
    root.style.setProperty('--ck-button-color', palette.buttonColor);
    root.style.setProperty('--ck-button-text-color', palette.buttonTextColor);
    root.style.setProperty('--heading-size', `${theme.headingSize || 22}px`);
    root.style.setProperty('--timer-size', `${theme.timerSize || 100}`);
    root.style.setProperty('--label-size', `${theme.labelSize || 14}px`);
    root.style.setProperty('--button-size', `${theme.buttonSize || 100}`);
  }

  function applyLayout() {
    const { position = {} } = state;
    widget.setAttribute('data-layout', position.layout || 'full-width');
    widget.setAttribute('data-alignment', position.alignment || 'center');
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
    if (stageEl) {
      stageEl.style.setProperty('--stage-bg', state.stage?.background || 'transparent');
    }
    if (podEl) {
      podEl.style.setProperty('--pod-bg', state.pod?.background || 'transparent');
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
      const storageKey = `ck-countdown-${state.widgetname || 'countdown'}-${location.pathname}`;
      const stored = localStorage.getItem(storageKey);
      const now = Date.now();
      let target = stored ? Number(stored) : null;
      if (!target || Number.isNaN(target) || target <= now) {
        const amount = Number(state.timer.personalCountdown?.timeAmount || 1);
        const unit = state.timer.personalCountdown?.timeUnit || 'hours';
        const duration = toMs(amount, unit);
        target = now + duration;
        localStorage.setItem(storageKey, String(target));
      }
      return target;
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
      const storageKey = `ck-countdown-${state.widgetname || 'countdown'}-${location.pathname}`;
      const amount = Number(timer.personalCountdown?.repeatAmount || 1);
      const unit = timer.personalCountdown?.repeatUnit || 'minutes';
      const duration = toMs(amount, unit);
      const nextTarget = Date.now() + duration;
      localStorage.setItem(storageKey, String(nextTarget));
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
    start();
  }

  function resolvePalette(theme = {}) {
    const preset = theme.preset || 'custom';
    const presets = {
      light: {
        background: '#FFFFFF',
        headingColor: '#0F172A',
        timerColor: '#0F172A',
        labelsColor: '#334155',
        separatorColor: '#CBD5E1',
        buttonColor: '#0F172A',
        buttonTextColor: '#FFFFFF',
      },
      dark: {
        background: '#0F172A',
        headingColor: '#E2E8F0',
        timerColor: '#E2E8F0',
        labelsColor: '#94A3B8',
        separatorColor: '#475569',
        buttonColor: '#38BDF8',
        buttonTextColor: '#0F172A',
      },
      gradient: {
        background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #2563EB 100%)',
        headingColor: '#FFFFFF',
        timerColor: '#FFFFFF',
        labelsColor: '#E2E8F0',
        separatorColor: '#C4B5FD',
        buttonColor: '#FBBF24',
        buttonTextColor: '#1F2937',
      },
      custom: {},
    };
    const palette = presets[preset] || presets.custom;
    return {
      background: theme.background || palette.background || '#6B21A8',
      headingColor: theme.headingColor || palette.headingColor || '#FFFFFF',
      timerColor: theme.timerColor || palette.timerColor || '#FFFFFF',
      labelsColor: theme.labelsColor || palette.labelsColor || '#FFFFFF',
      separatorColor: theme.separatorColor || palette.separatorColor || '#FFFFFF',
      buttonColor: theme.buttonColor || palette.buttonColor || '#84CC16',
      buttonTextColor: theme.buttonTextColor || palette.buttonTextColor || '#000000',
    };
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
