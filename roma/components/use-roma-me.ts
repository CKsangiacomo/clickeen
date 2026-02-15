'use client';

import { useCallback, useEffect, useState } from 'react';

export type RomaMeResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
  };
  accounts: Array<{
    accountId: string;
    status: string;
    isPlatform: boolean;
    derivedRole: 'account_owner' | 'account_admin' | 'account_member';
    workspaceRoles: string[];
  }>;
  workspaces: Array<{
    workspaceId: string;
    accountId: string;
    role: string;
    name: string;
    slug: string;
    tier: string;
  }>;
  defaults: {
    accountId: string | null;
    workspaceId: string | null;
  };
};

type UseRomaMeState = {
  loading: boolean;
  data: RomaMeResponse | null;
  error: string | null;
};

export function useRomaMe() {
  const [state, setState] = useState<UseRomaMeState>({
    loading: true,
    data: null,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as RomaMeResponse | { error?: unknown } | null;
      if (!response.ok) {
        const reason = (payload as any)?.error?.reasonKey || (payload as any)?.error || `HTTP_${response.status}`;
        throw new Error(typeof reason === 'string' ? reason : 'coreui.errors.auth.required');
      }
      setState({ loading: false, data: payload as RomaMeResponse, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ loading: false, data: null, error: message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    reload,
  };
}

