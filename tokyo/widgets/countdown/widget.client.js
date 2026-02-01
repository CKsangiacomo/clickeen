// Countdown widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

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

  const numberDisplayEl = timerEl.querySelector('[data-role="number-display"]');
  if (!(numberDisplayEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="number-display"]');
  }

  const numberValueEl = timerEl.querySelector('[data-role="number-value"]');
  if (!(numberValueEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="number-value"]');
  }

  const unitsDisplayEl = timerEl.querySelector('[data-role="units-display"]');
  if (!(unitsDisplayEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="units-display"]');
  }

  const ctaEl = countdownRoot.querySelector('[data-role="cta"]');
  if (!(ctaEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="cta"]');
  }

  const afterMsgEl = countdownRoot.querySelector('[data-role="after-message"]');
  if (!(afterMsgEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="after-message"]');
  }

  const afterLinkEl = afterMsgEl.querySelector('[data-role="after-link"]');
  if (!(afterLinkEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing [data-role="after-link"]');
  }

  const stageEl = widgetRoot.closest('.stage');
  if (!(stageEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing .stage wrapper');
  }

  const podEl = widgetRoot.closest('.pod');
  if (!(podEl instanceof HTMLElement)) {
    throw new Error('[Countdown] Missing .pod wrapper');
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

  const THEME_KEYS = new Set([
    'custom',
    'light',
    'dark',
    'gradient',
    'pastel',
    'halloween',
    'thanksgiving',
    'black-friday',
    'cyber-monday',
    'christmas',
    'new-year',
    'valentines',
    'easter',
    'summer',
  ]);
  const ANIMATION_KEYS = new Set(['fade']);

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

  function assertFill(value, path) {
    if (typeof value === 'string') return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[Countdown] ${path} must be a fill`);
    }
    if (typeof value.type !== 'string' || !value.type.trim()) {
      throw new Error(`[Countdown] ${path}.type must be a string`);
    }
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

  function parseTargetDate(raw) {
    const value = String(raw || '').trim();
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      throw new Error('[Countdown] state.timer.targetDate must be ISO YYYY-MM-DDTHH:MM(:SS)');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] ? Number(match[6]) : 0;
    if (month < 1 || month > 12) throw new Error('[Countdown] state.timer.targetDate month must be 1..12');
    if (day < 1 || day > 31) throw new Error('[Countdown] state.timer.targetDate day must be 1..31');
    if (hour < 0 || hour > 23) throw new Error('[Countdown] state.timer.targetDate hour must be 0..23');
    if (minute < 0 || minute > 59) throw new Error('[Countdown] state.timer.targetDate minute must be 0..59');
    if (second < 0 || second > 59) throw new Error('[Countdown] state.timer.targetDate second must be 0..59');
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
    assertObject(state.timer, 'state.timer');
    if (!['date', 'personal', 'number'].includes(state.timer.mode)) {
      throw new Error('[Countdown] state.timer.mode must be date|personal|number');
    }
    assertString(state.timer.headline, 'state.timer.headline');
    if (state.timer.mode === 'date') {
      assertString(state.timer.targetDate, 'state.timer.targetDate');
      assertString(state.timer.timezone, 'state.timer.timezone');
      parseTargetDate(state.timer.targetDate);
      if (state.timer.timezone !== 'browser' && !isValidTimeZone(state.timer.timezone)) {
        throw new Error('[Countdown] state.timer.timezone must be a valid IANA timezone or "browser"');
      }
    } else if (state.timer.mode === 'personal') {
      assertNumber(state.timer.timeAmount, 'state.timer.timeAmount');
      if (state.timer.timeAmount <= 0) {
        throw new Error('[Countdown] state.timer.timeAmount must be > 0');
      }
      if (!['minutes', 'hours', 'days', 'weeks', 'months'].includes(state.timer.timeUnit)) {
        throw new Error('[Countdown] state.timer.timeUnit must be minutes|hours|days|weeks|months');
      }
      if (!['never', '1 minute', '5 minutes', '1 hour', '1 day', '1 week'].includes(state.timer.repeat)) {
        throw new Error('[Countdown] state.timer.repeat must be never|1 minute|5 minutes|1 hour|1 day|1 week');
      }
    } else if (state.timer.mode === 'number') {
      assertNumber(state.timer.targetNumber, 'state.timer.targetNumber');
      assertNumber(state.timer.startingNumber, 'state.timer.startingNumber');
      assertNumber(state.timer.countDuration, 'state.timer.countDuration');
      if (state.timer.countDuration <= 0) {
        throw new Error('[Countdown] state.timer.countDuration must be > 0');
      }
    }
    assertObject(state.layout, 'state.layout');
    if (!['inline', 'full-width', 'top-bar', 'bottom-bar', 'static-top'].includes(state.layout.position)) {
      throw new Error('[Countdown] state.layout.position must be inline|full-width|top-bar|bottom-bar|static-top');
    }
    assertObject(state.appearance, 'state.appearance');
    assertString(state.appearance.theme, 'state.appearance.theme');
    if (!THEME_KEYS.has(state.appearance.theme)) {
      throw new Error(`[Countdown] state.appearance.theme must be one of: ${Array.from(THEME_KEYS).join(', ')}`);
    }
    assertString(state.appearance.animation, 'state.appearance.animation');
    if (!ANIMATION_KEYS.has(state.appearance.animation)) {
      throw new Error(`[Countdown] state.appearance.animation must be one of: ${Array.from(ANIMATION_KEYS).join(', ')}`);
    }
    assertFill(state.appearance.textColor, 'state.appearance.textColor');
    assertFill(state.appearance.itemBackground, 'state.appearance.itemBackground');
    assertString(state.appearance.separator, 'state.appearance.separator');
    assertObject(state.appearance.itemCard, 'state.appearance.itemCard');
    assertBoolean(state.appearance.itemCard.radiusLinked, 'state.appearance.itemCard.radiusLinked');
    assertString(state.appearance.itemCard.radius, 'state.appearance.itemCard.radius');
    assertString(state.appearance.itemCard.radiusTL, 'state.appearance.itemCard.radiusTL');
    assertString(state.appearance.itemCard.radiusTR, 'state.appearance.itemCard.radiusTR');
    assertString(state.appearance.itemCard.radiusBR, 'state.appearance.itemCard.radiusBR');
    assertString(state.appearance.itemCard.radiusBL, 'state.appearance.itemCard.radiusBL');
    assertBorderConfig(state.appearance.itemCard.border, 'state.appearance.itemCard.border');
    assertShadowConfig(state.appearance.itemCard.shadow, 'state.appearance.itemCard.shadow');
    assertBorderConfig(state.appearance.podBorder, 'state.appearance.podBorder');
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
    assertString(state.actions.after.url, 'state.actions.after.url');
    assertString(state.actions.after.text, 'state.actions.after.text');
    assertObject(state.stage, 'state.stage');
    assertObject(state.pod, 'state.pod');
    assertObject(state.typography, 'state.typography');
    assertObject(state.seoGeo, 'state.seoGeo');
    assertBoolean(state.seoGeo.enabled, 'state.seoGeo.enabled');
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html);
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'BR']);
    wrapper.querySelectorAll('*').forEach((node) => {
      const el = node;
      const tag = el.tagName;
      if (!allowed.has(tag)) {
        const parent = el.parentNode;
        if (!parent) return;
        const before = el.previousSibling;
        const after = el.nextSibling;
        const needsSpaceBefore =
          before &&
          before.nodeType === Node.TEXT_NODE &&
          before.textContent &&
          !/\s$/.test(before.textContent);
        const needsSpaceAfter =
          after &&
          after.nodeType === Node.TEXT_NODE &&
          after.textContent &&
          !/^\s/.test(after.textContent);
        if (needsSpaceBefore) parent.insertBefore(document.createTextNode(' '), el);
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        if (needsSpaceAfter) parent.insertBefore(document.createTextNode(' '), el.nextSibling);
        parent.removeChild(el);
        return;
      }

      if (tag === 'A') {
        const href = el.getAttribute('href') || '';
        if (!/^(?:https?:\/\/|\/|#)/i.test(href)) {
          el.removeAttribute('href');
          el.removeAttribute('target');
          el.removeAttribute('rel');
        } else {
          if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener');
          else el.removeAttribute('rel');
        }
        Array.from(el.attributes).forEach((attr) => {
          if (['href', 'target', 'rel'].includes(attr.name)) return;
          if (attr.name === 'class' && /\bdiet-dropdown-edit-link\b/.test(attr.value)) return;
          el.removeAttribute(attr.name);
        });
      } else {
        Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
      }
    });
    return wrapper.innerHTML;
  }

  function normalizeHref(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;
    if (/^(?:https?:\/\/|\/|#)/i.test(v)) return v;
    return null;
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
    if (resolvedPublicId) return resolvedPublicId;
    return null;
  }

  let currentAnimationFrame = null;
  let timerInterval = null;
  let hasDuringCta = false;
  let hasAfterLink = false;

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

    applyAppearanceVars(state);
    applyLayoutVars(state);
    applyHeading(state);
    applyActionsDuring(state);
    applyAfterMessage(state);

    countdownRoot.setAttribute('data-mode', state.timer.mode);

    if (state.timer.mode === 'number') {
      numberDisplayEl.hidden = false;
      unitsDisplayEl.hidden = true;
    } else {
      numberDisplayEl.hidden = true;
      unitsDisplayEl.hidden = false;
    }

    updateTimer(state);
  }

  function resolveFillBackground(value) {
    if (window.CKFill && typeof window.CKFill.toCssBackground === 'function') {
      return window.CKFill.toCssBackground(value);
    }
    return String(value ?? '');
  }

  function resolveFillColor(value) {
    if (window.CKFill && typeof window.CKFill.toCssColor === 'function') {
      return window.CKFill.toCssColor(value);
    }
    return String(value ?? '');
  }

  function applyAppearanceVars(state) {
    const textColor = resolveFillColor(state.appearance.textColor);
    const itemBackground = resolveFillBackground(state.appearance.itemBackground);

    countdownRoot.setAttribute('data-animation', state.appearance.animation);
    countdownRoot.style.setProperty('--countdown-text-color', textColor);
    countdownRoot.style.setProperty('--countdown-item-bg', itemBackground);

    if (podEl instanceof HTMLElement) {
      const podBorder = state.appearance.podBorder;
      const podEnabled = podBorder.enabled === true && podBorder.width > 0;
      podEl.style.setProperty('--pod-border-width', podEnabled ? `${podBorder.width}px` : '0px');
      podEl.style.setProperty('--pod-border-color', podEnabled ? podBorder.color : 'transparent');
    }
    if (!window.CKSurface?.applyItemCard) {
      throw new Error('[Countdown] Missing CKSurface.applyItemCard');
    }
    window.CKSurface.applyItemCard(state.appearance.itemCard, countdownRoot);

    const separatorText = String(state.appearance.separator || ':');
    timerEl.querySelectorAll('[data-role="separator"]').forEach((el) => {
      el.textContent = separatorText;
    });
  }

  function applyLayoutVars(state) {
    const position = state.layout.position;
    const stageAlignment = state.stage?.alignment;
    const derivedAlignment = stageAlignment === 'left' || stageAlignment === 'right' ? stageAlignment : 'center';
    const alignment = derivedAlignment;

    countdownRoot.setAttribute('data-layout-position', position);
    countdownRoot.setAttribute('data-layout-align', alignment);

    stageEl.setAttribute('data-layout-position', position);
    podEl.setAttribute('data-layout-position', position);
    countdownRoot.style.removeProperty('--countdown-content-width');
    countdownRoot.removeAttribute('data-layout-width');
  }

  function applyHeading(state) {
    const headingHtml = sanitizeInlineHtml(state.timer.headline);
    headingEl.innerHTML = headingHtml;
    headingEl.hidden = !headingHtml;
  }

  function applyActionsDuring(state) {
    const href = normalizeHref(state.actions.during.url);
    hasDuringCta = state.actions.during.type === 'link' && Boolean(href);

    ctaEl.setAttribute('data-variant', state.actions.during.style);
    ctaEl.textContent = state.actions.during.text;

    if (!hasDuringCta) {
      ctaEl.removeAttribute('href');
      ctaEl.removeAttribute('target');
      ctaEl.removeAttribute('rel');
      return;
    }

    ctaEl.setAttribute('href', href);
    if (state.actions.during.newTab) {
      ctaEl.setAttribute('target', '_blank');
      ctaEl.setAttribute('rel', 'noopener');
    } else {
      ctaEl.setAttribute('target', '_self');
      ctaEl.removeAttribute('rel');
    }
  }

  function applyAfterMessage(state) {
    const href = normalizeHref(state.actions.after.url);
    hasAfterLink = state.actions.after.type === 'link' && Boolean(href);

    afterLinkEl.textContent = state.actions.after.text;

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
      timerEl.hidden = false;
      afterMsgEl.hidden = true;
      ctaEl.hidden = !hasDuringCta;
      return;
    }

    if (state.actions.after.type === 'hide') {
      stageEl.hidden = true;
      return;
    }

    stageEl.hidden = false;
    timerEl.hidden = true;
    ctaEl.hidden = true;
    afterMsgEl.hidden = !hasAfterLink;
  }

  function updateTimer(state) {
    if (currentAnimationFrame) cancelAnimationFrame(currentAnimationFrame);
    if (timerInterval) clearInterval(timerInterval);

    if (state.timer.mode === 'date') {
      const targetParts = parseTargetDate(state.timer.targetDate);
      const targetTimeMs = resolveTargetTimestamp(targetParts, state.timer.timezone);

      const tick = () => {
        const totalSeconds = Math.max(0, Math.floor((targetTimeMs - Date.now()) / 1000));
        updateUnits(totalSeconds);
        renderPhase(state, totalSeconds === 0 ? 'ended' : 'active');
      };

      tick();
      timerInterval = setInterval(tick, 1000);
      return;
    }

    if (state.timer.mode === 'personal') {
      const storageKey = resolveStorageKey(state);
      let startMs = Date.now();
      if (storageKey) {
        try {
          const stored = localStorage.getItem(`countdown_${storageKey}`);
          if (stored) startMs = Number(stored);
          if (!Number.isFinite(startMs)) startMs = Date.now();
          if (!stored || !Number.isFinite(Number(stored))) {
            localStorage.setItem(`countdown_${storageKey}`, String(startMs));
          }
        } catch {
          startMs = Date.now();
        }
      }

      const durationSeconds = getDurationSeconds(state.timer.timeAmount, state.timer.timeUnit);
      const repeatSeconds = getRepeatSeconds(state.timer.repeat);
      const cycleSeconds = repeatSeconds > 0 ? durationSeconds + repeatSeconds : durationSeconds;

      const tick = () => {
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        if (repeatSeconds > 0) {
          const cycleElapsed = elapsedSeconds % cycleSeconds;
          if (cycleElapsed < durationSeconds) {
            const remaining = Math.max(0, durationSeconds - cycleElapsed);
            updateUnits(remaining);
            renderPhase(state, 'active');
            return;
          }
          updateUnits(0);
          renderPhase(state, 'ended');
          return;
        }

        const remaining = Math.max(0, durationSeconds - elapsedSeconds);
        updateUnits(remaining);
        renderPhase(state, remaining === 0 ? 'ended' : 'active');
      };

      tick();
      timerInterval = setInterval(tick, 1000);
      return;
    }

    if (state.timer.mode === 'number') {
      const start = state.timer.startingNumber;
      const end = state.timer.targetNumber;
      const durationMs = state.timer.countDuration * 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const current = start + (end - start) * progress;
        updateNumber(current);
        if (progress < 1) {
          currentAnimationFrame = requestAnimationFrame(animate);
        } else {
          renderPhase(state, 'ended');
        }
      };

      renderPhase(state, 'active');
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
    });
  }

  function updateNumber(value) {
    numberValueEl.textContent = String(Math.round(value));
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
