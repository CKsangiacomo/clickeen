import { AuthError, authenticateUser, assertWorkspaceMember, extractBearerToken, looksLikeJwt } from '@paris/lib/auth';
import type { AdminClient } from '@paris/lib/supabaseAdmin';
import type { InstanceRecord } from '@paris/lib/instances';
import { validateEmbedOrDraftToken, TokenError } from '@paris/lib/instances';

export async function assertInstanceAccess(
  req: Request,
  client: AdminClient,
  instance: InstanceRecord,
): Promise<'public' | 'jwt' | 'embed' | 'draft'> {
  const bearer = extractBearerToken(req);
  const embedHeader = req.headers.get('x-embed-token') ?? req.headers.get('X-Embed-Token');

  if (bearer) {
    if (looksLikeJwt(bearer)) {
      const user = await authenticateUser(client, bearer);
      await assertWorkspaceMember(client, instance.workspaceId, user.id);
      return 'jwt';
    }
    try {
      const { kind } = await validateEmbedOrDraftToken(client, instance, bearer);
      return kind;
    } catch (err) {
      if (err instanceof TokenError) {
        throw err;
      }
      throw new AuthError('AUTH_REQUIRED');
    }
  }

  if (embedHeader) {
    try {
      const { kind } = await validateEmbedOrDraftToken(client, instance, embedHeader);
      return kind;
    } catch (err) {
      if (err instanceof TokenError) {
        throw err;
      }
      throw new AuthError('AUTH_REQUIRED');
    }
  }

  if (instance.status === 'published') {
    return 'public';
  }

  throw new AuthError('AUTH_REQUIRED');
}
