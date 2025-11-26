// FAQ widget client-side behavior
// Expand/collapse + live title updates from Bob editing state + appearance controls.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let currentCategory = 'all';
  let currentQuery = '';
  let searchInputWired = false;
  let lastItems = [];
  const fallbackItems = [
    {
      id: 'q1',
      question: 'Can I cancel my subscription at anytime?',
      answer: 'Sure. Your paid subscription can be cancelled anytime by shifting to Lite plan.',
      category: 'All Questions',
    },
    { id: 'q2', question: 'Can I change my plan later on?', answer: '', category: 'All Questions' },
    {
      id: 'q3',
      question: 'Will you renew my subscription automatically?',
      answer: '',
      category: 'All Questions',
    },
    { id: 'q4', question: 'Do you offer any discounts?', answer: '', category: 'All Questions' },
    { id: 'q5', question: 'Can I request a refund?', answer: '', category: 'All Questions' },
    { id: 'q6', question: 'First question', answer: '', category: 'New Category' },
  ];

  function sanitizeString(value) {
    return typeof value === 'string' ? value : '';
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
        const catRaw = sanitizeString(item.category) || 'All Questions';
        const cat = escapeHtml(catRaw);
        const qText = escapeHtml(sanitizeString(item.question));
        const answerHtml = renderAnswerHtml(item.answer, behavior);
        const ctaText = sanitizeString(item.ctaText);
        const ctaHref = sanitizeString(item.ctaHref);
        const mediaUrl = sanitizeString(item.mediaUrl);
        const hasCta = Boolean(ctaText && ctaHref);
        const hasMedia = Boolean(mediaUrl);
        const mediaBlock = hasMedia
          ? `<div class="ck-faq__a-media"><img src="${escapeHtml(mediaUrl)}" alt="" class="ck-faq__a-img" loading="lazy" /></div>`
          : '';
        const ctaBlock = hasCta
          ? `<div class="ck-faq__cta"><a href="${escapeHtml(ctaHref)}" target="_blank" rel="noreferrer">${escapeHtml(ctaText)}</a></div>`
          : '';
        return `
          <li class="ck-faq__item" data-category="${cat}">
            <button class="ck-faq__q" type="button" aria-expanded="false">
              <span class="ck-faq__q-text">${qText}</span>
              <span class="ck-faq__q-icon" aria-hidden="true"></span>
            </button>
            <div class="ck-faq__a" role="region">${answerHtml || ''}${mediaBlock}${ctaBlock}</div>
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
      const cat = item.getAttribute('data-category') || 'All Questions';
      const matchCategory = currentCategory === 'all' || cat === currentCategory;
      const match = (!q || text.includes(q)) && matchCategory;
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
      noResults.hidden = visibleCount !== 0 || (!q && currentCategory === 'all');
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

  function wireCategoriesNavigation(showCategories, items) {
    const nav = document.querySelector('[data-role="faq-nav"]');
    if (!(nav instanceof HTMLElement)) return;
    const categories = Array.from(new Set(items.map((i) => sanitizeString(i.category) || 'All Questions')));
    if (!showCategories) {
      nav.hidden = true;
      currentCategory = 'all';
      applySearchFilter(currentQuery);
      nav.innerHTML = '';
      return;
    }

    nav.hidden = false;
    nav.innerHTML =
      `<button class="ck-faq__nav-item ck-faq__nav-item--active" type="button" data-category="all">All Questions</button>` +
      categories
        .filter((cat) => cat !== 'All Questions')
        .map(
          (cat) =>
            `<button class="ck-faq__nav-item" type="button" data-category="${escapeHtml(cat)}">${escapeHtml(
              cat
            )}</button>`
        )
        .join('');

    const navItems = nav.querySelectorAll('.ck-faq__nav-item');
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category') || 'all';
        currentCategory = cat;
        navItems.forEach((el) => el.classList.toggle('ck-faq__nav-item--active', el === btn));
        applySearchFilter(currentQuery);
      });
    });
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

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    const title = typeof state.title === 'string' ? state.title : null;
    const showTitle = toBool(state.showTitle, true);
    const displayCategoryTitles = toBool(state.displayCategoryTitles, true);
    const categoryTitle = sanitizeString(state.categoryTitle) || 'All Questions';
    const searchEnabled =
      state.search && Object.prototype.hasOwnProperty.call(state.search, 'enabled')
        ? toBool(state.search.enabled, true)
        : true;
    const searchPlaceholder =
      state.search && typeof state.search.placeholder === 'string'
        ? state.search.placeholder
        : 'Search...';
    const behavior = state.behavior || {};
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
    const layout = state.layout || {};
    const layoutType = typeof layout.type === 'string' ? layout.type : 'accordion';
    const searchPlacement = layout.searchPlacement === 'below' ? 'below' : 'title';
    const stageBg = state.stage && typeof state.stage.background === 'string' ? state.stage.background : null;
    const podBg = state.pod && typeof state.pod.background === 'string' ? state.pod.background : null;
    const appearance = state.appearance || {};
    const iconStyle = appearance.iconStyle || (appearance.useChevron ? 'arrow' : 'plus');
    const items = Array.isArray(state.items) ? state.items : [];

    const stage = document.querySelector('.stage');
    const pod = document.querySelector('.pod');
    if (stage instanceof HTMLElement) {
      stage.style.setProperty('--stage-bg', stageBg || 'transparent');
    }
    if (pod instanceof HTMLElement) {
      pod.style.setProperty('--pod-bg', podBg || 'transparent');
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
      const gapPx = typeof layout.gap === 'number' ? layout.gap : 16;
      const paddingPx = typeof layout.padding === 'number' ? layout.padding : 24;
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

    const navSticky = toBool(layout.stickyNav, false);
    const navEl = document.querySelector('.ck-faq__controls');
    if (navEl) {
      navEl.setAttribute('data-sticky', navSticky ? 'true' : 'false');
    }

    currentCategory = 'all';

    const normalized = items.map((item) => ({
      id: item.id || `item_${Math.random().toString(16).slice(2)}`,
      question: item.question,
      answer: item.answer,
      category: item.category || 'All Questions',
      defaultOpen: toBool(item.defaultOpen, false),
      ctaText: item.ctaText,
      ctaHref: item.ctaHref,
      mediaUrl: item.mediaUrl,
    }));

    const shuffle = toBool(behavior.shuffle, false);
    const shuffled = shuffle ? [...normalized].sort(() => Math.random() - 0.5) : normalized;

    renderItems(shuffled, { displayVideos, displayImages });
    const emptyEl = document.querySelector('[data-role="faq-empty"]');
    if (emptyEl instanceof HTMLElement) {
      emptyEl.hidden = shuffled.length > 0;
      emptyEl.style.display = shuffled.length > 0 ? 'none' : '';
    }
    wireCategoriesNavigation(toBool(layout.showCategories, true), shuffled);
    wireSearchInput();

    const anyDefaultOpen = shuffled.some((item) => toBool(item.defaultOpen, false));

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
          const shouldOpen = toBool(shuffled[idx]?.defaultOpen, false);
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
    applyCustomCss(state.customCss);

    if (behavior.customJs) {
      applyCustomJs(behavior.customJs, state);
    }

    const backlink = document.querySelector('[data-role="faq-backlink"]');
    if (backlink instanceof HTMLElement) {
      backlink.hidden = !toBool(behavior.showBacklink, true);
      backlink.style.display = toBool(behavior.showBacklink, true) ? '' : 'none';
    }

    const btnExpandAll = document.querySelector('[data-role="expand-all"]');
    if (btnExpandAll instanceof HTMLButtonElement) {
      btnExpandAll.style.display = layoutType === 'accordion' ? '' : 'none';
      btnExpandAll.onclick = () => {
        const listEl = document.querySelector('.ck-faq__list');
        if (!listEl) return;
        listEl.querySelectorAll('.ck-faq__q').forEach((btn) => setExpanded(btn, true));
      };
    }
    const btnCollapseAll = document.querySelector('[data-role="collapse-all"]');
    if (btnCollapseAll instanceof HTMLButtonElement) {
      btnCollapseAll.style.display = layoutType === 'accordion' ? '' : 'none';
      btnCollapseAll.onclick = () => {
        const listEl = document.querySelector('.ck-faq__list');
        if (!listEl) return;
        collapseAll(listEl);
      };
    }
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'faq') return;
    applyState(data.state || {});
  });

  // Initial render with defaults so the widget is not empty before state arrives.
  applyState({
    title: 'Frequently Asked Questions',
    showTitle: true,
    categoryTitle: 'All Questions',
    displayCategoryTitles: true,
    search: { enabled: true, placeholder: 'Search...' },
    layout: { type: 'accordion', searchPlacement: 'title', showCategories: true },
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
      multiOpen: false,
      displayVideos: true,
      displayImages: true,
      customJs: '',
    },
    stage: { background: 'var(--color-system-gray-5)' },
    pod: { background: 'var(--color-system-white)' },
    customCss: '',
    items: fallbackItems,
  });
})();
