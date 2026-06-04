(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Steps] Missing CKWidgetRuntime.register');
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR']);
    wrapper.querySelectorAll('*').forEach((node) => {
      const el = node;
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
    });
    return wrapper.innerHTML;
  }

  function normalizeIconName(value) {
    const iconName = String(value || '').trim();
    return /^[a-z0-9_.-]+$/i.test(iconName) ? iconName : '';
  }

  function normalizeVariant(value) {
    return value === 'value-props' ? 'value-props' : 'cards';
  }

  function createStepItem(item, index) {
    const article = document.createElement('article');
    article.className = 'ck-stepsWidget__item';
    article.setAttribute('data-role', 'steps-item');
    article.setAttribute('data-item-id', item.id || `step-${index + 1}`);

    const iconName = item.iconEnabled === true ? normalizeIconName(item.iconName) : '';
    if (iconName) {
      const icon = document.createElement('span');
      icon.className = 'ck-stepsWidget__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.setProperty('--ck-steps-icon', `url("/dieter/icons/svg/${iconName}.svg")`);
      article.appendChild(icon);
    }

    const title = document.createElement('h3');
    title.className = 'ck-stepsWidget__item-title heading-2';
    title.setAttribute('data-role', 'steps-item-title');
    title.innerHTML = sanitizeInlineHtml(item.title);
    article.appendChild(title);

    const body = document.createElement('div');
    body.className = 'ck-stepsWidget__item-body body-l';
    body.setAttribute('data-role', 'steps-item-body');
    body.innerHTML = sanitizeInlineHtml(item.body);
    article.appendChild(body);

    return article;
  }

  function initSteps(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;

    const stepsRoot = widgetRoot.querySelector('[data-role="steps"]');
    const titleEl = widgetRoot.querySelector('[data-role="steps-title"]');
    const subheadEl = widgetRoot.querySelector('[data-role="steps-subhead"]');
    const listEl = widgetRoot.querySelector('[data-role="steps-list"]');
    const emptyEl = widgetRoot.querySelector('[data-role="steps-empty"]');
    if (!(stepsRoot instanceof HTMLElement)) throw new Error('[Steps] Missing [data-role="steps"]');
    if (!(titleEl instanceof HTMLElement)) throw new Error('[Steps] Missing [data-role="steps-title"]');
    if (!(subheadEl instanceof HTMLElement)) throw new Error('[Steps] Missing [data-role="steps-subhead"]');
    if (!(listEl instanceof HTMLElement)) throw new Error('[Steps] Missing [data-role="steps-list"]');
    if (!(emptyEl instanceof HTMLElement)) throw new Error('[Steps] Missing [data-role="steps-empty"]');

    if (!window.CKStagePod || typeof window.CKStagePod.applyStagePod !== 'function') {
      throw new Error('[Steps] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography || typeof window.CKTypography.applyTypography !== 'function') {
      throw new Error('[Steps] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      stepsRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        itemTitle: { varKey: 'item-title' },
        itemBody: { varKey: 'item-body' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    if (!window.CKAppearance || typeof window.CKAppearance.toCssBackground !== 'function') {
      throw new Error('[Steps] Missing CKAppearance.toCssBackground');
    }

    stepsRoot.dataset.variant = normalizeVariant(state.layout.variant);
    stepsRoot.style.setProperty('--ck-steps-max-width', `${state.layout.maxWidth}px`);
    stepsRoot.style.setProperty('--ck-steps-columns', String(Math.max(1, Math.min(4, Math.round(state.layout.columns)))));
    stepsRoot.style.setProperty('--ck-steps-row-gap', `${state.layout.rowGap}px`);
    stepsRoot.style.setProperty('--ck-steps-card-gap', `${state.layout.cardGap}px`);
    stepsRoot.style.setProperty('--ck-steps-card-padding', `${state.layout.cardPadding}px`);
    stepsRoot.style.setProperty('--ck-steps-card-radius', state.appearance.cardRadius);
    stepsRoot.style.setProperty('--ck-steps-card-background', window.CKAppearance.toCssBackground(state.appearance.cardBackground));

    titleEl.innerHTML = sanitizeInlineHtml(state.title);
    titleEl.hidden = !String(state.title || '').trim();
    subheadEl.innerHTML = sanitizeInlineHtml(state.subhead);
    subheadEl.hidden = !String(state.subhead || '').trim();

    listEl.innerHTML = '';
    state.items.forEach((item, index) => {
      listEl.appendChild(createStepItem(item, index));
    });
    emptyEl.hidden = state.items.length > 0;

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('steps', initSteps);
})();
