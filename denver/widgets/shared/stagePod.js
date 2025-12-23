(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function resolvePadding(cfg, prefix) {
    const linked = cfg[`${prefix}Linked`];
    if (linked === false) {
      return {
        top: cfg[`${prefix}Top`],
        right: cfg[`${prefix}Right`],
        bottom: cfg[`${prefix}Bottom`],
        left: cfg[`${prefix}Left`],
      };
    }
    const all = cfg[prefix];
    return { top: all, right: all, bottom: all, left: all };
  }

  function resolveRadius(cfg) {
    const tokenize = (value) => (value === 'none' ? '0' : `var(--control-radius-${value})`);
    if (cfg.radiusLinked === false) {
      return {
        tl: tokenize(cfg.radiusTL),
        tr: tokenize(cfg.radiusTR),
        br: tokenize(cfg.radiusBR),
        bl: tokenize(cfg.radiusBL),
      };
    }
    const all = tokenize(cfg.radius);
    return { tl: all, tr: all, br: all, bl: all };
  }

  function applyStagePod(stageCfg, podCfg, scopeEl) {
    if (!(scopeEl instanceof HTMLElement)) {
      throw new Error('[CKStagePod] scope must be an HTMLElement');
    }

    const stageEl = scopeEl.closest('.stage');
    const podEl = scopeEl.closest('.pod');
    if (!(stageEl instanceof HTMLElement) || !(podEl instanceof HTMLElement)) {
      throw new Error('[CKStagePod] Missing .stage/.pod wrappers for scope');
    }

    stageEl.style.setProperty('--stage-bg', stageCfg.background);
    const stagePad = resolvePadding(stageCfg, 'padding');
    stageEl.style.padding = `${stagePad.top}px ${stagePad.right}px ${stagePad.bottom}px ${stagePad.left}px`;

    const alignMap = {
      left: { justify: 'flex-start', alignItems: 'center' },
      right: { justify: 'flex-end', alignItems: 'center' },
      top: { justify: 'center', alignItems: 'flex-start' },
      bottom: { justify: 'center', alignItems: 'flex-end' },
      center: { justify: 'center', alignItems: 'center' },
    };
    const resolved = alignMap[stageCfg.alignment];
    stageEl.style.justifyContent = resolved.justify;
    stageEl.style.alignItems = resolved.alignItems;

    podEl.style.setProperty('--pod-bg', podCfg.background);
    const podPad = resolvePadding(podCfg, 'padding');
    podEl.style.padding = `${podPad.top}px ${podPad.right}px ${podPad.bottom}px ${podPad.left}px`;

    const radii = resolveRadius(podCfg);
    podEl.style.setProperty('--pod-radius', `${radii.tl} ${radii.tr} ${radii.br} ${radii.bl}`);

    podEl.setAttribute('data-width-mode', podCfg.widthMode);
    podEl.style.setProperty('--content-width', `${podCfg.contentWidth}px`);
  }

  window.CKStagePod = { applyStagePod };
})();
