// Logo Showcase widget runtime (strict, deterministic)
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const widgetRoot = scriptEl.closest('[data-ck-widget="logoshowcase"]');
  if (!(widgetRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] widget.client.js must be inside [data-ck-widget="logoshowcase"]');
  }

  const lsRoot = widgetRoot.querySelector('[data-role="logoshowcase"]');
  if (!(lsRoot instanceof HTMLElement)) {
    throw new Error('[LogoShowcase] Missing [data-role="logoshowcase"] root');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapSpeedToDuration(speed) {
    // speed 1=60s (slow), 10=10s (fast)
    return 70 - (speed * 6);
  }

  function renderLogos(track, logos, mode) {
    if (!track) return;
    
    const items = logos.map(logo => {
      const linkAttrs = logo.link 
        ? `href="${escapeHtml(logo.link)}"${logo.openInNewTab ? ' target="_blank"' : ''}${logo.nofollow ? ' rel="nofollow noopener"' : ' rel="noopener"'}`
        : '';
      
      const img = `<img src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.alt || '')}" loading="lazy" />`;
      
      return `
        <div class="ck-ls__item" data-role="logo-item">
          ${logo.link ? `<a ${linkAttrs}>${img}</a>` : img}
        </div>
      `;
    }).join('');
    
    // Duplicate logos for seamless ticker loop
    if (mode === 'ticker') {
      track.innerHTML = items + items;
    } else {
      track.innerHTML = items;
    }
  }

  function applyLayout(state) {
    const mode = state.layout.mode;
    lsRoot.setAttribute('data-layout', mode);
    
    // CSS variables for sizing
    lsRoot.style.setProperty('--ls-logo-size', `${state.layout.logoSize}px`);
    lsRoot.style.setProperty('--ls-spacing', `${state.layout.spacing}px`);
    lsRoot.style.setProperty('--content-width', `${state.layout.width}px`);
    
    // Responsive variables
    lsRoot.style.setProperty('--ls-tablet-logo-size', `${state.responsive.tablet.logoSize}px`);
    lsRoot.style.setProperty('--ls-tablet-spacing', `${state.responsive.tablet.spacing}px`);
    lsRoot.style.setProperty('--ls-mobile-logo-size', `${state.responsive.mobile.logoSize}px`);
    lsRoot.style.setProperty('--ls-mobile-spacing', `${state.responsive.mobile.spacing}px`);
    
    // Layout-specific settings
    if (mode === 'ticker') {
      const duration = mapSpeedToDuration(state.layout.ticker.speed);
      lsRoot.style.setProperty('--ls-ticker-duration', `${duration}s`);
      lsRoot.setAttribute('data-ticker-direction', state.layout.ticker.direction);
      lsRoot.setAttribute('data-pause-on-hover', String(state.layout.ticker.pauseOnHover));
    }
    
    if (mode === 'carousel') {
      lsRoot.setAttribute('data-show-arrows', String(state.layout.carousel.showArrows));
    }
    
    if (mode === 'grid') {
      lsRoot.style.setProperty('--ls-grid-cols', String(state.layout.grid.columnsDesktop));
      lsRoot.style.setProperty('--ls-grid-cols-tablet', String(state.layout.grid.columnsTablet));
      lsRoot.style.setProperty('--ls-grid-cols-mobile', String(state.layout.grid.columnsMobile));
    }
  }

  function applyAppearance(state) {
    lsRoot.setAttribute('data-color-scheme', state.appearance.colorScheme);
    lsRoot.setAttribute('data-hover-effect', state.appearance.hoverEffect);
    
    if (state.appearance.colorScheme === 'custom') {
      lsRoot.style.setProperty('--ls-custom-color', state.appearance.customColor);
    }
  }

  function applyStyle(state) {
    lsRoot.style.setProperty('--ls-title-color', state.style.titleColor);
    lsRoot.style.setProperty('--ls-caption-color', state.style.captionColor);
    lsRoot.style.setProperty('--ls-links-color', state.style.linksColor);
    lsRoot.style.setProperty('--ls-button-bg', state.style.buttonColor);
    lsRoot.style.setProperty('--ls-button-color', state.style.buttonTextColor);
    lsRoot.style.setProperty('--ls-button-radius', `${state.style.buttonRadius}px`);
    
    // Title styling
    lsRoot.style.setProperty('--ls-title-weight', state.header.titleBold ? '700' : '600');
    lsRoot.style.setProperty('--ls-title-style', state.header.titleItalic ? 'italic' : 'normal');
    
    // Caption styling
    lsRoot.style.setProperty('--ls-caption-weight', state.header.captionBold ? '600' : '400');
    lsRoot.style.setProperty('--ls-caption-style', state.header.captionItalic ? 'italic' : 'normal');
  }

  function applyHeader(state) {
    const headerEl = lsRoot.querySelector('[data-role="header"]');
    const titleEl = lsRoot.querySelector('[data-role="title"]');
    const captionEl = lsRoot.querySelector('[data-role="caption"]');
    
    if (headerEl) {
      headerEl.hidden = state.header.show !== true;
      headerEl.style.textAlign = state.header.alignment;
      lsRoot.style.setProperty('--ls-header-align', state.header.alignment);
    }
    
    if (titleEl) titleEl.innerHTML = state.header.title || '';
    if (captionEl) captionEl.innerHTML = state.header.caption || '';
  }

  function applyButton(state) {
    const ctaEl = lsRoot.querySelector('[data-role="cta"]');
    const buttonEl = lsRoot.querySelector('[data-role="button"]');
    const buttonTextEl = lsRoot.querySelector('[data-role="button-text"]');
    const iconBeforeEl = lsRoot.querySelector('[data-role="button-icon-before"]');
    const iconAfterEl = lsRoot.querySelector('[data-role="button-icon-after"]');
    
    if (ctaEl) {
      ctaEl.hidden = state.button.show !== true;
      ctaEl.style.textAlign = state.button.alignment;
      lsRoot.style.setProperty('--ls-button-align', state.button.alignment);
    }
    
    if (buttonEl) {
      buttonEl.href = state.button.url || '#';
    }
    
    if (buttonTextEl) {
      buttonTextEl.textContent = state.button.text;
    }
    
    // Handle button icon
    const hasIcon = state.button.icon && state.button.icon.length > 0;
    const iconPosition = state.button.iconPosition || 'before';
    
    if (iconBeforeEl) {
      iconBeforeEl.setAttribute('data-visible', String(hasIcon && iconPosition === 'before'));
      if (hasIcon && iconPosition === 'before') {
        iconBeforeEl.innerHTML = `<span class="diet-btn-ic__icon" data-icon="${escapeHtml(state.button.icon)}"></span>`;
      } else {
        iconBeforeEl.innerHTML = '';
      }
    }
    
    if (iconAfterEl) {
      iconAfterEl.setAttribute('data-visible', String(hasIcon && iconPosition === 'after'));
      if (hasIcon && iconPosition === 'after') {
        iconAfterEl.innerHTML = `<span class="diet-btn-ic__icon" data-icon="${escapeHtml(state.button.icon)}"></span>`;
      } else {
        iconAfterEl.innerHTML = '';
      }
    }
  }

  let carouselPosition = 0;
  let autoSlideInterval = null;

  function wireCarousel(state) {
    if (state.layout.mode !== 'carousel') {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
        autoSlideInterval = null;
      }
      return;
    }
    
    const prevBtn = lsRoot.querySelector('[data-role="nav-prev"]');
    const nextBtn = lsRoot.querySelector('[data-role="nav-next"]');
    const track = lsRoot.querySelector('[data-role="logo-track"]');
    
    if (!prevBtn || !nextBtn || !track) return;
    
    const itemWidth = state.layout.logoSize + state.layout.spacing;
    const maxScroll = Math.max(0, (state.logos.length - state.layout.carousel.itemsVisible) * itemWidth);
    
    function goNext() {
      carouselPosition = Math.min(maxScroll, carouselPosition + itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    }
    
    function goPrev() {
      carouselPosition = Math.max(0, carouselPosition - itemWidth);
      track.style.transform = `translateX(-${carouselPosition}px)`;
      updateNavButtons();
    }
    
    prevBtn.onclick = goPrev;
    nextBtn.onclick = goNext;
    
    function updateNavButtons() {
      prevBtn.disabled = carouselPosition <= 0;
      nextBtn.disabled = carouselPosition >= maxScroll;
    }
    
    updateNavButtons();
    
    // Auto-slide
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      autoSlideInterval = null;
    }
    
    if (state.layout.carousel.autoSlide) {
      const delay = (state.layout.carousel.slideDelay || 3) * 1000;
      autoSlideInterval = setInterval(() => {
        if (carouselPosition >= maxScroll) {
          carouselPosition = 0;
          track.style.transform = `translateX(-${carouselPosition}px)`;
        } else {
          goNext();
        }
      }, delay);
    }
  }

  function applyState(state) {
    // Stage/Pod
    if (window.CKStagePod && window.CKStagePod.applyStagePod) {
      window.CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot);
    }

    // Typography
    if (window.CKTypography && window.CKTypography.applyTypography) {
      window.CKTypography.applyTypography(state.typography, lsRoot, {
        title: { varKey: 'title' },
        caption: { varKey: 'caption' },
        button: { varKey: 'button' },
      });
    }

    // Layout & content
    applyLayout(state);
    applyAppearance(state);
    applyStyle(state);
    applyHeader(state);
    applyButton(state);

    // Logos
    const track = lsRoot.querySelector('[data-role="logo-track"]');
    const logosToRender = state.layout.randomOrder 
      ? shuffleArray([...state.logos]) 
      : state.logos;
    renderLogos(track, logosToRender, state.layout.mode);

    // Empty state
    const emptyEl = lsRoot.querySelector('[data-role="empty"]');
    const hasLogos = state.logos && state.logos.length > 0;
    lsRoot.setAttribute('data-state', hasLogos ? 'ready' : 'empty');
    if (emptyEl) emptyEl.hidden = hasLogos;

    // Carousel nav
    carouselPosition = 0;
    wireCarousel(state);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Listen for state updates from Bob editor
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'ck:state-update') return;
    if (data.widgetname !== 'logoshowcase') return;
    applyState(data.state);
  });

  // Initial state from SSR
  const initialState = window.CK_WIDGET && window.CK_WIDGET.state;
  if (initialState) applyState(initialState);
})();

