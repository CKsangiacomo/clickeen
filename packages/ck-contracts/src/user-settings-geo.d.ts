export declare const USER_SETTINGS_COUNTRY_TIMEZONES: Readonly<Record<string, readonly string[]>>;
export declare const USER_SETTINGS_COUNTRY_CODES: readonly string[];
export declare function normalizeUserSettingsCountry(raw: unknown): string | null;
export declare function listUserSettingsCountries(): string[];
export declare function listUserSettingsTimezones(rawCountry: unknown): string[];
export declare function userSettingsCountryRequiresTimezoneChoice(rawCountry: unknown): boolean;
export declare function isUserSettingsTimezoneSupported(rawCountry: unknown, rawTimezone: unknown): boolean;
export declare function resolveUserSettingsTimezone(
  rawCountry: unknown,
  rawTimezone: unknown,
  rawFallbackTimezone?: unknown,
): string | null;
