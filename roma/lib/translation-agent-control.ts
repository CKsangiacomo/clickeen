import { CK_REQUEST_ID_HEADER } from '@clickeen/ck-contracts';
import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';

const TRANSLATION_AGENT_ORIGIN = 'https://translation-agent.internal';

type TranslationAgentBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function resolveTranslationAgentBinding(): TranslationAgentBinding {
  const requestContext = getOptionalCloudflareRequestContext<{ env?: { TRANSLATION_AGENT?: TranslationAgentBinding } }>();
  const binding = requestContext?.env?.TRANSLATION_AGENT;
  if (binding && typeof binding.fetch === 'function') return binding;
  throw new Error('[Roma] Missing TRANSLATION_AGENT service binding');
}

export async function fetchTranslationAgent(args: {
  path: string;
  method: 'POST';
  body: unknown;
  requestId?: string | null;
}): Promise<Response> {
  const path = args.path.startsWith('/') ? args.path : `/${args.path}`;
  const target = new URL(path, TRANSLATION_AGENT_ORIGIN);
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
  });
  if (args.requestId) headers.set(CK_REQUEST_ID_HEADER, args.requestId);
  return resolveTranslationAgentBinding().fetch(target.toString(), {
    method: args.method,
    headers,
    body: JSON.stringify(args.body),
    cache: 'no-store',
  });
}
