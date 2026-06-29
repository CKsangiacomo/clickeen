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

  function assertRecord(value, path) {
    if (!isRecord(value)) throw new Error('[Cards] ' + path + ' must be an object');
    return value;
  }

  function assertArray(value, path, min, max) {
    if (!Array.isArray(value)) throw new Error('[Cards] ' + path + ' must be an array');
    if (value.length < min || value.length > max) {
      throw new Error('[Cards] ' + path + ' must contain ' + min + '-' + max + ' cards');
    }
    return value;
  }

  function assertString(value, path) {
    if (typeof value !== 'string') throw new Error('[Cards] ' + path + ' must be a string');
    return value;
  }

  function assertNonEmptyString(value, path) {
    const text = assertString(value, path).trim();
    if (!text) throw new Error('[Cards] ' + path + ' must not be empty');
    return text;
  }

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') throw new Error('[Cards] ' + path + ' must be a boolean');
    return value;
  }

  function assertNumber(value, path, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('[Cards] ' + path + ' must be a number');
    }
    if (value < min || value > max) {
      throw new Error('[Cards] ' + path + ' must be between ' + min + ' and ' + max);
    }
    return value;
  }

  function assertInteger(value, path, min, max) {
    const number = assertNumber(value, path, min, max);
    if (!Number.isInteger(number)) throw new Error('[Cards] ' + path + ' must be an integer');
    return number;
  }

  function assertEnum(value, path, allowed) {
    if (typeof value !== 'string' || allowed.indexOf(value) < 0) {
      throw new Error('[Cards] ' + path + ' must be one of: ' + allowed.join(', '));
    }
    return value;
  }

  var APPROVED_DIETER_ICON_NAMES = new Set([
    'app.translucent',
    'arrow.counterclockwise',
    'arrow.down',
    'arrow.down.document',
    'arrow.down.left',
    'arrow.down.right',
    'arrow.left',
    'arrow.right',
    'arrow.trianglehead.2.counterclockwise',
    'arrow.trianglehead.clockwise',
    'arrow.up',
    'arrow.up.arrow.down',
    'arrow.up.document',
    'arrow.up.left',
    'arrow.up.right',
    'arrowshape.down',
    'arrowshape.forward',
    'arrowshape.left',
    'arrowshape.turn.up.left',
    'arrowshape.turn.up.left.2',
    'arrowshape.turn.up.right',
    'arrowshape.up',
    'at',
    'bag',
    'bell',
    'bold',
    'bolt',
    'bubble',
    'bubble.left.and.bubble.right',
    'calendar',
    'camera',
    'car.rear',
    'cart',
    'character.circle',
    'chart.bar',
    'chart.pie',
    'checkmark',
    'checkmark.message',
    'chevron.compact.down',
    'chevron.compact.left',
    'chevron.compact.right',
    'chevron.compact.up',
    'chevron.down',
    'chevron.down.2',
    'chevron.left',
    'chevron.right',
    'chevron.up',
    'chevron.up.2',
    'chevron.up.forward.2',
    'circle.dotted',
    'circle.grid.2x2',
    'circle.lefthalf.filled',
    'circle.on.square',
    'clock',
    'creditcard',
    'cube',
    'desktopcomputer',
    'document',
    'document.on.document',
    'ellipsis',
    'ellipsis.circle',
    'exclamationmark.triangle',
    'face.smiling',
    'flag',
    'folder',
    'gear',
    'gearshape',
    'gearshape.2',
    'globe',
    'hand.draw',
    'hand.point.up',
    'hand.point.up.left',
    'hand.raised',
    'hand.tap',
    'hand.thumbsdown',
    'hand.thumbsup',
    'hands.clap',
    'heart',
    'info.triangle',
    'iphone',
    'italic',
    'key',
    'lightbulb',
    'line.3.horizontal.decrease.circle',
    'link',
    'location',
    'lock',
    'lock.open',
    'lock.rectangle',
    'lock.shield',
    'macbook.and.ipod',
    'map',
    'mappin.and.ellipse',
    'message',
    'minus',
    'minus.square',
    'moon.fill',
    'multiply',
    'paintbrush',
    'paintbrush.pointed',
    'paperclip',
    'paperplane',
    'party.popper',
    'pause',
    'pencil',
    'pencil.slash',
    'person',
    'person.2',
    'person.2.badge.plus',
    'person.badge.key',
    'person.badge.plus',
    'person.crop.circle',
    'person.fill.checkmark',
    'person.line.dotted.person',
    'personalhotspot.slash',
    'phone',
    'phone.fill',
    'photo',
    'play',
    'play.circle',
    'play.rectangle',
    'play.square',
    'plus',
    'plus.square',
    'pointer.arrow.and.square.on.square.dashed',
    'rectangle.and.pencil.and.ellipsis',
    'rectangle.on.rectangle.badge.gearshape',
    'rectangle.portrait.and.arrow.right',
    'repeat',
    'scribble',
    'selection.pin.in.out',
    'signature',
    'slider.vertical.3',
    'slowmo',
    'sparkles',
    'square.and.arrow.down',
    'square.and.arrow.up',
    'square.and.pencil',
    'square.dashed',
    'square.on.square',
    'square.stack.3d.down.right',
    'square.stack.3d.up',
    'star',
    'stop',
    'strikethrough',
    'sun.max',
    'sun.max.fill',
    'tachometer',
    'tag',
    'textformat.characters.dottedunderline',
    'textformat.size.larger',
    'translate',
    'trash',
    'tray',
    'underline',
    'waveform.path.ecg',
    'xmark.triangle.circle.square',
  ]);

  function assertIconName(value, path) {
    const iconName = assertNonEmptyString(value, path);
    if (!APPROVED_DIETER_ICON_NAMES.has(iconName)) {
      throw new Error('[Cards] ' + path + ' must be an approved Dieter icon name');
    }
    return iconName;
  }

  function assertFillValue(value, path) {
    if (isRecord(value)) return value;
    throw new Error('[Cards] ' + path + ' must be a fill value');
  }

  function normalizeActionHref(raw, path) {
    var value = assertString(raw, path).trim();
    if (!value) return '';
    if (value.charAt(0) === '#' && !/\s/.test(value)) return value;
    if (value.charAt(0) === '/' && value.charAt(1) !== '/' && !/\s/.test(value)) return value;
    if (/^https?:\/\//i.test(value)) {
      try {
        return new URL(value).href;
      } catch {
        throw new Error('[Cards] ' + path + ' must be a valid http(s) URL');
      }
    }
    if (/^mailto:[^\s]+$/i.test(value)) return value;
    if (/^tel:[+0-9().\-\s]+$/i.test(value)) return value;
    throw new Error('[Cards] ' + path + ' must be empty, #, root-relative, http(s), mailto, or tel');
  }

  function cssFill(value) {
    if (!window.CKAppearance || typeof window.CKAppearance.toCssBackground !== 'function') throw new Error('[Cards] Missing CKAppearance fill helpers');
    return window.CKAppearance.toCssBackground(value);
  }

  function mediaSource(fill, path) {
    const mediaFill = assertRecord(fill, path);
    assertEnum(mediaFill.type, path + '.type', ['image']);
    const image = assertRecord(mediaFill.image, path + '.image');
    return assertNonEmptyString(image.src, path + '.image.src');
  }

  function assertBorder(border, path) {
    const value = assertRecord(border, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertNumber(value.width, path + '.width', 0, 32);
    assertString(value.color, path + '.color');
  }

  function assertShadow(shadow, path) {
    const value = assertRecord(shadow, path);
    assertBoolean(value.enabled, path + '.enabled');
    assertBoolean(value.inset, path + '.inset');
    assertNumber(value.x, path + '.x', -200, 200);
    assertNumber(value.y, path + '.y', -200, 200);
    assertNumber(value.blur, path + '.blur', 0, 400);
    assertNumber(value.spread, path + '.spread', -200, 200);
    assertString(value.color, path + '.color');
    assertNumber(value.alpha, path + '.alpha', 0, 100);
  }

  function assertCardWrapper(cardwrapper, path) {
    const value = assertRecord(cardwrapper, path);
    assertBoolean(value.radiusLinked, path + '.radiusLinked');
    assertString(value.radius, path + '.radius');
    assertString(value.radiusTL, path + '.radiusTL');
    assertString(value.radiusTR, path + '.radiusTR');
    assertString(value.radiusBR, path + '.radiusBR');
    assertString(value.radiusBL, path + '.radiusBL');
    assertBorder(value.border, path + '.border');
    assertShadow(value.shadow, path + '.shadow');
    return value;
  }

  function validateItems(cards, treatment) {
    const rawItems = assertArray(cards.items, 'state.cards.items', 2, 16);
    const seen = {};
    return rawItems.map(function (raw, index) {
      const itemPath = 'state.cards.items.' + index;
      assertRecord(raw, itemPath);
      const id = assertNonEmptyString(raw.id, itemPath + '.id');
      if (seen[id]) throw new Error('[Cards] duplicate card id: ' + id);
      seen[id] = true;
      const title = assertNonEmptyString(raw.title, itemPath + '.title');
      const copy = assertNonEmptyString(raw.copy, itemPath + '.copy');
      const media = assertRecord(raw.media, itemPath + '.media');
      const mediaKind = assertEnum(media.kind, itemPath + '.media.kind', ['none', 'icon', 'image']);
      const iconName = mediaKind === 'icon'
        ? assertIconName(media.iconName, itemPath + '.media.iconName')
        : assertString(media.iconName, itemPath + '.media.iconName');
      const imageSrc = mediaKind === 'image' ? mediaSource(media.image, itemPath + '.media.image') : '';
      const imageAlt = assertString(media.imageAlt, itemPath + '.media.imageAlt');
      const link = assertRecord(raw.link, itemPath + '.link');
      const enabledLink = assertBoolean(link.enabled, itemPath + '.link.enabled');
      assertString(link.href, itemPath + '.link.href');
      assertString(link.label, itemPath + '.link.label');
      const forceLink = treatment === 'linked-cards';
      const href = enabledLink || forceLink ? normalizeActionHref(link.href, itemPath + '.link.href') : '';
      const linkLabel = enabledLink || forceLink
        ? assertNonEmptyString(link.label, itemPath + '.link.label')
        : link.label.trim();
      if ((enabledLink || forceLink) && !href) {
        throw new Error('[Cards] ' + itemPath + '.link.href must not be empty when card link is enabled');
      }
      const style = assertRecord(raw.style, itemPath + '.style');
      assertFillValue(style.background, itemPath + '.style.background');
      assertFillValue(style.borderColor, itemPath + '.style.borderColor');
      assertFillValue(style.accentColor, itemPath + '.style.accentColor');
      assertEnum(style.textTone, itemPath + '.style.textTone', ['inherit', 'default', 'muted', 'inverse']);
      return {
        id: id,
        title: title,
        copy: copy,
        media: media,
        mediaKind: mediaKind,
        iconName: iconName,
        imageSrc: imageSrc,
        imageAlt: imageAlt,
        linkEnabled: enabledLink,
        href: href,
        linkLabel: linkLabel,
        style: style,
      };
    });
  }

  function validateCardsState(state) {
    assertRecord(state, 'state');
    const localeSwitcher = assertRecord(state.localeSwitcher, 'state.localeSwitcher'); assertBoolean(localeSwitcher.enabled, 'state.localeSwitcher.enabled'); assertEnum(localeSwitcher.attachTo, 'state.localeSwitcher.attachTo', ['stage', 'pod']); assertEnum(localeSwitcher.position, 'state.localeSwitcher.position', ['top-left', 'top-center', 'top-right', 'right-middle', 'bottom-right', 'bottom-center', 'bottom-left', 'left-middle']);
    const cards = assertRecord(state.cards, 'state.cards');
    const treatment = assertEnum(cards.treatment, 'state.cards.treatment', ['cards', 'linked-cards', 'steps']);
    const between = assertRecord(cards.betweenCards, 'state.cards.betweenCards');
    const line = assertRecord(between.line, 'state.cards.betweenCards.line');
    const icon = assertRecord(between.icon, 'state.cards.betweenCards.icon');
    const customCardStyles = assertRecord(cards.customCardStyles, 'state.cards.customCardStyles');
    const appearance = assertRecord(cards.appearance, 'state.cards.appearance');
    return {
      appearance: {
        cardwrapper: assertCardWrapper(appearance.cardwrapper, 'state.cards.appearance.cardwrapper'),
      },
      treatment: treatment,
      columns: assertInteger(cards.columns, 'state.cards.columns', 2, 4),
      gap: assertNumber(cards.gap, 'state.cards.gap', 8, 64),
      cardPadding: assertNumber(cards.cardPadding, 'state.cards.cardPadding', 16, 64),
      customCardStyles: assertBoolean(customCardStyles.enabled, 'state.cards.customCardStyles.enabled'),
      betweenCards: {
        enabled: assertBoolean(between.enabled, 'state.cards.betweenCards.enabled'),
        kind: assertEnum(between.kind, 'state.cards.betweenCards.kind', ['line', 'icon']),
        line: {
          widthPt: assertNumber(line.widthPt, 'state.cards.betweenCards.line.widthPt', 1, 24),
          color: assertFillValue(line.color, 'state.cards.betweenCards.line.color'),
        },
        icon: {
          name: assertIconName(icon.name, 'state.cards.betweenCards.icon.name'),
          sizePt: assertNumber(icon.sizePt, 'state.cards.betweenCards.icon.sizePt', 8, 96),
          color: assertFillValue(icon.color, 'state.cards.betweenCards.icon.color'),
        },
      },
      items: validateItems(cards, treatment),
    };
  }

  function applyCustomCardStyles(card, item, enabled) {
    if (!enabled || !isRecord(item.style)) return;
    const background = cssFill(item.style.background);
    const borderColor = cssFill(item.style.borderColor);
    const accentColor = cssFill(item.style.accentColor);
    const textTone = item.style.textTone;
    if (background) card.style.setProperty('background', background);
    if (borderColor) card.style.setProperty('border-color', borderColor);
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

  function renderCard(item, cards) {
    const linked = cards.treatment === 'linked-cards' || item.linkEnabled;
    if (cards.treatment === 'linked-cards' && (!item.href || !item.linkLabel)) {
      throw new Error('[Cards] linked-cards treatment requires every card link href and label');
    }
    const card = document.createElement(linked && item.href ? 'a' : 'article');
    card.className = 'ck-cards__card';
    card.dataset.itemId = item.id;
    if (linked && item.href) card.setAttribute('href', item.href);

    if (!window.CKSurface?.applyCardWrapper)
      throw new Error('[Cards] Missing CKSurface.applyCardWrapper');
    window.CKSurface.applyCardWrapper(cards.appearance.cardwrapper, card);
    card.style.setProperty('--ck-cards-card-padding', cards.cardPadding + 'px');
    applyCustomCardStyles(card, item, cards.customCardStyles);

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

  function renderBetween(cards, index) {
    if (!cards.betweenCards.enabled) return null;
    const between = document.createElement('span');
    between.className = 'ck-cards__between';
    between.setAttribute('aria-hidden', 'true');
    between.dataset.kind = cards.betweenCards.kind;
    const isEndOfRow = (index + 1) % cards.columns === 0;
    between.dataset.axis = isEndOfRow ? 'y' : 'x';
    if (cards.betweenCards.kind === 'icon') {
      between.style.setProperty(
        '--ck-cards-between-icon',
        'url("/dieter/icons/svg/' + cards.betweenCards.icon.name + '.svg")',
      );
      between.style.setProperty('--ck-cards-between-size', cards.betweenCards.icon.sizePt + 'pt');
      between.style.setProperty(
        '--ck-cards-between-color',
        cssFill(cards.betweenCards.icon.color),
      );
    } else {
      between.style.setProperty('--ck-cards-between-width', cards.betweenCards.line.widthPt + 'pt');
      between.style.setProperty(
        '--ck-cards-between-color',
        cssFill(cards.betweenCards.line.color),
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
      const cards = validateCardsState(state);
      if (!window.CKStagePod?.applyStagePod)
        throw new Error('[Cards] Missing CKStagePod.applyStagePod');
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot, state.appearance);

      if (!window.CKTypography?.applyTypography)
        throw new Error('[Cards] Missing CKTypography.applyTypography');
      window.CKTypography.applyTypography(
        state.typography,
        cardsRoot,
        {
          title: { varKey: 'title' },
          body: { varKey: 'body' },
          button: { varKey: 'button' },
          localeSwitcher: { varKey: 'locale-switcher' },
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

      const grid = document.createElement(cards.treatment === 'steps' ? 'ol' : 'div');
      grid.className = 'ck-cards__grid';
      grid.dataset.treatment = cards.treatment;
      grid.style.setProperty('--ck-cards-columns', String(cards.columns));
      grid.style.setProperty('--ck-cards-gap', cards.gap + 'px');

      cards.items.forEach(function (item, index) {
        const slot = document.createElement(cards.treatment === 'steps' ? 'li' : 'div');
        slot.className = 'ck-cards__slot';
        slot.appendChild(renderCard(item, cards));
        if (index < cards.items.length - 1) {
          const between = renderBetween(cards, index);
          if (between) slot.appendChild(between);
        }
        grid.appendChild(slot);
      });

      coreEl.replaceChildren(grid);

      if (!window.CKBranding?.applyBacklink) {
        throw new Error('[Cards] Missing CKBranding.applyBacklink');
      }
      window.CKBranding.applyBacklink(widgetRoot, state);

      if (!window.CKSocialShare?.apply) {
        throw new Error('[Cards] Missing CKSocialShare.apply');
      }
      window.CKSocialShare.apply(widgetRoot, state, {
        instanceId: context && context.instanceId,
        widgetType: 'cards',
        widgetLabel: document.title || 'Cards',
        previewMode: context && context.previewMode,
      });
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
      assertRecord(state, 'state');
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

    if (runtimeContext.payload) {
      const initialLocale = runtimeContext.locale || '';
      applyState(runtimeContext.state, {
        ...runtimeContext,
        locale: initialLocale,
        instanceId: resolvedInstanceId,
      });
    }
  }

  runtime.register('cards', initCards);
})();
