(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[LogoShowcase] Missing CKWidgetRuntime.register');
  }

  function readBoolean(element, name) {
    const value = element.dataset[name];
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`[LogoShowcase] Missing boolean data setting: ${name}`);
  }

  function readNumber(element, name) {
    const raw = element.dataset[name];
    if (typeof raw !== 'string' || !raw.trim()) throw new Error(`[LogoShowcase] Missing numeric data setting: ${name}`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`[LogoShowcase] Missing numeric data setting: ${name}`);
    return value;
  }

  function initLogoShowcase(widgetRoot) {
    const showcase = widgetRoot.querySelector('[data-role="logoshowcase"]');
    if (!(showcase instanceof HTMLElement)) {
      throw new Error('[LogoShowcase] Missing generated logo markup');
    }

    const type = showcase.dataset.type;
    const randomOrder = readBoolean(showcase, 'randomOrder');
    const carousel = {
      mode: showcase.dataset.motion,
      step: showcase.dataset.carouselStep,
      speed: readNumber(showcase, 'carouselSpeed'),
      autoplay: readBoolean(showcase, 'carouselAutoplay'),
      direction: showcase.dataset.carouselDirection,
      allowSwipe: readBoolean(showcase, 'carouselSwipe'),
      showArrows: readBoolean(showcase, 'carouselArrows'),
      pauseOnHover: readBoolean(showcase, 'carouselPause'),
      transitionMs: readNumber(showcase, 'carouselTransitionMs'),
      autoSlideDelayMs: readNumber(showcase, 'carouselDelayMs'),
    };
    if (!['grid', 'carousel'].includes(type)) throw new Error('[LogoShowcase] Invalid type setting');
    if (!['paged', 'continuous'].includes(carousel.mode)) throw new Error('[LogoShowcase] Invalid motion setting');
    if (!['logo', 'page'].includes(carousel.step)) throw new Error('[LogoShowcase] Invalid step setting');
    if (!['left', 'right'].includes(carousel.direction)) throw new Error('[LogoShowcase] Invalid direction setting');
    if (!(carousel.speed > 0) || carousel.transitionMs < 0 || !(carousel.autoSlideDelayMs > 0)) {
      throw new Error('[LogoShowcase] Invalid motion timing');
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function deterministicShuffle(list, seed) {
      let value = 2166136261;
      for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
      for (let index = list.length - 1; index > 0; index -= 1) {
        value = Math.imul(value ^ (value >>> 13), 16777619);
        const target = Math.abs(value) % (index + 1);
        [list[index], list[target]] = [list[target], list[index]];
      }
      return list;
    }

    function prepareOrder(strip) {
      if (!randomOrder) return;
      const list = strip.querySelector('[data-role="ticker-a"] [data-role="logos"]');
      if (!(list instanceof HTMLElement)) return;
      const logos = Array.from(list.querySelectorAll(':scope > [data-role="logo"]'));
      deterministicShuffle(logos, strip.dataset.stripId || 'logos').forEach((logo) => list.appendChild(logo));
    }

    function bindContinuous(strip) {
      const track = strip.querySelector('[data-role="strip-track"]');
      const copyA = strip.querySelector('[data-role="ticker-a"]');
      const list = copyA && copyA.querySelector('[data-role="logos"]');
      const nav = strip.querySelector('[data-role="nav"]');
      if (!(track instanceof HTMLElement) || !(copyA instanceof HTMLElement) || !(list instanceof HTMLElement)) {
        throw new Error('[LogoShowcase] Missing generated ticker markup');
      }
      if (nav instanceof HTMLElement) nav.hidden = true;
      if (reduceMotion) return;

      const copyB = copyA.cloneNode(true);
      copyB.dataset.role = 'ticker-b';
      copyB.setAttribute('aria-hidden', 'true');
      copyB.querySelectorAll('[data-ck-field-path], [data-ck-field-target]').forEach((element) => {
        element.removeAttribute('data-ck-field-path');
        element.removeAttribute('data-ck-field-target');
      });
      track.appendChild(copyB);
      strip.dataset.pauseOnHover = carousel.pauseOnHover === true ? 'true' : 'false';

      requestAnimationFrame(() => {
        const distance = copyA.getBoundingClientRect().width;
        if (!(distance > 0)) return;
        const direction = carousel.direction === 'right' ? 'right' : 'left';
        track.style.setProperty('--ls-ticker-from', direction === 'left' ? '0px' : `-${distance}px`);
        track.style.setProperty('--ls-ticker-to', direction === 'left' ? `-${distance}px` : '0px');
        track.style.setProperty('--ls-ticker-duration', `${Math.max(1, distance / carousel.speed)}s`);
      });
    }

    function bindPaged(strip) {
      const viewport = strip.querySelector('[data-role="strip-viewport"]');
      const list = strip.querySelector('[data-role="ticker-a"] [data-role="logos"]');
      const nav = strip.querySelector('[data-role="nav"]');
      const dots = strip.querySelector('[data-role="dots"]');
      const previous = strip.querySelector('[data-role="arrow"][data-dir="prev"]');
      const next = strip.querySelector('[data-role="arrow"][data-dir="next"]');
      if (!(viewport instanceof HTMLElement) || !(list instanceof HTMLElement) || !(nav instanceof HTMLElement) ||
          !(dots instanceof HTMLElement) || !(previous instanceof HTMLButtonElement) || !(next instanceof HTMLButtonElement)) {
        throw new Error('[LogoShowcase] Missing generated carousel controls');
      }

      strip.dataset.swipe = carousel.allowSwipe === true ? 'true' : 'false';
      nav.hidden = carousel.showArrows !== true;
      nav.dataset.dots = 'false';
      dots.hidden = true;
      const logos = Array.from(list.querySelectorAll(':scope > [data-role="logo"]'));
      let page = 0;
      let pageSize = 1;
      let autoplayId = null;
      let animationId = null;

      function measure() {
        const first = logos[0];
        if (!(first instanceof HTMLElement)) return;
        const gap = Number.parseFloat(getComputedStyle(list).gap) || 0;
        pageSize = carousel.step === 'logo'
          ? 1
          : Math.max(1, Math.floor((viewport.clientWidth + gap) / (first.offsetWidth + gap)));
      }

      function pageCount() {
        return Math.max(1, Math.ceil(logos.length / pageSize));
      }

      function syncControls() {
        previous.disabled = page === 0;
        next.disabled = page === pageCount() - 1;
      }

      function scrollTo(left, animate) {
        if (animationId !== null) window.cancelAnimationFrame(animationId);
        if (!animate || reduceMotion || carousel.transitionMs === 0) {
          viewport.scrollLeft = left;
          return;
        }
        const from = viewport.scrollLeft;
        const distance = left - from;
        const startedAt = performance.now();
        const frame = (now) => {
          const progress = Math.min(1, (now - startedAt) / carousel.transitionMs);
          viewport.scrollLeft = from + distance * (1 - Math.pow(1 - progress, 3));
          if (progress < 1) animationId = window.requestAnimationFrame(frame);
          else animationId = null;
        };
        animationId = window.requestAnimationFrame(frame);
      }

      function setPage(nextPage, wrap, animate) {
        const pages = pageCount();
        page = wrap ? (nextPage + pages) % pages : Math.max(0, Math.min(pages - 1, nextPage));
        const target = logos[page * pageSize];
        if (target instanceof HTMLElement) scrollTo(target.offsetLeft, animate);
        syncControls();
      }

      function restartAutoplay() {
        if (autoplayId !== null) window.clearInterval(autoplayId);
        if (carousel.autoplay !== true || reduceMotion) return;
        autoplayId = window.setInterval(() => setPage(page + 1, true, true), carousel.autoSlideDelayMs);
      }

      previous.addEventListener('click', () => { setPage(page - 1, false, true); restartAutoplay(); });
      next.addEventListener('click', () => { setPage(page + 1, false, true); restartAutoplay(); });
      viewport.addEventListener('scroll', () => {
        const target = logos.findIndex((logo) => logo instanceof HTMLElement && logo.offsetLeft >= viewport.scrollLeft - 1);
        if (target >= 0) page = Math.min(pageCount() - 1, Math.floor(target / pageSize));
        syncControls();
      }, { passive: true });
      strip.addEventListener('mouseenter', () => {
        if (carousel.pauseOnHover === true && autoplayId !== null) window.clearInterval(autoplayId);
      });
      strip.addEventListener('mouseleave', restartAutoplay);
      window.addEventListener('resize', () => { measure(); setPage(page, false, false); });

      measure();
      setPage(0, false, false);
      restartAutoplay();
    }

    showcase.querySelectorAll('[data-role="strip"]').forEach((strip) => {
      prepareOrder(strip);
      if (type !== 'carousel') {
        const nav = strip.querySelector('[data-role="nav"]');
        if (nav instanceof HTMLElement) nav.hidden = true;
      } else if (carousel.mode === 'continuous') {
        bindContinuous(strip);
      } else {
        bindPaged(strip);
      }
    });
  }

  runtime.register('logoshowcase', initLogoShowcase);
})();
