(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[Cards] Missing CKWidgetRuntime.register');
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html || '');
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR']);
    wrapper.querySelectorAll('*').forEach(function (node) {
      const el = node;
      if (!allowed.has(el.tagName)) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      Array.from(el.attributes).forEach(function (attr) {
        el.removeAttribute(attr.name);
      });
    });
    return wrapper.innerHTML;
  }

  function normalizeHref(value) {
    const href = String(value || '').trim();
    return /^(?:https?:\/\/|\/|#)/i.test(href) ? href : '';
  }

  function normalizeIconName(value, fallback) {
    const iconName = String(value || '').trim();
    return /^[a-z0-9_.-]+$/i.test(iconName) ? iconName : fallback || 'checkmark';
  }

  function cssFill(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (
      isRecord(value) &&
      window.CKAppearance &&
      typeof window.CKAppearance.toCssBackground === 'function'
    ) {
      return window.CKAppearance.toCssBackground(value);
    }
    return fallback || '';
  }

  function mediaSource(media) {
    if (!isRecord(media) || !isRecord(media.image)) return '';
    return typeof media.image.src === 'string' ? media.image.src.trim() : '';
  }

  function normalizeItems(state) {
    if (!isRecord(state.core)) throw new Error('[Cards] state.core must be an object');
    const rawItems = Array.isArray(state.core.items) ? state.core.items : [];
    if (rawItems.length < 2 || rawItems.length > 16)
      throw new Error('[Cards] core.items must contain 2-16 cards');
    const seen = {};
    return rawItems.map(function (raw, index) {
      if (!isRecord(raw)) throw new Error('[Cards] core.items[' + index + '] must be an object');
      const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : 'card-' + index;
      if (seen[id]) throw new Error('[Cards] duplicate card id: ' + id);
      seen[id] = true;
      const media = isRecord(raw.media) ? raw.media : {};
      const mediaKind = media.kind === 'icon' || media.kind === 'image' ? media.kind : 'none';
      const link = isRecord(raw.link) ? raw.link : {};
      const enabledLink = link.enabled === true;
      const href = enabledLink ? normalizeHref(link.href) : '';
      const style = isRecord(raw.style) ? raw.style : {};
      return {
        id: id,
        title: String(raw.title || '').trim(),
        copy: String(raw.copy || '').trim(),
        media: media,
        mediaKind: mediaKind,
        iconName: normalizeIconName(media.iconName, 'checkmark'),
        imageSrc: mediaKind === 'image' ? mediaSource(media.image) : '',
        imageAlt: String(media.imageAlt || '').trim(),
        linkEnabled: enabledLink,
        href: href,
        linkLabel: String(link.label || '').trim(),
        style: style,
      };
    });
  }

  function normalizeCore(state) {
    const core = isRecord(state.core) ? state.core : {};
    const treatment =
      ['cards', 'linked-cards', 'steps'].indexOf(core.treatment) >= 0 ? core.treatment : 'cards';
    const columns = typeof core.columns === 'number' ? Math.round(core.columns) : 3;
    const between = isRecord(core.betweenCards) ? core.betweenCards : {};
    const line = isRecord(between.line) ? between.line : {};
    const icon = isRecord(between.icon) ? between.icon : {};
    return {
      treatment: treatment,
      columns: Math.min(Math.max(columns, 2), 4),
      gap:
        typeof core.gap === 'number' && Number.isFinite(core.gap)
          ? Math.min(Math.max(core.gap, 8), 64)
          : 24,
      cardPadding:
        typeof core.cardPadding === 'number' && Number.isFinite(core.cardPadding)
          ? Math.min(Math.max(core.cardPadding, 16), 64)
          : 32,
      customCardStyles: isRecord(core.customCardStyles) && core.customCardStyles.enabled === true,
      betweenCards: {
        enabled: between.enabled === true,
        kind: between.kind === 'icon' ? 'icon' : 'line',
        line: {
          widthPt:
            typeof line.widthPt === 'number' && Number.isFinite(line.widthPt)
              ? Math.min(Math.max(line.widthPt, 1), 24)
              : 2,
          color:
            typeof line.color === 'string' && line.color.trim() ? line.color.trim() : '#D7D7DA',
        },
        icon: {
          name: normalizeIconName(icon.name, 'chevron.right'),
          sizePt:
            typeof icon.sizePt === 'number' && Number.isFinite(icon.sizePt)
              ? Math.min(Math.max(icon.sizePt, 8), 96)
              : 28,
          color:
            typeof icon.color === 'string' && icon.color.trim() ? icon.color.trim() : '#222222',
        },
      },
      items: normalizeItems(state),
    };
  }

  function applyCustomCardStyles(card, item, enabled) {
    if (!enabled || !isRecord(item.style)) return;
    const background = cssFill(item.style.background, '');
    const borderColor = cssFill(item.style.borderColor, '');
    const radius = typeof item.style.radius === 'string' ? item.style.radius.trim() : '';
    const shadow = typeof item.style.shadow === 'string' ? item.style.shadow.trim() : '';
    const accentColor = cssFill(item.style.accentColor, '');
    const textTone =
      ['inherit', 'default', 'muted', 'inverse'].indexOf(item.style.textTone) >= 0
        ? item.style.textTone
        : 'inherit';
    if (background) card.style.setProperty('background', background);
    if (borderColor) card.style.setProperty('border-color', borderColor);
    if (radius) card.style.setProperty('border-radius', radius);
    if (shadow) card.style.setProperty('box-shadow', shadow);
    if (accentColor) card.style.setProperty('--ck-cards-card-accent', accentColor);
    card.dataset.tone = textTone;
  }

  function renderMedia(item) {
    if (item.mediaKind === 'none') return null;
    const media = document.createElement('div');
    media.className = 'ck-cards__media';
    if (item.mediaKind === 'icon') {
      const icon = document.createElement('span');
      icon.className = 'ck-cards__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.setProperty(
        '--ck-cards-icon',
        'url("/dieter/icons/svg/' + item.iconName + '.svg")',
      );
      media.appendChild(icon);
      return media;
    }
    if (!item.imageSrc) throw new Error('[Cards] image card requires media.image.src');
    const image = document.createElement('img');
    image.className = 'ck-cards__image';
    image.src = item.imageSrc;
    image.alt = item.imageAlt;
    image.loading = 'lazy';
    media.appendChild(image);
    return media;
  }

  function renderCard(item, core, state) {
    const linked = core.treatment === 'linked-cards' || item.linkEnabled;
    if (core.treatment === 'linked-cards' && (!item.href || !item.linkLabel)) {
      throw new Error('[Cards] linked-cards treatment requires every card link href and label');
    }
    const card = document.createElement(linked && item.href ? 'a' : 'article');
    card.className = 'ck-cards__card';
    card.dataset.itemId = item.id;
    if (linked && item.href) card.setAttribute('href', item.href);

    if (!window.CKSurface?.applyCardWrapper)
      throw new Error('[Cards] Missing CKSurface.applyCardWrapper');
    window.CKSurface.applyCardWrapper(state.appearance && state.appearance.cardwrapper, card);
    card.style.setProperty('--ck-cards-card-padding', core.cardPadding + 'px');
    applyCustomCardStyles(card, item, core.customCardStyles);

    const media = renderMedia(item);
    if (media) card.appendChild(media);

    const title = document.createElement('h3');
    title.className = 'ck-cards__title heading-3';
    title.innerHTML = sanitizeInlineHtml(item.title);
    card.appendChild(title);

    const copy = document.createElement('div');
    copy.className = 'ck-cards__copy body-l';
    copy.innerHTML = sanitizeInlineHtml(item.copy);
    card.appendChild(copy);

    if (linked && item.linkLabel) {
      const label = document.createElement('span');
      label.className = 'ck-cards__linkLabel label-s';
      label.textContent = item.linkLabel;
      if (card.tagName === 'A') label.setAttribute('aria-hidden', 'true');
      card.appendChild(label);
    }

    return card;
  }

  function renderBetween(core, index) {
    if (!core.betweenCards.enabled) return null;
    const between = document.createElement('span');
    between.className = 'ck-cards__between';
    between.setAttribute('aria-hidden', 'true');
    between.dataset.kind = core.betweenCards.kind;
    const isEndOfRow = (index + 1) % core.columns === 0;
    between.dataset.axis = isEndOfRow ? 'y' : 'x';
    if (core.betweenCards.kind === 'icon') {
      between.style.setProperty(
        '--ck-cards-between-icon',
        'url("/dieter/icons/svg/' + core.betweenCards.icon.name + '.svg")',
      );
      between.style.setProperty('--ck-cards-between-size', core.betweenCards.icon.sizePt + 'pt');
      between.style.setProperty(
        '--ck-cards-between-color',
        cssFill(core.betweenCards.icon.color, '#222222'),
      );
    } else {
      between.style.setProperty('--ck-cards-between-width', core.betweenCards.line.widthPt + 'pt');
      between.style.setProperty(
        '--ck-cards-between-color',
        cssFill(core.betweenCards.line.color, '#D7D7DA'),
      );
    }
    return between;
  }

  function initCards(widgetRoot, runtimeContext) {
    const cardsRoot = widgetRoot.querySelector('[data-role="cards"]');
    const coreEl = widgetRoot.querySelector('[data-role="cards-core"]');
    if (!(cardsRoot instanceof HTMLElement)) throw new Error('[Cards] Missing [data-role="cards"]');
    if (!(coreEl instanceof HTMLElement))
      throw new Error('[Cards] Missing [data-role="cards-core"]');
    const resolvedInstanceId = runtimeContext.instanceId;

    function applyState(state, context) {
      if (!state) return;
      if (!window.CKStagePod?.applyStagePod)
        throw new Error('[Cards] Missing CKStagePod.applyStagePod');
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

      if (!window.CKTypography?.applyTypography)
        throw new Error('[Cards] Missing CKTypography.applyTypography');
      window.CKTypography.applyTypography(
        state.typography,
        cardsRoot,
        {
          title: { varKey: 'title' },
          body: { varKey: 'body' },
          button: { varKey: 'button' },
          localeSwitcher: { varKey: 'localeSwitcher' },
          cardTitle: { varKey: 'card-title' },
          cardCopy: { varKey: 'card-copy' },
        },
        { locale: context && context.locale, instanceId: context && context.instanceId },
      );

      if (!window.CKHeader?.applyHeader) throw new Error('[Cards] Missing CKHeader.applyHeader');
      window.CKHeader.applyHeader(state, widgetRoot);

      if (!window.CKCoreSize?.applyCoreSize)
        throw new Error('[Cards] Missing CKCoreSize.applyCoreSize');
      window.CKCoreSize.applyCoreSize(state.coreSize, coreEl);

      if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
        throw new Error('[Cards] Missing CKLocaleSwitcher.applyLocaleSwitcher');
      }
      window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
        composedPage: context && context.composedPage === true,
        locale: context && context.locale,
        previewMode: context && context.previewMode,
        typographyScope: cardsRoot,
      });

      const core = normalizeCore(state);
      const grid = document.createElement(core.treatment === 'steps' ? 'ol' : 'div');
      grid.className = 'ck-cards__grid';
      grid.dataset.treatment = core.treatment;
      grid.style.setProperty('--ck-cards-columns', String(core.columns));
      grid.style.setProperty('--ck-cards-gap', core.gap + 'px');

      core.items.forEach(function (item, index) {
        const slot = document.createElement(core.treatment === 'steps' ? 'li' : 'div');
        slot.className = 'ck-cards__slot';
        slot.appendChild(renderCard(item, core, state));
        if (index < core.items.length - 1) {
          const between = renderBetween(core, index);
          if (between) slot.appendChild(between);
        }
        grid.appendChild(slot);
      });

      coreEl.replaceChildren(grid);

      if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
        window.CKBranding.applyBacklink(widgetRoot, state);
      }
    }

    let previewLocaleRequest = 0;

    async function applyPreviewState(
      state,
      locale,
      instanceId,
      previewMode,
      baseLocale,
      translatedLocaleValues,
    ) {
      if (!state) return;
      const requestId = ++previewLocaleRequest;
      const helper =
        window.CK_PREVIEW_L10N &&
        typeof window.CK_PREVIEW_L10N === 'object' &&
        typeof window.CK_PREVIEW_L10N.loadLocalizedState === 'function'
          ? window.CK_PREVIEW_L10N
          : null;
      let localizedState = state;
      if (helper) {
        try {
          localizedState = await helper.loadLocalizedState({
            instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
            locale,
            baseLocale,
            previewMode,
            baseState: state,
            values: translatedLocaleValues,
          });
        } catch (error) {
          if (requestId === previewLocaleRequest) {
            console.error('[Cards] preview localization load failed', error);
          }
          return;
        }
      }
      if (requestId !== previewLocaleRequest) return;
      applyState(localizedState, {
        locale,
        previewMode,
        composedPage: runtimeContext && runtimeContext.composedPage === true,
        instanceId: typeof instanceId === 'string' ? instanceId : resolvedInstanceId,
      });
    }

    runtime.bindStateUpdates(
      'cards',
      resolvedInstanceId,
      (data) => {
        void applyPreviewState(
          data.state,
          data.locale,
          data.instanceId,
          data.previewMode,
          data.baseLocale,
          data.translatedLocaleValues,
        );
      },
      { requireWidgetName: true },
    );

    const initialLocale = runtimeContext.locale || '';
    const initialState = runtimeContext.state;
    if (initialState)
      applyState(initialState, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
  }

  runtime.register('cards', initCards);
})();
