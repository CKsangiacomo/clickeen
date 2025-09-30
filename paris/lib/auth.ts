import type { User } from '@supabase/supabase-js';
import { getServiceClient, type AdminClient } from '@paris/lib/supabaseAdmin';

export class AuthError extends Error {
  constructor(public readonly code: 'AUTH_REQUIRED' | 'FORBIDDEN', message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

export interface AuthContext {
  client: AdminClient;
  user: User;
  token: string;
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('AUTH_REQUIRED');
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AuthError('AUTH_REQUIRED');
  }

  const client = getServiceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError('AUTH_REQUIRED');
  }

  return { client, user: data.user, token };
}

export async function assertWorkspaceMember(
  client: AdminClient,
  workspaceId: string,
  userId: string,
) {
  const { data, error } = await client
    .from('workspace_members')
    .select('role,status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AuthError('FORBIDDEN');
  }

  return data;
}

export function resolveWorkspaceId(req: Request, user: User): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('workspaceId');
  if (fromQuery) return fromQuery;

  const metadataSources = [user.app_metadata, user.user_metadata];
  for (const source of metadataSources) {
    if (!source || typeof source !== 'object') continue;
    const maybe = (source as Record<string, any>).workspaceId ?? (source as Record<string, any>).workspace_id;
    if (typeof maybe === 'string' && maybe.length > 0) {
      return maybe;
    }
  }

  const header = req.headers.get('x-workspace-id') ?? req.headers.get('X-Workspace-Id');
  return header?.trim() || null;
}
