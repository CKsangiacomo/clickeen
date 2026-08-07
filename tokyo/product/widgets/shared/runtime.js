(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function normalizeWidgetType(widgetType) {
    return String(widgetType || '').trim();
  }

  function assertWidgetShell(widgetShell, widgetType) {
    if (!(widgetShell instanceof HTMLElement)) {
      throw new Error('[CKWidgetRuntime] widget Shell must be an HTMLElement');
    }
    if (!widgetShell.classList.contains('ck-headerLayout') || widgetShell.getAttribute('data-ck-widget') !== widgetType) {
      throw new Error(`[CKWidgetRuntime] expected .ck-headerLayout[data-ck-widget="${widgetType}"]`);
    }
  }

  function bindingAttr(widgetType) {
    return `data-ck-${widgetType.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-runtime-bound`;
  }

  function shells(widgetType) {
    return Array.from(document.querySelectorAll(`.ck-headerLayout[data-ck-widget="${widgetType}"]`))
      .filter((shell) => shell instanceof HTMLElement);
  }

  function resolveInstanceId(widgetShell) {
    if (!(widgetShell instanceof HTMLElement)) return '';

    const direct = widgetShell.getAttribute('data-ck-instance-id');
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const treeNode = widgetShell.getRootNode();
    if (treeNode instanceof ShadowRoot) {
      const host = treeNode.host;
      const fromHost = host instanceof HTMLElement ? host.getAttribute('data-ck-instance-id') : '';
      if (typeof fromHost === 'string' && fromHost.trim()) return fromHost.trim();
    }

    const ancestor = widgetShell.closest('[data-ck-instance-id]');
    const fromAncestor = ancestor instanceof HTMLElement ? ancestor.getAttribute('data-ck-instance-id') : '';
    if (typeof fromAncestor === 'string' && fromAncestor.trim()) return fromAncestor.trim();

    return '';
  }

  function readPayload(instanceId) {
    if (!instanceId || !window.CK_WIDGETS || typeof window.CK_WIDGETS !== 'object') return null;
    const payload = window.CK_WIDGETS[instanceId];
    return payload && typeof payload === 'object' ? payload : null;
  }

  function contextFor(widgetShell, widgetType) {
    assertWidgetShell(widgetShell, widgetType);
    const instanceId = resolveInstanceId(widgetShell);
    if (instanceId) widgetShell.setAttribute('data-ck-instance-id', instanceId);
    const payload = readPayload(instanceId);
    return {
      widgetShell,
      instanceId,
      payload,
      locale: payload && typeof payload.locale === 'string' ? payload.locale : '',
      state: payload ? payload.state : null,
    };
  }

  function register(widgetType, init) {
    const normalized = normalizeWidgetType(widgetType);
    if (!normalized) throw new Error('[CKWidgetRuntime] widget type is required');
    if (typeof init !== 'function') throw new Error('[CKWidgetRuntime] init must be a function');

    const attr = bindingAttr(normalized);
    const initializer = function (widgetShell) {
      assertWidgetShell(widgetShell, normalized);
      if (widgetShell.getAttribute(attr) === 'true') return null;
      widgetShell.setAttribute(attr, 'true');
      return init(widgetShell, contextFor(widgetShell, normalized));
    };

    window.CK_WIDGET_INITIALIZERS = Object.assign({}, window.CK_WIDGET_INITIALIZERS || {});
    window.CK_WIDGET_INITIALIZERS[normalized] = initializer;
    shells(normalized).forEach((shell) => initializer(shell));
    return initializer;
  }

  function bindStateUpdates(widgetType, instanceId, handler, options) {
    const normalized = normalizeWidgetType(widgetType);
    if (!normalized) throw new Error('[CKWidgetRuntime] widget type is required');
    if (typeof handler !== 'function') throw new Error('[CKWidgetRuntime] state update handler must be a function');
    const requireWidgetName = Boolean(options && options.requireWidgetName === true);

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'ck:state-update') return;
      if (requireWidgetName && data.widgetname !== normalized) return;
      if (!requireWidgetName && data.widgetname && data.widgetname !== normalized) return;
      if (instanceId && typeof data.instanceId === 'string' && data.instanceId && data.instanceId !== instanceId) return;
      if (data.typographyData && typeof data.typographyData === 'object') {
        window.CK_WIDGET_TYPOGRAPHY_DATA = data.typographyData;
        if (window.CKTypography && typeof window.CKTypography.setTypographyData === 'function') {
          window.CKTypography.setTypographyData(data.typographyData);
        }
      }
      handler(data);
    });
  }

  window.CKWidgetRuntime = Object.freeze({
    assertWidgetShell,
    bindStateUpdates,
    contextFor,
    readPayload,
    register,
    resolveInstanceId,
    shells,
  });
})();
