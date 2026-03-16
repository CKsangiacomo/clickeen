import type { Env } from './shared/types';
import { corsPreflight } from './shared/http';
import { handleHealthz } from './shared/handlers';
import { ckError, errorDetail } from './shared/errors';
import { handleGetInstance } from './domains/instances';

function methodNotAllowed(): Response {
  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.method.notAllowed' }, 405);
}

function routeNotFound(): Response {
  return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'OPTIONS') return corsPreflight(req);
      if (pathname === '/api/healthz') return handleHealthz();

      const instanceMatch = pathname.match(/^\/api\/instance\/([^/]+)$/);
      if (instanceMatch) {
        const publicId = decodeURIComponent(instanceMatch[1]);
        if (req.method === 'GET') return handleGetInstance(req, env, publicId);
        return methodNotAllowed();
      }

      return routeNotFound();
    } catch (err) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.internal.serverError',
          detail: errorDetail(err),
        },
        500,
      );
    }
  },
};
