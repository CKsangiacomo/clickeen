(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Countdown] Missing CKWidgetRuntime.register');
  }

  function parseTargetDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) throw new Error('[Countdown] targetDate must be YYYY-MM-DDTHH:mm[:ss]');
    return {
      year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
      hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0),
    };
  }

  function targetTimestamp(value, timezone) {
    const target = parseTargetDate(value);
    const targetUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
    if (timezone === 'UTC') return targetUtc;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    let guess = targetUtc;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
      const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
      guess += targetUtc - observed;
    }
    return guess;
  }

  function durationSeconds(amount, unit) {
    const units = { minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000 };
    if (!Number.isFinite(amount) || !(unit in units)) throw new Error('[Countdown] Invalid personal timer duration');
    return amount * units[unit];
  }

  function repeatSeconds(value) {
    const repeats = { never: 0, '1 minute': 60, '5 minutes': 300, '1 hour': 3600, '1 day': 86400 };
    if (!(value in repeats)) throw new Error('[Countdown] Invalid personal timer repeat');
    return repeats[value];
  }

  function readNumber(element, name) {
    const raw = element.dataset[name];
    if (typeof raw !== 'string' || !raw.trim()) throw new Error(`[Countdown] Missing numeric data setting: ${name}`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`[Countdown] Missing numeric data setting: ${name}`);
    return value;
  }

  function initCountdown(widgetRoot) {
    const countdownRoot = widgetRoot.querySelector('[data-role="countdown"]');
    const timer = widgetRoot.querySelector('[data-role="timer"]');
    const unitsDisplay = widgetRoot.querySelector('[data-role="units-display"]');
    const numberDisplay = widgetRoot.querySelector('[data-role="number-display"]');
    const numberValue = widgetRoot.querySelector('[data-role="number-value"]');
    const core = widgetRoot.querySelector('[data-role="countdown-core"]');
    const during = widgetRoot.querySelector('[data-role="cta"]');
    const after = widgetRoot.querySelector('[data-role="after-message"]');
    if (!(countdownRoot instanceof HTMLElement) || !(timer instanceof HTMLElement) || !(unitsDisplay instanceof HTMLElement) ||
        !(numberDisplay instanceof HTMLElement) || !(numberValue instanceof HTMLElement) || !(core instanceof HTMLElement)) {
      throw new Error('[Countdown] Missing generated countdown markup');
    }
    const config = {
      mode: countdownRoot.dataset.timerMode,
      repeat: countdownRoot.dataset.timerRepeat,
      timeUnit: countdownRoot.dataset.timerUnit,
      timezone: countdownRoot.dataset.timerTimezone,
      targetDate: countdownRoot.dataset.timerTargetDate,
      timeAmount: readNumber(countdownRoot, 'timerAmount'),
      targetNumber: readNumber(countdownRoot, 'timerTargetNumber'),
      countDuration: readNumber(countdownRoot, 'timerDuration'),
      startingNumber: readNumber(countdownRoot, 'timerStartingNumber'),
      timeFormat: countdownRoot.dataset.timeFormat,
      afterType: countdownRoot.dataset.afterType,
    };
    if (!['auto', 'D:H:M:S', 'H:M:S'].includes(config.timeFormat)) {
      throw new Error('[Countdown] Invalid time format');
    }
    if (!['hide', 'link'].includes(config.afterType)) {
      throw new Error('[Countdown] Invalid after-timer action');
    }

    let intervalId = null;
    let frameId = null;

    function renderPhase(ended) {
      if (!ended) {
        core.hidden = false;
        timer.hidden = false;
        if (during instanceof HTMLElement) during.hidden = false;
        if (after instanceof HTMLElement) after.hidden = true;
        return;
      }
      if (config.afterType === 'hide') {
        core.hidden = true;
        return;
      }
      core.hidden = false;
      timer.hidden = true;
      if (during instanceof HTMLElement) during.hidden = true;
      if (after instanceof HTMLElement) after.hidden = false;
    }

    function renderUnits(totalSeconds) {
      const values = {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      };
      const visible = config.timeFormat === 'H:M:S' ? ['hours', 'minutes', 'seconds'] :
        config.timeFormat === 'auto' && values.days === 0 ? ['hours', 'minutes', 'seconds'] :
        ['days', 'hours', 'minutes', 'seconds'];
      timer.querySelectorAll('[data-role="unit"]').forEach((unit) => {
        const name = unit.dataset.unit;
        const value = unit.querySelector('[data-role="value"]');
        unit.hidden = !visible.includes(name);
        if (value instanceof HTMLElement) value.textContent = String(values[name]).padStart(2, '0');
      });
      timer.querySelectorAll('[data-role="separator"]').forEach((separator, index) => {
        separator.hidden = index === 0 && !visible.includes('days');
      });
    }

    function startClock(resolveRemaining) {
      const tick = () => {
        const remaining = Math.max(0, Math.floor(resolveRemaining()));
        renderUnits(remaining);
        renderPhase(remaining === 0);
      };
      tick();
      intervalId = window.setInterval(tick, 1000);
    }

    if (config.mode === 'date') {
      unitsDisplay.hidden = false;
      numberDisplay.hidden = true;
      const target = targetTimestamp(config.targetDate, config.timezone);
      startClock(() => (target - Date.now()) / 1000);
      return;
    }

    if (config.mode === 'personal') {
      const instanceId = widgetRoot.getAttribute('data-ck-instance-id');
      if (typeof instanceId !== 'string' || !instanceId) {
        throw new Error('[Countdown] Personal timer requires an instance id');
      }
      const storageKey = `countdown_${instanceId}`;
      const stored = window.localStorage.getItem(storageKey);
      let startedAt = stored === null ? Date.now() : Number(stored);
      if (!Number.isFinite(startedAt)) throw new Error('[Countdown] Personal timer stored start is invalid');
      if (stored === null) window.localStorage.setItem(storageKey, String(startedAt));
      const duration = durationSeconds(config.timeAmount, config.timeUnit);
      const repeat = repeatSeconds(config.repeat);
      unitsDisplay.hidden = false;
      numberDisplay.hidden = true;
      startClock(() => {
        const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
        if (repeat === 0) return duration - elapsed;
        const cycleElapsed = elapsed % (duration + repeat);
        return cycleElapsed < duration ? duration - cycleElapsed : 0;
      });
      return;
    }

    if (config.mode !== 'number') throw new Error('[Countdown] Invalid timer mode');
    unitsDisplay.hidden = true;
    numberDisplay.hidden = false;
    const startedAt = performance.now();
    const duration = config.countDuration * 1000;
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      numberValue.textContent = String(Math.round(config.startingNumber +
        (config.targetNumber - config.startingNumber) * progress));
      renderPhase(progress === 1);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);

    void intervalId;
    void frameId;
  }

  runtime.register('countdown', initCountdown);
})();
