/**
 * Countdown widget runtime (strict, deterministic).
 * Assumes canonical, typed state from the editor; no runtime fallbacks/merges.
 */

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widget = scriptEl.closest('[data-ck-widget="countdown"]');
  if (!(widget instanceof HTMLElement)) {
    throw new Error('[Countdown] widget.client.js must be rendered inside [data-ck-widget="countdown"]');
  }

  let timerInterval = null;
  let numberRAF = null;
  let numberStartTs = null;
  let customCssEl = null;
  let personalTarget = null;

  function toMs(amount, unit) {
    const n = amount;
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
    if (Number.isNaN(base.getTime())) {
      throw new Error('[Countdown] Invalid target date/time');
    }
    if (tz === 'browser') return base.getTime();

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
    return Date.UTC(year, month, day, hour, minute, second);
  }

  function setCssVars(state) {
    const { layout, pod, theme } = state;
    widget.style.setProperty('--gap', `${layout.gap}px`);
    widget.style.setProperty('--ck-bg', pod.background);
    widget.style.setProperty('--ck-heading-color', theme.headingColor);
    widget.style.setProperty('--ck-timer-color', theme.timerColor);
    widget.style.setProperty('--ck-labels-color', theme.labelsColor);
    widget.style.setProperty('--ck-separator-color', theme.separatorColor);
    widget.style.setProperty('--ck-button-color', theme.buttonColor);
    widget.style.setProperty('--ck-button-text-color', theme.buttonTextColor);
    widget.style.setProperty('--heading-size', `${theme.headingSize}px`);
    widget.style.setProperty('--timer-size', String(theme.timerSize));
    widget.style.setProperty('--label-size', `${theme.labelSize}px`);
    widget.style.setProperty('--button-size', String(theme.buttonSize));
  }

  function applyLayout(state) {
    const { layout, theme, timer } = state;
    widget.setAttribute('data-layout', layout.type);
    widget.setAttribute('data-alignment', layout.alignment);
    widget.setAttribute('data-theme', theme.preset);
    widget.setAttribute('data-timer-style', theme.timerStyle);
    widget.setAttribute('data-animation', theme.animation);
    widget.setAttribute('data-mode', timer.mode);
  }

  function applyContent(state) {
    const headingEl = widget.querySelector('[data-role="heading"]');
    if (headingEl) headingEl.textContent = state.timer.heading;
    if (document.documentElement) document.documentElement.lang = state.settings.language;
  }

  function applyBackdrop(state) {
    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[Countdown] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widget);
  }

  function applyActionsVisibility(state) {
    const duringCta = widget.querySelector('[data-role="cta-during"]');
    const duringWrap = widget.querySelector('[data-role="actions-during"]');
    const afterWrap = widget.querySelector('[data-role="actions-after"]');
    const afterCta = widget.querySelector('[data-role="cta-after"]');
    const expiredMsg = widget.querySelector('[data-role="expired-message"]');

    if (duringWrap instanceof HTMLElement) duringWrap.style.display = state.actions.showButtonDuring ? '' : 'none';
    if (duringCta instanceof HTMLElement) {
      duringCta.textContent = state.actions.buttonText;
      duringCta.setAttribute('href', state.actions.buttonUrl);
      duringCta.setAttribute('data-variant', state.actions.buttonStyle);
      if (state.actions.openInNewTab) {
        duringCta.setAttribute('target', '_blank');
        duringCta.setAttribute('rel', 'noreferrer');
      } else {
        duringCta.removeAttribute('target');
        duringCta.removeAttribute('rel');
      }
    }

    if (expiredMsg instanceof HTMLElement) expiredMsg.textContent = state.actions.expiredMessage;
    if (afterCta instanceof HTMLElement) {
      afterCta.textContent = state.actions.afterButtonText;
      afterCta.setAttribute('href', state.actions.afterButtonUrl);
      afterCta.setAttribute('data-variant', state.actions.buttonStyle);
      afterCta.setAttribute('target', '_blank');
      afterCta.setAttribute('rel', 'noreferrer');
    }
    if (afterWrap instanceof HTMLElement) afterWrap.hidden = true;
  }

  function applyTimerVisibility(state) {
    const { theme } = state;
    const format = theme.timeFormat;
    const showDays = theme.showDays && format.includes('D');
    const showHours = theme.showHours && (format.includes('H') || !format.includes('D'));
    const showMinutes = theme.showMinutes;
    const showSeconds = theme.showSeconds;
    const sep = theme.separator;

    const daysEl = widget.querySelector('[data-unit="days"]');
    const hoursEl = widget.querySelector('[data-unit="hours"]');
    const minutesEl = widget.querySelector('[data-unit="minutes"]');
    const secondsEl = widget.querySelector('[data-unit="seconds"]');
    const seps = widget.querySelectorAll('.ck-timer-sep');

    if (daysEl instanceof HTMLElement) daysEl.style.display = showDays ? '' : 'none';
    if (hoursEl instanceof HTMLElement) hoursEl.style.display = showHours ? '' : 'none';
    if (minutesEl instanceof HTMLElement) minutesEl.style.display = showMinutes ? '' : 'none';
    if (secondsEl instanceof HTMLElement) secondsEl.style.display = showSeconds ? '' : 'none';

    seps.forEach((sepEl) => {
      sepEl.setAttribute('data-separator', sep);
      sepEl.style.display = sep === 'none' ? 'none' : '';
    });

    // Hide separators that sit next to hidden units
    const units = Array.from(widget.querySelectorAll('.ck-timer-unit'));
    const visibleUnits = units.filter((u) => u instanceof HTMLElement && u.style.display !== 'none');
    seps.forEach((sepEl, idx) => {
      const leftVisible = visibleUnits[idx] != null;
      const rightVisible = visibleUnits[idx + 1] != null;
      sepEl.style.display = leftVisible && rightVisible && sep !== 'none' ? '' : 'none';
    });

    const labels = widget.querySelectorAll('.ck-timer-label');
    labels.forEach((label) => {
      label.style.display = theme.showLabels ? '' : 'none';
    });
  }

  function setNumberValue(val) {
    const el = widget.querySelector('[data-role="number-value"]');
    if (el) el.textContent = String(val);
  }

  function renderNumberCounter(state, ts) {
    const { numberCounter } = state.timer;
    const start = numberCounter.startingNumber;
    const end = numberCounter.targetNumber;
    const durationMs = Math.max(0, numberCounter.duration * 1000);
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
      numberRAF = requestAnimationFrame((nextTs) => renderNumberCounter(state, nextTs));
    } else {
      setNumberValue(end);
    }
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

  function setUnit(state, unit, value, animate) {
    const unitEl = widget.querySelector(`.ck-timer-unit[data-unit="${unit}"] .ck-timer-value`);
    if (!unitEl) return;
    const prev = unitEl.textContent;
    const next = String(value).padStart(2, '0');
    if (prev !== next) {
      unitEl.textContent = next;
      unitEl.setAttribute('data-animate', animate ? state.theme.animation : 'none');
    }
  }

  function resolveTargetTime(state) {
    if (state.timer.mode === 'date') {
      const { countdownToDate } = state.timer;
      return resolveDateWithTimezone(
        countdownToDate.targetDate,
        countdownToDate.targetTime,
        countdownToDate.timezone,
      );
    }
    if (state.timer.mode === 'personal') {
      const now = Date.now();
      if (!personalTarget) {
        const duration = toMs(state.timer.personalCountdown.timeAmount, state.timer.personalCountdown.timeUnit);
        personalTarget = now + duration;
      }
      return personalTarget;
    }
    return null;
  }

  function handleExpire(state) {
    if (state.timer.mode === 'personal' && state.timer.personalCountdown.repeatEnabled === true) {
      const duration = toMs(state.timer.personalCountdown.repeatAmount, state.timer.personalCountdown.repeatUnit);
      personalTarget = Date.now() + duration;
      return;
    }

    widget.setAttribute('data-state', 'expired');
    widget.setAttribute('data-after-action', state.actions.afterAction);

    const afterWrap = widget.querySelector('[data-role="actions-after"]');
    if (afterWrap instanceof HTMLElement) afterWrap.hidden = false;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimer(state) {
    const now = Date.now();
    const target = resolveTargetTime(state);
    if (target == null) return;
    const remaining = target - now;
    if (remaining <= 0) {
      handleExpire(state);
      return;
    }

    const units = formatUnits(remaining);
    const format = state.theme.timeFormat;
    const showDays = state.theme.showDays && format.includes('D');
    const showHours = state.theme.showHours && (format.includes('H') || !format.includes('D'));

    if (showDays) setUnit(state, 'days', units.days, true);
    if (showHours) setUnit(state, 'hours', units.hours, true);
    setUnit(state, 'minutes', units.minutes, true);
    setUnit(state, 'seconds', units.seconds, true);
  }

  function applyCustomCss(css) {
    if (!customCssEl) {
      customCssEl = document.createElement('style');
      customCssEl.setAttribute('data-role', 'custom-css');
      document.head.appendChild(customCssEl);
    }
    customCssEl.textContent = css;
  }

  function applyCustomJs(state) {
    const code = state.settings.customJS;
    if (!code) return;
    const fn = new Function('state', code);
    fn(state);
  }

  function stopTimers() {
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
  }

  function applyTypography(state) {
    if (!window.CKTypography?.applyTypography) {
      throw new Error('[Countdown] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(state.typography, widget, {
      heading: { varKey: 'heading' },
      timer: { varKey: 'timer' },
      label: { varKey: 'label' },
      button: { varKey: 'button' },
    });
  }

  function applyState(state) {
    stopTimers();
    widget.removeAttribute('data-state');
    widget.removeAttribute('data-after-action');

    setCssVars(state);
    applyTypography(state);
    applyLayout(state);
    applyContent(state);
    applyBackdrop(state);
    applyActionsVisibility(state);
    applyTimerVisibility(state);
    applyCustomCss(state.settings.customCSS);
    applyCustomJs(state);

    const unitsEl = widget.querySelector('[data-role="units"]');
    const numberEl = widget.querySelector('[data-role="number"]');

    if (state.timer.mode === 'number') {
      if (unitsEl instanceof HTMLElement) unitsEl.hidden = true;
      if (numberEl instanceof HTMLElement) numberEl.hidden = false;
      numberRAF = requestAnimationFrame((ts) => renderNumberCounter(state, ts));
      return;
    }

    if (unitsEl instanceof HTMLElement) unitsEl.hidden = false;
    if (numberEl instanceof HTMLElement) numberEl.hidden = true;
    updateTimer(state);
    timerInterval = window.setInterval(() => updateTimer(state), 1000);
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'ck:state-update') return;
    if (msg.widgetname && msg.widgetname !== 'countdown') return;
    applyState(msg.state);
  });

  const initialState = window.CK_WIDGET && window.CK_WIDGET.state;
  if (initialState) applyState(initialState);
})();
