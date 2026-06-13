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

  function readAssetSrc(raw) {
    if (!isRecord(raw)) return '';
    var direct = typeof raw.src === 'string' ? raw.src.trim() : '';
    if (!direct) return '';
    return /^https?:\/\//i.test(direct) || direct.indexOf('/') === 0 ? direct : '';
  }

  function normalizeGradient(raw) {
    if (!isRecord(raw)) return null;
    if (typeof raw.kind !== 'string' || !GRADIENT_KINDS[raw.kind] || typeof raw.angle !== 'number' || !Number.isFinite(raw.angle) || raw.angle < 0 || raw.angle > 360 || !Array.isArray(raw.stops)) return null;
    if (raw.stops.some(function (stop) { return !isRecord(stop) || typeof stop.color !== 'string' || !stop.color.trim() || typeof stop.position !== 'number' || !Number.isFinite(stop.position) || stop.position < 0 || stop.position > 100; })) return null;
    return { kind: raw.kind, angle: raw.angle, stops: raw.stops.map(function (stop) { return { color: stop.color.trim(), position: stop.position }; }) };
  }

  function normalizeFill(raw) {
    if (raw == null) return { type: 'none' };
    if (typeof raw === 'string') return raw.trim() === 'transparent' ? { type: 'none' } : null;
    if (!isRecord(raw)) return null;

    var type = typeof raw.type === 'string' ? raw.type.trim() : '';
    if (!type) {
      if (typeof raw.color === 'string') return raw.color.trim() ? { type: 'color', color: raw.color.trim() } : null;
      if (raw.gradient != null) return normalizeGradient(raw.gradient) ? { type: 'gradient', gradient: normalizeGradient(raw.gradient) } : null;
      if (raw.image != null) return { type: 'image', image: normalizeImage(raw.image) };
      if (raw.video != null) return { type: 'video', video: normalizeVideo(raw.video) };
      return null;
    }
    if (!VALID_TYPES[type]) return null;

    if (type === 'none') return { type: 'none' };
    if (type === 'color') return typeof raw.color === 'string' && raw.color.trim() ? { type: 'color', color: raw.color.trim() } : null;
    if (type === 'gradient') return normalizeGradient(raw.gradient) ? { type: 'gradient', gradient: normalizeGradient(raw.gradient) } : null;
    if (type === 'image') {
      return { type: 'image', image: normalizeImage(raw.image) };
    }
    if (type === 'video') {
      return { type: 'video', video: normalizeVideo(raw.video) };
    }
    return null;
  }

  function normalizeImage(raw) {
    if (!isRecord(raw)) throw new Error('[CKFill] image fill requires src');
    var src = readAssetSrc(raw);
    if (!src) throw new Error('[CKFill] image fill requires src');
    var fit = raw.fit === 'contain' ? 'contain' : 'cover';
    var position = typeof raw.position === 'string' && raw.position.trim() ? raw.position.trim() : 'center';
    var repeat = typeof raw.repeat === 'string' && raw.repeat.trim() ? raw.repeat.trim() : 'no-repeat';
    return { src: src, fit: fit, position: position, repeat: repeat };
  }

  function normalizeVideo(raw) {
    if (!isRecord(raw)) throw new Error('[CKFill] video fill requires src');
    var src = readAssetSrc(raw);
    if (!src) throw new Error('[CKFill] video fill requires src');
    var poster = typeof raw.poster === 'string' && raw.poster.trim() ? raw.poster.trim() : '';
    var fit = raw.fit === 'contain' ? 'contain' : 'cover';
    var position = typeof raw.position === 'string' && raw.position.trim() ? raw.position.trim() : 'center';
    var loop = typeof raw.loop === 'boolean' ? raw.loop : true;
    var muted = typeof raw.muted === 'boolean' ? raw.muted : true;
    var autoplay = typeof raw.autoplay === 'boolean' ? raw.autoplay : true;
    return {
      src: src,
      poster: poster,
      fit: fit,
      position: position,
      loop: loop,
      muted: muted,
      autoplay: autoplay,
    };
  }

  function buildGradientCss(gradient) {
    var stops = Array.isArray(gradient.stops) ? gradient.stops : [];
    if (stops.length < 2) throw new Error('[CKFill] Invalid gradient fill');
    var stopList = stops
      .map(function (stop) {
        return stop.color + ' ' + stop.position + '%';
      })
      .join(', ');
    if (gradient.kind === 'radial') {
      return 'radial-gradient(circle, ' + stopList + ')';
    }
    if (gradient.kind === 'conic') {
      return 'conic-gradient(from ' + gradient.angle + 'deg, ' + stopList + ')';
    }
    return 'linear-gradient(' + gradient.angle + 'deg, ' + stopList + ')';
  }

  function toCssBackground(raw) {
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    if (fill.type === 'none') return 'transparent';
    if (fill.type === 'color') return fill.color;
    if (fill.type === 'gradient') return buildGradientCss(fill.gradient);
    if (fill.type === 'image') {
      var fit = fill.image.fit === 'contain' ? 'contain' : 'cover';
      var position = fill.image.position || 'center';
      var repeat = fill.image.repeat || 'no-repeat';
      return 'url(\"' + fill.image.src + '\") ' + position + ' / ' + fit + ' ' + repeat;
    }
    if (fill.type === 'video') return 'transparent';
  }

  function toCssColor(raw) {
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    if (fill.type === 'none') return 'transparent';
    if (fill.type !== 'color') {
      throw new Error('[CKFill] Fill is not a color');
    }
    return fill.color;
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

  function applyMediaLayer(container, raw, opts) {
    var fill = normalizeFill(raw);
    if (!fill) throw new Error('[CKFill] Invalid fill');
    if (fill.type === 'gradient') buildGradientCss(fill.gradient);
    var wantsVideo = fill.type === 'video' && fill.video && fill.video.src;
    if (!wantsVideo) {
      var existing = container.querySelector('.ck-fill-layer');
      if (existing && existing.parentElement === container) existing.remove();
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
