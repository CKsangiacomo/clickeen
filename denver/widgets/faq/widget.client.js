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

  const faqRoot = widgetRoot.querySelector('[data-role="faq"]');
  if (!(faqRoot instanceof HTMLElement)) {
    throw new Error('[FAQ] Missing [data-role="faq"] root');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeInlineHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(html);
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

  function renderAnswerHtml(text, behavior) {
    if (!text) return '';

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = String(text).split(urlRegex);
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

        if (isImage && behavior.displayImages === true) {
          return `<img src="${safeUrl}" alt="" class="ck-faq__a-img" />`;
        }
        if (behavior.displayVideos === true && (isYouTube || isVimeo)) {
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

  function collapseAll(listEl) {
    listEl.querySelectorAll('.ck-faq__q').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      const ans = button.nextElementSibling;
      if (ans && ans.classList.contains('ck-faq__a')) ans.style.display = 'none';
    });
  }

  function setExpanded(button, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
    const ans = button.nextElementSibling;
    if (ans && ans.classList.contains('ck-faq__a')) {
      ans.style.display = expanded ? '' : 'none';
    }
  }

  function wireAccordion(listEl, multiOpen) {
    const buttons = listEl.querySelectorAll('.ck-faq__q');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        const next = !isOpen;
        if (!multiOpen) collapseAll(listEl);
        setExpanded(button, next);
      });
    });
  }

  function renderItems(sections, behavior, displayCategoryTitles) {
    const listEl = faqRoot.querySelector('[data-role="faq-list"]');
    if (!(listEl instanceof HTMLElement)) return;

    const markup = sections
      .map((section) => {
        const header = displayCategoryTitles
          ? `<li class="ck-faq__category" data-role="faq-section-title" role="presentation">${escapeHtml(
              section.title,
            )}</li>`
          : '';

        const items = section.faqs
          .map((item) => {
            const qText = sanitizeInlineHtml(item.question);
            const answerHtml = renderAnswerHtml(item.answer, behavior);
            return `
              <li class="ck-faq__item" data-role="faq-item">
                <button class="ck-faq__q" data-role="faq-question" type="button" aria-expanded="false">
                  <span class="ck-faq__q-text" data-role="faq-question-text">${qText}</span>
                  <span class="ck-faq__q-icon diet-btn-ic" data-size="md" data-variant="neutral" aria-hidden="true">
                    <span class="diet-btn-ic__icon"></span>
                  </span>
                </button>
                <div class="ck-faq__a" data-role="faq-answer" role="region">${answerHtml}</div>
              </li>
            `;
          })
          .join('');

        return header + items;
      })
      .join('');

    listEl.innerHTML = markup;
  }

  function applyAppearance(appearance) {
    faqRoot.style.setProperty('--faq-item-bg', appearance.itemBackground);
    faqRoot.style.setProperty('--faq-question-color', appearance.questionColor);
    faqRoot.style.setProperty('--faq-answer-color', appearance.answerColor);
  }

  function applyLayout(layout) {
    faqRoot.style.setProperty('--layout-gap', `${layout.gap}px`);
    faqRoot.style.setProperty('--faq-columns-desktop', String(layout.columns.desktop));
    faqRoot.style.setProperty('--faq-columns-tablet', String(layout.columns.tablet));
    faqRoot.style.setProperty('--faq-columns-mobile', String(layout.columns.mobile));
    faqRoot.setAttribute('data-layout', layout.type);
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
    faqRoot.setAttribute('data-icon-style', iconStyle);
  }

  function applyState(state) {
    if (window.CKStagePod?.applyStagePod) {
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);
    }

    if (window.CKTypography?.applyTypography) {
      window.CKTypography.applyTypography(state.typography, faqRoot, {
        title: { varKey: 'title' },
        section: { varKey: 'section' },
        question: { varKey: 'question' },
        answer: { varKey: 'answer' },
      });
    }

    const titleEl = faqRoot.querySelector('[data-role="faq-title"]');
    if (titleEl instanceof HTMLElement) {
      titleEl.textContent = state.title;
      titleEl.hidden = state.showTitle !== true;
      titleEl.style.display = state.showTitle === true ? '' : 'none';
    }

    applyAccordionIcons(state.appearance.iconStyle);

    applyAppearance(state.appearance);
    applyLayout(state.layout);
    renderItems(state.sections, state.behavior, state.displayCategoryTitles === true);

    const emptyEl = faqRoot.querySelector('[data-role="faq-empty"]');
    const hasAny = state.sections.some((section) => section.faqs.length > 0);
    faqRoot.setAttribute('data-state', hasAny ? 'ready' : 'empty');
    if (emptyEl instanceof HTMLElement) emptyEl.hidden = hasAny;

    const listEl = faqRoot.querySelector('.ck-faq__list');
    if (!(listEl instanceof HTMLElement)) return;

    if (state.layout.type === 'list' || state.layout.type === 'multicolumn') {
      listEl.querySelectorAll('.ck-faq__q').forEach((button) => {
        setExpanded(button, true);
        button.style.cursor = 'default';
        button.setAttribute('tabindex', '-1');
      });
      return;
    }

    const buttons = listEl.querySelectorAll('.ck-faq__q');
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

    wireAccordion(listEl, state.behavior.multiOpen === true);

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
