'use client';

import { useCallback, useMemo } from 'react';
import { fetchSameOriginJson } from './same-origin-json';

type RomaAccountRequestInit = RequestInit & { timeoutMs?: number };

export type RomaAccountApi = {
  buildHeaders: (args?: { headers?: HeadersInit; contentType?: string | null }) => Headers | undefined;
  fetchJson: <T = unknown>(url: string, init?: RomaAccountRequestInit) => Promise<T>;
  fetchRaw: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export function buildRomaAccountHeaders(args?: { headers?: HeadersInit; contentType?: string | null }): Headers | undefined {
  const headers = new Headers(args?.headers);
  if (args?.contentType) {
    headers.set('content-type', args.contentType);
  }
  return Array.from(headers.keys()).length > 0 ? headers : undefined;
}

export async function fetchRomaAccountJson<T = unknown>(url: string, init?: RomaAccountRequestInit): Promise<T> {
  const { headers, ...rest } = init ?? {};
  return fetchSameOriginJson<T>(url, {
    ...rest,
    headers: buildRomaAccountHeaders({ headers }),
  });
}

export function useRomaAccountApi(): RomaAccountApi {
  const buildHeaders = useCallback(
    (args?: { headers?: HeadersInit; contentType?: string | null }) =>
      buildRomaAccountHeaders({
        headers: args?.headers,
        contentType: args?.contentType,
      }),
    [],
  );

  const fetchJson = useCallback(
    function fetchJson<T = unknown>(url: string, init?: RomaAccountRequestInit): Promise<T> {
      return fetchRomaAccountJson<T>(url, init);
    },
    [],
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
      buildHeaders,
      fetchJson,
      fetchRaw,
    }),
    [buildHeaders, fetchJson, fetchRaw],
  );
}
