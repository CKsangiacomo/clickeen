import { normalizePublicServingBaseUrl, resolvePublicServingBaseUrl } from './env/public-serving';

export type PublicActions = {
  publicUrl: string;
  clickeenJsSnippet: string;
};

export function buildWidgetPublicActions({
  accountPublicId,
  instanceId,
  baseUrl,
}: {
  accountPublicId: string;
  instanceId: string;
  baseUrl?: string;
}): PublicActions {
  const account = accountPublicId.trim();
  const instance = instanceId.trim();
  if (!account || !instance) throw new Error('coreui.errors.payload.invalid');
  const origin = typeof baseUrl === 'string'
    ? normalizePublicServingBaseUrl(baseUrl)
    : resolvePublicServingBaseUrl();
  const publicUrl = `${origin}/${encodeURIComponent(account)}/${encodeURIComponent(instance)}`;
  return {
    publicUrl,
    clickeenJsSnippet: `<script
  src="${origin}/clickeen.js"
  data-clickeen="${publicUrl}"
  defer
></script>`,
  };
}
