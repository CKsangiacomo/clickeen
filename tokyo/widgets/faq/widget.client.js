// FAQ widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript || window.CK_CURRENT_SCRIPT;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widgetRoot = scriptEl.closest('[data-ck-widget="faq"]');
  if (!(widgetRoot instanceof HTMLElement)) {
    throw new Error('[FAQ] widget.client.js must be rendered inside [data-ck-widget="faq"]');
  }
  const podEl = widgetRoot.closest('.pod');

  const faqRoot = widgetRoot.querySelector('[data-role="faq"]');
  if (!(faqRoot instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing [data-role="faq"] root');
  }

  const emptyEl = faqRoot.querySelector('[data-role="faq-empty"]');
  if (!(emptyEl instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing [data-role="faq-empty"]');
  }

  const listEl = faqRoot.querySelector('[data-role="faq-list"]');
  if (!(listEl instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing [data-role="faq-list"]');
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
    const direct = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const rootNode = widgetRoot.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      const host = rootNode.host;
      const fromHost = host instanceof HTMLElement ? host.getAttribute('data-ck-public-id') : '';
      if (typeof fromHost === 'string' && fromHost.trim()) return fromHost.trim();
    }

    const ancestor = widgetRoot.closest('[data-ck-public-id]');
    const fromAncestor = ancestor instanceof HTMLElement ? ancestor.getAttribute('data-ck-public-id') : '';
    if (typeof fromAncestor === 'string' && fromAncestor.trim()) return fromAncestor.trim();

    const global = window.CK_WIDGET && typeof window.CK_WIDGET === 'object' ? window.CK_WIDGET : null;
    const candidate = global && typeof global.publicId === 'string' ? global.publicId.trim() : '';
    return candidate || '';
  })();
  if (resolvedPublicId) widgetRoot.setAttribute('data-ck-public-id', resolvedPublicId);

  function assertBoolean(value, path) {
    if (typeof value !== 'boolean') {
      throw new Error(`[FAQ] ${path} must be a boolean`);
    }
  }

  function assertNumber(value, path) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`[FAQ] ${path} must be a finite number`);
    }
  }

  function assertString(value, path) {
    if (typeof value !== 'string') {
      throw new Error(`[FAQ] ${path} must be a string`);
    }
  }

  function assertObject(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[FAQ] ${path} must be an object`);
    }
  }

  function assertFill(value, path) {
    if (typeof value === 'string') return;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[FAQ] ${path} must be a fill`);
    }
    if (typeof value.type !== 'string' || !value.type.trim()) {
      throw new Error(`[FAQ] ${path}.type must be a string`);
    }
  }

  function assertArray(value, path) {
    if (!Array.isArray(value)) {
      throw new Error(`[FAQ] ${path} must be an array`);
    }
  }

  function assertBorderConfig(value, path) {
    assertObject(value, path);
    assertBoolean(value.enabled, `${path}.enabled`);
    assertNumber(value.width, `${path}.width`);
    assertString(value.color, `${path}.color`);
    if (value.width < 0 || value.width > 12) {
      throw new Error(`[FAQ] ${path}.width must be 0..12`);
    }
  }

  function assertFaqState(state) {
    assertObject(state, 'state');
    assertBoolean(state.displayCategoryTitles, 'state.displayCategoryTitles');

    assertObject(state.header, 'state.header');
    assertBoolean(state.header.enabled, 'state.header.enabled');
    assertString(state.header.title, 'state.header.title');
    assertBoolean(state.header.showSubtitle, 'state.header.showSubtitle');
    assertString(state.header.subtitleHtml, 'state.header.subtitleHtml');
    assertString(state.header.alignment, 'state.header.alignment');
    if (!['left', 'center', 'right'].includes(state.header.alignment)) {
      throw new Error('[FAQ] state.header.alignment must be left|center|right');
    }
    assertString(state.header.placement, 'state.header.placement');
    if (!['top', 'bottom', 'left', 'right'].includes(state.header.placement)) {
      throw new Error('[FAQ] state.header.placement must be top|bottom|left|right');
    }
    assertString(state.header.ctaPlacement, 'state.header.ctaPlacement');
    if (!['right', 'below'].includes(state.header.ctaPlacement)) {
      throw new Error('[FAQ] state.header.ctaPlacement must be right|below');
    }

    assertObject(state.cta, 'state.cta');
    assertBoolean(state.cta.enabled, 'state.cta.enabled');
    assertString(state.cta.label, 'state.cta.label');
    assertString(state.cta.href, 'state.cta.href');
    assertBoolean(state.cta.iconEnabled, 'state.cta.iconEnabled');
    assertString(state.cta.iconName, 'state.cta.iconName');
    assertString(state.cta.iconPlacement, 'state.cta.iconPlacement');
    if (!['left', 'right'].includes(state.cta.iconPlacement)) {
      throw new Error('[FAQ] state.cta.iconPlacement must be left|right');
    }

    assertObject(state.layout, 'state.layout');
    if (!['accordion', 'list', 'multicolumn'].includes(state.layout.type)) {
      throw new Error('[FAQ] state.layout.type must be accordion|list|multicolumn');
    }
    assertNumber(state.layout.gap, 'state.layout.gap');
    assertObject(state.layout.columns, 'state.layout.columns');
    assertNumber(state.layout.columns.desktop, 'state.layout.columns.desktop');
    assertNumber(state.layout.columns.mobile, 'state.layout.columns.mobile');
    if (state.layout.cardsLayout !== undefined) {
      assertString(state.layout.cardsLayout, 'state.layout.cardsLayout');
      if (!['grid', 'masonry'].includes(state.layout.cardsLayout)) {
        throw new Error('[FAQ] state.layout.cardsLayout must be grid|masonry');
      }
    }
    assertBoolean(state.layout.itemPaddingLinked, 'state.layout.itemPaddingLinked');
    assertNumber(state.layout.itemPadding, 'state.layout.itemPadding');
    assertNumber(state.layout.itemPaddingTop, 'state.layout.itemPaddingTop');
    assertNumber(state.layout.itemPaddingRight, 'state.layout.itemPaddingRight');
    assertNumber(state.layout.itemPaddingBottom, 'state.layout.itemPaddingBottom');
    assertNumber(state.layout.itemPaddingLeft, 'state.layout.itemPaddingLeft');

    assertObject(state.appearance, 'state.appearance');
    assertFill(state.appearance.itemBackground, 'state.appearance.itemBackground');
    if (!['underline', 'highlight', 'color'].includes(state.appearance.linkStyle)) {
      throw new Error('[FAQ] state.appearance.linkStyle must be underline|highlight|color');
    }
    assertFill(state.appearance.linkUnderlineColor, 'state.appearance.linkUnderlineColor');
    assertFill(state.appearance.linkHighlightColor, 'state.appearance.linkHighlightColor');
    assertFill(state.appearance.linkTextColor, 'state.appearance.linkTextColor');
    assertFill(state.appearance.ctaBackground, 'state.appearance.ctaBackground');
    assertFill(state.appearance.ctaTextColor, 'state.appearance.ctaTextColor');
    assertBorderConfig(state.appearance.ctaBorder, 'state.appearance.ctaBorder');
    assertString(state.appearance.ctaRadius, 'state.appearance.ctaRadius');
    assertString(state.appearance.ctaSizePreset, 'state.appearance.ctaSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.ctaSizePreset)) {
      throw new Error('[FAQ] state.appearance.ctaSizePreset must be xs|s|m|l|xl|custom');
    }
    assertBoolean(state.appearance.ctaPaddingLinked, 'state.appearance.ctaPaddingLinked');
    assertNumber(state.appearance.ctaPaddingInline, 'state.appearance.ctaPaddingInline');
    assertNumber(state.appearance.ctaPaddingBlock, 'state.appearance.ctaPaddingBlock');
    assertString(state.appearance.ctaIconSizePreset, 'state.appearance.ctaIconSizePreset');
    if (!['xs', 's', 'm', 'l', 'xl', 'custom'].includes(state.appearance.ctaIconSizePreset)) {
      throw new Error('[FAQ] state.appearance.ctaIconSizePreset must be xs|s|m|l|xl|custom');
    }
    assertNumber(state.appearance.ctaIconSize, 'state.appearance.ctaIconSize');
    if (!['plus', 'chevron', 'arrow', 'arrowshape'].includes(state.appearance.iconStyle)) {
      throw new Error('[FAQ] state.appearance.iconStyle must be plus|chevron|arrow|arrowshape');
    }
    assertFill(state.appearance.iconColor, 'state.appearance.iconColor');
    assertObject(state.appearance.cardwrapper, 'state.appearance.cardwrapper');
    assertBoolean(state.appearance.cardwrapper.radiusLinked, 'state.appearance.cardwrapper.radiusLinked');
    assertString(state.appearance.cardwrapper.radius, 'state.appearance.cardwrapper.radius');
    assertString(state.appearance.cardwrapper.radiusTL, 'state.appearance.cardwrapper.radiusTL');
    assertString(state.appearance.cardwrapper.radiusTR, 'state.appearance.cardwrapper.radiusTR');
    assertString(state.appearance.cardwrapper.radiusBR, 'state.appearance.cardwrapper.radiusBR');
    assertString(state.appearance.cardwrapper.radiusBL, 'state.appearance.cardwrapper.radiusBL');
    assertBorderConfig(state.appearance.cardwrapper.border, 'state.appearance.cardwrapper.border');
    assertObject(state.appearance.cardwrapper.shadow, 'state.appearance.cardwrapper.shadow');
    assertBoolean(state.appearance.cardwrapper.shadow.enabled, 'state.appearance.cardwrapper.shadow.enabled');
    assertBoolean(state.appearance.cardwrapper.shadow.inset, 'state.appearance.cardwrapper.shadow.inset');
    assertNumber(state.appearance.cardwrapper.shadow.x, 'state.appearance.cardwrapper.shadow.x');
    assertNumber(state.appearance.cardwrapper.shadow.y, 'state.appearance.cardwrapper.shadow.y');
    assertNumber(state.appearance.cardwrapper.shadow.blur, 'state.appearance.cardwrapper.shadow.blur');
    assertNumber(state.appearance.cardwrapper.shadow.spread, 'state.appearance.cardwrapper.shadow.spread');
    assertString(state.appearance.cardwrapper.shadow.color, 'state.appearance.cardwrapper.shadow.color');
    assertNumber(state.appearance.cardwrapper.shadow.alpha, 'state.appearance.cardwrapper.shadow.alpha');
    if (state.appearance.cardwrapper.shadow.alpha < 0 || state.appearance.cardwrapper.shadow.alpha > 100) {
      throw new Error('[FAQ] state.appearance.cardwrapper.shadow.alpha must be 0..100');
    }
    assertBorderConfig(state.appearance.podBorder, 'state.appearance.podBorder');

    assertObject(state.behavior, 'state.behavior');
    assertBoolean(state.behavior.expandFirst, 'state.behavior.expandFirst');
    assertBoolean(state.behavior.expandAll, 'state.behavior.expandAll');
    assertBoolean(state.behavior.multiOpen, 'state.behavior.multiOpen');
    assertBoolean(state.behavior.displayVideos, 'state.behavior.displayVideos');
    assertBoolean(state.behavior.displayImages, 'state.behavior.displayImages');
    assertBoolean(state.behavior.showBacklink, 'state.behavior.showBacklink');

    assertObject(state.stage, 'state.stage');
    assertObject(state.pod, 'state.pod');
    assertObject(state.typography, 'state.typography');

    assertObject(state.geo, 'state.geo');
    assertBoolean(state.geo.enableDeepLinks, 'state.geo.enableDeepLinks');

    if (state.context != null) {
      assertObject(state.context, 'state.context');
      if ('websiteUrl' in state.context) {
        assertString(state.context.websiteUrl, 'state.context.websiteUrl');
      }
    }

    assertArray(state.sections, 'state.sections');
    state.sections.forEach((section, idx) => {
      assertObject(section, `state.sections[${idx}]`);
      assertString(section.id, `state.sections[${idx}].id`);
      assertString(section.title, `state.sections[${idx}].title`);
      assertArray(section.faqs, `state.sections[${idx}].faqs`);
      section.faqs.forEach((faq, j) => {
        assertObject(faq, `state.sections[${idx}].faqs[${j}]`);
        assertString(faq.id, `state.sections[${idx}].faqs[${j}].id`);
        assertString(faq.question, `state.sections[${idx}].faqs[${j}].question`);
        assertString(faq.answer, `state.sections[${idx}].faqs[${j}].answer`);
        assertBoolean(faq.defaultOpen, `state.sections[${idx}].faqs[${j}].defaultOpen`);
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeInlineHtml(html, allowLinks) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html);
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR']);
    if (allowLinks) allowed.add('A');
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
        if (!/^https?:\/\//i.test(href)) {
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

  function renderAnswerHtml(html, behavior) {
    if (html == null) throw new Error('[FAQ] answer must be a string');

    const sanitized = sanitizeInlineHtml(html, true);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = sanitized;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const textNodes = [];
    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentNode;
      if (!(parent instanceof HTMLElement) || parent.tagName !== 'A') {
        if (typeof node.textContent === 'string' && /(https?:\/\/)/i.test(node.textContent)) {
          textNodes.push(node);
        }
      }
      node = walker.nextNode();
    }

    function buildUrlNode(url, allowBlockEmbeds) {
      const trimmed = url.trim();
      if (!/^https?:\/\/\S+$/i.test(trimmed)) return document.createTextNode(url);

      const lower = trimmed.toLowerCase();
      const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(lower);
      const isYouTube =
        /youtube\.com\/watch\?v=|youtu\.be\//i.test(lower) || /youtube\.com\/embed\//i.test(lower);
      const isVimeo = /vimeo\.com\//i.test(lower);

      if (isImage && behavior.displayImages === true) {
        const img = document.createElement('img');
        img.className = 'ck-faq__a-img';
        img.alt = '';
        img.src = trimmed;
        return img;
      }

      if (allowBlockEmbeds === true && behavior.displayVideos === true && (isYouTube || isVimeo)) {
        const src = isYouTube
          ? trimmed.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
          : trimmed;
        const container = document.createElement('div');
        container.className = 'ck-faq__a-video';
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.loading = 'lazy';
        iframe.setAttribute('allowfullscreen', '');
        container.appendChild(iframe);
        return container;
      }

      const a = document.createElement('a');
      a.href = trimmed;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = trimmed;
      return a;
    }

    textNodes.forEach((textNode) => {
      const raw = textNode.textContent || '';
      const parts = raw.split(urlRegex);
      if (parts.length <= 1) return;

      const frag = document.createDocumentFragment();
      const parent = textNode.parentNode;
      const allowBlockEmbeds = parent === wrapper;
      parts.forEach((part) => {
        const url = part.trim();
        if (/^https?:\/\/\S+$/i.test(url)) frag.appendChild(buildUrlNode(url, allowBlockEmbeds));
        else frag.appendChild(document.createTextNode(part));
      });
      textNode.parentNode?.replaceChild(frag, textNode);
    });

    return wrapper.innerHTML;
  }

  function collapseAll(listEl) {
    listEl.querySelectorAll('[data-role="faq-question"]').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function setExpanded(button, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
  }

  const accordionRuntime = {
    isAccordion: true,
    multiOpen: false,
    deepLinksEnabled: false,
  };

  function applyDeepLink() {
    if (!accordionRuntime.isAccordion || !accordionRuntime.deepLinksEnabled) return;
    const hash = typeof window.location?.hash === 'string' ? window.location.hash : '';
    if (!hash || hash === '#') return;
    const targetId = decodeURIComponent(hash.slice(1));
    if (!targetId) return;
    const items = listEl.querySelectorAll('[data-role="faq-item"]');
    for (const item of items) {
      if (!(item instanceof HTMLElement)) continue;
      if (item.id !== targetId) continue;
      const button = item.querySelector('[data-role="faq-question"]');
      if (!(button instanceof HTMLElement)) return;
      if (!accordionRuntime.multiOpen) collapseAll(listEl);
      setExpanded(button, true);
      return;
    }
  }

  function renderItems(sections, behavior, displayCategoryTitles, isAccordion) {
    const publicId = resolvedPublicId;
    const markup = sections
      .map((section) => {
        const header = displayCategoryTitles
          ? `
              <div class="ck-faq__section-header" data-role="faq-section-header">
                <div class="ck-faq__category" data-role="faq-section-title">${escapeHtml(section.title)}</div>
              </div>
            `
          : '';

        const items = section.faqs
          .map((item) => {
            const qText = sanitizeInlineHtml(item.question, false);
            const answerHtml = renderAnswerHtml(item.answer, behavior);
            const anchorId = publicId ? `faq-q-${publicId}-${item.id}` : `faq-q-${item.id}`;
            const answerId = publicId ? `faq-a-${publicId}-${item.id}` : `faq-a-${item.id}`;
            const questionTag = isAccordion ? 'button' : 'div';
            const questionAttrs = isAccordion
              ? `type="button" aria-expanded="false" aria-controls="${escapeHtml(answerId)}"`
              : 'role="heading" aria-level="3"';
            const iconMarkup = isAccordion
              ? `
                  <span class="ck-faq__q-icon diet-btn-ic" data-size="md" data-variant="neutral" aria-hidden="true">
                    <span class="diet-btn-ic__icon"></span>
                  </span>
                `
              : '';
            return `
              <li class="ck-faq__item" data-role="faq-item" id="${escapeHtml(anchorId)}">
                <${questionTag} class="ck-faq__q" data-role="faq-question" ${questionAttrs}>
                  <span class="ck-faq__q-text" data-role="faq-question-text">${qText}</span>
                  ${iconMarkup}
                </${questionTag}>
                <div class="ck-faq__a" data-role="faq-answer" role="region" id="${escapeHtml(
                  answerId,
                )}">${answerHtml}</div>
              </li>
            `;
          })
          .join('');

        return `
          <li class="ck-faq__section" data-role="faq-section">
            ${header}
            <ul class="ck-faq__list" data-role="faq-section-body">${items}</ul>
          </li>
        `;
      })
      .join('');

    listEl.innerHTML = markup;
  }

  function resolveFillBackground(value) {
    if (!window.CKFill || typeof window.CKFill.toCssBackground !== 'function') {
      throw new Error('[FAQ] Missing CKFill.toCssBackground');
    }
    return window.CKFill.toCssBackground(value);
  }

  function resolveFillColor(value) {
    if (!window.CKFill || typeof window.CKFill.toCssColor !== 'function') {
      throw new Error('[FAQ] Missing CKFill.toCssColor');
    }
    return window.CKFill.toCssColor(value);
  }

  function applyAppearance(appearance) {
    faqRoot.style.setProperty('--faq-item-bg', resolveFillBackground(appearance.itemBackground));
    if (!window.CKSurface?.applyCardWrapper) {
      throw new Error('[FAQ] Missing CKSurface.applyCardWrapper');
    }
    window.CKSurface.applyCardWrapper(appearance.cardwrapper, faqRoot);
    faqRoot.setAttribute('data-link-style', appearance.linkStyle);
    faqRoot.style.setProperty('--faq-link-underline-color', resolveFillColor(appearance.linkUnderlineColor));
    faqRoot.style.setProperty('--faq-link-highlight-color', resolveFillBackground(appearance.linkHighlightColor));
    faqRoot.style.setProperty('--faq-link-text-color', resolveFillColor(appearance.linkTextColor));
    faqRoot.style.setProperty('--faq-icon-color', resolveFillColor(appearance.iconColor));

    if (podEl instanceof HTMLElement) {
      const podBorder = appearance.podBorder;
      const podEnabled = podBorder.enabled === true && podBorder.width > 0;
      podEl.style.setProperty('--pod-border-width', podEnabled ? `${podBorder.width}px` : '0px');
      podEl.style.setProperty('--pod-border-color', podEnabled ? podBorder.color : 'transparent');
    }
  }

  function applyLayout(layout) {
    faqRoot.style.setProperty('--layout-gap', `${layout.gap}px`);
    faqRoot.style.setProperty('--faq-columns-desktop', String(layout.columns.desktop));
    faqRoot.style.setProperty('--faq-columns-mobile', String(layout.columns.mobile));
    faqRoot.setAttribute('data-layout', layout.type);
    if (layout.type === 'multicolumn') {
      const cardsLayout = typeof layout.cardsLayout === 'string' ? layout.cardsLayout : 'grid';
      faqRoot.setAttribute('data-cards-layout', cardsLayout);
    } else {
      faqRoot.removeAttribute('data-cards-layout');
    }

    const pad =
      layout.itemPaddingLinked === false
        ? {
            top: layout.itemPaddingTop,
            right: layout.itemPaddingRight,
            bottom: layout.itemPaddingBottom,
            left: layout.itemPaddingLeft,
          }
        : {
            top: layout.itemPadding,
            right: layout.itemPadding,
            bottom: layout.itemPadding,
            left: layout.itemPadding,
          };
    faqRoot.style.setProperty('--faq-item-pad-top', `${pad.top}px`);
    faqRoot.style.setProperty('--faq-item-pad-right', `${pad.right}px`);
    faqRoot.style.setProperty('--faq-item-pad-bottom', `${pad.bottom}px`);
    faqRoot.style.setProperty('--faq-item-pad-left', `${pad.left}px`);
  }

  const ICON_PAIRS = {
    plus: { expand: 'plus', collapse: 'minus' },
    chevron: { expand: 'chevron.down', collapse: 'chevron.up' },
    arrow: { expand: 'arrow.down', collapse: 'arrow.up' },
    arrowshape: { expand: 'arrowshape.down', collapse: 'arrowshape.up' },
  };

  function applyAccordionIcons(iconStyle) {
    const pair = ICON_PAIRS[iconStyle];
    if (!pair) {
      throw new Error(`[FAQ] Unknown accordion icon style "${iconStyle}"`);
    }
    faqRoot.style.setProperty('--faq-icon-expand', `url("${assetOrigin}/dieter/icons/svg/${pair.expand}.svg")`);
    faqRoot.style.setProperty('--faq-icon-collapse', `url("${assetOrigin}/dieter/icons/svg/${pair.collapse}.svg")`);
  }

  // Avoid DOM churn on unrelated state updates (e.g. stage sizing). The state object sent
  // via postMessage is always cloned, so we use a stable signature of the fields that
  // actually affect list markup.
  let lastItemsSignature = '';
  let lastAccordionSignature = '';

  listEl.addEventListener('click', (event) => {
    if (!accordionRuntime.isAccordion) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-role="faq-question"]');
    if (!(button instanceof HTMLButtonElement)) return;
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    const next = !isOpen;
    if (!accordionRuntime.multiOpen) collapseAll(listEl);
    setExpanded(button, next);
    if (accordionRuntime.deepLinksEnabled && next) {
      const item = button.closest('[data-role="faq-item"]');
      if (item instanceof HTMLElement && item.id) {
        window.location.hash = item.id;
      }
    }
  });

  function applyState(state) {
    assertFaqState(state);

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[FAQ] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[FAQ] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(state.typography, faqRoot, {
      title: { varKey: 'title' },
      body: { varKey: 'body' },
      section: { varKey: 'section' },
      question: { varKey: 'question' },
      answer: { varKey: 'answer' },
      button: { varKey: 'button' },
    });

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[FAQ] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    applyAccordionIcons(state.appearance.iconStyle);

    applyAppearance(state.appearance);
    applyLayout(state.layout);
    accordionRuntime.deepLinksEnabled = state.geo.enableDeepLinks === true;
    const nextItemsSignature = JSON.stringify([
      state.sections,
      state.displayCategoryTitles === true,
      state.behavior.displayVideos === true,
      state.behavior.displayImages === true,
      state.layout.type,
    ]);
    if (nextItemsSignature !== lastItemsSignature) {
      lastItemsSignature = nextItemsSignature;
      renderItems(
        state.sections,
        state.behavior,
        state.displayCategoryTitles === true,
        state.layout.type === 'accordion',
      );
    }

    const hasAny = state.sections.some((section) => section.faqs.length > 0);
    faqRoot.setAttribute('data-state', hasAny ? 'ready' : 'empty');
    emptyEl.hidden = hasAny;

    if (state.layout.type === 'list' || state.layout.type === 'multicolumn') {
      accordionRuntime.isAccordion = false;
      lastAccordionSignature = JSON.stringify([state.layout.type]);
      return;
    }

    const buttons = listEl.querySelectorAll('[data-role="faq-question"]');
    accordionRuntime.isAccordion = true;
    accordionRuntime.multiOpen = state.behavior.multiOpen === true;
    const sig = JSON.stringify([
      state.layout.type,
      state.behavior.multiOpen === true,
      state.behavior.expandAll === true,
      state.behavior.expandFirst === true,
      state.sections.map((section) => section.faqs.map((faq) => faq.defaultOpen === true)),
    ]);
    if (sig !== lastAccordionSignature) {
      lastAccordionSignature = sig;
      buttons.forEach((button) => {
        if (button instanceof HTMLButtonElement) button.disabled = false;
        button.removeAttribute('tabindex');
      });
      collapseAll(listEl);

      if (state.behavior.expandAll === true) {
        buttons.forEach((button) => setExpanded(button, true));
      } else if (state.sections.some((section) => section.faqs.some((faq) => faq.defaultOpen === true))) {
        const flat = state.sections.flatMap((section) => section.faqs);
        buttons.forEach((button, idx) => {
          if (flat[idx]?.defaultOpen === true) setExpanded(button, true);
        });
      } else if (state.behavior.expandFirst === true) {
        const first = buttons[0];
        if (first) setExpanded(first, true);
      }
    } else {
      // Keep the currently expanded/collapsed state as-is; no churn on stage/pod changes.
      buttons.forEach((button) => {
        if (button instanceof HTMLButtonElement) button.disabled = false;
        button.removeAttribute('tabindex');
      });
    }

    applyDeepLink();
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'faq') return;
    applyState(data.state);
  });

  const keyedPayload =
    resolvedPublicId &&
    window.CK_WIDGETS &&
    typeof window.CK_WIDGETS === 'object' &&
    window.CK_WIDGETS[resolvedPublicId] &&
    typeof window.CK_WIDGETS[resolvedPublicId] === 'object'
      ? window.CK_WIDGETS[resolvedPublicId]
      : null;
  const initialState = (keyedPayload && keyedPayload.state) || (window.CK_WIDGET && window.CK_WIDGET.state);
  if (initialState) applyState(initialState);
})();
