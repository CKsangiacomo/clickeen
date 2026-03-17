'use client';

import { useCallback, useMemo } from 'react';
import { fetchSameOriginJson } from './same-origin-json';
import type { RomaMeResponse } from './use-roma-me';

type RomaAccountRequestInit = RequestInit & { timeoutMs?: number };

export type RomaAccountApi = {
  accountCapsule: string | null;
  buildHeaders: (args?: { headers?: HeadersInit; contentType?: string | null }) => Headers | undefined;
  fetchJson: <T = unknown>(url: string, init?: RomaAccountRequestInit) => Promise<T>;
  fetchRaw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export function resolveRomaAccountCapsule(data: RomaMeResponse | null | undefined): string | null {
  const value = typeof data?.authz?.accountCapsule === 'string' ? data.authz.accountCapsule.trim() : '';
  return value || null;
}

export function buildRomaAccountHeaders(args?: {
  accountCapsule?: string | null;
  headers?: HeadersInit;
  contentType?: string | null;
}): Headers | undefined {
  const headers = new Headers(args?.headers);
  const accountCapsule = typeof args?.accountCapsule === 'string' ? args.accountCapsule.trim() : '';
  if (accountCapsule) {
    headers.set('x-ck-authz-capsule', accountCapsule);
  }
  if (args?.contentType) {
    headers.set('content-type', args.contentType);
  }
  return Array.from(headers.keys()).length > 0 ? headers : undefined;
}

export async function fetchRomaAccountJson<T = unknown>(
  url: string,
  init?: RomaAccountRequestInit & { accountCapsule?: string | null },
): Promise<T> {
  const { accountCapsule, headers, ...rest } = init ?? {};
  return fetchSameOriginJson<T>(url, {
    ...rest,
    headers: buildRomaAccountHeaders({ accountCapsule, headers }),
  });
}

export function useRomaAccountApi(data: RomaMeResponse | null | undefined): RomaAccountApi {
  const accountCapsule = useMemo(() => resolveRomaAccountCapsule(data), [data]);

  const buildHeaders = useCallback(
    (args?: { headers?: HeadersInit; contentType?: string | null }) =>
      buildRomaAccountHeaders({
        accountCapsule,
        headers: args?.headers,
        contentType: args?.contentType,
      }),
    [accountCapsule],
  );

  const fetchJson = useCallback(
    function fetchJson<T = unknown>(url: string, init?: RomaAccountRequestInit): Promise<T> {
      return fetchRomaAccountJson<T>(url, {
        ...(init ?? {}),
        accountCapsule,
      });
    },
    [accountCapsule],
  );

  const fetchRaw = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        cache: 'no-store',
        ...(init ?? {}),
        headers: buildHeaders({ headers: init?.headers }),
      }),
    [buildHeaders],
  );

  return useMemo(
    () => ({
      accountCapsule,
      buildHeaders,
      fetchJson,
      fetchRaw,
    }),
    [accountCapsule, buildHeaders, fetchJson, fetchRaw],
  );
}
