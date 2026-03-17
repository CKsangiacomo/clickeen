import { resolvePolicy } from '@clickeen/ck-policy';

const DEVSTUDIO_LOCAL_POLICY = resolvePolicy({ profile: 'tier3', role: 'owner' });

const DEVSTUDIO_LOCALIZATION_SNAPSHOT = {
  accountLocales: ['en'],
  invalidAccountLocales: null,
  readyLocales: ['en'],
  localeOverlays: [],
  policy: {
    baseLocale: 'en',
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: true },
  },
};

export function createBobHost(deps) {
  const compiledCache = new Map();
  const compiledPromiseCache = new Map();
  let sendInstanceSeq = 0;

  const {
    windowRef,
    performanceRef,
    cryptoRef,
    bobOrigin,
    supportMode,
    tokyoBase,
    defaultInstanceDisplayName,
    iframe,
    getBobSessionId,
    resolveDevStudioAccountId,
    findInstanceByPublicId,
    normalizeWidgetname,
    isLocalDefaultPublicId,
    fetchInstanceEnvelope,
    getSupportTarget,
  } = deps;

  function fetchBob(url, init = {}) {
    const requestInit = { ...init };
    if (!Object.prototype.hasOwnProperty.call(requestInit, 'credentials')) {
      requestInit.credentials = 'include';
    }
    if (!Object.prototype.hasOwnProperty.call(requestInit, 'mode')) {
      requestInit.mode = 'cors';
    }
    return fetch(url, requestInit);
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  async function ensureCompiledWidget(widgetname) {
    const slug = normalizeWidgetname(widgetname);
    if (!slug) throw new Error(`Cannot normalize widget name: ${widgetname}`);
    if (compiledCache.has(slug)) return compiledCache.get(slug);
    if (compiledPromiseCache.has(slug)) return compiledPromiseCache.get(slug);

    const promise = (async () => {
      const res = await fetchBob(`${bobOrigin}/api/widgets/${slug}/compiled`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        let details = '';
        try {
          const text = await res.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                details = String(parsed.error || '');
              } else {
                details = text;
              }
            } catch {
              details = text;
            }
          }
        } catch {}
        const suffix = details ? ` → ${details}` : '';
        throw new Error(`Failed to compile widget ${widgetname} (${res.status})${suffix}`);
      }
      const json = await res.json();
      compiledCache.set(slug, json);
      return json;
    })().finally(() => {
      compiledPromiseCache.delete(slug);
    });

    compiledPromiseCache.set(slug, promise);
    return promise;
  }

  function invalidateCompiledWidget(widgetname) {
    const slug = normalizeWidgetname(widgetname);
    if (!slug) return;
    compiledCache.delete(slug);
    compiledPromiseCache.delete(slug);
  }

  async function exportInstanceDataFromBob({ timeoutMs = 2500, exportMode = 'base' } = {}) {
    const target = iframe.contentWindow;
    if (!target) throw new Error('[DevStudio] Bob iframe not ready');
    const requestId = cryptoRef.randomUUID();

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('[DevStudio] Timed out requesting instance data from Bob'));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        windowRef.removeEventListener('message', onMessage);
      };

      const onMessage = (event) => {
        if (event.origin !== bobOrigin) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type !== 'bob:export-instance-data') return;
        if (data.requestId !== requestId) return;
        cleanup();
        if (data.ok !== true) {
          reject(new Error(data.error || '[DevStudio] Bob failed to export instance data'));
          return;
        }
        resolve(data);
      };

      windowRef.addEventListener('message', onMessage);
      target.postMessage(
        {
          type: 'host:export-instance-data',
          requestId,
          exportMode,
        },
        bobOrigin,
      );
    });
  }

  async function postOpenEditorAndWait(target, messageBase) {
    const sessionId = String(getBobSessionId() || '').trim();
    if (!sessionId) {
      throw new Error('[DevStudio] Bob session is not ready');
    }
    const requestId = cryptoRef.randomUUID();
    const message = { ...messageBase, requestId, sessionId };

    await new Promise((resolve, reject) => {
      let settled = false;
      let acknowledged = false;
      let attempts = 0;
      let retryTimer = null;
      let timeoutTimer = null;

      const cleanup = () => {
        if (retryTimer) clearTimeout(retryTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        windowRef.removeEventListener('message', onMessage);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const send = () => {
        if (settled) return;
        attempts += 1;
        target.postMessage(message, bobOrigin);

        if (!acknowledged) {
          if (attempts >= 6) {
            fail(new Error('[DevStudio] Timed out waiting for bob:open-editor-ack'));
            return;
          }
          retryTimer = setTimeout(send, 250);
        }
      };

      const onMessage = (event) => {
        if (event.origin !== bobOrigin) return;
        if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (String(data.requestId || '') !== requestId) return;
        if (String(data.sessionId || '') !== sessionId) return;

        if (data.type === 'bob:open-editor-ack') {
          acknowledged = true;
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
          return;
        }

        if (data.type === 'bob:open-editor-applied') {
          succeed();
          return;
        }

        if (data.type === 'bob:open-editor-failed') {
          const reason = String(data.reasonKey || data.message || '[DevStudio] Bob failed to apply instance');
          fail(new Error(reason));
        }
      };

      timeoutTimer = setTimeout(
        () => fail(new Error('[DevStudio] Timed out waiting for bob:open-editor-applied')),
        7000,
      );
      windowRef.addEventListener('message', onMessage);
      send();
    });
  }

  async function sendInstanceToIframe(publicId) {
    if (!publicId) {
      throw new Error('[DevStudio] Missing publicId for sendInstanceToIframe');
    }
    const requestSeq = ++sendInstanceSeq;
    const totalStart = performanceRef.now();
    const hostOrigin = window.location.origin.replace(/\/+$/, '');
    const assetApiBase = `${hostOrigin}/api/devstudio/assets`;
    const assetUploadEndpoint = `${hostOrigin}/api/devstudio/assets/upload`;

    const target = iframe.contentWindow;
    if (!target) {
      throw new Error('[DevStudio] Bob iframe contentWindow unavailable');
    }

    const instance = findInstanceByPublicId(publicId);
    if (!instance) {
      throw new Error(`[DevStudio] Instance not found for publicId ${publicId}`);
    }
    const label =
      typeof instance.label === 'string' && instance.label.trim()
        ? instance.label.trim()
        : defaultInstanceDisplayName;

    const slug = instance.widgetSlug || normalizeWidgetname(instance.widgetname);
    if (!slug) {
      throw new Error(`[DevStudio] Unable to derive widget slug for ${instance.widgetname}`);
    }

    if (instance.source === 'local' || isLocalDefaultPublicId(publicId)) {
      const devstudioAccountId = await resolveDevStudioAccountId();
      const compiledStart = performanceRef.now();
      const compiled = await ensureCompiledWidget(instance.widgetname);
      if (requestSeq !== sendInstanceSeq) return;
      const defaults =
        compiled?.defaults && typeof compiled.defaults === 'object' && !Array.isArray(compiled.defaults)
          ? cloneJson(compiled.defaults)
          : {};

      await postOpenEditorAndWait(target, {
        type: 'ck:open-editor',
        subjectMode: 'account',
        publicId,
        accountId: devstudioAccountId,
        ownerAccountId: devstudioAccountId,
        assetApiBase,
        assetUploadEndpoint,
        label,
        widgetname: slug,
        compiled,
        instanceData: defaults,
        localization: DEVSTUDIO_LOCALIZATION_SNAPSHOT,
        policy: DEVSTUDIO_LOCAL_POLICY,
      });
      console.log('[DevStudio] Main instance load timings', {
        publicId,
        compileMs: Math.round(performanceRef.now() - compiledStart),
        totalMs: Math.round(performanceRef.now() - totalStart),
      });
      return;
    }

    if (supportMode) {
      const supportTarget = getSupportTarget();
      if (!supportTarget) {
        throw new Error('[DevStudio] Missing support target envelope');
      }
      const compiled = await ensureCompiledWidget(instance.widgetname);
      if (requestSeq !== sendInstanceSeq) return;
      await postOpenEditorAndWait(target, {
        type: 'ck:open-editor',
        subjectMode: 'account',
        publicId,
        accountId:
          typeof supportTarget.accountId === 'string' && supportTarget.accountId.trim()
            ? supportTarget.accountId.trim()
            : '',
        ownerAccountId:
          typeof supportTarget.ownerAccountId === 'string' && supportTarget.ownerAccountId.trim()
            ? supportTarget.ownerAccountId.trim()
            : typeof supportTarget.accountId === 'string' && supportTarget.accountId.trim()
              ? supportTarget.accountId.trim()
              : '',
        assetApiBase,
        assetUploadEndpoint,
        label,
        widgetname: slug,
        compiled,
        instanceData:
          supportTarget.config && typeof supportTarget.config === 'object' && !Array.isArray(supportTarget.config)
            ? supportTarget.config
            : {},
        status: supportTarget.status === 'published' ? 'published' : 'unpublished',
        localization:
          supportTarget.localization && typeof supportTarget.localization === 'object'
            ? supportTarget.localization
            : null,
        policy:
          supportTarget.policy && typeof supportTarget.policy === 'object' ? supportTarget.policy : null,
      });
      return;
    }

    let compiled = compiledCache.get(slug);
    const devstudioAccountId = await resolveDevStudioAccountId();
    const hasInlineConfig = Boolean(
      instance.config && typeof instance.config === 'object' && !Array.isArray(instance.config),
    );
    const compiledStart = performanceRef.now();
    const compiledPromise = compiled
      ? Promise.resolve({ value: compiled, durationMs: performanceRef.now() - compiledStart })
      : ensureCompiledWidget(instance.widgetname).then((nextCompiled) => ({
          value: nextCompiled,
          durationMs: performanceRef.now() - compiledStart,
        }));

    const envelopeStart = performanceRef.now();
    const envelopePromise = hasInlineConfig
      ? Promise.resolve({
          value: {
            config: instance.config,
            localization: instance.localization ?? null,
            policy: instance.policy ?? null,
            ownerAccountId: devstudioAccountId,
            status: instance.status ?? 'unpublished',
          },
          durationMs: performanceRef.now() - envelopeStart,
        })
      : fetchInstanceEnvelope(publicId, devstudioAccountId).then((envelope) => ({
          value: envelope,
          durationMs: performanceRef.now() - envelopeStart,
        }));

    const [compiledResult, envelopeResult] = await Promise.all([compiledPromise, envelopePromise]);
    if (requestSeq !== sendInstanceSeq) return;
    compiled = compiledResult.value;
    const envelope = envelopeResult.value ?? {};
    const config = envelope?.config ?? null;
    instance.config = config;
    instance.localization = envelope?.localization ?? null;
    instance.policy =
      envelope?.policy && typeof envelope.policy === 'object' ? envelope.policy : DEVSTUDIO_LOCAL_POLICY;
    instance.status = envelope?.status === 'published' ? 'published' : 'unpublished';
    console.log('[DevStudio] Posting instance to Bob', { publicId, widgetname: slug });
    await postOpenEditorAndWait(target, {
      type: 'ck:open-editor',
      subjectMode: 'account',
      publicId,
      accountId: devstudioAccountId,
      ownerAccountId:
        typeof envelope?.ownerAccountId === 'string' && envelope.ownerAccountId.trim()
          ? envelope.ownerAccountId.trim()
          : devstudioAccountId,
      assetApiBase,
      assetUploadEndpoint,
      label,
      widgetname: slug,
      compiled,
      instanceData: config ?? null,
      status: instance.status,
      localization: instance.localization,
      policy: instance.policy,
    });
    console.log('[DevStudio] Instance load timings', {
      publicId,
      compileMs: Math.round(compiledResult.durationMs),
      configMs: Math.round(envelopeResult.durationMs),
      totalMs: Math.round(performanceRef.now() - totalStart),
    });
  }

  return {
    ensureCompiledWidget,
    exportInstanceDataFromBob,
    invalidateCompiledWidget,
    sendInstanceToIframe,
  };
}
