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

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function looksLikeJwt(token: string) {
  return token.split('.').length === 3;
}

export async function authenticateUser(client: AdminClient, token: string) {
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError('AUTH_REQUIRED');
  }
  return data.user;
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AuthError('AUTH_REQUIRED');
  }
  const client = getServiceClient();
  const user = await authenticateUser(client, token);
  return { client, user, token };
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
