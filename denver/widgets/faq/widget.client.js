// FAQ widget client-side behavior
// Expand/collapse + live title updates from Bob editing state + appearance controls.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let currentQuery = '';
  let searchInputWired = false;
  let lastItems = [];
  const fallbackItems = [
    {
      id: 'q1',
      question: 'What is Clickeen?',
      answer: 'Embeddable widgets with conversions built in.',
    },
    {
      id: 'q2',
      question: 'Is there a free plan?',
      answer: 'Yes, one active widget with core features.',
    },
    {
      id: 'q3',
      question: 'How do I install a widget?',
      answer: 'Copy the embed code and paste it before </body> on your site.',
    },
  ];

  const defaultState = {
    title: 'Frequently Asked Questions',
    showTitle: true,
    categoryTitle: 'All Questions',
    displayCategoryTitles: true,
    search: { enabled: true, placeholder: 'Search...' },
    layout: {
      type: 'accordion',
      searchPlacement: 'title',
      stickyNav: false,
      columns: { desktop: 2, tablet: 2, mobile: 1 },
      gap: 16,
      padding: 24,
    },
    appearance: {
      template: 'background',
      cardBorder: true,
      cardShadow: true,
      cardRadius: 'lg',
      iconStyle: 'plus',
      itemBackground: '#f9f9fb',
      questionColor: '#0f0f10',
      answerColor: '#3f3f46',
    },
    behavior: {
      expandFirst: false,
      expandAll: false,
      multiOpen: false,
      shuffle: false,
      displayVideos: true,
      displayImages: true,
      showBacklink: true,
      customJs: '',
    },
    stage: {
      background: 'var(--color-system-gray-5)',
      alignment: 'center',
      paddingLinked: true,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    pod: {
      background: 'var(--color-system-white)',
      paddingLinked: true,
      padding: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      widthMode: 'wrap',
      contentWidth: 960,
      radiusLinked: true,
      radius: '6xl',
      radiusTL: '6xl',
      radiusTR: '6xl',
      radiusBR: '6xl',
      radiusBL: '6xl',
    },
    customCss: '',
    objects: {
      objects: fallbackItems.map((item, idx) => ({
        id: item.id || `q${idx + 1}`,
        type: 'faq-qa',
        payload: {
          question: item.question,
          answer: item.answer,
          defaultOpen: false,
        },
      })),
    },
  };

  const initial = window.CK_WIDGET?.state || {};
  let state = mergeState(defaultState, initial);

  function sanitizeString(value) {
    return typeof value === 'string' ? value : '';
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = sanitizeString(html);
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
          before && before.nodeType === Node.TEXT_NODE && before.textContent && !/\s$/.test(before.textContent);
        const needsSpaceAfter =
          after && after.nodeType === Node.TEXT_NODE && after.textContent && !/^\s/.test(after.textContent);
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

  function escapeHtml(value) {
    return sanitizeString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toBool(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    return Boolean(value);
  }

  function mergeState(base, next) {
    const mergedLayout = {
      ...(base.layout || {}),
      ...(next?.layout || {}),
      columns: {
        ...(base.layout?.columns || {}),
        ...((next?.layout && next.layout.columns) || {}),
      },
    };

    return {
      ...base,
      ...next,
      search: { ...(base.search || {}), ...(next?.search || {}) },
      layout: mergedLayout,
      appearance: { ...(base.appearance || {}), ...(next?.appearance || {}) },
      behavior: { ...(base.behavior || {}), ...(next?.behavior || {}) },
      stage: { ...(base.stage || {}), ...(next?.stage || {}) },
      pod: { ...(base.pod || {}), ...(next?.pod || {}) },
      objects: next?.objects && Array.isArray(next.objects.objects)
        ? { objects: next.objects.objects }
        : base.objects,
    };
  }

  function collapseAll(listEl) {
    listEl.querySelectorAll('.ck-faq__q').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const ans = btn.nextElementSibling;
      if (ans && ans.classList.contains('ck-faq__a')) {
        ans.style.display = 'none';
      }
    });
  }

  function setExpanded(button, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
    const answer = button.nextElementSibling;
    if (answer && answer.classList.contains('ck-faq__a')) {
      answer.style.display = expanded ? 'block' : 'none';
    }
  }

  function renderAnswerHtml(raw, opts) {
    const sanitized = sanitizeInlineHtml(raw);
    if (sanitized) return sanitized;
    const text = sanitizeString(raw);
    const displayImages = !!opts.displayImages;
    const displayVideos = !!opts.displayVideos;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts
      .map((part) => {
        const url = part.trim();
        if (!/^https?:\/\/\S+$/i.test(url)) return escapeHtml(part);
        const lower = url.toLowerCase();
        const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(lower);
        const isYouTube =
          /youtube\.com\/watch\?v=|youtu\.be\//i.test(lower) || /youtube\.com\/embed\//i.test(lower);
        const isVimeo = /vimeo\.com\//i.test(lower);
        const safeUrl = escapeHtml(url);
        if (isImage && displayImages) {
          return `<img src="${safeUrl}" alt="" class="ck-faq__a-img" />`;
        }
        if (displayVideos && (isYouTube || isVimeo)) {
          const src = isYouTube
            ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
            : url;
          const safeSrc = escapeHtml(src);
          return `<div class="ck-faq__a-video"><iframe src="${safeSrc}" loading="lazy" allowfullscreen></iframe></div>`;
        }
        return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>`;
      })
      .join('');
  }

  function renderItems(items, behavior) {
    const listEl = document.querySelector('[data-role="faq-list"]');
    if (!listEl) return;
    lastItems = items;
    listEl.innerHTML = items
      .map((item) => {
        const qText = sanitizeInlineHtml(item.question);
        const answerHtml = renderAnswerHtml(item.answer, behavior);
        return `
          <li class="ck-faq__item">
            <button class="ck-faq__q" type="button" aria-expanded="false">
              <span class="ck-faq__q-text body-m">${qText}</span>
              <span class="ck-faq__q-icon" aria-hidden="true"></span>
            </button>
            <div class="ck-faq__a body-s" role="region">${answerHtml || ''}</div>
          </li>
        `;
      })
      .join('');
  }

  function applySearchFilter(query) {
    const listEl = document.querySelector('.ck-faq__list');
    if (!listEl) return;
    const q = (query || '').trim().toLowerCase();
    currentQuery = q;
    const items = listEl.querySelectorAll('.ck-faq__item');
    let visibleCount = 0;
    items.forEach((item) => {
      const text = (item.textContent || '').toLowerCase();
      const match = !q || text.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) visibleCount += 1;
    });
    const countEl = document.querySelector('[data-role="faq-search-count"]');
    if (countEl instanceof HTMLElement) {
      countEl.hidden = false;
      countEl.textContent = visibleCount === 1 ? '1 result' : `${visibleCount} results`;
    }
    const noResults = document.querySelector('[data-role="faq-noresults"]');
    if (noResults instanceof HTMLElement) {
      noResults.hidden = visibleCount !== 0 || !q;
      noResults.style.display = noResults.hidden ? 'none' : '';
    }
  }

  function wireSearchInput() {
    if (searchInputWired) return;
    const input = document.querySelector('.ck-faq__search input[type="search"]');
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('input', (e) => {
      applySearchFilter((e.target && e.target.value) || '');
    });
    searchInputWired = true;
  }

  function wireAccordion(multiOpen, defaultOpen) {
    const listEl = document.querySelector('.ck-faq__list');
    if (!listEl) return;
    const buttons = listEl.querySelectorAll('.ck-faq__q');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const current = button.getAttribute('aria-expanded') === 'true';
        const next = !current;
        if (!multiOpen) collapseAll(listEl);
        setExpanded(button, next);
      });
    });
    if (defaultOpen === 'first') {
      const first = buttons[0];
      if (first) {
        if (!multiOpen) collapseAll(listEl);
        setExpanded(first, true);
      }
    } else if (defaultOpen === 'none') {
      collapseAll(listEl);
    }
  }

  function applyTemplate(widget, appearance) {
    const template = sanitizeString(appearance.template) || 'background';
    widget.setAttribute('data-template', template);
    const cardBorder = appearance.cardBorder !== false;
    const cardShadow = appearance.cardShadow !== false;
    const cardRadius = typeof appearance.cardRadius === 'string' ? appearance.cardRadius : 'lg';
    const radiusVar = `var(--control-radius-${cardRadius})`;
    widget.style.setProperty('--faq-card-border', cardBorder ? '1px solid var(--color-system-gray-5)' : '1px solid transparent');
    widget.style.setProperty('--faq-card-shadow', cardShadow ? 'var(--shadow-floating)' : 'none');
    widget.style.setProperty('--faq-card-radius', radiusVar);
    if (appearance.itemBackground) {
      widget.style.setProperty('--faq-item-bg', appearance.itemBackground);
    }
    if (appearance.questionColor) {
      widget.style.setProperty('--faq-question-color', appearance.questionColor);
    }
    if (appearance.answerColor) {
      widget.style.setProperty('--faq-answer-color', appearance.answerColor);
    }
    const iconSize = appearance.iconSize === 'lg' ? '1.6rem' : appearance.iconSize === 'sm' ? '1.1rem' : '1.3rem';
    if (iconSize) {
      widget.style.setProperty('--faq-icon-size', iconSize);
    }
    if (appearance.iconColor) {
      widget.style.setProperty('--faq-icon-color', appearance.iconColor);
    }
    const questionSize =
      appearance.questionSize === 'lg'
        ? 'var(--fs-18)'
        : appearance.questionSize === 'sm'
          ? 'var(--fs-14)'
          : 'var(--fs-16)';
    const answerSize = appearance.answerSize === 'md' ? 'var(--fs-14)' : 'var(--fs-13)';
    widget.style.setProperty('--faq-question-size', questionSize);
    widget.style.setProperty('--faq-answer-size', answerSize);
  }

  function applyCustomCss(cssText) {
    const id = 'ck-faq-custom-css';
    let styleEl = document.getElementById(id);
    const css = sanitizeString(cssText);
    if (!css) {
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  function applyCustomJs(jsText, state) {
    const code = sanitizeString(jsText).trim();
    if (!code) return;
    try {
      const fn = new Function('state', code);
      fn(state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[FAQ widget] custom JS error', err);
    }
  }

  function applyState(current) {
    if (!current || typeof current !== 'object') return;
    const title = typeof current.title === 'string' ? current.title : null;
    const showTitle = toBool(current.showTitle, true);
    const displayCategoryTitles = toBool(current.displayCategoryTitles, true);
    const categoryTitle = sanitizeString(current.categoryTitle) || 'All Questions';
    const searchEnabled =
      current.search && Object.prototype.hasOwnProperty.call(current.search, 'enabled')
        ? toBool(current.search.enabled, true)
        : true;
    const searchPlaceholder =
      current.search && typeof current.search.placeholder === 'string'
        ? current.search.placeholder
        : 'Search...';
    const behavior = current.behavior || {};
    const multiOpen = toBool(behavior.multiOpen, false);
    const expandFirst = toBool(behavior.expandFirst, false);
    const expandAll = toBool(behavior.expandAll, false);
    const displayVideos =
      Object.prototype.hasOwnProperty.call(behavior, 'displayVideos') && behavior.displayVideos === false
        ? false
        : true;
    const displayImages =
      Object.prototype.hasOwnProperty.call(behavior, 'displayImages') && behavior.displayImages === false
        ? false
        : true;
    const layout = current.layout || {};
    const layoutType = typeof layout.type === 'string' ? layout.type : 'accordion';
    const searchPlacement = layout.searchPlacement === 'below' ? 'below' : 'title';
    const stageCfg = current.stage || {};
    const podCfg = current.pod || {};
    const stageBg = typeof stageCfg.background === 'string' ? stageCfg.background : null;
    const podBg = typeof podCfg.background === 'string' ? podCfg.background : null;
    const appearance = current.appearance || {};
    const iconStyle = appearance.iconStyle || (appearance.useChevron ? 'arrow' : 'plus');
    const objectsList =
      current.objects && Array.isArray(current.objects.objects) && current.objects.objects.length
        ? current.objects.objects
        : defaultState.objects.objects;

    const stage = document.querySelector('.stage');
    const pod = document.querySelector('.pod');
    if (stage instanceof HTMLElement) {
      stage.style.setProperty('--stage-bg', stageBg || defaultState.stage.background);
      const stageLinked = toBool(stageCfg.paddingLinked, true);
      if (stageLinked) {
        const pad = stageCfg.padding ?? defaultState.stage.padding ?? 0;
        stage.style.padding = `${pad || 0}px`;
      } else {
        const top = stageCfg.paddingTop ?? defaultState.stage.paddingTop ?? stageCfg.padding ?? 0;
        const right = stageCfg.paddingRight ?? defaultState.stage.paddingRight ?? stageCfg.padding ?? 0;
        const bottom = stageCfg.paddingBottom ?? defaultState.stage.paddingBottom ?? stageCfg.padding ?? 0;
        const left = stageCfg.paddingLeft ?? defaultState.stage.paddingLeft ?? stageCfg.padding ?? 0;
        stage.style.padding = `${top || 0}px ${right || 0}px ${bottom || 0}px ${left || 0}px`;
      }
      const align = stageCfg.alignment || defaultState.stage.alignment || 'center';
      const { justify, alignItems } = resolveStageAlignment(align);
      stage.style.justifyContent = justify;
      stage.style.alignItems = alignItems;
    }
    if (pod instanceof HTMLElement) {
      pod.style.setProperty('--pod-bg', podBg || defaultState.pod.background);
      const padLinked = toBool(podCfg.paddingLinked, true);
      if (padLinked) {
        const pad = podCfg.padding ?? defaultState.pod.padding ?? 0;
        pod.style.padding = `${pad || 0}px`;
      } else {
        const top = podCfg.paddingTop ?? defaultState.pod.paddingTop ?? podCfg.padding ?? 0;
        const right = podCfg.paddingRight ?? defaultState.pod.paddingRight ?? podCfg.padding ?? 0;
        const bottom = podCfg.paddingBottom ?? defaultState.pod.paddingBottom ?? podCfg.padding ?? 0;
        const left = podCfg.paddingLeft ?? defaultState.pod.paddingLeft ?? podCfg.padding ?? 0;
        pod.style.padding = `${top || 0}px ${right || 0}px ${bottom || 0}px ${left || 0}px`;
      }
      const linked = toBool(podCfg.radiusLinked, true);
      const resolveRadiusToken = (value, fallback) => {
        if (value === 'none') return '0';
        const v = value || fallback;
        return v ? `var(--control-radius-${v})` : `var(--control-radius-${fallback})`;
      };
      if (linked) {
        pod.style.setProperty('--pod-radius', resolveRadiusToken(podCfg.radius, defaultState.pod.radius || '6xl'));
      } else {
        const tl = resolveRadiusToken(podCfg.radiusTL, defaultState.pod.radiusTL || defaultState.pod.radius || '6xl');
        const tr = resolveRadiusToken(podCfg.radiusTR, defaultState.pod.radiusTR || defaultState.pod.radius || '6xl');
        const br = resolveRadiusToken(podCfg.radiusBR, defaultState.pod.radiusBR || defaultState.pod.radius || '6xl');
        const bl = resolveRadiusToken(podCfg.radiusBL, defaultState.pod.radiusBL || defaultState.pod.radius || '6xl');
        pod.style.setProperty('--pod-radius', `${tl} ${tr} ${br} ${bl}`);
      }
      const widthMode = typeof podCfg.widthMode === 'string' ? podCfg.widthMode : defaultState.pod.widthMode || 'wrap';
      pod.setAttribute('data-width-mode', widthMode);
      const cw = podCfg.contentWidth ?? defaultState.pod.contentWidth;
      if (cw != null && cw !== '') pod.style.setProperty('--content-width', `${cw}px`);
      else pod.style.removeProperty('--content-width');
    }

    const titleEl = document.querySelector('.ck-faq__title');
    const header = document.querySelector('.ck-faq__header');
    if (titleEl) titleEl.textContent = title || 'Frequently Asked Questions';
    if (header instanceof HTMLElement) header.style.display = showTitle ? '' : 'none';

    const searchWrapper = document.querySelector('.ck-faq__search');
    if (searchWrapper instanceof HTMLElement) {
      searchWrapper.hidden = !searchEnabled;
      searchWrapper.style.display = searchEnabled ? '' : 'none';
      const input = searchWrapper.querySelector('input[type="search"]');
      if (input instanceof HTMLInputElement) {
        input.placeholder = searchPlaceholder || '';
        if (!currentQuery) {
          input.value = '';
        }
        if (!searchEnabled) {
          input.value = '';
          applySearchFilter('');
        }
      }
    }

    const categoryLabel = document.querySelector('.ck-faq__category');
    if (categoryLabel instanceof HTMLElement) {
      categoryLabel.hidden = !displayCategoryTitles;
      categoryLabel.textContent = categoryTitle;
    }

    const widget = document.querySelector('.ck-faq-widget');
    if (widget instanceof HTMLElement) {
      applyTemplate(widget, appearance);
      const gapPx =
        typeof layout.gap === 'number'
          ? layout.gap
          : Number.isFinite(Number(layout.gap))
          ? Number(layout.gap)
          : 16;
      const paddingPx =
        typeof layout.padding === 'number'
          ? layout.padding
          : Number.isFinite(Number(layout.padding))
          ? Number(layout.padding)
          : 24;
      widget.style.setProperty('--layout-gap', `${gapPx}px`);
      widget.style.setProperty('--layout-padding', `${paddingPx}px`);
      const colDesktop = layout.columns && layout.columns.desktop ? Number(layout.columns.desktop) : 2;
      const colTablet = layout.columns && layout.columns.tablet ? Number(layout.columns.tablet) : 2;
      const colMobile = layout.columns && layout.columns.mobile ? Number(layout.columns.mobile) : 1;
      widget.style.setProperty('--faq-columns-desktop', Math.max(1, colDesktop));
      widget.style.setProperty('--faq-columns-tablet', Math.max(1, colTablet));
      widget.style.setProperty('--faq-columns-mobile', Math.max(1, colMobile));
    }

    const faqRoot = document.querySelector('.ck-faq');
    if (faqRoot instanceof HTMLElement) {
      const iconMode = iconStyle === 'arrow' ? 'chevron' : 'plus';
      faqRoot.setAttribute('data-icon-style', iconMode);
      faqRoot.setAttribute('data-layout', layoutType);
      faqRoot.setAttribute('data-search-placement', searchPlacement);
      faqRoot.setAttribute('data-expanded-all', layoutType === 'accordion' ? 'false' : 'true');
    }

    const flatItems = objectsList.map((obj) => ({
      id: obj.id || `item_${Math.random().toString(16).slice(2)}`,
      question: obj.payload?.question,
      answer: obj.payload?.answer,
      defaultOpen: toBool(obj.payload?.defaultOpen, false),
    }));

    renderItems(flatItems, { displayVideos, displayImages });
    const emptyEl = document.querySelector('[data-role="faq-empty"]');
    if (emptyEl instanceof HTMLElement) {
      emptyEl.hidden = flatItems.length > 0;
      emptyEl.style.display = flatItems.length > 0 ? 'none' : '';
    }
    wireSearchInput();


    const anyDefaultOpen = flatItems.some((item) => toBool(item.defaultOpen, false));

    if (layoutType === 'list' || layoutType === 'multicolumn') {
      const listEl = document.querySelector('.ck-faq__list');
      if (listEl) {
        const buttons = listEl.querySelectorAll('.ck-faq__q');
        buttons.forEach((button) => {
          setExpanded(button, true);
          button.style.cursor = 'default';
          button.setAttribute('tabindex', '-1');
        });
      }
    } else {
      const defaultOpen = anyDefaultOpen ? 'none' : expandFirst ? 'first' : 'none';
      const listEl = document.querySelector('.ck-faq__list');
      if (listEl) {
        const buttons = listEl.querySelectorAll('.ck-faq__q');
        buttons.forEach((button, idx) => {
          const shouldOpen = toBool(flatItems[idx]?.defaultOpen, false);
          if (shouldOpen) setExpanded(button, true);
        });
      }
      wireAccordion(multiOpen, defaultOpen);
    }

    if (expandAll && layoutType === 'accordion') {
      const listEl = document.querySelector('.ck-faq__list');
      if (listEl) {
        const buttons = listEl.querySelectorAll('.ck-faq__q');
        buttons.forEach((btn) => setExpanded(btn, true));
      }
    }

    applySearchFilter(currentQuery);
    applyCustomCss(current.customCss);

    if (behavior.customJs) {
      applyCustomJs(behavior.customJs, current);
    }

    const backlink = document.querySelector('[data-role="faq-backlink"]');
    if (backlink instanceof HTMLElement) {
      backlink.hidden = !toBool(behavior.showBacklink, true);
      backlink.style.display = toBool(behavior.showBacklink, true) ? '' : 'none';
    }

  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'faq') return;
    state = mergeState(state, data.state || {});
    applyState(state);
  });

  applyState(state);
})();

  function resolveStageAlignment(value) {
    switch (value) {
      case 'left':
        return { justify: 'flex-start', alignItems: 'center' };
      case 'right':
        return { justify: 'flex-end', alignItems: 'center' };
      case 'top':
        return { justify: 'center', alignItems: 'flex-start' };
      case 'bottom':
        return { justify: 'center', alignItems: 'flex-end' };
      case 'center':
      default:
        return { justify: 'center', alignItems: 'center' };
    }
  }
