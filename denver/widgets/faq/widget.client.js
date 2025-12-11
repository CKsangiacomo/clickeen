// FAQ widget client-side behavior
// Expand/collapse + live title updates from Bob editing state + appearance controls.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let lastItems = [];

  const initial = window.CK_WIDGET?.state || {};
  let state = structuredClone(initial);

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
        const questionRaw = item.question || 'Type your question';
        const answerRaw = item.answer || 'Type your answer';
        const qText = sanitizeInlineHtml(questionRaw);
        const answerHtml = renderAnswerHtml(answerRaw, behavior);
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
    const template = sanitizeString(appearance.template);
    if (template) widget.setAttribute('data-template', template);
    else widget.removeAttribute('data-template');

    widget.style.setProperty('--faq-card-border', appearance.cardBorder === true ? '1px solid var(--color-system-gray-5)' : '1px solid transparent');
    widget.style.setProperty('--faq-card-shadow', appearance.cardShadow === true ? 'var(--shadow-floating)' : 'none');
    if (typeof appearance.cardRadius === 'string') {
      widget.style.setProperty('--faq-card-radius', `var(--control-radius-${appearance.cardRadius})`);
    } else {
      widget.style.removeProperty('--faq-card-radius');
    }

    widget.style.setProperty('--faq-card-bg', appearance.cardBackground || 'transparent');
    if (appearance.itemBackground) widget.style.setProperty('--faq-item-bg', appearance.itemBackground);
    else widget.style.removeProperty('--faq-item-bg');
    if (appearance.questionColor) widget.style.setProperty('--faq-question-color', appearance.questionColor);
    else widget.style.removeProperty('--faq-question-color');
    if (appearance.answerColor) widget.style.setProperty('--faq-answer-color', appearance.answerColor);
    else widget.style.removeProperty('--faq-answer-color');

    const iconSize =
      appearance.iconSize === 'lg'
        ? '1.6rem'
        : appearance.iconSize === 'sm'
          ? '1.1rem'
          : appearance.iconSize === 'md'
            ? '1.3rem'
            : null;
    if (iconSize) widget.style.setProperty('--faq-icon-size', iconSize);
    else widget.style.removeProperty('--faq-icon-size');

    if (appearance.iconColor) {
      widget.style.setProperty('--faq-icon-color', appearance.iconColor);
    } else {
      widget.style.removeProperty('--faq-icon-color');
    }

    const questionSize =
      appearance.questionSize === 'lg'
        ? 'var(--fs-18)'
        : appearance.questionSize === 'sm'
          ? 'var(--fs-14)'
          : appearance.questionSize === 'md'
            ? 'var(--fs-16)'
            : null;
    const answerSize = appearance.answerSize === 'md' ? 'var(--fs-14)' : appearance.answerSize === 'sm' ? 'var(--fs-13)' : null;
    if (questionSize) widget.style.setProperty('--faq-question-size', questionSize);
    else widget.style.removeProperty('--faq-question-size');
    if (answerSize) widget.style.setProperty('--faq-answer-size', answerSize);
    else widget.style.removeProperty('--faq-answer-size');
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
    const title = sanitizeString(current.title);
    const showTitle = toBool(current.showTitle, false);
    const displayCategoryTitles = toBool(current.displayCategoryTitles, false);
    const categoryTitle = sanitizeString(current.categoryTitle);
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
    const stageCfg = current.stage || {};
    const podCfg = current.pod || {};
    const stageBg = typeof stageCfg.background === 'string' ? stageCfg.background : null;
    const podBg = typeof podCfg.background === 'string' ? podCfg.background : null;
    const appearance = current.appearance || {};
    const iconStyle = appearance.iconStyle || (appearance.useChevron ? 'arrow' : 'plus');
    const objectsList =
      current.objects && Array.isArray(current.objects.objects) ? current.objects.objects : [];

    const stage = document.querySelector('.stage');
    const pod = document.querySelector('.pod');
    if (stage instanceof HTMLElement) {
      if (stageBg) {
        stage.style.setProperty('--stage-bg', stageBg);
        stage.style.background = stageBg;
      } else {
        stage.style.removeProperty('--stage-bg');
        stage.style.background = 'none';
      }

      const stageLinked = typeof stageCfg.paddingLinked === 'boolean' ? stageCfg.paddingLinked : null;
      const hasStagePadding =
        stageCfg.padding !== undefined ||
        stageCfg.paddingTop !== undefined ||
        stageCfg.paddingRight !== undefined ||
        stageCfg.paddingBottom !== undefined ||
        stageCfg.paddingLeft !== undefined;
      if (hasStagePadding) {
        if (stageLinked === false) {
          const top = stageCfg.paddingTop ?? stageCfg.padding;
          const right = stageCfg.paddingRight ?? stageCfg.padding;
          const bottom = stageCfg.paddingBottom ?? stageCfg.padding;
          const left = stageCfg.paddingLeft ?? stageCfg.padding;
          stage.style.padding = `${top || 0}px ${right || 0}px ${bottom || 0}px ${left || 0}px`;
        } else {
          const pad = stageCfg.padding;
          stage.style.padding = pad !== undefined ? `${pad || 0}px` : '';
        }
      } else {
        stage.style.padding = '';
      }
      const align = stageCfg.alignment;
      if (align) {
        const { justify, alignItems } = resolveStageAlignment(align);
        stage.style.justifyContent = justify;
        stage.style.alignItems = alignItems;
      }
    }
    if (pod instanceof HTMLElement) {
      if (podBg) {
        pod.style.setProperty('--pod-bg', podBg);
        pod.style.background = podBg;
      } else {
        pod.style.removeProperty('--pod-bg');
        pod.style.background = 'none';
      }

      const padLinked = typeof podCfg.paddingLinked === 'boolean' ? podCfg.paddingLinked : null;
      const hasPodPadding =
        podCfg.padding !== undefined ||
        podCfg.paddingTop !== undefined ||
        podCfg.paddingRight !== undefined ||
        podCfg.paddingBottom !== undefined ||
        podCfg.paddingLeft !== undefined;
      if (hasPodPadding) {
        if (padLinked === false) {
          const top = podCfg.paddingTop ?? podCfg.padding;
          const right = podCfg.paddingRight ?? podCfg.padding;
          const bottom = podCfg.paddingBottom ?? podCfg.padding;
          const left = podCfg.paddingLeft ?? podCfg.padding;
          pod.style.padding = `${top || 0}px ${right || 0}px ${bottom || 0}px ${left || 0}px`;
        } else {
          const pad = podCfg.padding;
          pod.style.padding = pad !== undefined ? `${pad || 0}px` : '';
        }
      } else {
        pod.style.padding = '';
      }

      const resolveRadiusToken = (value) => {
        if (value === 'none') return '0';
        return value ? `var(--control-radius-${value})` : '';
      };
      const radiusLinked = typeof podCfg.radiusLinked === 'boolean' ? podCfg.radiusLinked : null;
      if (
        podCfg.radius !== undefined ||
        podCfg.radiusTL !== undefined ||
        podCfg.radiusTR !== undefined ||
        podCfg.radiusBR !== undefined ||
        podCfg.radiusBL !== undefined
      ) {
        if (radiusLinked === false) {
          const tl = resolveRadiusToken(podCfg.radiusTL ?? podCfg.radius);
          const tr = resolveRadiusToken(podCfg.radiusTR ?? podCfg.radius);
          const br = resolveRadiusToken(podCfg.radiusBR ?? podCfg.radius);
          const bl = resolveRadiusToken(podCfg.radiusBL ?? podCfg.radius);
          pod.style.setProperty('--pod-radius', `${tl} ${tr} ${br} ${bl}`.trim());
        } else {
          pod.style.setProperty('--pod-radius', resolveRadiusToken(podCfg.radius));
        }
      } else {
        pod.style.removeProperty('--pod-radius');
      }

      if (typeof podCfg.widthMode === 'string') {
        pod.setAttribute('data-width-mode', podCfg.widthMode);
      } else {
        pod.removeAttribute('data-width-mode');
      }
      if (podCfg.contentWidth !== undefined && podCfg.contentWidth !== null && podCfg.contentWidth !== '') {
        pod.style.setProperty('--content-width', `${podCfg.contentWidth}px`);
      } else {
        pod.style.removeProperty('--content-width');
      }
    }

    const titleEl = document.querySelector('.ck-faq__title');
    const header = document.querySelector('.ck-faq__header');
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.style.display = showTitle ? '' : 'none';
      titleEl.hidden = !showTitle;
    }
    if (header instanceof HTMLElement) {
      header.style.display = '';
      header.hidden = false;
    }

    const categoryLabel = document.querySelector('.ck-faq__category');
    if (categoryLabel instanceof HTMLElement) {
      categoryLabel.hidden = !displayCategoryTitles;
      categoryLabel.textContent = categoryTitle;
    }

    const widget = document.querySelector('.ck-faq');
    if (widget instanceof HTMLElement) {
      applyTemplate(widget, appearance);
      const gapPx =
        typeof layout.gap === 'number'
          ? layout.gap
          : Number.isFinite(Number(layout.gap))
          ? Number(layout.gap)
          : null;
      const paddingPx =
        typeof layout.padding === 'number'
          ? layout.padding
          : Number.isFinite(Number(layout.padding))
          ? Number(layout.padding)
          : null;
      if (gapPx !== null) widget.style.setProperty('--layout-gap', `${gapPx}px`);
      else widget.style.removeProperty('--layout-gap');
      if (paddingPx !== null) widget.style.setProperty('--layout-padding', `${paddingPx}px`);
      else widget.style.removeProperty('--layout-padding');
      const colDesktop = layout.columns && layout.columns.desktop ? Number(layout.columns.desktop) : null;
      const colTablet = layout.columns && layout.columns.tablet ? Number(layout.columns.tablet) : null;
      const colMobile = layout.columns && layout.columns.mobile ? Number(layout.columns.mobile) : null;
      if (colDesktop) widget.style.setProperty('--faq-columns-desktop', Math.max(1, colDesktop));
      if (colTablet) widget.style.setProperty('--faq-columns-tablet', Math.max(1, colTablet));
      if (colMobile) widget.style.setProperty('--faq-columns-mobile', Math.max(1, colMobile));
    }

    const faqRoot = document.querySelector('.ck-faq');
    if (faqRoot instanceof HTMLElement) {
      const iconMode = iconStyle === 'arrow' ? 'chevron' : 'plus';
      faqRoot.setAttribute('data-icon-style', iconMode);
      faqRoot.setAttribute('data-layout', layoutType);
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
