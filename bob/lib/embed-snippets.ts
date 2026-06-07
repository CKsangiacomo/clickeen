import { resolvePublicEmbedBaseUrl } from './env/public-embed';

type EmbedSnippetInput = {
  accountPublicId: string;
  instanceId: string;
  published: boolean;
  baseUrl?: string;
};

export type EmbedSnippets = {
  publicUrl: string;
  canRender: boolean;
  iframeSnippet: string;
  scriptSnippet: string;
};

function cleanSegment(value: string): string {
  return String(value || '').trim();
}

export function buildPublicEmbedUrl(args: {
  accountPublicId: string;
  instanceId: string;
  baseUrl?: string;
}): string {
  const base = (args.baseUrl ?? resolvePublicEmbedBaseUrl()).replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(cleanSegment(args.accountPublicId))}/${encodeURIComponent(cleanSegment(args.instanceId))}`;
}

export function buildEmbedSnippets(args: EmbedSnippetInput): EmbedSnippets {
  const accountPublicId = cleanSegment(args.accountPublicId);
  const instanceId = cleanSegment(args.instanceId);
  const publicUrl = accountPublicId && instanceId
    ? buildPublicEmbedUrl({ accountPublicId, instanceId, baseUrl: args.baseUrl })
    : '';
  const canRender = Boolean(args.published && publicUrl);

  return {
    publicUrl,
    canRender,
    iframeSnippet: canRender
      ? `<iframe
  src="${publicUrl}"
  title="Clickeen widget"
  loading="lazy"
  referrerpolicy="no-referrer"
  allow="clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  style="width:100%;border:0;min-height:420px;"
></iframe>`
      : '',
    scriptSnippet: canRender
      ? `<script src="${publicUrl}/runtime.js" async></script>`
      : '',
  };
}
