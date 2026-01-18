function applyState(state) {
  // Validate state
  if (!state || typeof state !== 'object') {
    throw new Error('Invalid state: must be an object');
  }
  if (!['date', 'personal', 'number'].includes(state.timer?.mode)) {
    throw new Error('Invalid timer mode');
  }

  const root = document.querySelector('[data-ck-widget="countdown"]');
  if (!root) return;

  if (!window.CKStagePod?.applyStagePod) {
    throw new Error('[Countdown] Missing CKStagePod.applyStagePod');
  }
  window.CKStagePod.applyStagePod(state.stage, state.pod, root);

  if (!window.CKTypography?.applyTypography) {
    throw new Error('[Countdown] Missing CKTypography.applyTypography');
  }
  window.CKTypography.applyTypography(state.typography, root, {
    heading: { varKey: 'heading' },
    timer: { varKey: 'timer' },
    label: { varKey: 'label' },
    button: { varKey: 'button' },
  });

  // Apply custom appearance vars
  applyAppearanceVars(state, root);

  // Apply layout vars
  applyLayoutVars(state, root);

  // Apply behavior
  applyBehavior(state, root);

  // Set data attributes
  root.setAttribute('data-mode', state.timer.mode);
  root.setAttribute('data-layout-position', state.layout?.position || 'inline');

  // Update heading
  const heading = root.querySelector('[data-role="heading"]');
  if (heading) {
    heading.textContent = state.timer.headline || '';
  }

  // Update timer
  updateTimer(state);

  // Update CTA
  const cta = root.querySelector('[data-role="cta"]');
  if (cta && state.actions?.during) {
    if (state.actions.during.type === 'link' && state.actions.during.url) {
      cta.href = state.actions.during.url;
      cta.textContent = state.actions.during.text || 'Action';
      cta.style.display = 'inline-block';
      cta.className = `ck-countdown__cta button-${state.actions.during.style || 'primary'}`;
      if (state.actions.during.newTab) {
        cta.target = '_blank';
      }
    } else {
      cta.style.display = 'none';
    }
  }

  // Update after message
  const afterMsg = root.querySelector('[data-role="after-message"]');
  if (afterMsg && state.actions?.after) {
    if (state.actions.after.type === 'link' && state.actions.after.url) {
      afterMsg.textContent = state.actions.after.text || 'Offer ended';
      afterMsg.style.display = 'block';
    } else if (state.actions.after.type === 'hide') {
      afterMsg.style.display = 'none';
    }
  }
}

function updateTimer(state) {
  const root = document.querySelector('[data-ck-widget="countdown"]');
  if (!root) return;

  // Update separators
  const separators = root.querySelectorAll('.ck-countdown__separator');
  separators.forEach(s => s.textContent = state.appearance?.separator || ':');

  const units = ['days', 'hours', 'minutes', 'seconds'];
  const now = new Date();
  let totalSeconds = 0;

  if (state.timer.mode === 'date') {
    const target = new Date(state.timer.targetDate);
    if (isNaN(target)) return;
    totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  } else if (state.timer.mode === 'personal') {
    const key = `countdown_${state.instanceId || 'default'}`;
    let startTime = localStorage.getItem(key);
    if (!startTime) {
      startTime = now.getTime();
      localStorage.setItem(key, startTime);
    }
    const elapsed = Math.floor((now.getTime() - parseInt(startTime)) / 1000);
    const duration = (state.timer.timeAmount || 1) * getMultiplier(state.timer.timeUnit || 'hours');
    totalSeconds = Math.max(0, duration - elapsed);
  } else if (state.timer.mode === 'number') {
    // For number mode, this would be animated, but for static render, show target
    // Actual animation handled separately
    return;
  }

  const time = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };

  units.forEach(unit => {
    const unitEl = root.querySelector(`[data-unit="${unit}"]`);
    if (unitEl) {
      const valueEl = unitEl.querySelector('[data-role="value"]');
      if (valueEl) {
        valueEl.textContent = time[unit].toString().padStart(2, '0');
      }
    }
  });
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
  const appearance = state.appearance || {};
  root.style.setProperty('--countdown-bg', appearance.background || 'var(--color-system-white)');
  root.style.setProperty('--countdown-text-color', appearance.textColor || 'var(--color-system-gray-90)');
  root.style.setProperty('--countdown-timer-bg', appearance.timerBoxColor || 'var(--color-system-gray-10)');
}

function applyLayoutVars(state, root) {
  const layout = state.layout || {};
  root.style.setProperty('--pod-max-width', layout.width === 'full' ? 'none' : '960px');
  const countdownEl = root.querySelector('.ck-countdown');
  if (countdownEl) {
    countdownEl.style.textAlign = layout.alignment || 'center';
  }
}

function applyBehavior(state, root) {
  const behavior = state.behavior || {};
  const backlink = root.querySelector('[data-role="backlink"]');
  if (backlink) {
    backlink.style.display = behavior.showBacklink ? 'block' : 'none';
  }
}

// Start timer updates
setInterval(() => {
  const state = window.currentState; // Assumed to be set by embed
  if (state) updateTimer(state);
}, 1000);