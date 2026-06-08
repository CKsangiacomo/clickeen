// FAQ widget runtime (strict, deterministic).
// Assumes canonical, typed state from the editor; no runtime fallbacks/merges.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[FAQ] Missing CKWidgetRuntime.register');
  }

  function initFaq(widgetRoot, runtimeContext) {
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

  const resolvedInstanceId = runtimeContext.instanceId;

  const QA_GAP_PRESETS = {
    xs: 'var(--space-1)',
    s: 'var(--space-2)',
    m: 'var(--space-3)',
    l: 'var(--space-4)',
    xl: 'var(--space-5)',
  };

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

  function renderAnswerHtml(html) {
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

    function buildUrlNode(url) {
      const trimmed = url.trim();
      if (!/^https?:\/\/\S+$/i.test(trimmed)) return document.createTextNode(url);

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
      parts.forEach((part) => {
        const url = part.trim();
        if (/^https?:\/\/\S+$/i.test(url)) frag.appendChild(buildUrlNode(url));
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
    const instanceId = resolvedInstanceId;
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
            const answerHtml = renderAnswerHtml(item.answer);
            const anchorId = instanceId ? `faq-q-${instanceId}-${item.id}` : `faq-q-${item.id}`;
            const answerId = instanceId ? `faq-a-${instanceId}-${item.id}` : `faq-a-${item.id}`;
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

  function resolveAppearanceHelpers() {
    if (
      !window.CKAppearance ||
      typeof window.CKAppearance.toCssBackground !== 'function' ||
      typeof window.CKAppearance.toCssColor !== 'function'
    ) {
      throw new Error('[FAQ] Missing CKAppearance fill helpers');
    }
    return window.CKAppearance;
  }

  function applyAppearance(appearance, shellAppearance) {
    if (!shellAppearance || typeof shellAppearance !== 'object' || Array.isArray(shellAppearance)) {
      throw new Error('[FAQ] state.appearance must be an object');
    }
    const helpers = resolveAppearanceHelpers();
    faqRoot.style.setProperty('--faq-item-bg', helpers.toCssBackground(appearance.itemBackground));
    if (!window.CKSurface?.applyCardWrapper) {
      throw new Error('[FAQ] Missing CKSurface.applyCardWrapper');
    }
    window.CKSurface.applyCardWrapper(appearance.cardwrapper, faqRoot);
    faqRoot.setAttribute('data-link-style', appearance.linkStyle);
    faqRoot.style.setProperty('--faq-link-underline-color', helpers.toCssColor(appearance.linkUnderlineColor));
    faqRoot.style.setProperty('--faq-link-highlight-color', helpers.toCssBackground(appearance.linkHighlightColor));
    faqRoot.style.setProperty('--faq-link-text-color', helpers.toCssColor(appearance.linkTextColor));
    faqRoot.style.setProperty('--faq-icon-color', helpers.toCssColor(appearance.iconColor));

    if (podEl instanceof HTMLElement) {
      const podBorder = shellAppearance.podBorder;
      const podEnabled = podBorder.enabled === true && podBorder.width > 0;
      podEl.style.setProperty('--pod-border-width', podEnabled ? `${podBorder.width}px` : '0px');
      podEl.style.setProperty('--pod-border-color', podEnabled ? podBorder.color : 'transparent');
    }
  }

  function applyLayout(layout) {
    faqRoot.style.setProperty('--layout-gap', `${layout.gap}px`);
    const qaGapPreset = typeof layout.itemQaGapPreset === 'string' ? layout.itemQaGapPreset : 's';
    const qaGapValue =
      qaGapPreset === 'custom'
        ? `${Math.max(0, Math.min(120, layout.itemQaGapCustom))}px`
        : QA_GAP_PRESETS[qaGapPreset] || QA_GAP_PRESETS.s;
    faqRoot.style.setProperty('--faq-qa-gap', qaGapValue);
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
    faqRoot.style.setProperty('--faq-icon-expand', `url("/dieter/icons/svg/${pair.expand}.svg")`);
    faqRoot.style.setProperty('--faq-icon-collapse', `url("/dieter/icons/svg/${pair.collapse}.svg")`);
  }

  // Avoid DOM churn on unrelated state updates (e.g. stage sizing). The state object sent
  // via postMessage is always cloned, so we use a stable signature of the fields that
  // actually affect list markup.
  let lastItemsSignature = '';
  let lastAccordionSignature = '';
  let lastState = null;

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

  function applyState(state, runtimeContext) {
    lastState = state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('[FAQ] state must be an object');
    }
    if (!state.faq || typeof state.faq !== 'object' || Array.isArray(state.faq)) {
      throw new Error('[FAQ] state.faq must be an object');
    }

    if (!window.CKStagePod?.applyStagePod) {
      throw new Error('[FAQ] Missing CKStagePod.applyStagePod');
    }
    window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);

    if (!window.CKTypography?.applyTypography) {
      throw new Error('[FAQ] Missing CKTypography.applyTypography');
    }
    window.CKTypography.applyTypography(
      state.typography,
      faqRoot,
      {
        title: { varKey: 'title' },
        body: { varKey: 'body' },
        section: { varKey: 'section' },
        question: { varKey: 'question' },
        answer: { varKey: 'answer' },
        button: { varKey: 'button' },
      },
      { locale: runtimeContext && runtimeContext.locale, instanceId: resolvedInstanceId },
    );

    if (!window.CKHeader?.applyHeader) {
      throw new Error('[FAQ] Missing CKHeader.applyHeader');
    }
    window.CKHeader.applyHeader(state, widgetRoot);

    if (!window.CKLocaleSwitcher?.applyLocaleSwitcher) {
      throw new Error('[FAQ] Missing CKLocaleSwitcher.applyLocaleSwitcher');
    }
    window.CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, {
      composedPage: runtimeContext && runtimeContext.composedPage === true,
      locale: runtimeContext && runtimeContext.locale,
      previewMode: runtimeContext && runtimeContext.previewMode,
      typographyScope: faqRoot,
    });

    if (window.CKBranding && typeof window.CKBranding.applyBacklink === 'function') {
      window.CKBranding.applyBacklink(widgetRoot, state);
    }

    applyAccordionIcons(state.faq.appearance.iconStyle);

    applyAppearance(state.faq.appearance, state.appearance);
    applyLayout(state.faq.layout);
    accordionRuntime.deepLinksEnabled = state.faq.geo.enableDeepLinks === true;

    // If we rebuild list markup (e.g. while typing in Bob), preserve the current expanded state.
    // Otherwise, "expandFirst/defaultOpen" would only apply on the initial mount and get lost on re-render.
    let desiredExpandedAnchorIds = null;
    const captureExpandedAnchors = () => {
      const expanded = [];
      listEl.querySelectorAll('[data-role="faq-question"]').forEach((button) => {
        if (!(button instanceof HTMLElement)) return;
        if (button.getAttribute('aria-expanded') !== 'true') return;
        const item = button.closest('[data-role="faq-item"]');
        if (item instanceof HTMLElement && item.id) expanded.push(item.id);
      });
      return expanded;
    };

    const nextItemsSignature = JSON.stringify([
      state.faq.sections,
      state.faq.displayCategoryTitles === true,
      state.faq.layout.type,
    ]);
    if (nextItemsSignature !== lastItemsSignature) {
      lastItemsSignature = nextItemsSignature;
      if (accordionRuntime.isAccordion === true && state.faq.layout.type === 'accordion') {
        const expanded = captureExpandedAnchors();
        desiredExpandedAnchorIds = expanded.length ? expanded : null;
      }
      renderItems(
        state.faq.sections,
        state.faq.behavior,
        state.faq.displayCategoryTitles === true,
        state.faq.layout.type === 'accordion',
      );
      if (accordionRuntime.isAccordion === true && state.faq.layout.type === 'accordion' && !desiredExpandedAnchorIds) {
        // No items were open before the re-render: re-run initial expand logic (expandFirst/defaultOpen/expandAll).
        lastAccordionSignature = '';
      }
    }

    const hasAny = state.faq.sections.some((section) => section.faqs.length > 0);
    faqRoot.setAttribute('data-state', hasAny ? 'ready' : 'empty');
    emptyEl.hidden = hasAny;

    if (state.faq.layout.type === 'list' || state.faq.layout.type === 'multicolumn') {
      accordionRuntime.isAccordion = false;
      lastAccordionSignature = JSON.stringify([state.faq.layout.type]);
      return;
    }

    const buttons = listEl.querySelectorAll('[data-role="faq-question"]');
    accordionRuntime.isAccordion = true;
    accordionRuntime.multiOpen = state.faq.behavior.multiOpen === true;
    const sig = JSON.stringify([
      state.faq.layout.type,
      state.faq.behavior.multiOpen === true,
      state.faq.behavior.expandAll === true,
      state.faq.behavior.expandFirst === true,
      state.faq.sections.map((section) => section.faqs.map((faq) => faq.defaultOpen === true)),
    ]);
    if (desiredExpandedAnchorIds && desiredExpandedAnchorIds.length) {
      lastAccordionSignature = sig;
      buttons.forEach((button) => {
        if (button instanceof HTMLButtonElement) button.disabled = false;
        button.removeAttribute('tabindex');
      });
      collapseAll(listEl);

      const escapeId = (id) => {
        if (typeof window.CSS?.escape === 'function') return window.CSS.escape(id);
        return String(id).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      };
      const want = accordionRuntime.multiOpen ? desiredExpandedAnchorIds : [desiredExpandedAnchorIds[0]];
      want.forEach((anchorId) => {
        const item = listEl.querySelector(`#${escapeId(anchorId)}`);
        if (!(item instanceof HTMLElement)) return;
        const button = item.querySelector('[data-role="faq-question"]');
        if (!(button instanceof HTMLElement)) return;
        setExpanded(button, true);
      });
    } else if (sig !== lastAccordionSignature) {
      lastAccordionSignature = sig;
      buttons.forEach((button) => {
        if (button instanceof HTMLButtonElement) button.disabled = false;
        button.removeAttribute('tabindex');
      });
      collapseAll(listEl);

      if (state.faq.behavior.expandAll === true) {
        buttons.forEach((button) => setExpanded(button, true));
      } else if (state.faq.sections.some((section) => section.faqs.some((faq) => faq.defaultOpen === true))) {
        const flat = state.faq.sections.flatMap((section) => section.faqs);
        buttons.forEach((button, idx) => {
          if (flat[idx]?.defaultOpen === true) setExpanded(button, true);
        });
      } else if (state.faq.behavior.expandFirst === true) {
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

  let previewLocaleRequest = 0;

  async function applyPreviewState(state, locale, instanceId, previewMode, baseLocale, translatedLocaleValues) {
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
          console.error('[FAQ] preview localization load failed', error);
        }
        return;
      }
    }
    if (requestId !== previewLocaleRequest) return;
    applyState(localizedState, { locale, previewMode });
  }

  runtime.bindStateUpdates('faq', resolvedInstanceId, (data) => {
    void applyPreviewState(
      data.state,
      data.locale,
      data.instanceId,
      data.previewMode,
      data.baseLocale,
      data.translatedLocaleValues,
    );
  }, { requireWidgetName: true });

  function containsUrl(value) {
    return /\bhttps?:\/\//i.test(value) || /\bwww\./i.test(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function trimCopy(value, maxLen) {
    const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    const limit = typeof maxLen === 'number' && Number.isFinite(maxLen) ? maxLen : 220;
    if (trimmed.length <= limit) return trimmed;
    return trimmed.slice(0, limit).trim();
  }

  function applyCopyOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') return 0;
    if (!lastState) return 0;

    const clone =
      typeof structuredClone === 'function' ? structuredClone(lastState) : JSON.parse(JSON.stringify(lastState));

    const allowedKeyRe =
      /^(header\.(?:title|subtitleHtml)|faq\.sections\.\d+\.title|faq\.sections\.\d+\.faqs\.\d+\.(?:question|answer))$/;

    let applied = 0;
    Object.keys(overrides).forEach((key) => {
      if (!allowedKeyRe.test(key)) return;
      const raw = overrides[key];
      if (typeof raw !== 'string') return;
      if (containsUrl(raw)) return;
      const value = escapeHtml(trimCopy(raw, 220));
      if (!value) return;

      const parts = key.split('.').filter(Boolean);
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        const isIndex = /^[0-9]+$/.test(part);
        if (isIndex) {
          const idx = Number(part);
          if (!Array.isArray(cur)) return;
          cur = cur[idx];
          continue;
        }
        if (!cur || typeof cur !== 'object') return;
        cur = cur[part];
      }
      const last = parts[parts.length - 1];
      if (!cur || typeof cur !== 'object') return;
      if (typeof cur[last] !== 'string') return;
      cur[last] = value;
      applied += 1;
    });

    if (applied > 0) applyState(clone);
    return applied;
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'ck:copy-overrides') return;
    if (data.widgetname !== 'faq') return;
    if (data.instanceId && typeof data.instanceId === 'string' && resolvedInstanceId && data.instanceId !== resolvedInstanceId) return;

    const appliedCount = applyCopyOverrides(data.overrides);
    try {
      window.parent?.postMessage(
        { type: 'ck:copy-overrides-applied', widgetname: 'faq', instanceId: resolvedInstanceId, appliedCount },
        '*',
      );
    } catch {
      // ignore
    }
  });

  const initialLocale = runtimeContext.locale || '';
  const initialState = runtimeContext.state;
  if (initialState) applyState(initialState, { locale: initialLocale });
  }

  runtime.register('faq', initFaq);
})();
