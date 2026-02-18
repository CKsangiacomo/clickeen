(function () {
  if (typeof window === 'undefined') return;

  var VALID_TYPES = {
    none: true,
    color: true,
    gradient: true,
    image: true,
    video: true,
  };

  var GRADIENT_KINDS = {
    linear: true,
    radial: true,
    conic: true,
  };

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function clampNumber(value, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function extractPrimaryUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    var match = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
    if (match && match[2]) return match[2];
    return v;
  }

  function isPersistedAssetUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return false;
    return /^https?:\/\//i.test(v) || v.indexOf('/') === 0;
  }

  function normalizeStringFill(raw) {
    var v = String(raw || '').trim();
    if (!v || v === 'transparent') return { type: 'none' };
    if (/url\(\s*/i.test(v)) {
      var extracted = extractPrimaryUrl(v);
      if (!isPersistedAssetUrl(extracted)) return null;
      return {
        type: 'image',
        image: {
          src: extracted,
          fit: 'cover',
          position: 'center',
          repeat: 'no-repeat',
          fallback: '',
        },
      };
    }
    if (isPersistedAssetUrl(v)) {
      return {
        type: 'image',
        image: {
          src: extractPrimaryUrl(v),
          fit: 'cover',
          position: 'center',
          repeat: 'no-repeat',
          fallback: '',
        },
      };
    }
    if (/-gradient\(/i.test(v)) {
      return { type: 'gradient', gradient: { css: v } };
    }
    return { type: 'color', color: v };
  }

  function normalizeGradient(raw) {
    if (typeof raw === 'string') {
      var css = raw.trim();
      return css ? { css: css } : null;
    }
    if (!isRecord(raw)) return null;
    if (typeof raw.css === 'string') {
      var rawCss = raw.css.trim();
      if (rawCss) {
        return { css: rawCss };
      }
    }
    var kind = typeof raw.kind === 'string' && GRADIENT_KINDS[raw.kind] ? raw.kind : 'linear';
    var angle = clampNumber(raw.angle, 0, 360);
    var rawStops = Array.isArray(raw.stops) ? raw.stops : [];
    var stops = rawStops
      .map(function (stop) {
        if (!isRecord(stop)) return null;
        var color = typeof stop.color === 'string' ? stop.color.trim() : '';
        if (!color) return null;
        var position = clampNumber(stop.position, 0, 100);
        return { color: color, position: position };
      })
      .filter(Boolean);
    return { kind: kind, angle: angle, stops: stops };
  }

  function normalizeFill(raw) {
    if (raw == null) return { type: 'none' };
    if (typeof raw === 'string') return normalizeStringFill(raw);
    if (!isRecord(raw)) return null;

    var type = typeof raw.type === 'string' ? raw.type.trim() : '';
    if (!type) {
      if (typeof raw.color === 'string') return { type: 'color', color: raw.color.trim() };
      if (raw.gradient != null) return { type: 'gradient', gradient: normalizeGradient(raw.gradient) || undefined };
      if (raw.image != null) return { type: 'image', image: normalizeImage(raw.image) };
      if (raw.video != null) return { type: 'video', video: normalizeVideo(raw.video) };
      return { type: 'none' };
    }
    if (!VALID_TYPES[type]) return null;

    if (type === 'none') return { type: 'none' };
    if (type === 'color') {
      var color = typeof raw.color === 'string' ? raw.color.trim() : '';
      return { type: 'color', color: color || 'transparent' };
    }
    if (type === 'gradient') {
      var gradient = normalizeGradient(raw.gradient);
      return { type: 'gradient', gradient: gradient || undefined };
    }
    if (type === 'image') {
      return { type: 'image', image: normalizeImage(raw.image) };
    }
    if (type === 'video') {
      return { type: 'video', video: normalizeVideo(raw.video) };
    }
    return { type: 'none' };
  }

  function normalizeImage(raw) {
    if (!isRecord(raw)) return { src: '', fit: 'cover', position: 'center', repeat: 'no-repeat', fallback: '' };
    var srcRaw = typeof raw.src === 'string' ? raw.src.trim() : '';
    var src = isPersistedAssetUrl(srcRaw) ? srcRaw : '';
    var fit = raw.fit === 'contain' ? 'contain' : 'cover';
    var position = typeof raw.position === 'string' && raw.position.trim() ? raw.position.trim() : 'center';
    var repeat = typeof raw.repeat === 'string' && raw.repeat.trim() ? raw.repeat.trim() : 'no-repeat';
    var fallback = typeof raw.fallback === 'string' ? raw.fallback.trim() : '';
    return { src: src, fit: fit, position: position, repeat: repeat, fallback: fallback };
  }

  function normalizeVideo(raw) {
    if (!isRecord(raw)) return { src: '', poster: '', fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true, fallback: '' };
    var srcRaw = typeof raw.src === 'string' ? raw.src.trim() : '';
    var posterRaw = typeof raw.poster === 'string' ? raw.poster.trim() : '';
    var src = isPersistedAssetUrl(srcRaw) ? srcRaw : '';
    var poster = isPersistedAssetUrl(posterRaw) ? posterRaw : '';
    var fit = raw.fit === 'contain' ? 'contain' : 'cover';
    var position = typeof raw.position === 'string' && raw.position.trim() ? raw.position.trim() : 'center';
    var loop = typeof raw.loop === 'boolean' ? raw.loop : true;
    var muted = typeof raw.muted === 'boolean' ? raw.muted : true;
    var autoplay = typeof raw.autoplay === 'boolean' ? raw.autoplay : true;
    var fallback = typeof raw.fallback === 'string' ? raw.fallback.trim() : '';
    return {
      src: src,
      poster: poster,
      fit: fit,
      position: position,
      loop: loop,
      muted: muted,
      autoplay: autoplay,
      fallback: fallback,
    };
  }

  function fallbackLayer(raw) {
    var v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) return 'linear-gradient(var(--color-system-white), var(--color-system-white))';
    if (v === 'transparent') return 'transparent';
    if (/-gradient\(/i.test(v)) return v;
    return 'linear-gradient(' + v + ', ' + v + ')';
  }

  function buildGradientCss(gradient) {
    if (!gradient) return 'transparent';
    if (gradient.css) return gradient.css;
    var stops = Array.isArray(gradient.stops) ? gradient.stops : [];
    if (stops.length < 2) return 'transparent';
    var stopList = stops
      .map(function (stop) {
        return stop.color + ' ' + clampNumber(stop.position, 0, 100) + '%';
      })
      .join(', ');
    if (gradient.kind === 'radial') {
      return 'radial-gradient(circle, ' + stopList + ')';
    }
    if (gradient.kind === 'conic') {
      return 'conic-gradient(from ' + clampNumber(gradient.angle, 0, 360) + 'deg, ' + stopList + ')';
    }
    return 'linear-gradient(' + clampNumber(gradient.angle, 0, 360) + 'deg, ' + stopList + ')';
  }

  function toCssBackground(raw) {
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    if (fill.type === 'none') return 'transparent';
    if (fill.type === 'color') return fill.color || 'transparent';
    if (fill.type === 'gradient') return buildGradientCss(fill.gradient);
    if (fill.type === 'image') {
      if (!fill.image || !fill.image.src) return 'transparent';
      var fit = fill.image.fit === 'contain' ? 'contain' : 'cover';
      var position = fill.image.position || 'center';
      var repeat = fill.image.repeat || 'no-repeat';
      var layer = 'url(\"' + fill.image.src + '\") ' + position + ' / ' + fit + ' ' + repeat;
      var fallback = fallbackLayer(fill.image.fallback);
      return fallback === 'transparent' ? layer : layer + ', ' + fallback;
    }
    if (fill.type === 'video') return fallbackLayer(fill.video && fill.video.fallback);
    return 'transparent';
  }

  function toCssColor(raw) {
    if (typeof raw === 'string') return raw.trim();
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    if (fill.type === 'none') return 'transparent';
    if (fill.type !== 'color') {
      throw new Error('[CKFill] Fill is not a color');
    }
    return fill.color || 'transparent';
  }

  function ensureLayer(container) {
    var existing = container.querySelector('.ck-fill-layer');
    if (existing && existing.parentElement === container) return existing;
    var layer = document.createElement('div');
    layer.className = 'ck-fill-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '0';
    layer.style.overflow = 'hidden';
    layer.style.borderRadius = 'inherit';
    container.prepend(layer);
    return layer;
  }

  function clearLayer(container) {
    var existing = container.querySelector('.ck-fill-layer');
    if (existing && existing.parentElement === container) {
      existing.remove();
    }
  }

  function applyMediaLayer(container, raw, opts) {
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    var wantsVideo = fill.type === 'video' && fill.video && fill.video.src;
    if (!wantsVideo) {
      clearLayer(container);
      return fill;
    }

    var layer = ensureLayer(container);
    layer.dataset.fillKind = 'video';
    var video = layer.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.objectPosition = 'center';
      video.style.display = 'block';
      layer.textContent = '';
      layer.appendChild(video);
    }

    var cfg = fill.video || {};
    video.src = cfg.src || '';
    if (cfg.poster) video.poster = cfg.poster;
    video.muted = cfg.muted !== false;
    video.loop = cfg.loop !== false;
    video.autoplay = cfg.autoplay !== false;
    video.style.objectFit = cfg.fit === 'contain' ? 'contain' : 'cover';
    video.style.objectPosition = cfg.position || 'center';

    container.style.position = 'relative';
    container.style.isolation = 'isolate';
    if (opts && opts.contentEl instanceof HTMLElement) {
      opts.contentEl.style.position = 'relative';
      opts.contentEl.style.zIndex = '1';
    }

    return fill;
  }

  window.CKFill = {
    normalizeFill: normalizeFill,
    toCssBackground: toCssBackground,
    toCssColor: toCssColor,
    applyMediaLayer: applyMediaLayer,
  };
})();
