(function () {
  'use strict';

  var DURATION_SECONDS = {
    minutes: 60,
    hours: 3600,
    days: 86400,
    weeks: 604800,
    months: 2592000,
  };

  var REPEAT_SECONDS = {
    never: 0,
    '1 minute': 60,
    '5 minutes': 300,
    '1 hour': 3600,
    '1 day': 86400,
    '1 week': 604800,
  };
  var disposeCurrent = function () {};

  function targetDateParts(value) {
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: Number(match[6] || 0),
    };
  }

  function timeZoneOffset(date, timeZone) {
    var values = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .forEach(function (part) {
        if (part.type !== 'literal') values[part.type] = part.value;
      });
    return (
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
      ) - date.getTime()
    );
  }

  function targetTimestamp(value, timeZone) {
    var parts = targetDateParts(value);
    if (timeZone === 'browser') {
      return new Date(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ).getTime();
    }
    var utcDate = new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
    );
    return utcDate.getTime() - timeZoneOffset(utcDate, timeZone);
  }

  function personalStart(instanceId) {
    var key = 'countdown_' + instanceId;
    var stored = localStorage.getItem(key);
    if (stored !== null) {
      var value = Number(stored);
      if (!Number.isFinite(value)) {
        throw new Error('[Countdown] personal timer stored start is invalid');
      }
      return value;
    }
    var now = Date.now();
    localStorage.setItem(key, String(now));
    return now;
  }

  function initialize(widgetShell) {
    disposeCurrent();
    var interval = 0;
    var animationFrame = 0;
    disposeCurrent = function () {
      if (interval) window.clearInterval(interval);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      interval = 0;
      animationFrame = 0;
    };

    var core = widgetShell.querySelector('[data-role="countdown-core"]');
    var timer = core.querySelector('[data-role="timer"]');
    var numberValue = core.querySelector('[data-role="number-value"]');
    var action = core.querySelector('[data-role="cta"]');
    var afterMessage = core.querySelector('[data-role="after-message"]');
    var mode = core.dataset.mode;
    var format = core.dataset.timeFormat;

    function renderPhase(phase) {
      if (phase === 'active') {
        core.hidden = false;
        timer.hidden = false;
        action.hidden = !action.getAttribute('href');
        afterMessage.hidden = true;
        return;
      }
      if (core.dataset.afterType === 'hide') {
        core.hidden = true;
        return;
      }
      core.hidden = false;
      timer.hidden = true;
      action.hidden = true;
      afterMessage.hidden = false;
    }

    function renderUnits(totalSeconds) {
      var values = {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      };
      Object.keys(values).forEach(function (unit) {
        var unitElement = timer.querySelector('[data-unit="' + unit + '"]');
        unitElement.querySelector('[data-role="value"]').textContent = String(
          values[unit],
        ).padStart(2, '0');
        unitElement.hidden =
          unit === 'days' && (format === 'H:M:S' || (format === 'auto' && values.days === 0));
      });
    }

    if (mode === 'date') {
      var target = targetTimestamp(core.dataset.targetDate, core.dataset.timezone);
      var tickDate = function () {
        var remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
        renderUnits(remaining);
        renderPhase(remaining === 0 ? 'ended' : 'active');
      };
      tickDate();
      interval = window.setInterval(tickDate, 1000);
      return;
    }

    if (mode === 'personal') {
      var started = personalStart(widgetShell.dataset.ckInstanceId);
      var duration = Number(core.dataset.timeAmount) * DURATION_SECONDS[core.dataset.timeUnit];
      var repeat = REPEAT_SECONDS[core.dataset.repeat];
      var cycle = duration + repeat;
      var tickPersonal = function () {
        var elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
        var inCycle = repeat > 0 ? elapsed % cycle : elapsed;
        var active = inCycle < duration;
        var remaining = active ? duration - inCycle : 0;
        renderUnits(remaining);
        renderPhase(active ? 'active' : 'ended');
      };
      tickPersonal();
      interval = window.setInterval(tickPersonal, 1000);
      return;
    }

    var startingNumber = Number(core.dataset.startingNumber);
    var targetNumber = Number(core.dataset.targetNumber);
    var durationMs = Number(core.dataset.countDuration) * 1000;
    var startedAt = performance.now();
    var animate = function (now) {
      var progress = Math.min((now - startedAt) / durationMs, 1);
      numberValue.textContent = String(
        Math.round(startingNumber + (targetNumber - startingNumber) * progress),
      );
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
      else {
        animationFrame = 0;
        renderPhase('ended');
      }
    };
    renderPhase('active');
    animationFrame = requestAnimationFrame(animate);
  }

  window.CKWidgetRuntime.register(initialize);
})();
