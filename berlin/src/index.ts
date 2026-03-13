import { BerlinAuthTicketDO } from './auth-ticket-store';
import { internalError, json, methodNotAllowed } from './helpers';
import { type Env } from './types';
import { handleFinish, handlePasswordLogin, handleProviderLoginCallback, handleProviderLoginStart } from './routes-login';
import {
  handleAccountById,
  handleAccountCreate,
  handleAccountDelete,
  handleAccountInvitationDelete,
  handleAccountInvitations,
  handleAccountLocales,
  handleAccountLifecycleTierDropDismiss,
  handleAccountMemberById,
  handleAccountMemberPatch,
  handleAccountMembers,
  handleAccountOwnerTransfer,
  handleAccounts,
  handleAccountSwitch,
  handleInvitationAccept,
  handleMe,
  handleMeContactMethodStart,
  handleMeContactMethodVerify,
  handleMeEmailChange,
  handleMeUpdate,
  handleMeIdentities,
  handleSessionBootstrap,
} from './routes-account';
import {
  handleHealthz,
  handleInternalRevokeUserSessions,
  handleJwks,
  handleLogout,
  handleMichaelToken,
  handleRefresh,
  handleSession,
} from './routes-session';

export { BerlinAuthTicketDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (pathname === '/internal/healthz') {
        if (request.method !== 'GET') return methodNotAllowed();
        return handleHealthz();
      }

      const internalRevokeSessionsMatch = pathname.match(/^\/internal\/control\/users\/([^/]+)\/revoke-sessions$/);
      if (internalRevokeSessionsMatch) {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleInternalRevokeUserSessions(
          request,
          env,
          decodeURIComponent(internalRevokeSessionsMatch[1] || ''),
        );
      }

      if (pathname === '/.well-known/jwks.json') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleJwks(env);
      }

      if (pathname === '/auth/login/password') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handlePasswordLogin(request, env);
      }

      if (pathname === '/auth/login/provider/start') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleProviderLoginStart(request, env);
      }

      if (pathname === '/auth/login/provider/callback') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleProviderLoginCallback(request, env);
      }

      if (pathname === '/auth/finish') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleFinish(request, env);
      }

      if (pathname === '/auth/session') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleSession(request, env);
      }

      if (pathname === '/v1/me') {
        if (request.method === 'GET') return await handleMe(request, env);
        if (request.method === 'PUT') return await handleMeUpdate(request, env);
        return methodNotAllowed();
      }

      if (pathname === '/v1/me/email-change') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleMeEmailChange(request, env);
      }

      const meContactMethodMatch = pathname.match(/^\/v1\/me\/contact-methods\/([^/]+)\/(start|verify)$/);
      if (meContactMethodMatch) {
        const channel = decodeURIComponent(meContactMethodMatch[1] || '');
        const action = meContactMethodMatch[2] || '';
        if (request.method !== 'POST') return methodNotAllowed();
        if (action === 'start') return await handleMeContactMethodStart(request, env, channel);
        if (action === 'verify') return await handleMeContactMethodVerify(request, env, channel);
        return methodNotAllowed();
      }

      if (pathname === '/v1/me/identities') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleMeIdentities(request, env);
      }

      if (pathname === '/v1/accounts') {
        if (request.method === 'GET') return await handleAccounts(request, env);
        if (request.method === 'POST') return await handleAccountCreate(request, env);
        return methodNotAllowed();
      }

      const invitationAcceptMatch = pathname.match(/^\/v1\/invitations\/([^/]+)\/accept$/);
      if (invitationAcceptMatch) {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleInvitationAccept(request, env, decodeURIComponent(invitationAcceptMatch[1] || ''));
      }

      const accountMemberMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/members\/([^/]+)$/);
      if (accountMemberMatch) {
        if (request.method === 'GET') {
          return await handleAccountMemberById(
            request,
            env,
            decodeURIComponent(accountMemberMatch[1] || ''),
            decodeURIComponent(accountMemberMatch[2] || ''),
          );
        }
        if (request.method === 'PATCH') {
          return await handleAccountMemberPatch(
            request,
            env,
            decodeURIComponent(accountMemberMatch[1] || ''),
            decodeURIComponent(accountMemberMatch[2] || ''),
          );
        }
        return methodNotAllowed();
      }

      const accountMembersMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/members$/);
      if (accountMembersMatch) {
        if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed();
        return await handleAccountMembers(request, env, decodeURIComponent(accountMembersMatch[1] || ''));
      }

      const accountInvitationDeleteMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/invitations\/([^/]+)$/);
      if (accountInvitationDeleteMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed();
        return await handleAccountInvitationDelete(
          request,
          env,
          decodeURIComponent(accountInvitationDeleteMatch[1] || ''),
          decodeURIComponent(accountInvitationDeleteMatch[2] || ''),
        );
      }

      const accountInvitationsMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/invitations$/);
      if (accountInvitationsMatch) {
        if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed();
        return await handleAccountInvitations(request, env, decodeURIComponent(accountInvitationsMatch[1] || ''));
      }

      const accountLocalesMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/locales$/);
      if (accountLocalesMatch) {
        if (request.method !== 'PUT') return methodNotAllowed();
        return await handleAccountLocales(request, env, decodeURIComponent(accountLocalesMatch[1] || ''));
      }

      const accountSwitchMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/switch$/);
      if (accountSwitchMatch) {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleAccountSwitch(request, env, decodeURIComponent(accountSwitchMatch[1] || ''));
      }

      const accountTierDropDismissMatch = pathname.match(
        /^\/v1\/accounts\/([^/]+)\/lifecycle\/tier-drop\/dismiss$/,
      );
      if (accountTierDropDismissMatch) {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleAccountLifecycleTierDropDismiss(
          request,
          env,
          decodeURIComponent(accountTierDropDismissMatch[1] || ''),
        );
      }

      const accountOwnerTransferMatch = pathname.match(/^\/v1\/accounts\/([^/]+)\/owner-transfer$/);
      if (accountOwnerTransferMatch) {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleAccountOwnerTransfer(request, env, decodeURIComponent(accountOwnerTransferMatch[1] || ''));
      }

      const accountDetailMatch = pathname.match(/^\/v1\/accounts\/([^/]+)$/);
      if (accountDetailMatch) {
        if (request.method === 'GET') {
          return await handleAccountById(request, env, decodeURIComponent(accountDetailMatch[1] || ''));
        }
        if (request.method === 'DELETE') {
          return await handleAccountDelete(request, env, decodeURIComponent(accountDetailMatch[1] || ''));
        }
        return methodNotAllowed();
      }

      if (pathname === '/v1/session/bootstrap') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleSessionBootstrap(request, env);
      }

      if (pathname === '/auth/refresh') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleRefresh(request, env);
      }

      if (pathname === '/auth/logout') {
        if (request.method !== 'POST') return methodNotAllowed();
        return await handleLogout(request, env);
      }

      if (pathname === '/auth/michael/token') {
        if (request.method !== 'GET') return methodNotAllowed();
        return await handleMichaelToken(request, env);
      }

      return json({ error: 'NOT_FOUND' }, { status: 404 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return internalError('berlin.errors.unexpected', detail);
    }
  },
};
