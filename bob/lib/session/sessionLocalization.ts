import {
  applyLocalizationOps,
  buildL10nSnapshot,
  computeL10nFingerprint,
  filterAllowlistedOps,
  normalizeLocaleToken,
  type AllowlistEntry,
  type LocalizationOp,
} from '../l10n/instance';
import {
  DEFAULT_LOCALE,
  DEFAULT_LOCALE_STATE,
  type LocaleOverlayEntry,
  type LocaleState,
} from './sessionTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function resolveAftermathSaveMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const error = isRecord(value.error) ? value.error : null;
  const detail = typeof error?.detail === 'string' ? error.detail.trim() : '';
  if (detail) return detail;
  return 'Saved, but background updates need attention.';
}

export function normalizeLocalizationOps(raw: unknown): LocalizationOp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const op = entry.op;
      const path = entry.path;
      const value = entry.value;
      if (op !== 'set') return null;
      if (typeof path !== 'string' || !path.trim()) return null;
      if (typeof value !== 'string') return null;
      return { op: 'set' as const, path: path.trim(), value };
    })
    .filter((entry): entry is LocalizationOp => Boolean(entry));
}

export function normalizeLocalizationSnapshotForOpen(raw: unknown): {
  baseLocale: string;
  allowedLocales: string[];
  readyLocales: string[];
  overlayEntries: LocaleOverlayEntry[];
  accountLocalesInvalid: string | null;
  accountL10nPolicy: LocaleState['accountL10nPolicy'];
} {
  if (!isRecord(raw)) {
    return {
      baseLocale: DEFAULT_LOCALE,
      allowedLocales: [DEFAULT_LOCALE],
      readyLocales: [DEFAULT_LOCALE],
      overlayEntries: [],
      accountLocalesInvalid: null,
      accountL10nPolicy: structuredClone(DEFAULT_LOCALE_STATE.accountL10nPolicy),
    };
  }

  const policyRaw = isRecord((raw as any).policy) ? ((raw as any).policy as Record<string, unknown>) : null;
  const baseLocale = normalizeLocaleToken(policyRaw?.baseLocale) ?? DEFAULT_LOCALE;
  const ipRaw = policyRaw && isRecord(policyRaw.ip) ? (policyRaw.ip as Record<string, unknown>) : null;
  const ipEnabled = typeof ipRaw?.enabled === 'boolean' ? ipRaw.enabled : DEFAULT_LOCALE_STATE.accountL10nPolicy.ip.enabled;
  const countryToLocale: Record<string, string> = {};
  const mapRaw = ipRaw && isRecord(ipRaw.countryToLocale) ? (ipRaw.countryToLocale as Record<string, unknown>) : null;
  if (mapRaw) {
    for (const [countryRaw, localeRaw] of Object.entries(mapRaw)) {
      const country = typeof countryRaw === 'string' ? countryRaw.trim().toUpperCase() : '';
      if (!/^[A-Z]{2}$/.test(country)) continue;
      const locale = normalizeLocaleToken(localeRaw);
      if (!locale) continue;
      countryToLocale[country] = locale;
    }
  }
  const switcherRaw = policyRaw && isRecord(policyRaw.switcher) ? (policyRaw.switcher as Record<string, unknown>) : null;
  const switcherEnabled =
    typeof switcherRaw?.enabled === 'boolean'
      ? switcherRaw.enabled
      : DEFAULT_LOCALE_STATE.accountL10nPolicy.switcher.enabled;
  const switcherLocales = Array.isArray(switcherRaw?.locales)
    ? Array.from(
        new Set(
          switcherRaw.locales
            .map((entry) => normalizeLocaleToken(entry))
            .filter((entry): entry is string => Boolean(entry)),
        ),
      )
    : [];
  const accountL10nPolicy: LocaleState['accountL10nPolicy'] = {
    v: 1,
    baseLocale,
    ip: { enabled: ipEnabled, countryToLocale },
    switcher: {
      enabled: switcherEnabled,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };

  const accountLocales = Array.isArray((raw as any).accountLocales)
    ? ((raw as any).accountLocales as unknown[])
        .map((entry: unknown) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const readyLocalesRaw = Array.isArray((raw as any).readyLocales)
    ? ((raw as any).readyLocales as unknown[])
        .map((entry: unknown) => normalizeLocaleToken(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  const overlayEntriesMap = new Map<string, LocaleOverlayEntry>();
  if (Array.isArray(raw.localeOverlays)) {
    raw.localeOverlays.forEach((entry) => {
      if (!isRecord(entry)) return;
      const locale = normalizeLocaleToken(entry.locale);
      if (!locale) return;
      const source = typeof entry.source === 'string' && entry.source.trim() ? entry.source.trim() : null;
      const baseFingerprint =
        typeof entry.baseFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(entry.baseFingerprint.trim())
          ? entry.baseFingerprint.trim()
          : null;
      const baseUpdatedAt = typeof entry.baseUpdatedAt === 'string' ? entry.baseUpdatedAt : null;
      const baseOps = normalizeLocalizationOps(entry.baseOps);
      const userOps = normalizeLocalizationOps(entry.userOps);
      overlayEntriesMap.set(locale, {
        locale,
        source,
        baseFingerprint,
        baseUpdatedAt,
        baseOps,
        userOps,
        hasUserOps: typeof entry.hasUserOps === 'boolean' ? entry.hasUserOps : userOps.length > 0,
      });
    });
  }

  const normalizedLocales = Array.from(new Set([baseLocale, ...accountLocales]));
  const baseFirst = [baseLocale, ...normalizedLocales.filter((locale) => locale !== baseLocale).sort()];
  const normalizedReadyLocales = Array.from(new Set([baseLocale, ...readyLocalesRaw]));
  const readyBaseFirst = [baseLocale, ...normalizedReadyLocales.filter((locale) => locale !== baseLocale).sort()];

  return {
    baseLocale,
    allowedLocales: baseFirst,
    readyLocales: readyBaseFirst,
    overlayEntries: Array.from(overlayEntriesMap.values()).sort((a, b) => a.locale.localeCompare(b.locale)),
    accountLocalesInvalid:
      typeof (raw as any).invalidAccountLocales === 'string' && (raw as any).invalidAccountLocales.trim()
        ? (raw as any).invalidAccountLocales.trim()
        : null,
    accountL10nPolicy,
  };
}

export function resolveLocaleOverlayEntry(entries: LocaleOverlayEntry[], locale: string): LocaleOverlayEntry | null {
  const normalized = normalizeLocaleToken(locale);
  if (!normalized) return null;
  return entries.find((entry) => entry.locale === normalized) ?? null;
}

export function upsertLocaleOverlayEntry(
  entries: LocaleOverlayEntry[],
  locale: string,
  mutate: (current: LocaleOverlayEntry | null) => LocaleOverlayEntry,
): LocaleOverlayEntry[] {
  const normalized = normalizeLocaleToken(locale);
  if (!normalized) return entries;
  const nextEntries = entries.slice();
  const index = nextEntries.findIndex((entry) => entry.locale === normalized);
  const current = index >= 0 ? nextEntries[index] : null;
  const next = mutate(current);
  if (index >= 0) {
    nextEntries[index] = next;
  } else {
    nextEntries.push(next);
  }
  return nextEntries.sort((a, b) => a.locale.localeCompare(b.locale));
}

export async function resolveLocalizedOverlayState(args: {
  baseInstanceData: Record<string, unknown>;
  allowlist: AllowlistEntry[];
  overlayEntry: LocaleOverlayEntry | null;
  locale: string;
  warnOnMissingFingerprint?: boolean;
}): Promise<{
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
  source: string | null;
  stale: boolean;
  localizedData: Record<string, unknown>;
}> {
  const l10nSnapshot = buildL10nSnapshot(args.baseInstanceData, args.allowlist);
  const snapshotPaths = new Set(Object.keys(l10nSnapshot));
  const hasSnapshot = snapshotPaths.size > 0;
  const baseFiltered = filterAllowlistedOps(args.overlayEntry?.baseOps ?? [], args.allowlist);
  const userFiltered = filterAllowlistedOps(args.overlayEntry?.userOps ?? [], args.allowlist);
  const baseOps = baseFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
  const userOps = userFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
  const currentFingerprint = await computeL10nFingerprint(args.baseInstanceData, args.allowlist);

  let stale = false;
  if (hasSnapshot) {
    if (!args.overlayEntry?.baseFingerprint) {
      stale = true;
      if (args.warnOnMissingFingerprint && args.overlayEntry && args.overlayEntry.baseOps.length > 0) {
        console.warn('[useWidgetSession] Missing baseFingerprint for locale overlay', {
          locale: args.locale,
        });
      }
    } else if (args.overlayEntry.baseFingerprint !== currentFingerprint) {
      stale = true;
    }

    if (args.overlayEntry && userOps.length > 0) {
      if (!args.overlayEntry.baseFingerprint) {
        stale = true;
        if (args.warnOnMissingFingerprint) {
          console.warn('[useWidgetSession] Missing baseFingerprint for user overrides', {
            locale: args.locale,
          });
        }
      } else if (args.overlayEntry.baseFingerprint !== currentFingerprint) {
        stale = true;
      }
    }
  }

  return {
    baseOps,
    userOps,
    source: args.overlayEntry?.source ?? null,
    stale,
    localizedData: applyLocalizationOps(applyLocalizationOps(args.baseInstanceData, baseOps), userOps),
  };
}
