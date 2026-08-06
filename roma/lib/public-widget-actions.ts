import { normalizePublicServingBaseUrl, resolvePublicServingBaseUrl } from './env/public-serving';

export type WidgetPublicActions = {
  publicUrl: string;
  iframeSnippet: string;
  scriptSnippet: string;
};

export function buildWidgetPublicActions({
  accountPublicId,
  instanceId,
  baseUrl,
}: {
  accountPublicId: string;
  instanceId: string;
  baseUrl?: string;
}): WidgetPublicActions {
  const account = accountPublicId.trim();
  const instance = instanceId.trim();
  if (!account || !instance) throw new Error('coreui.errors.payload.invalid');

  const origin = typeof baseUrl === 'string'
    ? normalizePublicServingBaseUrl(baseUrl)
    : resolvePublicServingBaseUrl();
  const publicUrl = `${origin}/${encodeURIComponent(account)}/${encodeURIComponent(instance)}`;

  return {
    publicUrl,
    iframeSnippet: `<iframe
  src="${publicUrl}"
  title="Clickeen widget"
  loading="lazy"
  referrerpolicy="no-referrer"
  allow="clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  style="width:100%;border:0;min-height:420px;"
></iframe>`,
    scriptSnippet: `<script src="${publicUrl}/runtime.js" async></script>`,
  };
}
