(function () {
  'use strict';

  var disposeCurrent = function () {};

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function fnv1a32(value) {
    var hash = 0x811c9dc5;
    for (var index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash =
        (hash +
          (hash << 1) +
          (hash << 4) +
          (hash << 7) +
          (hash << 8) +
          (hash << 24)) >>>
        0;
    }
    return hash;
  }

  function xorshift32(seed) {
    var value = seed >>> 0;
    return function () {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function applyDeterministicOrder(strip) {
    var list = strip.querySelector('[data-role="logos"]');
    var logos = Array.from(list.querySelectorAll('[data-role="logo"]'));
    var seed =
      strip.dataset.stripId + '|' + logos.map(function (logo) {
        return logo.dataset.logoId;
      }).join(',');
    var random = xorshift32(fnv1a32(seed));
    for (var index = logos.length - 1; index > 0; index -= 1) {
      var other = Math.floor(random() * (index + 1));
      var temporary = logos[index];
      logos[index] = logos[other];
      logos[other] = temporary;
    }
    logos.forEach(function (logo) {
      list.appendChild(logo);
    });
  }

  function renderedGap(element) {
    return Number.parseFloat(getComputedStyle(element).columnGap);
  }

  function animateScroll(element, target, duration, motion) {
    if (motion.frame) cancelAnimationFrame(motion.frame);
    var start = element.scrollLeft;
    var delta = Math.max(0, Math.round(target)) - start;
    var started = performance.now();
    if (duration <= 0) {
      element.scrollLeft = start + delta;
      return;
    }
    var tick = function (now) {
      var progress = clamp((now - started) / duration, 0, 1);
      var eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      element.scrollLeft = start + delta * eased;
      if (progress < 1) motion.frame = requestAnimationFrame(tick);
      else motion.frame = 0;
    };
    motion.frame = requestAnimationFrame(tick);
  }

  function bindPaged(strip, config) {
    var viewport = strip.querySelector('[data-role="strip-viewport"]');
    var list = strip.querySelector('[data-role="logos"]');
    var nav = strip.querySelector('[data-role="nav"]');
    var previous = strip.querySelector('[data-dir="prev"]');
    var next = strip.querySelector('[data-dir="next"]');
    var motion = { frame: 0 };
    var hovering = false;
    var observer = null;
    var autoplayInterval = 0;

    strip.dataset.swipe = String(config.allowSwipe);
    nav.hidden = !config.showArrows;
    previous.hidden = !config.showArrows;
    next.hidden = !config.showArrows;

    function paging() {
      var count = list.querySelectorAll('[data-role="logo"]').length;
      var first = list.querySelector('[data-role="logo"]');
      var tileWidth = first.getBoundingClientRect().width;
      var gap = renderedGap(list);
      var perPage = Math.max(1, Math.floor((viewport.clientWidth + gap) / (tileWidth + gap)));
      var pageCount = config.step === 'logo' ? Math.max(1, count) : Math.max(1, Math.ceil(count / perPage));
      var step = (config.step === 'logo' ? 1 : perPage) * (tileWidth + gap);
      var page = step > 0 ? clamp(Math.round(viewport.scrollLeft / step), 0, pageCount - 1) : 0;
      return { page: page, pageCount: pageCount, step: step };
    }

    function sync() {
      var state = paging();
      previous.disabled = state.page <= 0;
      next.disabled = state.page >= state.pageCount - 1;
    }

    function go(page, animated) {
      var state = paging();
      if (state.pageCount <= 1 || state.step <= 0) return;
      var resolved = clamp(page, 0, state.pageCount - 1);
      if (animated) animateScroll(viewport, resolved * state.step, config.transitionMs, motion);
      else viewport.scrollLeft = resolved * state.step;
      sync();
    }

    previous.addEventListener('click', function () {
      go(paging().page - 1, true);
    });
    next.addEventListener('click', function () {
      go(paging().page + 1, true);
    });
    viewport.addEventListener('scroll', sync, { passive: true });
    strip.addEventListener('mouseenter', function () {
      hovering = true;
    });
    strip.addEventListener('mouseleave', function () {
      hovering = false;
    });

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(function () {
        go(paging().page, false);
      });
      observer.observe(viewport);
    }
    if (config.autoplay && config.autoSlideDelayMs > 0) {
      autoplayInterval = window.setInterval(function () {
        if (config.pauseOnHover && hovering) return;
        var state = paging();
        if (state.pageCount > 1) go((state.page + 1) % state.pageCount, true);
      }, config.autoSlideDelayMs);
    }
    sync();
    return function () {
      if (motion.frame) cancelAnimationFrame(motion.frame);
      if (observer) observer.disconnect();
      if (autoplayInterval) window.clearInterval(autoplayInterval);
      motion.frame = 0;
      observer = null;
      autoplayInterval = 0;
    };
  }

  function bindContinuous(strip, config) {
    var viewport = strip.querySelector('[data-role="strip-viewport"]');
    var track = strip.querySelector('[data-role="strip-track"]');
    var firstCopy = strip.querySelector('[data-role="ticker-a"]');
    var secondCopy = firstCopy.cloneNode(true);
    var observer = null;
    secondCopy.dataset.role = 'ticker-b';
    secondCopy.setAttribute('aria-hidden', 'true');
    secondCopy.querySelectorAll('a').forEach(function (link) {
      link.tabIndex = -1;
    });
    track.appendChild(secondCopy);
    strip.dataset.swipe = 'false';
    strip.dataset.pauseOnHover = String(config.pauseOnHover);

    function applyMotion() {
      var list = firstCopy.querySelector('[data-role="logos"]');
      var distance = Math.max(0, Math.ceil(list.scrollWidth + renderedGap(track)));
      track.style.setProperty('--ls-ticker-duration', distance / config.speed + 's');
      if (config.direction === 'right') {
        track.style.setProperty('--ls-ticker-from', -distance + 'px');
        track.style.setProperty('--ls-ticker-to', '0px');
      } else {
        track.style.setProperty('--ls-ticker-from', '0px');
        track.style.setProperty('--ls-ticker-to', -distance + 'px');
      }
    }

    applyMotion();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(applyMotion);
      observer.observe(viewport);
    }
    return function () {
      if (observer) observer.disconnect();
      observer = null;
    };
  }

  function initialize(widgetShell) {
    disposeCurrent();
    var disposers = [];
    disposeCurrent = function () {
      disposers.forEach(function (dispose) {
        dispose();
      });
      disposers = [];
    };

    var config = {
      type: widgetShell.dataset.type,
      mode: widgetShell.dataset.motion,
      step: widgetShell.dataset.step,
      showArrows: widgetShell.dataset.showArrows === 'true',
      allowSwipe: widgetShell.dataset.allowSwipe === 'true',
      autoplay: widgetShell.dataset.autoplay === 'true',
      pauseOnHover: widgetShell.dataset.pauseOnHover === 'true',
      autoSlideDelayMs: Number(widgetShell.dataset.autoSlideDelayMs),
      transitionMs: Number(widgetShell.dataset.transitionMs),
      speed: Number(widgetShell.dataset.speed),
      direction: widgetShell.dataset.direction,
    };

    widgetShell.querySelectorAll('[data-role="strip"]').forEach(function (strip) {
      if (widgetShell.dataset.randomOrder === 'true') applyDeterministicOrder(strip);
      if (config.type !== 'carousel') return;
      if (config.mode === 'continuous') disposers.push(bindContinuous(strip, config));
      else disposers.push(bindPaged(strip, config));
    });
  }

  window.CKWidgetRuntime.register(initialize);
})();
