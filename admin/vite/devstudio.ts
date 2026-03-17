import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  buildL10nSnapshot,
  computeBaseFingerprint,
  normalizeLocaleToken,
  type AllowlistEntry,
} from '@clickeen/l10n';
import {
  buildLocaleMirrorPayload,
  deleteTokyoOverlay,
  loadSavedAccountInstanceFromTokyo,
  loadTokyoAllowlist,
  loadTokyoCurrentArtifactReadyLocales,
  parseAccountLocaleListStrict,
  parseAccountL10nPolicyStrict,
  upsertTokyoOverlay,
  validateUserOps,
  writeTokyoBaseSnapshot,
  type AccountLocalizationSnapshot,
  type AccountL10nPolicy,
  type LocalizationOp,
} from '../../roma/lib/account-l10n';
import {
  loadTokyoPreferredAccountInstance,
  saveAccountInstanceDirect,
  validatePersistableConfig,
} from '../../roma/lib/account-instance-direct';

const DEVSTUDIO_ALLOWED_ASSET_ORIGINS = new Set([
  'https://bob.dev.clickeen.com',
  'https://bob.clickeen.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const DEVSTUDIO_ASSET_ALLOW_HEADERS = [
  'authorization',
  'content-type',
  'x-account-id',
  'x-public-id',
  'x-widget-type',
  'x-filename',
  'x-source',
  'x-clickeen-surface',
  'x-request-id',
].join(', ');

type DevstudioPluginOptions = {
  rootDir: string;
  internalServiceId: string;
  platformAccountId: string;
};

type DevstudioPlatformContext =
  | {
      ok: true;
      accountId: string;
      scope: 'platform';
      mode: 'local-tool';
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

type DevstudioInstanceListEntry = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  source: 'account' | 'curated';
};

type DevstudioSavedInstanceState = {
  config: Record<string, unknown>;
  widgetType: string;
  updatedAt: string;
  published: boolean;
  seoGeoLive: boolean;
};

type DevstudioLocalizationBaseContext = {
  accountLocales: string[];
  desiredLocales: string[];
  policy: AccountL10nPolicy;
  localizationAllowlist: AllowlistEntry[];
  baseTextPack: Record<string, string>;
  baseFingerprint: string;
  saved: DevstudioSavedInstanceState;
};

type DevstudioOverlayIndex = {
  layers?: Record<string, { keys?: unknown }>;
};

type DevstudioLiveLocalePayload = {
  baseFingerprint?: unknown;
  textFp?: unknown;
  updatedAt?: unknown;
};

export function createDevstudioPlugins(options: DevstudioPluginOptions): Plugin[] {
  const rootEnvLocalPath = path.resolve(options.rootDir, '.env.local');
  const widgetsRoot = path.resolve(options.rootDir, 'tokyo', 'widgets');
  let cachedRootEnvLocal: Map<string, string> | null = null;

  function readRootEnvLocal(): Map<string, string> {
    if (cachedRootEnvLocal) return cachedRootEnvLocal;
    const values = new Map<string, string>();
    if (!fs.existsSync(rootEnvLocalPath)) {
      cachedRootEnvLocal = values;
      return values;
    }
    const raw = fs.readFileSync(rootEnvLocalPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return;
      const [, key, remainder] = match;
      let value = remainder.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values.set(key, value);
    });
    cachedRootEnvLocal = values;
    return values;
  }

  function resolveRootEnvValue(name: string): string {
    const direct = String(process.env[name] || '').trim();
    if (direct) return direct;
    return String(readRootEnvLocal().get(name) || '').trim();
  }

  function listLocalWidgetCatalog() {
    if (!fs.existsSync(widgetsRoot)) return [];
    return fs
      .readdirSync(widgetsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name.trim().toLowerCase())
      .filter(Boolean)
      .filter((widgetType) => fs.existsSync(path.join(widgetsRoot, widgetType, 'spec.json')))
      .sort((a, b) => a.localeCompare(b))
      .map((widgetType) => ({ widgetType }));
  }

  function readRequestBuffer(req: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  async function readRequestText(req: NodeJS.ReadableStream): Promise<string> {
    return (await readRequestBuffer(req)).toString('utf8');
  }

  function resolveDevstudioTokyoBaseUrl(): string {
    const raw = String(
      process.env.TOKYO_URL || process.env.NEXT_PUBLIC_TOKYO_URL || 'https://tokyo.dev.clickeen.com',
    )
      .trim()
      .replace(/\/+$/, '');
    if (!raw) {
      throw new Error('Missing TOKYO_URL for local DevStudio routes.');
    }
    return raw;
  }

  function resolveDevstudioTokyoWorkerBaseUrl(): string {
    const raw = String(process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791')
      .trim()
      .replace(/\/+$/, '');
    if (!raw) {
      throw new Error('Missing TOKYO_WORKER_BASE_URL for local DevStudio asset routes.');
    }
    return raw;
  }

  function resolveDevstudioTokyoAccessToken(): string {
    const raw =
      resolveRootEnvValue('TOKYO_DEV_JWT') || resolveRootEnvValue('CK_INTERNAL_SERVICE_JWT');
    if (!raw) {
      throw new Error('Missing TOKYO_DEV_JWT for local DevStudio routes.');
    }
    return raw;
  }

  function createDevstudioTokyoScope(accountId: string) {
    return {
      tokyoBaseUrl: resolveDevstudioTokyoBaseUrl(),
      tokyoAccessToken: resolveDevstudioTokyoAccessToken(),
      internalServiceName: options.internalServiceId,
      accountId,
    };
  }

  async function resolveDevstudioPlatformContext(_req: unknown): Promise<DevstudioPlatformContext> {
    return {
      ok: true,
      accountId: options.platformAccountId,
      scope: 'platform',
      mode: 'local-tool',
    };
  }

  function createDevstudioTokyoHeaders(initHeaders?: HeadersInit): Headers {
    const headers = new Headers(initHeaders || {});
    headers.set('authorization', `Bearer ${resolveDevstudioTokyoAccessToken()}`);
    headers.set('x-ck-internal-service', options.internalServiceId);
    return headers;
  }

  function resolveMichaelBaseUrl(): string {
    const raw = resolveRootEnvValue('SUPABASE_URL').replace(/\/+$/, '');
    if (!raw) {
      throw new Error('Missing SUPABASE_URL for local DevStudio routes.');
    }
    return raw;
  }

  function resolveMichaelServiceRoleKey(): string {
    const raw = resolveRootEnvValue('SUPABASE_SERVICE_ROLE_KEY');
    if (!raw) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for local DevStudio routes.');
    }
    return raw;
  }

  function createMichaelHeaders(initHeaders?: HeadersInit): Headers {
    const serviceRoleKey = resolveMichaelServiceRoleKey();
    const headers = new Headers(initHeaders || {});
    headers.set('apikey', serviceRoleKey);
    headers.set('authorization', `Bearer ${serviceRoleKey}`);
    return headers;
  }

  function encodeFilterValue(value: string): string {
    return encodeURIComponent(String(value || '').trim());
  }

  function asTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  function formatCuratedDisplayName(meta: unknown, fallback: string): string {
    if (!isRecord(meta)) return fallback;
    return (
      asTrimmedString(meta.styleName) ||
      asTrimmedString(meta.name) ||
      asTrimmedString(meta.title) ||
      fallback
    );
  }

  async function readResponseText(response: Response): Promise<string> {
    return await response.text().catch(() => '');
  }

  async function parseJsonText<T>(text: string): Promise<T | null> {
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  async function fetchMichaelJson<T>(pathWithQuery: string): Promise<{
    response: Response;
    payload: T | null;
    text: string;
  }> {
    const response = await fetch(`${resolveMichaelBaseUrl()}${pathWithQuery}`, {
      method: 'GET',
      headers: createMichaelHeaders({ accept: 'application/json' }),
      cache: 'no-store',
    });
    const text = await readResponseText(response);
    return {
      response,
      payload: await parseJsonText<T>(text),
      text,
    };
  }

  function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
    const pathSegments = String(pathStr || '')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const allowSegments = String(allowPath || '')
      .split('.')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (pathSegments.length !== allowSegments.length) return false;
    for (let index = 0; index < allowSegments.length; index += 1) {
      const allow = allowSegments[index];
      const actual = pathSegments[index];
      if (allow === '*') {
        if (!/^\d+$/.test(actual || '')) return false;
        continue;
      }
      if (allow !== actual) return false;
    }
    return true;
  }

  function filterAllowlistedOps(raw: unknown, allowlist: AllowlistEntry[]): LocalizationOp[] {
    if (!Array.isArray(raw)) return [];
    const allowlistPaths = allowlist.map((entry) => String(entry.path || '').trim()).filter(Boolean);
    const out: LocalizationOp[] = [];
    for (const entry of raw) {
      if (!isRecord(entry) || entry.op !== 'set') continue;
      const path = asTrimmedString(entry.path);
      if (!path || typeof entry.value !== 'string') continue;
      if (!allowlistPaths.some((allowPath) => pathMatchesAllowlist(path, allowPath))) continue;
      out.push({ op: 'set', path, value: entry.value });
    }
    return out;
  }

  function isDevstudioInstanceMissing(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message === 'devstudio_instance_not_found' || error.message === 'tokyo_saved_http_404')
    );
  }

  function writeJson(res: any, status: number, body: unknown) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  }

  async function loadPlatformAccountRow(accountId: string): Promise<{
    accountLocales: string[];
    policy: AccountL10nPolicy;
  }> {
    const { response, payload, text } = await fetchMichaelJson<
      Array<{ id?: unknown; l10n_locales?: unknown; l10n_policy?: unknown }>
    >(
      `/rest/v1/accounts?select=id,l10n_locales,l10n_policy&id=eq.${encodeFilterValue(accountId)}&limit=1`,
    );
    if (!response.ok) {
      throw new Error(`michael_account_http_${response.status}:${text || 'unknown'}`);
    }
    const row = Array.isArray(payload) ? payload[0] : null;
    if (!row) {
      throw new Error('michael_account_missing');
    }
    return {
      accountLocales: parseAccountLocaleListStrict(row.l10n_locales),
      policy: parseAccountL10nPolicyStrict(row.l10n_policy),
    };
  }

  async function loadPlatformWidgetTypeById(): Promise<Map<string, string>> {
    const { response, payload, text } = await fetchMichaelJson<Array<{ id?: unknown; type?: unknown }>>(
      `/rest/v1/widgets?select=id,type&order=type.asc&limit=500`,
    );
    if (!response.ok) {
      throw new Error(`michael_widgets_http_${response.status}:${text || 'unknown'}`);
    }
    const out = new Map<string, string>();
    for (const row of Array.isArray(payload) ? payload : []) {
      const id = asTrimmedString(row?.id);
      const widgetType = asTrimmedString(row?.type);
      if (!id || !widgetType) continue;
      out.set(id, widgetType);
    }
    return out;
  }

  async function loadPlatformInstanceCatalog(accountId: string): Promise<{
    widgetTypes: string[];
    instances: DevstudioInstanceListEntry[];
  }> {
    const widgetTypeByIdPromise = loadPlatformWidgetTypeById();
    const accountInstancesPromise = fetchMichaelJson<
      Array<{ public_id?: unknown; display_name?: unknown; status?: unknown; widget_id?: unknown }>
    >(
      `/rest/v1/widget_instances?select=public_id,display_name,status,widget_id&account_id=eq.${encodeFilterValue(accountId)}&order=created_at.desc&limit=500`,
    );
    const curatedInstancesPromise = fetchMichaelJson<
      Array<{ public_id?: unknown; widget_type?: unknown; status?: unknown; meta?: unknown }>
    >(
      `/rest/v1/curated_widget_instances?select=public_id,widget_type,status,meta&owner_account_id=eq.${encodeFilterValue(accountId)}&order=created_at.desc&limit=500`,
    );

    const [widgetTypeById, accountInstancesResult, curatedInstancesResult] = await Promise.all([
      widgetTypeByIdPromise,
      accountInstancesPromise,
      curatedInstancesPromise,
    ]);

    if (!accountInstancesResult.response.ok) {
      throw new Error(
        `michael_widget_instances_http_${accountInstancesResult.response.status}:${accountInstancesResult.text || 'unknown'}`,
      );
    }
    if (!curatedInstancesResult.response.ok) {
      throw new Error(
        `michael_curated_instances_http_${curatedInstancesResult.response.status}:${curatedInstancesResult.text || 'unknown'}`,
      );
    }

    const widgetTypes = new Set<string>();
    const instances: DevstudioInstanceListEntry[] = [];

    for (const row of Array.isArray(accountInstancesResult.payload) ? accountInstancesResult.payload : []) {
      const publicId = asTrimmedString(row?.public_id);
      const widgetId = asTrimmedString(row?.widget_id);
      const widgetType = widgetId ? widgetTypeById.get(widgetId) ?? null : null;
      if (!publicId || !widgetType) continue;
      widgetTypes.add(widgetType);
      instances.push({
        publicId,
        widgetType,
        displayName: asTrimmedString(row?.display_name) || 'Untitled widget',
        status: row?.status === 'published' ? 'published' : 'unpublished',
        source: 'account',
      });
    }

    for (const row of Array.isArray(curatedInstancesResult.payload) ? curatedInstancesResult.payload : []) {
      const publicId = asTrimmedString(row?.public_id);
      const widgetType = asTrimmedString(row?.widget_type);
      if (!publicId || !widgetType) continue;
      widgetTypes.add(widgetType);
      instances.push({
        publicId,
        widgetType,
        displayName: formatCuratedDisplayName(row?.meta, publicId),
        status: row?.status === 'unpublished' ? 'unpublished' : 'published',
        source: 'curated',
      });
    }

    instances.sort((left, right) => left.publicId.localeCompare(right.publicId));

    return {
      widgetTypes: Array.from(widgetTypes).sort((left, right) => left.localeCompare(right)),
      instances,
    };
  }

  async function loadDevstudioSavedInstanceState(args: {
    accountId: string;
    publicId: string;
  }): Promise<DevstudioSavedInstanceState | null> {
    const scope = createDevstudioTokyoScope(args.accountId);
    try {
      const saved = await loadSavedAccountInstanceFromTokyo({
        tokyoBaseUrl: scope.tokyoBaseUrl,
        accessToken: scope.tokyoAccessToken,
        accountId: args.accountId,
        publicId: args.publicId,
        internalServiceName: scope.internalServiceName,
      });
      return {
        config: saved.config,
        widgetType: saved.widgetType,
        updatedAt: saved.updatedAt,
        published: saved.published,
        seoGeoLive: saved.seoGeoLive,
      };
    } catch (error) {
      if (isDevstudioInstanceMissing(error)) return null;
      throw error;
    }
  }

  async function loadTokyoOverlayOps(args: {
    publicId: string;
    layer: 'locale' | 'user';
    layerKey: string;
    baseFingerprint: string;
    allowlist: AllowlistEntry[];
  }): Promise<{ ops: LocalizationOp[]; baseUpdatedAt: string | null }> {
    const response = await fetch(
      `${resolveDevstudioTokyoBaseUrl()}/l10n/instances/${encodeURIComponent(args.publicId)}/${args.layer}/${encodeURIComponent(args.layerKey)}/${encodeURIComponent(args.baseFingerprint)}.ops.json`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (response.status === 404) {
      return { ops: [], baseUpdatedAt: null };
    }
    const text = await readResponseText(response);
    const payload = await parseJsonText<{ ops?: unknown; baseUpdatedAt?: unknown }>(text);
    if (!response.ok) {
      throw new Error(`tokyo_overlay_http_${response.status}:${text || 'unknown'}`);
    }
    return {
      ops: filterAllowlistedOps(payload?.ops, args.allowlist),
      baseUpdatedAt: asTrimmedString(payload?.baseUpdatedAt),
    };
  }

  async function loadTokyoOverlayIndex(publicId: string): Promise<{
    localeKeys: Set<string>;
    userKeys: Set<string>;
  }> {
    const response = await fetch(
      `${resolveDevstudioTokyoBaseUrl()}/l10n/instances/${encodeURIComponent(publicId)}/index.json`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (response.status === 404) {
      return { localeKeys: new Set(), userKeys: new Set() };
    }
    const text = await readResponseText(response);
    const payload = await parseJsonText<DevstudioOverlayIndex>(text);
    if (!response.ok || !isRecord(payload?.layers)) {
      return { localeKeys: new Set(), userKeys: new Set() };
    }
    const normalizeKeys = (value: unknown, allowGlobal = false) =>
      new Set(
        (Array.isArray(value) ? value : [])
          .map((entry) => {
            const normalized = normalizeLocaleToken(entry);
            if (normalized) return normalized;
            if (allowGlobal && String(entry || '').trim().toLowerCase() === 'global') return 'global';
            return null;
          })
          .filter((entry): entry is string => Boolean(entry)),
      );
    return {
      localeKeys: normalizeKeys(payload.layers?.locale?.keys),
      userKeys: normalizeKeys(payload.layers?.user?.keys, true),
    };
  }

  async function loadTokyoLocaleArtifactStates(args: {
    publicId: string;
    locales: string[];
  }): Promise<Map<string, { baseFingerprint: string | null; updatedAt: string | null; hasTextPack: boolean }>> {
    const locales = Array.from(
      new Set(
        args.locales
          .map((entry) => normalizeLocaleToken(entry))
          .filter((entry): entry is string => Boolean(entry)),
      ),
    );
    const states = await Promise.all(
      locales.map(async (locale) => {
        const response = await fetch(
          `${resolveDevstudioTokyoBaseUrl()}/l10n/instances/${encodeURIComponent(args.publicId)}/live/${encodeURIComponent(locale)}.json`,
          {
            method: 'GET',
            headers: { accept: 'application/json' },
            cache: 'no-store',
          },
        );
        if (response.status === 404) return [locale, null] as const;
        const text = await readResponseText(response);
        const payload = await parseJsonText<DevstudioLiveLocalePayload>(text);
        if (!response.ok) {
          throw new Error(`tokyo_l10n_live_pointer_http_${response.status}:${text || 'unknown'}`);
        }
        return [
          locale,
          {
            baseFingerprint:
              typeof payload?.baseFingerprint === 'string' &&
              /^[a-f0-9]{64}$/i.test(payload.baseFingerprint.trim())
                ? payload.baseFingerprint.trim()
                : null,
            updatedAt: asTrimmedString(payload?.updatedAt),
            hasTextPack:
              typeof payload?.textFp === 'string' && /^[a-f0-9]{64}$/i.test(payload.textFp.trim()),
          },
        ] as const;
      }),
    );
    const out = new Map<string, { baseFingerprint: string | null; updatedAt: string | null; hasTextPack: boolean }>();
    for (const [locale, state] of states) {
      if (!state) continue;
      out.set(locale, state);
    }
    return out;
  }

  async function loadDevstudioLocalizationBaseContext(args: {
    accountId: string;
    publicId: string;
  }): Promise<DevstudioLocalizationBaseContext> {
    const [account, saved] = await Promise.all([
      loadPlatformAccountRow(args.accountId),
      loadDevstudioSavedInstanceState(args),
    ]);
    if (!saved) {
      throw new Error('devstudio_instance_not_found');
    }
    const desiredLocales = Array.from(new Set([account.policy.baseLocale, ...account.accountLocales]));
    const localizationAllowlist = await loadTokyoAllowlist({
      tokyoBaseUrl: resolveDevstudioTokyoBaseUrl(),
      widgetType: saved.widgetType,
      path: 'localization',
    });
    const baseTextPack = buildL10nSnapshot(saved.config, localizationAllowlist);
    const baseFingerprint = await computeBaseFingerprint(baseTextPack);
    return {
      accountLocales: account.accountLocales,
      desiredLocales,
      policy: account.policy,
      localizationAllowlist,
      baseTextPack,
      baseFingerprint,
      saved,
    };
  }

  async function loadDevstudioLocalizationSnapshot(args: {
    accountId: string;
    publicId: string;
  }): Promise<{
    snapshot: AccountLocalizationSnapshot;
    widgetType: string;
    baseFingerprint: string;
    saved: DevstudioSavedInstanceState;
  }> {
    const base = await loadDevstudioLocalizationBaseContext(args);
    const nonBaseLocales = base.desiredLocales.filter((locale) => locale !== base.policy.baseLocale);
    const localeOverlays = await Promise.all(
      nonBaseLocales.map(async (locale) => {
        const [baseOverlay, userOverlay] = await Promise.all([
          loadTokyoOverlayOps({
            publicId: args.publicId,
            layer: 'locale',
            layerKey: locale,
            baseFingerprint: base.baseFingerprint,
            allowlist: base.localizationAllowlist,
          }),
          loadTokyoOverlayOps({
            publicId: args.publicId,
            layer: 'user',
            layerKey: locale,
            baseFingerprint: base.baseFingerprint,
            allowlist: base.localizationAllowlist,
          }),
        ]);
        return {
          locale,
          source:
            userOverlay.ops.length > 0 ? 'user' : baseOverlay.ops.length > 0 ? 'agent' : null,
          baseFingerprint:
            baseOverlay.ops.length > 0 || userOverlay.ops.length > 0 ? base.baseFingerprint : null,
          baseUpdatedAt: userOverlay.baseUpdatedAt ?? baseOverlay.baseUpdatedAt,
          hasUserOps: userOverlay.ops.length > 0,
          baseOps: baseOverlay.ops,
          userOps: userOverlay.ops,
        };
      }),
    );
    const readyLocales = await loadTokyoCurrentArtifactReadyLocales({
      tokyoBaseUrl: resolveDevstudioTokyoBaseUrl(),
      publicId: args.publicId,
      baseLocale: base.policy.baseLocale,
      locales: base.desiredLocales,
      baseFingerprint: base.baseFingerprint,
    });
    return {
      snapshot: {
        baseLocale: base.policy.baseLocale,
        accountLocales: base.accountLocales,
        readyLocales,
        invalidAccountLocales: null,
        localeOverlays,
        policy: base.policy,
      },
      widgetType: base.saved.widgetType,
      baseFingerprint: base.baseFingerprint,
      saved: base.saved,
    };
  }

  async function loadDevstudioL10nStatus(args: {
    accountId: string;
    publicId: string;
  }): Promise<{
    publicId: string;
    widgetType: string;
    baseFingerprint: string;
    baseUpdatedAt: string;
    locales: Array<{
      locale: string;
      status: 'dirty' | 'succeeded' | 'superseded';
      attempts: number;
      nextAttemptAt: null;
      lastAttemptAt: string | null;
      lastError: null;
    }>;
  }> {
    const base = await loadDevstudioLocalizationBaseContext(args);
    const [index, artifactStates] = await Promise.all([
      loadTokyoOverlayIndex(args.publicId),
      loadTokyoLocaleArtifactStates({
        publicId: args.publicId,
        locales: base.accountLocales,
      }),
    ]);
    return {
      publicId: args.publicId,
      widgetType: base.saved.widgetType,
      baseFingerprint: base.baseFingerprint,
      baseUpdatedAt: base.saved.updatedAt,
      locales: base.accountLocales.map((locale) => {
        const artifact = artifactStates.get(locale) ?? null;
        const hasCurrent =
          artifact !== null &&
          artifact.hasTextPack &&
          artifact.baseFingerprint === base.baseFingerprint;
        const hasArtifact = artifact !== null && artifact.hasTextPack;
        const hasIndexed = index.localeKeys.has(locale) || index.userKeys.has(locale);
        const status: 'dirty' | 'succeeded' | 'superseded' = hasCurrent
          ? 'succeeded'
          : hasArtifact || hasIndexed
            ? 'superseded'
            : 'dirty';
        return {
          locale,
          status,
          attempts: hasCurrent || hasArtifact || hasIndexed ? 1 : 0,
          nextAttemptAt: null,
          lastAttemptAt: artifact?.updatedAt ?? null,
          lastError: null,
        };
      }),
    };
  }

  async function loadDevstudioUserLayerContext(args: {
    accountId: string;
    publicId: string;
    locale: string;
  }): Promise<{
    widgetType: string;
    baseFingerprint: string;
    baseUpdatedAt: string;
    userAllowlist: AllowlistEntry[];
    baseConfig: Record<string, unknown>;
    baseLocale: string;
    baseTextPack: Record<string, string>;
    localeOps: LocalizationOp[];
    userOps: LocalizationOp[];
    published: boolean;
    seoGeoLive: boolean;
  }> {
    const snapshot = await loadDevstudioLocalizationSnapshot({
      accountId: args.accountId,
      publicId: args.publicId,
    });
    const userAllowlist = await loadTokyoAllowlist({
      tokyoBaseUrl: resolveDevstudioTokyoBaseUrl(),
      widgetType: snapshot.widgetType,
      path: 'user-layer',
    });
    const overlay = snapshot.snapshot.localeOverlays.find((entry) => entry.locale === args.locale) ?? null;
    return {
      widgetType: snapshot.widgetType,
      baseFingerprint: snapshot.baseFingerprint,
      baseUpdatedAt: snapshot.saved.updatedAt,
      userAllowlist,
      baseConfig: snapshot.saved.config,
      baseLocale: snapshot.snapshot.baseLocale,
      baseTextPack: buildL10nSnapshot(snapshot.saved.config, await loadTokyoAllowlist({
        tokyoBaseUrl: resolveDevstudioTokyoBaseUrl(),
        widgetType: snapshot.widgetType,
        path: 'localization',
      })),
      localeOps: overlay?.baseOps ?? [],
      userOps: overlay?.userOps ?? [],
      published: snapshot.saved.published,
      seoGeoLive: snapshot.saved.seoGeoLive,
    };
  }

  async function proxyDevstudioTokyo(args: {
    req: any;
    res: any;
    pathname: string;
    method?: string;
    body?: Buffer;
    headers?: HeadersInit;
    baseUrl?: string;
  }) {
    const upstream = await fetch(`${(args.baseUrl || resolveDevstudioTokyoBaseUrl()).replace(/\/+$/, '')}${args.pathname}`, {
      method: args.method || args.req.method || 'GET',
      headers: createDevstudioTokyoHeaders(args.headers),
      body: args.body,
      cache: 'no-store',
    } as RequestInit);

    const bytes = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    args.res.statusCode = upstream.status;
    args.res.setHeader('Content-Type', contentType);
    args.res.setHeader('Cache-Control', 'no-store');
    args.res.end(bytes);
  }

  function applyDevstudioAssetCors(req: any, res: any) {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (origin && DEVSTUDIO_ALLOWED_ASSET_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', DEVSTUDIO_ASSET_ALLOW_HEADERS);
    if (
      String(req.headers['access-control-request-private-network'] || '')
        .trim()
        .toLowerCase() === 'true'
    ) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }

  return [
    {
      name: 'devstudio-context-route',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/devstudio/context' || req.method !== 'GET') return next();
          try {
            const context = await resolveDevstudioPlatformContext(req);
            if (!context.ok) {
              writeJson(res, context.status, context.body);
              return;
            }
            writeJson(res, 200, {
              accountId: context.accountId,
              scope: context.scope,
              mode: context.mode,
            });
          } catch (error) {
            writeJson(res, 500, {
              error: {
                kind: 'INTERNAL',
                reasonKey: 'coreui.errors.auth.contextUnavailable',
                detail: error instanceof Error ? error.message : String(error),
              },
            });
          }
        });
      },
    },
    {
      name: 'devstudio-widget-catalog',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (pathname !== '/api/devstudio/widgets' || req.method !== 'GET') return next();
          try {
            writeJson(res, 200, { widgets: listLocalWidgetCatalog() });
          } catch (error) {
            writeJson(res, 500, {
              error: {
                kind: 'INTERNAL',
                reasonKey: 'coreui.errors.widgetCatalog.readFailed',
                detail: error instanceof Error ? error.message : String(error),
              },
            });
          }
        });
      },
    },
    {
      name: 'devstudio-instance-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const requestUrl = new URL(rawUrl || '/', 'http://localhost:5173');
          const pathname = requestUrl.pathname || '';

          const wantsInstances = pathname === '/api/devstudio/instances' && req.method === 'GET';
          const wantsInstance =
            pathname === '/api/devstudio/instance' && (req.method === 'GET' || req.method === 'PUT');
          const wantsLocalization =
            pathname === '/api/devstudio/instance/localization' && req.method === 'GET';
          const wantsUserLayer =
            pathname === '/api/devstudio/instance/localization/user' &&
            (req.method === 'PUT' || req.method === 'DELETE');
          const l10nStatusMatch = pathname.match(/^\/api\/devstudio\/instances\/([^/]+)\/l10n\/status$/);
          const wantsL10nStatus = Boolean(l10nStatusMatch && req.method === 'GET');

          if (
            !wantsInstances &&
            !wantsInstance &&
            !wantsLocalization &&
            !wantsUserLayer &&
            !wantsL10nStatus
          ) {
            return next();
          }

          try {
            const context = await resolveDevstudioPlatformContext(req);
            if (!context.ok) {
              writeJson(res, context.status, context.body);
              return;
            }

            if (wantsInstances) {
              writeJson(res, 200, await loadPlatformInstanceCatalog(context.accountId));
              return;
            }

            const accountId = String(requestUrl.searchParams.get('accountId') || '').trim().toLowerCase();
            if (!isUuid(accountId)) {
              writeJson(res, 422, {
                error: {
                  kind: 'VALIDATION',
                  reasonKey: 'coreui.errors.accountId.invalid',
                },
              });
              return;
            }
            if (accountId !== context.accountId) {
              writeJson(res, 404, {
                error: {
                  kind: 'NOT_FOUND',
                  reasonKey: 'coreui.errors.instance.notFound',
                },
              });
              return;
            }

            const publicId =
              wantsL10nStatus && l10nStatusMatch
                ? decodeURIComponent(l10nStatusMatch[1] || '').trim()
                : String(requestUrl.searchParams.get('publicId') || '').trim();
            if (!publicId) {
              writeJson(res, 422, {
                error: {
                  kind: 'VALIDATION',
                  reasonKey: 'coreui.errors.instance.publicIdRequired',
                },
              });
              return;
            }

            const tokyoScope = createDevstudioTokyoScope(accountId);

            if (wantsInstance && req.method === 'GET') {
              const instance = await loadTokyoPreferredAccountInstance({
                accountId,
                publicId,
                tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                tokyoAccessToken: tokyoScope.tokyoAccessToken,
                internalServiceName: tokyoScope.internalServiceName,
              });
              if (!instance.ok) {
                writeJson(res, instance.status, { error: instance.error });
                return;
              }
              writeJson(res, 200, {
                publicId: instance.value.row.publicId,
                widgetType: instance.value.row.widgetType,
                displayName: instance.value.row.displayName || 'Untitled widget',
                ownerAccountId: instance.value.row.accountId,
                status: instance.value.row.status,
                source: instance.value.row.source === 'curated' ? 'curated' : 'account',
                meta: instance.value.row.meta ?? null,
                config: instance.value.config,
              });
              return;
            }

            if (wantsInstance && req.method === 'PUT') {
              let body: { config?: unknown } | null = null;
              try {
                const rawBody = await readRequestText(req);
                body = rawBody ? (JSON.parse(rawBody) as { config?: unknown } | null) : null;
              } catch {
                body = null;
              }
              const validated = validatePersistableConfig(body?.config, accountId);
              if (!validated.ok) {
                writeJson(res, validated.status, { error: validated.error });
                return;
              }
              const saved = await saveAccountInstanceDirect({
                accountId,
                publicId,
                config: validated.value.config,
                tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                tokyoAccessToken: tokyoScope.tokyoAccessToken,
                internalServiceName: tokyoScope.internalServiceName,
              });
              if (!saved.ok) {
                writeJson(res, saved.status, { error: saved.error });
                return;
              }
              writeJson(res, 200, {
                config: saved.value.config,
                aftermath: null,
              });
              return;
            }

            if (wantsLocalization) {
              const snapshot = await loadDevstudioLocalizationSnapshot({ accountId, publicId });
              writeJson(res, 200, { localization: snapshot.snapshot });
              return;
            }

            if (wantsL10nStatus) {
              writeJson(res, 200, await loadDevstudioL10nStatus({ accountId, publicId }));
              return;
            }

            if (wantsUserLayer) {
              const locale = normalizeLocaleToken(requestUrl.searchParams.get('locale'));
              if (!locale) {
                writeJson(res, 422, {
                  error: {
                    kind: 'VALIDATION',
                    reasonKey: 'coreui.errors.payload.invalid',
                  },
                });
                return;
              }

              const contextData = await loadDevstudioUserLayerContext({
                accountId,
                publicId,
                locale,
              });

              if (req.method === 'PUT') {
                let body: { ops?: unknown } | null = null;
                try {
                  const rawBody = await readRequestText(req);
                  body = rawBody ? (JSON.parse(rawBody) as { ops?: unknown } | null) : null;
                } catch {
                  body = null;
                }
                const nextUserOps = validateUserOps(body?.ops, contextData.userAllowlist);
                if (!nextUserOps) {
                  writeJson(res, 422, {
                    error: {
                      kind: 'VALIDATION',
                      reasonKey: 'coreui.errors.payload.invalid',
                    },
                  });
                  return;
                }

                const mirror = contextData.published
                  ? buildLocaleMirrorPayload({
                      widgetType: contextData.widgetType,
                      baseConfig: contextData.baseConfig,
                      baseLocale: contextData.baseLocale,
                      locale,
                      baseTextPack: contextData.baseTextPack,
                      baseOps: contextData.localeOps,
                      userOps: nextUserOps,
                      seoGeoLive: contextData.seoGeoLive,
                    })
                  : { textPack: null, metaPack: null };

                await writeTokyoBaseSnapshot({
                  tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                  accessToken: tokyoScope.tokyoAccessToken,
                  accountId,
                  publicId,
                  internalServiceName: tokyoScope.internalServiceName,
                  baseFingerprint: contextData.baseFingerprint,
                  baseTextPack: contextData.baseTextPack,
                });

                if (nextUserOps.length === 0) {
                  await deleteTokyoOverlay({
                    tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                    accessToken: tokyoScope.tokyoAccessToken,
                    accountId,
                    publicId,
                    internalServiceName: tokyoScope.internalServiceName,
                    layer: 'user',
                    layerKey: locale,
                    baseFingerprint: contextData.baseFingerprint,
                    ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
                    ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
                  });
                  writeJson(res, 200, {
                    publicId,
                    layer: 'user',
                    layerKey: locale,
                    deleted: true,
                    baseFingerprint: contextData.baseFingerprint,
                    baseUpdatedAt: contextData.baseUpdatedAt,
                  });
                  return;
                }

                await upsertTokyoOverlay({
                  tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                  accessToken: tokyoScope.tokyoAccessToken,
                  accountId,
                  publicId,
                  internalServiceName: tokyoScope.internalServiceName,
                  layer: 'user',
                  layerKey: locale,
                  baseFingerprint: contextData.baseFingerprint,
                  baseUpdatedAt: contextData.baseUpdatedAt,
                  ops: nextUserOps,
                  ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
                  ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
                });
                writeJson(res, 200, {
                  publicId,
                  layer: 'user',
                  layerKey: locale,
                  source: 'user',
                  baseFingerprint: contextData.baseFingerprint,
                  baseUpdatedAt: contextData.baseUpdatedAt,
                });
                return;
              }

              const mirror = contextData.published
                ? buildLocaleMirrorPayload({
                    widgetType: contextData.widgetType,
                    baseConfig: contextData.baseConfig,
                    baseLocale: contextData.baseLocale,
                    locale,
                    baseTextPack: contextData.baseTextPack,
                    baseOps: contextData.localeOps,
                    userOps: [],
                    seoGeoLive: contextData.seoGeoLive,
                  })
                : { textPack: null, metaPack: null };

              await deleteTokyoOverlay({
                tokyoBaseUrl: tokyoScope.tokyoBaseUrl,
                accessToken: tokyoScope.tokyoAccessToken,
                accountId,
                publicId,
                internalServiceName: tokyoScope.internalServiceName,
                layer: 'user',
                layerKey: locale,
                baseFingerprint: contextData.baseFingerprint,
                ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
                ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
              });
              writeJson(res, 200, {
                publicId,
                layer: 'user',
                layerKey: locale,
                deleted: true,
              });
              return;
            }
          } catch (error) {
            if (isDevstudioInstanceMissing(error)) {
              writeJson(res, 404, {
                error: {
                  kind: 'NOT_FOUND',
                  reasonKey: 'coreui.errors.instance.notFound',
                },
              });
              return;
            }
            writeJson(res, 502, {
              error: {
                kind: 'UPSTREAM_UNAVAILABLE',
                reasonKey: 'coreui.errors.devstudio.instanceProxyFailed',
                detail: error instanceof Error ? error.message : String(error),
              },
            });
            return;
          }

          return next();
        });
      },
    },
    {
      name: 'devstudio-asset-routes',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url || '';
          const requestUrl = new URL(rawUrl || '/', 'http://localhost:5173');
          const pathname = requestUrl.pathname || '';

          if (!pathname.startsWith('/api/devstudio/assets')) return next();

          applyDevstudioAssetCors(req, res);

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          const listMatch = pathname.match(/^\/api\/devstudio\/assets\/([^/]+)$/);
          const resolveMatch = pathname.match(/^\/api\/devstudio\/assets\/([^/]+)\/resolve$/);
          const deleteMatch = pathname.match(/^\/api\/devstudio\/assets\/([^/]+)\/([^/]+)$/);
          const wantsUpload = pathname === '/api/devstudio/assets/upload' && req.method === 'POST';
          const wantsList = Boolean(listMatch && req.method === 'GET');
          const wantsResolve = Boolean(resolveMatch && req.method === 'POST');
          const wantsDelete = Boolean(deleteMatch && req.method === 'DELETE');

          if (!wantsUpload && !wantsList && !wantsResolve && !wantsDelete) return next();

          try {
            if (wantsUpload) {
              const body = await readRequestBuffer(req);
              const headers = new Headers();
              const forwardHeader = (name: string) => {
                const value = req.headers[name];
                if (typeof value === 'string' && value.trim()) headers.set(name, value.trim());
              };
              forwardHeader('content-type');
              forwardHeader('x-account-id');
              forwardHeader('x-filename');
              forwardHeader('x-source');
              forwardHeader('x-clickeen-surface');
              forwardHeader('x-public-id');
              forwardHeader('x-widget-type');
              return await proxyDevstudioTokyo({
                req,
                res,
                baseUrl: resolveDevstudioTokyoWorkerBaseUrl(),
                pathname: '/assets/upload',
                method: 'POST',
                body,
                headers,
              });
            }

            if (wantsList && listMatch) {
              const accountId = decodeURIComponent(listMatch[1] || '');
              const search = requestUrl.searchParams.toString();
              return await proxyDevstudioTokyo({
                req,
                res,
                baseUrl: resolveDevstudioTokyoWorkerBaseUrl(),
                pathname: `/assets/account/${encodeURIComponent(accountId)}${search ? `?${search}` : ''}`,
                method: 'GET',
                headers: { accept: 'application/json' },
              });
            }

            if (wantsResolve && resolveMatch) {
              const accountId = decodeURIComponent(resolveMatch[1] || '');
              const body = await readRequestBuffer(req);
              return await proxyDevstudioTokyo({
                req,
                res,
                baseUrl: resolveDevstudioTokyoWorkerBaseUrl(),
                pathname: `/assets/account/${encodeURIComponent(accountId)}/resolve`,
                method: 'POST',
                body,
                headers: { accept: 'application/json', 'content-type': 'application/json' },
              });
            }

            if (wantsDelete && deleteMatch) {
              const accountId = decodeURIComponent(deleteMatch[1] || '');
              const assetId = decodeURIComponent(deleteMatch[2] || '');
              const search = requestUrl.searchParams.toString();
              return await proxyDevstudioTokyo({
                req,
                res,
                baseUrl: resolveDevstudioTokyoWorkerBaseUrl(),
                pathname: `/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}${search ? `?${search}` : ''}`,
                method: 'DELETE',
                headers: { accept: 'application/json' },
              });
            }
          } catch (error) {
            writeJson(res, 500, {
              error: {
                kind: 'INTERNAL',
                reasonKey: 'coreui.errors.devstudio.assetProxyFailed',
                detail: error instanceof Error ? error.message : String(error),
              },
            });
            return;
          }

          return next();
        });
      },
    },
    {
      name: 'devstudio-route-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const pathname = url.split('?')[0] || '';
          if (!pathname.startsWith('/api/devstudio/')) return next();

          writeJson(res, 404, {
            error: {
              kind: 'NOT_FOUND',
              reasonKey: 'coreui.errors.route.notFound',
              detail: pathname,
            },
          });
        });
      },
    },
  ];
}
