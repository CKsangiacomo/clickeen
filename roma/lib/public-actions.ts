import { normalizePublicServingBaseUrl, resolvePublicServingBaseUrl } from './env/public-serving';

export type PublicActions = {
  publicUrl: string;
  clickeenJsSnippet: string;
};

type PublicActionsInput = {
  accountPublicId: string;
  productPath: string[];
  baseUrl?: string;
};

function buildPublicActions({
  accountPublicId,
  productPath,
  baseUrl,
}: PublicActionsInput): PublicActions {
  const account = accountPublicId.trim();
  const path = productPath.map((part) => part.trim());
  if (!account || path.some((part) => !part)) {
    throw new Error('coreui.errors.payload.invalid');
  }

  const origin = typeof baseUrl === 'string'
    ? normalizePublicServingBaseUrl(baseUrl)
    : resolvePublicServingBaseUrl();
  const publicUrl = `${origin}/${encodeURIComponent(account)}/${path.map((part) => encodeURIComponent(part)).join('/')}`;

  return {
    publicUrl,
    clickeenJsSnippet: `<script
  src="${origin}/clickeen.js"
  data-clickeen="${publicUrl}"
  defer
></script>`,
  };
}

export function buildWidgetPublicActions({
  accountPublicId,
  instanceId,
  baseUrl,
}: {
  accountPublicId: string;
  instanceId: string;
  baseUrl?: string;
}): PublicActions {
  return buildPublicActions({ accountPublicId, productPath: [instanceId], baseUrl });
}

export function buildPagePublicActions({
  accountPublicId,
  pageId,
  baseUrl,
}: {
  accountPublicId: string;
  pageId: string;
  baseUrl?: string;
}): PublicActions {
  return buildPublicActions({ accountPublicId, productPath: ['pages', pageId], baseUrl });
}
