import { BerlinAuthTicketDO } from './auth-ticket-store';
import { internalError, json, methodNotAllowed } from './helpers';
import { type Env } from './types';
import { handleFinish, handlePasswordLogin, handleProviderLoginCallback, handleProviderLoginStart } from './routes-login';
import { handleHealthz, handleJwks, handleLogout, handleMichaelToken, handleRefresh, handleSession } from './routes-session';

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
