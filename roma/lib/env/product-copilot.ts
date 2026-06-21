export function resolveProductCopilotBaseUrl(): string {
  const raw = typeof process !== 'undefined' ? process.env.PRODUCT_COPILOT_BASE_URL : undefined;
  const fromEnv = raw?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  throw new Error(
    '[Roma] Missing PRODUCT_COPILOT_BASE_URL (explicit internal base URL required for Roma -> Product Copilot calls)',
  );
}
