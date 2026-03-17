import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  normalizeWidgetname,
  isMainInstancePublicId,
} from './state.js';

export function createWorkspaceApi(deps) {
  const instanceEnvelopePromiseCache = new Map();
  let devstudioContextPromise = null;

  const {
    supportMode,
    getSupportTarget,
    setSupportTarget,
    writeSupportTargetEnvelopeToStorage,
    bobOrigin,
    supportStatusValue,
    supportStatusMeta,
    buildDevStudioApiUrl,
    fetchDevStudio,
    isLocalDefaultPublicId,
    findInstanceByPublicId,
    setL10nStatusDisplay,
    getL10nStatusTimer,
    setL10nStatusTimer,
  } = deps;

  async function loadDevStudioContext() {
    if (devstudioContextPromise) return devstudioContextPromise;
    devstudioContextPromise = (async () => {
      const res = await fetchDevStudio(buildDevStudioApiUrl('/api/devstudio/context'));
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const reasonKey = payload?.error?.reasonKey || payload?.error || `HTTP_${res.status}`;
        throw new Error(String(reasonKey));
      }
      const accountId =
        typeof payload?.accountId === 'string' && payload.accountId.trim() ? payload.accountId.trim() : '';
      if (!accountId) {
        throw new Error('coreui.errors.auth.contextUnavailable');
      }
      return { accountId };
    })().catch((error) => {
      devstudioContextPromise = null;
      throw error;
    });
    return devstudioContextPromise;
  }

  async function resolveDevStudioAccountId() {
    const supportTarget = getSupportTarget();
    if (
      supportMode &&
      supportTarget &&
      typeof supportTarget.accountId === 'string' &&
      supportTarget.accountId.trim()
    ) {
      return supportTarget.accountId.trim();
    }
    const context = await loadDevStudioContext();
    return context.accountId;
  }

  function buildSupportInstance(envelope) {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return null;
    const publicId =
      typeof envelope.publicId === 'string' && envelope.publicId.trim() ? envelope.publicId.trim() : null;
    const widgetType =
      typeof envelope.widgetType === 'string' && envelope.widgetType.trim() ? envelope.widgetType.trim() : null;
    if (!publicId || !widgetType) return null;
    const widgetSlug = normalizeWidgetname(widgetType);
    if (!widgetSlug) return null;
    const label =
      typeof envelope.label === 'string' && envelope.label.trim()
        ? envelope.label.trim()
        : DEFAULT_INSTANCE_DISPLAY_NAME;
    const status = envelope.status === 'published' ? 'published' : 'unpublished';
    return {
      publicId,
      widgetname: widgetSlug,
      widgetSlug,
      label,
      status,
      source: 'support',
      actions: null,
      config: envelope.config && typeof envelope.config === 'object' ? envelope.config : null,
      localization:
        envelope.localization && typeof envelope.localization === 'object' ? envelope.localization : null,
      policy: envelope.policy && typeof envelope.policy === 'object' ? envelope.policy : null,
      meta: {
        accountId:
          typeof envelope.accountId === 'string' && envelope.accountId.trim() ? envelope.accountId.trim() : '',
        ownerAccountId:
          typeof envelope.ownerAccountId === 'string' && envelope.ownerAccountId.trim()
            ? envelope.ownerAccountId.trim()
            : '',
        reason: typeof envelope.reason === 'string' ? envelope.reason.trim() : '',
      },
    };
  }

  async function runSupportAccountCommand({ source, requestId, sessionId, command, accountId, publicId, body }) {
    const reply = ({ ok, status, payload = null, message = undefined }) => {
      source.postMessage(
        {
          type: 'host:account-command-result',
          requestId,
          sessionId,
          command,
          accountId,
          publicId,
          ok,
          status,
          payload,
          ...(message ? { message } : {}),
        },
        bobOrigin,
      );
    };

    const supportTarget = getSupportTarget();
    if (!supportTarget || publicId !== supportTarget.publicId || accountId !== supportTarget.accountId) {
      reply({ ok: false, status: 404, message: 'coreui.errors.instance.notFound' });
      return;
    }

    if (command !== 'update-instance') {
      reply({
        ok: false,
        status: 422,
        message: 'coreui.errors.internalControl.supportCommandUnsupported',
      });
      return;
    }

    const config = body && typeof body === 'object' && !Array.isArray(body) ? body.config : null;
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      reply({ ok: false, status: 422, message: 'coreui.errors.payload.invalid' });
      return;
    }

    try {
      const res = await fetchDevStudio(buildDevStudioApiUrl('/api/devstudio/control/support-update-instance'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          publicId,
          reason:
            typeof supportTarget.reason === 'string' && supportTarget.reason.trim()
              ? supportTarget.reason.trim()
              : 'customer_support',
          config,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload && typeof payload === 'object' && payload.config && typeof payload.config === 'object') {
        const nextSupportTarget = {
          ...supportTarget,
          config: payload.config,
        };
        setSupportTarget(nextSupportTarget);
        writeSupportTargetEnvelopeToStorage(nextSupportTarget);
      }
      reply({
        ok: res.ok,
        status: res.status,
        payload,
        message:
          !res.ok && payload?.error?.reasonKey
            ? String(payload.error.reasonKey)
            : !res.ok
              ? `HTTP_${res.status}`
              : undefined,
      });
    } catch (error) {
      reply({
        ok: false,
        status: 500,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function runDevstudioAccountCommand({ source, requestId, sessionId, command, accountId, publicId, locale, body }) {
    const reply = ({ ok, status, payload = null, message = undefined }) => {
      source.postMessage(
        {
          type: 'host:account-command-result',
          requestId,
          sessionId,
          command,
          accountId,
          publicId,
          ok,
          status,
          payload,
          ...(message ? { message } : {}),
        },
        bobOrigin,
      );
    };

    const devstudioAccountId = await resolveDevStudioAccountId().catch(() => '');
    if (!devstudioAccountId || accountId !== devstudioAccountId || !findInstanceByPublicId(publicId)) {
      reply({ ok: false, status: 404, message: 'coreui.errors.instance.notFound' });
      return;
    }

    try {
      if (command === 'update-instance') {
        const config = body && typeof body === 'object' && !Array.isArray(body) ? body.config : null;
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
          reply({ ok: false, status: 422, message: 'coreui.errors.payload.invalid' });
          return;
        }

        const res = await fetchDevStudio(buildDevStudioApiUrl('/api/devstudio/instance', { accountId, publicId }), {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config }),
        });
        const payload = await res.json().catch(() => null);
        if (res.ok && payload && typeof payload === 'object' && payload.config && typeof payload.config === 'object') {
          const instance = findInstanceByPublicId(publicId);
          if (instance) instance.config = payload.config;
        }
        reply({
          ok: res.ok,
          status: res.status,
          payload,
          message:
            !res.ok && payload?.error?.reasonKey
              ? String(payload.error.reasonKey)
              : !res.ok
                ? `HTTP_${res.status}`
                : undefined,
        });
        return;
      }

      if (command === 'put-user-locale-layer') {
        const res = await fetchDevStudio(
          buildDevStudioApiUrl('/api/devstudio/instance/localization/user', { accountId, publicId, locale }),
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {}),
          },
        );
        const payload = await res.json().catch(() => null);
        reply({
          ok: res.ok,
          status: res.status,
          payload,
          message:
            !res.ok && payload?.error?.reasonKey
              ? String(payload.error.reasonKey)
              : !res.ok
                ? `HTTP_${res.status}`
                : undefined,
        });
        return;
      }

      if (command === 'get-localization-snapshot') {
        const payload = await fetchInstanceLocalization(publicId, accountId);
        reply({
          ok: true,
          status: 200,
          payload,
        });
        return;
      }

      if (command === 'get-l10n-status') {
        const res = await fetchDevStudio(
          buildDevStudioApiUrl(`/api/devstudio/instances/${encodeURIComponent(publicId)}/l10n/status`, {
            _t: Date.now(),
          }),
        );
        const payload = await res.json().catch(() => null);
        reply({
          ok: res.ok,
          status: res.status,
          payload,
          message:
            !res.ok && payload?.error?.reasonKey
              ? String(payload.error.reasonKey)
              : !res.ok
                ? `HTTP_${res.status}`
                : undefined,
        });
        return;
      }

      if (command === 'delete-user-locale-layer') {
        const res = await fetchDevStudio(
          buildDevStudioApiUrl('/api/devstudio/instance/localization/user', { accountId, publicId, locale }),
          { method: 'DELETE' },
        );
        const payload = await res.json().catch(() => null);
        reply({
          ok: res.ok,
          status: res.status,
          payload,
          message:
            !res.ok && payload?.error?.reasonKey
              ? String(payload.error.reasonKey)
              : !res.ok
                ? `HTTP_${res.status}`
                : undefined,
        });
        return;
      }

      reply({ ok: false, status: 422, message: 'coreui.errors.builder.command.unsupported' });
    } catch (error) {
      reply({
        ok: false,
        status: 500,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function summarizeL10nStatus(payload) {
    const locales = Array.isArray(payload?.locales) ? payload.locales : [];
    const localized = locales.filter((entry) => entry?.locale && entry.locale !== 'en');
    const countStatus = (predicate) => localized.filter(predicate).length;
    const succeeded = countStatus((entry) => entry?.status === 'succeeded');
    const dirty = countStatus((entry) => entry?.status === 'dirty');
    const queued = countStatus((entry) => entry?.status === 'queued');
    const running = countStatus((entry) => entry?.status === 'running');
    const retrying = countStatus((entry) => entry?.status === 'failed' && Boolean(entry?.nextAttemptAt));
    const failed = countStatus((entry) => entry?.status === 'failed' && !entry?.nextAttemptAt);
    const superseded = countStatus((entry) => entry?.status === 'superseded');

    let label = 'Live';
    let tone = 'ready';
    if (failed > 0) {
      label = 'Failed';
      tone = 'unavailable';
    } else if (running > 0) {
      label = 'Updating';
      tone = 'running';
    } else if (queued > 0) {
      label = 'Queued';
      tone = 'pending';
    } else if (retrying > 0) {
      label = 'Retrying';
      tone = 'retrying';
    } else if (dirty > 0 || superseded > 0) {
      label = 'Outdated';
      tone = 'pending';
    }

    const firstError = localized.find((entry) => entry?.lastError);
    const rawError = firstError?.lastError ? String(firstError.lastError).trim() : '';
    const meta = [
      succeeded > 0 ? `${succeeded} live` : '',
      running > 0 ? `${running} running` : '',
      queued > 0 ? `${queued} queued` : '',
      retrying > 0 ? `${retrying} retrying` : '',
      dirty > 0 ? `${dirty} dirty` : '',
      superseded > 0 ? `${superseded} superseded` : '',
      failed > 0 ? `${failed} failed` : '',
      rawError
        ? `Last error: ${rawError.length > 120 ? `${rawError.slice(0, 117)}...` : rawError}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const shouldPoll = running > 0 || queued > 0 || retrying > 0;
    return { label, tone, meta, shouldPoll };
  }

  async function refreshL10nStatus(publicId) {
    if (supportMode) {
      setL10nStatusDisplay({
        state: 'ready',
        tone: 'unavailable',
        value: supportStatusValue,
        meta: supportStatusMeta,
      });
      return;
    }
    if (!publicId) {
      setL10nStatusDisplay({ state: 'hidden', tone: 'unavailable', value: '-', meta: '' });
      return;
    }

    if (isLocalDefaultPublicId(publicId)) {
      setL10nStatusDisplay({
        state: 'ready',
        tone: 'unavailable',
        value: 'Local',
        meta: 'Main instance from widget defaults; no cloud locale jobs',
      });
      return;
    }

    const existingTimer = getL10nStatusTimer();
    if (existingTimer) {
      clearTimeout(existingTimer);
      setL10nStatusTimer(null);
    }

    setL10nStatusDisplay({ state: 'loading', tone: 'pending', value: 'Loading...', meta: '' });

    try {
      const res = await fetchDevStudio(
        buildDevStudioApiUrl(`/api/devstudio/instances/${encodeURIComponent(publicId)}/l10n/status`, {
          _t: Date.now(),
        }),
      );
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const reasonKey = payload?.error?.reasonKey || payload?.error?.code || null;
        if (res.status === 403 && String(reasonKey || '').includes('coreui.upsell')) {
          setL10nStatusDisplay({
            state: 'ready',
            tone: 'unavailable',
            value: 'Off',
            meta: 'Upgrade required',
          });
          return;
        }
        setL10nStatusDisplay({
          state: 'ready',
          tone: 'unavailable',
          value: 'Unavailable',
          meta: '',
        });
        return;
      }

      if (payload?.unavailable === true) {
        setL10nStatusDisplay({
          state: 'ready',
          tone: 'unavailable',
          value: 'Unavailable',
          meta: 'Translations status unavailable',
        });
        return;
      }

      const locales = Array.isArray(payload?.locales) ? payload.locales : [];
      const nonBaseLocales = locales.filter((entry) => entry?.locale !== 'en');
      if (!nonBaseLocales.length) {
        setL10nStatusDisplay({
          state: 'ready',
          tone: 'unavailable',
          value: 'Off',
          meta: 'No active locales (EN only)',
        });
        return;
      }

      const summary = summarizeL10nStatus(payload);
      setL10nStatusDisplay({
        state: 'ready',
        tone: summary.tone,
        value: summary.label,
        meta: summary.meta,
      });

      if (summary.shouldPoll) {
        setL10nStatusTimer(
          setTimeout(() => {
            refreshL10nStatus(publicId).catch(() => {});
          }, 15000),
        );
      }
    } catch (err) {
      console.error('[DevStudio] Failed to load l10n status', err);
      setL10nStatusDisplay({
        state: 'ready',
        tone: 'unavailable',
        value: 'Unavailable',
        meta: '',
      });
    }
  }

  async function fetchInstanceCore(publicId, accountId = null) {
    if (!accountId) {
      accountId = await resolveDevStudioAccountId();
    }
    const res = await fetchDevStudio(
      buildDevStudioApiUrl('/api/devstudio/instance', { accountId, publicId, _t: Date.now() }),
    );
    if (!res.ok) throw new Error(`Failed to load instance ${publicId} (${res.status})`);
    return await res.json();
  }

  async function fetchInstanceLocalization(publicId, accountId = null) {
    if (!accountId) {
      accountId = await resolveDevStudioAccountId();
    }
    const res = await fetchDevStudio(
      buildDevStudioApiUrl('/api/devstudio/instance/localization', { accountId, publicId, _t: Date.now() }),
    );
    if (!res.ok) {
      throw new Error(`Failed to load localization ${publicId} (${res.status})`);
    }
    return await res.json();
  }

  async function fetchInstanceEnvelope(publicId, accountId = null) {
    if (!accountId) {
      accountId = await resolveDevStudioAccountId();
    }
    const cacheKey = `${accountId}::${publicId}`;
    if (instanceEnvelopePromiseCache.has(cacheKey)) {
      return instanceEnvelopePromiseCache.get(cacheKey);
    }
    const promise = (async () => {
      const [core, localizationResult] = await Promise.all([
        fetchInstanceCore(publicId, accountId),
        fetchInstanceLocalization(publicId, accountId).catch(() => null),
      ]);
      return {
        ...core,
        localization: localizationResult?.localization ?? core?.localization ?? null,
      };
    })().finally(() => {
      instanceEnvelopePromiseCache.delete(cacheKey);
    });

    instanceEnvelopePromiseCache.set(cacheKey, promise);
    return promise;
  }

  async function fetchLocalWidgetCatalog() {
    const res = await fetchDevStudio(buildDevStudioApiUrl('/api/devstudio/widgets', { _t: Date.now() }));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `[DevStudio] Failed to load local widget catalog (HTTP ${res.status})${text ? `: ${text}` : ''}`,
      );
    }
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.widgets)
      ? data.widgets
          .map((entry) => normalizeWidgetname(entry?.widgetType))
          .filter((widgetType) => typeof widgetType === 'string' && widgetType)
      : [];
  }

  async function fetchInstances() {
    console.log('[DevStudio] Fetching instances');
    const res = await fetchDevStudio(buildDevStudioApiUrl('/api/devstudio/instances', { _t: Date.now() }));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && parsed.error) {
          detail = parsed.error?.reasonKey ? String(parsed.error.reasonKey) : JSON.stringify(parsed.error);
        }
      } catch {}
      throw new Error(
        `[DevStudio] Failed to fetch instances (HTTP ${res.status})${detail ? `: ${detail}` : ''}`,
      );
    }
    const data = await res.json();
    const payload = Array.isArray(data.instances) ? data.instances : [];
    return payload.map((inst) => ({
      publicId: inst.publicId,
      widgetname: inst.widgetType,
      widgetSlug: normalizeWidgetname(inst.widgetType),
      label: isMainInstancePublicId(inst.publicId, inst.widgetType)
        ? 'Main instance'
        : typeof inst.displayName === 'string' && inst.displayName.trim()
          ? inst.displayName.trim()
          : DEFAULT_INSTANCE_DISPLAY_NAME,
      status: inst.status === 'published' ? 'published' : 'unpublished',
      source: inst.source === 'curated' ? 'curated' : 'account',
      actions: inst.actions || null,
      config: null,
      localization: null,
      policy: null,
      meta: null,
    }));
  }

  return {
    buildSupportInstance,
    runSupportAccountCommand,
    runDevstudioAccountCommand,
    fetchLocalWidgetCatalog,
    fetchInstances,
    fetchInstanceEnvelope,
    refreshL10nStatus,
    resolveDevStudioAccountId,
  };
}
