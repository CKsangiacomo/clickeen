export const PRAGUE_PHASE1_LOCALES = ['en', 'es', 'pt', 'de', 'fr'] as const;

export type PragueLocale = (typeof PRAGUE_PHASE1_LOCALES)[number];

export function listPragueLocales(): string[] {
  // Keep this as a function so we can later evolve it:
  // - Phase 2+ locale expansion
  // - env overrides for local dev
  return [...PRAGUE_PHASE1_LOCALES];
}


