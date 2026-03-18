import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Berlin large-account list contract', () => {
  it('reads all Supabase pages instead of silently truncating at a fixed cap', async () => {
    const calls: string[] = [];
    const pages = [
      Array.from({ length: 200 }, (_, index) => ({ id: `row-${index}` })),
      Array.from({ length: 200 }, (_, index) => ({ id: `row-${index + 200}` })),
      Array.from({ length: 50 }, (_, index) => ({ id: `row-${index + 400}` })),
    ];

    vi.doMock('../../berlin/src/supabase-admin', () => ({
      supabaseAdminFetch: vi.fn(async (_env: unknown, pathname: string) => {
        calls.push(pathname);
        const next = pages.shift() ?? [];
        return jsonResponse(next);
      }),
      readSupabaseAdminJson: vi.fn(async (response: Response) => response.json()),
      supabaseAdminErrorResponse: vi.fn(
        (_reasonKey: string, status: number, payload: unknown) =>
          jsonResponse({ error: payload }, status),
      ),
    }));

    const { readSupabaseAdminListAll } = await import('../../berlin/src/supabase-list');
    const result = await readSupabaseAdminListAll<{ id: string }>({
      env: {} as any,
      pathname: '/rest/v1/account_members',
      params: new URLSearchParams({
        select: 'user_id,role',
        account_id: 'eq.11111111-1111-1111-1111-111111111111',
        order: 'created_at.asc',
      }),
      pageSize: 200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected paged read to succeed');
    }
    expect(result.value).toHaveLength(450);
    expect(calls).toEqual([
      '/rest/v1/account_members?select=user_id%2Crole&account_id=eq.11111111-1111-1111-1111-111111111111&order=created_at.asc&limit=200&offset=0',
      '/rest/v1/account_members?select=user_id%2Crole&account_id=eq.11111111-1111-1111-1111-111111111111&order=created_at.asc&limit=200&offset=200',
      '/rest/v1/account_members?select=user_id%2Crole&account_id=eq.11111111-1111-1111-1111-111111111111&order=created_at.asc&limit=200&offset=400',
    ]);
  });
});
