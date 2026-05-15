import { LANGUAGE_OVERLAY_CODES } from '@clickeen/ck-contracts/overlay-codebooks';

const LOCALE_BY_OVERLAY_LANGUAGE_CODE = Object.fromEntries(
  Object.entries(LANGUAGE_OVERLAY_CODES).map(([locale, code]) => [code, locale]),
);

export const EMBED_LOCALE_RUNTIME_SOURCE = String.raw`
        const normalizeLocaleToken = (raw) => {
          const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
          return value || '';
        };

        const parseGeoCountry = (response) => {
          const raw = response && response.headers ? (response.headers.get('x-ck-geo-country') || response.headers.get('X-Ck-Geo-Country')) : '';
          const normalized = String(raw || '').trim().toUpperCase();
          return /^[A-Z]{2}$/.test(normalized) ? normalized : 'ZZ';
        };

        const LOCALE_BY_OVERLAY_LANGUAGE_CODE = ${JSON.stringify(LOCALE_BY_OVERLAY_LANGUAGE_CODE)};

        const resolveLocaleRuntimePolicy = (pointer) => {
          const policy =
            pointer && typeof pointer === 'object' && pointer.localePolicy && typeof pointer.localePolicy === 'object'
              ? pointer.localePolicy
              : null;
          const baseLocale = normalizeLocaleToken(policy && policy.baseLocale) || 'en';
          const languageOverlays =
            pointer &&
            typeof pointer === 'object' &&
            pointer.overlays &&
            typeof pointer.overlays === 'object' &&
            pointer.overlays.languages &&
            typeof pointer.overlays.languages === 'object'
              ? pointer.overlays.languages
              : {};
          const overlayLocales = Object.keys(languageOverlays)
            .map((code) => LOCALE_BY_OVERLAY_LANGUAGE_CODE[String(code || '').trim().toUpperCase()])
            .map(normalizeLocaleToken)
            .filter(Boolean);
          const availableLocales = Array.from(new Set([baseLocale].concat(overlayLocales)));
          const ipEnabled =
            policy && typeof policy === 'object' && policy.ip && typeof policy.ip === 'object' && policy.ip.enabled === true;
          const alwaysShowLocale =
            policy &&
            typeof policy === 'object' &&
            policy.switcher &&
            typeof policy.switcher === 'object' &&
            typeof policy.switcher.alwaysShowLocale === 'string'
              ? normalizeLocaleToken(policy.switcher.alwaysShowLocale)
              : '';
          const mapping =
            policy && typeof policy === 'object' && policy.ip && typeof policy.ip === 'object' && policy.ip.countryToLocale
              ? policy.ip.countryToLocale
              : null;
          return { baseLocale, availableLocales, ipEnabled, alwaysShowLocale, mapping };
        };

        const computeEffectiveLocale = (policyState, geoCountry, fixedLocaleOverride) => {
          const resolved =
            policyState && typeof policyState === 'object' && typeof policyState.baseLocale === 'string'
              ? policyState
              : resolveLocaleRuntimePolicy(policyState);
          let locale = resolved.baseLocale;
          const fixed = normalizeLocaleToken(fixedLocaleOverride);
          if (fixed && resolved.availableLocales.indexOf(fixed) >= 0) {
            locale = fixed;
          } else if (resolved.ipEnabled) {
            const mapped =
              resolved.mapping && typeof resolved.mapping[geoCountry] === 'string'
                ? normalizeLocaleToken(resolved.mapping[geoCountry])
                : '';
            if (mapped && resolved.availableLocales.indexOf(mapped) >= 0) locale = mapped;
          } else if (resolved.alwaysShowLocale && resolved.availableLocales.indexOf(resolved.alwaysShowLocale) >= 0) {
            locale = resolved.alwaysShowLocale;
          }
          return locale;
        };
`;
