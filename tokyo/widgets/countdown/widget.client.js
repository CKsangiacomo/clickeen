// Countdown widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widgetRoot = scriptEl.closest('[data-ck-widget="countdown"]');
  if (!(widgetRoot instanceof HTMLElement)) {
    throw new Error('[Countdown] widget.client.js must be rendered inside [data-ck-widget="countdown"]');
  }

  const countdownRoot = widgetRoot.querySelector('[data-role="countdown"]');
  if (!(countdownRoot instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="countdown"] root');
  }

  const headingEl = countdownRoot.querySelector('[data-role="heading"]');
  if (!(headingEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="heading"]');
  }

  const timerEl = countdownRoot.querySelector('[data-role="timer"]');
  if (!(timerEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="timer"]');
  }

  const ctaEl = countdownRoot.querySelector('[data-role="cta"]');
  if (!(ctaEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="cta"]');
  }

  const afterMsgEl = countdownRoot.querySelector('[data-role="after-message"]');
  if (!(afterMsgEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="after-message"]');
  }

  const assetOriginRaw = typeof window.CK_ASSET_ORIGIN === 'string' ? window.CK_ASSET_ORIGIN : '';
  const scriptOrigin = (() => {
    if (!(scriptEl instanceof HTMLScriptElement)) return '';
    try {
      return new URL(scriptEl.src, window.location.href).origin;
    } catch {
      return '';
    }
  })();
  const assetOrigin = (assetOriginRaw || scriptOrigin || window.location.origin).replace(/\/$/, '');
  widgetRoot.style.setProperty('--ck-asset-origin', assetOrigin);

  const resolvedPublicId = (() => {
    const attr = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof attr === 'string' && attr.trim()) return attr.trim();
    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    const candidate = global && typeof global.publicId === 'string' ? global.publicId.trim() : '';
    return candidate || '';
  })();
  if (resolvedPublicId) widgetRoot.setAttribute('data-ck-public-id', resolvedPublicId);

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

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[Countdown] ${path} must be an object`);
    }
  }

  function assertCountdownState(state) {
    assertObject(state, 'state');
    assertObject(state.timer, 'state.timer');
    if (!['date', 'personal', 'number'].includes(state.timer.mode)) {
      throw new Error('[Countdown] state.timer.mode must be date|personal|number');
    }
    assertString(state.timer.headline, 'state.timer.headline');
    if (state.timer.mode === 'date') {
      assertString(state.timer.targetDate, 'state.timer.targetDate');
      assertString(state.timer.timezone, 'state.timer.timezone');
    } else if (state.timer.mode === 'personal') {
      assertNumber(state.timer.timeAmount, 'state.timer.timeAmount');
      if (!['minutes', 'hours', 'days', 'weeks', 'months'].includes(state.timer.timeUnit)) {
        throw new Error('[Countdown] state.timer.timeUnit must be minutes|hours|days|weeks|months');
      }
      assertString(state.timer.repeat, 'state.timer.repeat');
    } else if (state.timer.mode === 'number') {
      assertNumber(state.timer.targetNumber, 'state.timer.targetNumber');
      assertNumber(state.timer.startingNumber, 'state.timer.startingNumber');
      assertNumber(state.timer.countDuration, 'state.timer.countDuration');
      if (state.timer.countDuration <= 0) {
        throw new Error('[Countdown] state.timer.countDuration must be > 0');
      }
    }
    assertObject(state.layout, 'state.layout');
    if (!['inline', 'sticky-top', 'sticky-bottom'].includes(state.layout.position)) {
      throw new Error('[Countdown] state.layout.position must be inline|sticky-top|sticky-bottom');
    }
    if (!['auto', 'full'].includes(state.layout.width)) {
      throw new Error('[Countdown] state.layout.width must be auto|full');
    }
    if (!['left', 'center', 'right'].includes(state.layout.alignment)) {
      throw new Error('[Countdown] state.layout.alignment must be left|center|right');
    }
    assertObject(state.appearance, 'state.appearance');
    assertString(state.appearance.background, 'state.appearance.background');
    assertString(state.appearance.textColor, 'state.appearance.textColor');
    assertString(state.appearance.timerBoxColor, 'state.appearance.timerBoxColor');
    assertString(state.appearance.separator, 'state.appearance.separator');
    assertObject(state.behavior, 'state.behavior');
    assertBoolean(state.behavior.showBacklink, 'state.behavior.showBacklink');
    assertObject(state.actions, 'state.actions');
    assertObject(state.actions.during, 'state.actions.during');
    if (!['link'].includes(state.actions.during.type)) {
      throw new Error('[Countdown] state.actions.during.type must be link');
    }
    assertString(state.actions.during.url, 'state.actions.during.url');
    assertString(state.actions.during.text, 'state.actions.during.text');
    if (!['primary', 'secondary'].includes(state.actions.during.style)) {
      throw new Error('[Countdown] state.actions.during.style must be primary|secondary');
    }
    assertBoolean(state.actions.during.newTab, 'state.actions.during.newTab');
    assertObject(state.actions.after, 'state.actions.after');
    if (!['hide', 'link'].includes(state.actions.after.type)) {
      throw new Error('[Countdown] state.actions.after.type must be hide|link');
    }
    if (state.actions.after.type === 'link') {
      assertString(state.actions.after.url, 'state.actions.after.url');
      assertString(state.actions.after.text, 'state.actions.after.text');
    }
    assertObject(state.stage, 'state.stage');
    assertObject(state.pod, 'state.pod');
    assertObject(state.typography, 'state.typography');
    assertObject(state.seoGeo, 'state.seoGeo');
    assertBoolean(state.seoGeo.enabled, 'state.seoGeo.enabled');
  }

  let currentAnimationFrame = null;
  let timerInterval = null;

  function applyState(state) {
    assertCountdownState(state);

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[Countdown] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[Countdown] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(state.typography, countdownRoot, {
      heading: { varKey: 'heading' },
      timer: { varKey: 'timer' },
      label: { varKey: 'label' },
      button: { varKey: 'button' },
    });

    // Apply custom appearance vars
    applyAppearanceVars(state, widgetRoot);

    // Apply layout vars
    applyLayoutVars(state, widgetRoot);

    // Apply behavior
    applyBehavior(state, widgetRoot);

    // Set data attributes
    widgetRoot.setAttribute('data-mode', state.timer.mode);
    widgetRoot.setAttribute('data-layout-position', state.layout.position);

    // Toggle display modes
    const numberDisplay = timerEl.querySelector('[data-role="number-display"]');
    const unitsDisplay = timerEl.querySelector('[data-role="units-display"]');
    if (state.timer.mode === 'number') {
      numberDisplay.hidden = false;
      unitsDisplay.hidden = true;
    } else {
      numberDisplay.hidden = true;
      unitsDisplay.hidden = false;
    }

    // Update heading
    headingEl.textContent = state.timer.headline;

    // Update timer
    updateTimer(state);

    // Update CTA
    if (state.actions.during.type === 'link' && state.actions.during.url) {
      ctaEl.href = state.actions.during.url;
      ctaEl.textContent = state.actions.during.text || 'Action';
      ctaEl.className = `ck-countdown__cta button-${state.actions.during.style}`;
      ctaEl.target = state.actions.during.newTab ? '_blank' : '_self';
      ctaEl.hidden = false;
    } else {
      ctaEl.hidden = true;
    }

    // Update after message
    if (state.actions.after.type === 'link' && state.actions.after.url) {
      afterMsgEl.textContent = state.actions.after.text || 'Offer ended';
      afterMsgEl.hidden = false;
    } else {
      afterMsgEl.hidden = true;
    }
  }

  function updateTimer(state) {
    // Clear any existing animation/interval
    if (currentAnimationFrame) cancelAnimationFrame(currentAnimationFrame);
    if (timerInterval) clearInterval(timerInterval);

    const separators = timerEl.querySelectorAll('.ck-countdown__separator');
    separators.forEach(s => s.textContent = state.appearance.separator);

    if (state.timer.mode === 'date') {
      timerInterval = setInterval(() => {
        const now = new Date();
        const target = new Date(state.timer.targetDate + 'Z'); // Assume UTC if not specified
        const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
        updateUnits(totalSeconds);
        handleEnd(state, totalSeconds === 0);
      }, 1000);
    } else if (state.timer.mode === 'personal') {
      const key = `countdown_${resolvedPublicId || 'default'}`;
      let startTime = localStorage.getItem(key);
      if (!startTime) {
        startTime = Date.now();
        localStorage.setItem(key, startTime);
      }
      const duration = state.timer.timeAmount * getMultiplier(state.timer.timeUnit);
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        updateUnits(remaining);
        handleEnd(state, remaining === 0);
        if (remaining === 0 && state.timer.repeat !== 'never') {
          // Reset for repeat
          localStorage.setItem(key, Date.now());
        }
      }, 1000);
    } else if (state.timer.mode === 'number') {
      const start = state.timer.startingNumber;
      const end = state.timer.targetNumber;
      const duration = state.timer.countDuration * 1000; // ms
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;
        updateNumber(current);
        if (progress < 1) {
          currentAnimationFrame = requestAnimationFrame(animate);
        } else {
          handleEnd(state, true);
        }
      };
      animate();
    }
  }

  function updateUnits(totalSeconds) {
    const time = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };
    ['days', 'hours', 'minutes', 'seconds'].forEach(unit => {
      const unitEl = timerEl.querySelector(`[data-unit="${unit}"]`);
      if (unitEl) {
        const valueEl = unitEl.querySelector('[data-role="value"]');
        if (valueEl) {
          valueEl.textContent = time[unit].toString().padStart(2, '0');
        }
      }
    });
  }

  function updateNumber(value) {
    const numberEl = timerEl.querySelector('[data-role="number-value"]');
    if (numberEl) {
      numberEl.textContent = Math.floor(value).toString();
    }
  }

  function handleEnd(state, ended) {
    if (ended) {
      timerEl.hidden = state.actions.after.type === 'hide';
      afterMsgEl.hidden = state.actions.after.type !== 'link';
      ctaEl.hidden = state.actions.after.type !== 'link' || !state.actions.after.url;
      if (state.actions.after.type === 'link') {
        ctaEl.href = state.actions.after.url;
        ctaEl.textContent = state.actions.after.text || 'Action';
      }
    } else {
      timerEl.hidden = false;
      afterMsgEl.hidden = true;
      ctaEl.hidden = !(state.actions.during.type === 'link' && state.actions.during.url);
    }
  }

  function getMultiplier(unit) {
    const multipliers = {
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
      months: 2592000
    };
    return multipliers[unit] || 3600;
  }

  function applyAppearanceVars(state, root) {
    root.style.setProperty('--countdown-bg', state.appearance.background);
    root.style.setProperty('--countdown-text-color', state.appearance.textColor);
    root.style.setProperty('--countdown-timer-bg', state.appearance.timerBoxColor);
  }

  function applyLayoutVars(state, root) {
    root.style.setProperty('--pod-max-width', state.layout.width === 'full' ? 'none' : '960px');
    countdownRoot.style.textAlign = state.layout.alignment;
  }

  function applyBehavior(state, root) {
    const backlink = root.querySelector('[data-role="backlink"]');
    if (backlink) {
      backlink.style.display = state.behavior.showBacklink ? 'block' : 'none';
    }
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'countdown') return;
    applyState(data.state);
  });

  const initialState = window.CK_WIDGET && window.CK_WIDGET.state;
  if (initialState) applyState(initialState);
})();