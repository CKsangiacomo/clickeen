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

  function readDeclaredString(value) {
    return typeof value === 'string' && value && value === value.trim() ? value : '';
  }

  function readOptionalDeclaredString(value) {
    if (value === undefined) return '';
    return readDeclaredString(value);
  }

  function readAssetSrc(raw) {
    if (!isRecord(raw)) return '';
    var direct = readDeclaredString(raw.src);
    if (!direct) return '';
    return /^https?:\/\//i.test(direct) || direct.indexOf('/') === 0 ? direct : '';
  }

  function readDeclaredGradient(raw) {
    if (!isRecord(raw)) return null;
    if (typeof raw.kind !== 'string' || !GRADIENT_KINDS[raw.kind] || typeof raw.angle !== 'number' || !Number.isFinite(raw.angle) || raw.angle < 0 || raw.angle > 360 || !Array.isArray(raw.stops)) return null;
    if (raw.stops.some(function (stop) { return !isRecord(stop) || !readDeclaredString(stop.color) || typeof stop.position !== 'number' || !Number.isFinite(stop.position) || stop.position < 0 || stop.position > 100; })) return null;
    return { kind: raw.kind, angle: raw.angle, stops: raw.stops.map(function (stop) { return { color: stop.color, position: stop.position }; }) };
  }

  function normalizeFill(raw) {
    if (raw == null) return null;
    if (typeof raw === 'string') return null;
    if (!isRecord(raw)) return null;

    var type = typeof raw.type === 'string' ? raw.type : '';
    if (!type) return null;
    if (!VALID_TYPES[type]) return null;

    if (type === 'none') return { type: 'none' };
    if (type === 'color') return readDeclaredString(raw.color) ? { type: 'color', color: raw.color } : null;
    if (type === 'gradient') return readDeclaredGradient(raw.gradient) ? { type: 'gradient', gradient: readDeclaredGradient(raw.gradient) } : null;
    if (type === 'image') {
      return { type: 'image', image: readDeclaredImage(raw.image) };
    }
    if (type === 'video') {
      return { type: 'video', video: readDeclaredVideo(raw.video) };
    }
    return null;
  }

  function readDeclaredImage(raw) {
    if (!isRecord(raw)) throw new Error('[CKFill] image fill requires src');
    var src = readAssetSrc(raw);
    if (!src) throw new Error('[CKFill] image fill requires src');
    var fit = raw.fit === 'cover' || raw.fit === 'contain' ? raw.fit : '';
    var position = readDeclaredString(raw.position);
    var repeat = readDeclaredString(raw.repeat);
    if (!fit || !position || !repeat) throw new Error('[CKFill] image fill missing declared layout');
    return { src: src, fit: fit, position: position, repeat: repeat };
  }

  function readDeclaredVideo(raw) {
    if (!isRecord(raw)) throw new Error('[CKFill] video fill requires src');
    var src = readAssetSrc(raw);
    if (!src) throw new Error('[CKFill] video fill requires src');
    var poster = readOptionalDeclaredString(raw.poster);
    if (raw.poster !== undefined && !poster) throw new Error('[CKFill] video fill has malformed poster');
    var fit = raw.fit === 'cover' || raw.fit === 'contain' ? raw.fit : '';
    var position = readDeclaredString(raw.position);
    var loop = typeof raw.loop === 'boolean' ? raw.loop : null;
    var muted = typeof raw.muted === 'boolean' ? raw.muted : null;
    var autoplay = typeof raw.autoplay === 'boolean' ? raw.autoplay : null;
    if (!fit || !position || loop == null || muted == null || autoplay == null) throw new Error('[CKFill] video fill missing declared layout');
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
      return 'url(\"' + fill.image.src + '\") ' + fill.image.position + ' / ' + fill.image.fit + ' ' + fill.image.repeat;
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
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.display = 'block';
      layer.textContent = '';
      layer.appendChild(video);
    }

    var cfg = fill.video || {};
    video.src = cfg.src;
    if (cfg.poster) video.poster = cfg.poster;
    video.muted = cfg.muted;
    video.loop = cfg.loop;
    video.autoplay = cfg.autoplay;
    video.style.objectFit = cfg.fit;
    video.style.objectPosition = cfg.position;

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
