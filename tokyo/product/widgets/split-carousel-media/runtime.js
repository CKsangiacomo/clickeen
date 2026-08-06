(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const runtime = window.CKWidgetRuntime;
  if (!runtime || typeof runtime.register !== 'function') {
    throw new Error('[SplitCarouselMedia] Missing CKWidgetRuntime.register');
  }

  function readBoolean(element, name) {
    const value = element.dataset[name];
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`[SplitCarouselMedia] Missing boolean data setting: ${name}`);
  }

  function initSplitCarouselMedia(widgetRoot) {
    const carouselRoot = widgetRoot.querySelector('[data-role="split-carousel-media"]');
    const stage = widgetRoot.querySelector('[data-role="carousel-stage"]');
    if (!(carouselRoot instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
      throw new Error('[SplitCarouselMedia] Missing generated carousel markup');
    }
    if (!['fade', 'slide'].includes(carouselRoot.dataset.transition)) {
      throw new Error('[SplitCarouselMedia] Invalid transition setting');
    }
    const loop = readBoolean(carouselRoot, 'loop');
    const autoplay = readBoolean(carouselRoot, 'autoplay');
    const intervalMs = Number(carouselRoot.dataset.intervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error('[SplitCarouselMedia] Missing numeric interval setting');
    }

    const slides = Array.from(stage.querySelectorAll('[data-role="carousel-slide"]'));
    const dots = Array.from(stage.querySelectorAll('[data-role="carousel-dot"]'));
    const controls = Array.from(stage.querySelectorAll('[data-role="carousel-control"]'));
    if (slides.length < 2) throw new Error('[SplitCarouselMedia] Carousel requires at least two slides');

    let active = 0;
    let autoplayId = null;

    function normalizeIndex(next) {
      if (loop) return (next + slides.length) % slides.length;
      return Math.max(0, Math.min(slides.length - 1, next));
    }

    function setActive(next) {
      active = normalizeIndex(next);
      slides.forEach((slide, index) => {
        const selected = index === active;
        slide.dataset.active = selected ? 'true' : 'false';
        slide.setAttribute('aria-hidden', selected ? 'false' : 'true');
        const video = slide.querySelector('video');
        if (!(video instanceof HTMLVideoElement)) return;
        if (selected && video.dataset.autoplay === 'true') {
          const play = video.play();
          if (play && typeof play.catch === 'function') play.catch(() => {});
        } else {
          video.pause();
        }
      });
      dots.forEach((dot, index) => dot.setAttribute('aria-current', index === active ? 'true' : 'false'));
      if (!loop) {
        controls.forEach((control) => {
          control.disabled = control.dataset.dir === 'prev' ? active === 0 : active === slides.length - 1;
        });
      }
    }

    function restartAutoplay() {
      if (autoplayId !== null) window.clearInterval(autoplayId);
      if (!autoplay) return;
      autoplayId = window.setInterval(() => setActive(active + 1), intervalMs);
    }

    controls.forEach((control) => {
      control.addEventListener('click', () => {
        setActive(active + (control.dataset.dir === 'prev' ? -1 : 1));
        restartAutoplay();
      });
    });
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        setActive(Number(dot.dataset.index));
        restartAutoplay();
      });
    });
    stage.addEventListener('mouseenter', () => {
      if (autoplayId !== null) window.clearInterval(autoplayId);
    });
    stage.addEventListener('mouseleave', restartAutoplay);

    setActive(0);
    restartAutoplay();
  }

  runtime.register('split-carousel-media', initSplitCarouselMedia);
})();
