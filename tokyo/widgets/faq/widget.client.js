// FAQ widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
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

  const titleEl = faqRoot.querySelector('[data-role="faq-title"]');
  if (!(titleEl instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing [data-role="faq-title"]');
  }
  const headerEl = titleEl.closest('.ck-faq__header');
  if (!(headerEl instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing .ck-faq__header');
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
    const attr = widgetRoot.getAttribute('data-ck-public-id');
    if (typeof attr === 'string' && attr.trim()) return attr.trim();
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
    assertString(state.title, 'state.title');
    assertBoolean(state.showTitle, 'state.showTitle');
    assertBoolean(state.displayCategoryTitles, 'state.displayCategoryTitles');

    assertObject(state.layout, 'state.layout');
    if (!['accordion', 'list', 'multicolumn'].includes(state.layout.type)) {
      throw new Error('[FAQ] state.layout.type must be accordion|list|multicolumn');
    }
    assertNumber(state.layout.gap, 'state.layout.gap');
    assertObject(state.layout.columns, 'state.layout.columns');
    assertNumber(state.layout.columns.desktop, 'state.layout.columns.desktop');
    assertNumber(state.layout.columns.mobile, 'state.layout.columns.mobile');
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
    if (!['plus', 'chevron', 'arrow', 'arrowshape'].includes(state.appearance.iconStyle)) {
      throw new Error('[FAQ] state.appearance.iconStyle must be plus|chevron|arrow|arrowshape');
    }
    assertFill(state.appearance.iconColor, 'state.appearance.iconColor');
    assertObject(state.appearance.itemCard, 'state.appearance.itemCard');
    assertBoolean(state.appearance.itemCard.radiusLinked, 'state.appearance.itemCard.radiusLinked');
    assertString(state.appearance.itemCard.radius, 'state.appearance.itemCard.radius');
    assertString(state.appearance.itemCard.radiusTL, 'state.appearance.itemCard.radiusTL');
    assertString(state.appearance.itemCard.radiusTR, 'state.appearance.itemCard.radiusTR');
    assertString(state.appearance.itemCard.radiusBR, 'state.appearance.itemCard.radiusBR');
    assertString(state.appearance.itemCard.radiusBL, 'state.appearance.itemCard.radiusBL');
    assertBorderConfig(state.appearance.itemCard.border, 'state.appearance.itemCard.border');
    assertObject(state.appearance.itemCard.shadow, 'state.appearance.itemCard.shadow');
    assertBoolean(state.appearance.itemCard.shadow.enabled, 'state.appearance.itemCard.shadow.enabled');
    assertBoolean(state.appearance.itemCard.shadow.inset, 'state.appearance.itemCard.shadow.inset');
    assertNumber(state.appearance.itemCard.shadow.x, 'state.appearance.itemCard.shadow.x');
    assertNumber(state.appearance.itemCard.shadow.y, 'state.appearance.itemCard.shadow.y');
    assertNumber(state.appearance.itemCard.shadow.blur, 'state.appearance.itemCard.shadow.blur');
    assertNumber(state.appearance.itemCard.shadow.spread, 'state.appearance.itemCard.shadow.spread');
    assertString(state.appearance.itemCard.shadow.color, 'state.appearance.itemCard.shadow.color');
    assertNumber(state.appearance.itemCard.shadow.alpha, 'state.appearance.itemCard.shadow.alpha');
    if (state.appearance.itemCard.shadow.alpha < 0 || state.appearance.itemCard.shadow.alpha > 100) {
      throw new Error('[FAQ] state.appearance.itemCard.shadow.alpha must be 0..100');
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
    if (!['direct-first', 'detailed'].includes(state.geo.answerFormat)) {
      throw new Error('[FAQ] state.geo.answerFormat must be direct-first|detailed');
    }
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
          ? `<li class="ck-faq__category" data-role="faq-section-title" role="presentation">${escapeHtml(
              section.title,
            )}</li>`
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

        return header + items;
      })
      .join('');

    listEl.innerHTML = markup;
  }

  function computeShadowBoxShadow(shadow) {
    if (shadow.enabled !== true || shadow.alpha <= 0) return 'none';
    const alphaMix = 100 - shadow.alpha;
    const color = `color-mix(in oklab, ${shadow.color}, transparent ${alphaMix}%)`;
    return `${shadow.inset === true ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px ${color}`;
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
    const border = appearance.itemCard.border;
    const borderEnabled = border.enabled === true && border.width > 0;
    faqRoot.style.setProperty('--faq-card-border-width', borderEnabled ? `${border.width}px` : '0px');
    faqRoot.style.setProperty('--faq-card-border-color', borderEnabled ? border.color : 'transparent');
    faqRoot.style.setProperty('--faq-item-shadow', computeShadowBoxShadow(appearance.itemCard.shadow));
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

    const tokenize = (value) => {
      const normalized = String(value || '').trim();
      return normalized === 'none' ? '0' : `var(--control-radius-${normalized})`;
    };
    const radiusCfg = appearance.itemCard;
    const r =
      radiusCfg.radiusLinked === false
        ? {
            tl: tokenize(radiusCfg.radiusTL),
            tr: tokenize(radiusCfg.radiusTR),
            br: tokenize(radiusCfg.radiusBR),
            bl: tokenize(radiusCfg.radiusBL),
          }
        : (() => {
            const all = tokenize(radiusCfg.radius);
            return { tl: all, tr: all, br: all, bl: all };
          })();
    faqRoot.style.setProperty('--faq-item-radius', `${r.tl} ${r.tr} ${r.br} ${r.bl}`);
  }

  function applyLayout(layout) {
    faqRoot.style.setProperty('--layout-gap', `${layout.gap}px`);
    faqRoot.style.setProperty('--faq-columns-desktop', String(layout.columns.desktop));
    faqRoot.style.setProperty('--faq-columns-mobile', String(layout.columns.mobile));
    faqRoot.setAttribute('data-layout', layout.type);

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
      section: { varKey: 'section' },
      question: { varKey: 'question' },
      answer: { varKey: 'answer' },
    });

    titleEl.textContent = state.title;
    titleEl.hidden = state.showTitle !== true;
    headerEl.hidden = state.showTitle !== true;

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

  const initialState = window.CK_WIDGET && window.CK_WIDGET.state;
  if (initialState) applyState(initialState);
})();
