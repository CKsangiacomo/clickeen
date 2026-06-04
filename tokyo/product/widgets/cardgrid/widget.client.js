(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[CardGrid] Missing CKWidgetRuntime.register');
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

  function normalizeHref(value) {
    const href = String(value || '').trim();
    return /^(?:https?:\/\/|\/|#)/i.test(href) ? href : '';
  }

  function normalizeIconName(value) {
    const iconName = String(value || '').trim();
    return /^[a-z0-9_.-]+$/i.test(iconName) ? iconName : '';
  }

  function createCard(item, index) {
    const href = normalizeHref(item.href);
    const card = document.createElement(href ? 'a' : 'article');
    card.className = 'ck-cardgrid__card';
    card.setAttribute('data-role', 'cardgrid-card');
    card.setAttribute('data-item-id', item.id || `card-${index + 1}`);
    if (href) card.setAttribute('href', href);

    const iconName = item.iconEnabled === true ? normalizeIconName(item.iconName) : '';
    if (iconName) {
      const icon = document.createElement('span');
      icon.className = 'ck-cardgrid__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.setProperty('--ck-cardgrid-icon', `url("/dieter/icons/svg/${iconName}.svg")`);
      card.appendChild(icon);
    }

    const title = document.createElement('h3');
    title.className = 'ck-cardgrid__card-title heading-2';
    title.setAttribute('data-role', 'cardgrid-card-title');
    title.innerHTML = sanitizeInlineHtml(item.title);
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'ck-cardgrid__card-body body-l';
    body.setAttribute('data-role', 'cardgrid-card-body');
    body.innerHTML = sanitizeInlineHtml(item.body);
    card.appendChild(body);

    const ctaLabel = String(item.ctaLabel || '').trim();
    if (href && ctaLabel) {
      const hint = document.createElement('div');
      hint.className = 'ck-cardgrid__hint';
      hint.setAttribute('aria-hidden', 'true');
      const cta = document.createElement('span');
      cta.className = 'ck-btn ck-btn--secondaryCta label-s ck-cardgrid__cta';
      cta.textContent = ctaLabel;
      hint.appendChild(cta);
      card.appendChild(hint);
    }

    return card;
  }

  function initCardGrid(widgetRoot, runtimeContext) {
    const state = runtimeContext.state;

    const cardgridRoot = widgetRoot.querySelector('[data-role="cardgrid"]');
    const titleEl = widgetRoot.querySelector('[data-role="cardgrid-title"]');
    const subheadEl = widgetRoot.querySelector('[data-role="cardgrid-subhead"]');
    const listEl = widgetRoot.querySelector('[data-role="cardgrid-list"]');
    const emptyEl = widgetRoot.querySelector('[data-role="cardgrid-empty"]');
    if (!(cardgridRoot instanceof HTMLElement)) throw new Error('[CardGrid] Missing [data-role="cardgrid"]');
    if (!(titleEl instanceof HTMLElement)) throw new Error('[CardGrid] Missing [data-role="cardgrid-title"]');
    if (!(subheadEl instanceof HTMLElement)) throw new Error('[CardGrid] Missing [data-role="cardgrid-subhead"]');
    if (!(listEl instanceof HTMLElement)) throw new Error('[CardGrid] Missing [data-role="cardgrid-list"]');
    if (!(emptyEl instanceof HTMLElement)) throw new Error('[CardGrid] Missing [data-role="cardgrid-empty"]');

    if (!window.CKStagePod || typeof window.CKStagePod.applyStagePod !== 'function') {
      throw new Error('[CardGrid] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography || typeof window.CKTypography.applyTypography !== 'function') {
      throw new Error('[CardGrid] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      cardgridRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        cardTitle: { varKey: 'card-title' },
        cardBody: { varKey: 'card-body' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: runtimeContext && runtimeContext.instanceId },
    );

    if (!window.CKAppearance || typeof window.CKAppearance.toCssBackground !== 'function') {
      throw new Error('[CardGrid] Missing CKAppearance.toCssBackground');
    }

    cardgridRoot.style.setProperty('--ck-cardgrid-max-width', `${state.layout.maxWidth}px`);
    cardgridRoot.style.setProperty('--ck-cardgrid-columns', String(Math.max(1, Math.min(4, Math.round(state.layout.columns)))));
    cardgridRoot.style.setProperty('--ck-cardgrid-row-gap', `${state.layout.rowGap}px`);
    cardgridRoot.style.setProperty('--ck-cardgrid-card-gap', `${state.layout.cardGap}px`);
    cardgridRoot.style.setProperty('--ck-cardgrid-card-padding', `${state.layout.cardPadding}px`);
    cardgridRoot.style.setProperty('--ck-cardgrid-card-radius', state.appearance.cardRadius);
    cardgridRoot.style.setProperty('--ck-cardgrid-card-background', window.CKAppearance.toCssBackground(state.appearance.cardBackground));

    titleEl.innerHTML = sanitizeInlineHtml(state.title);
    titleEl.hidden = !String(state.title || '').trim();
    subheadEl.innerHTML = sanitizeInlineHtml(state.subhead);
    subheadEl.hidden = !String(state.subhead || '').trim();

    listEl.innerHTML = '';
    state.items.forEach((item, index) => {
      listEl.appendChild(createCard(item, index));
    });
    emptyEl.hidden = state.items.length > 0;

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }
  }

  runtime.register('cardgrid', initCardGrid);
})();
