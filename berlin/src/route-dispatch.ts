import { BerlinAuthTicketDO } from './auth-ticket-store';
import { internalError, json, methodNotAllowed } from './helpers';
import { type Env } from './types';
import {
  handleFinish,
  handleProviderLoginCallback,
  handleProviderLoginRedirectStart,
  handleProviderLoginStart,
} from './routes-login';
import {
  handleAccountById,
  handleAccountCreate,
  handleAccountDelete,
  handleAccountInvitationDelete,
  handleAccountInvitations,
  handleAccountInstancePublicIdsRegistry,
  handleAccountInstanceRegistryByPublicId,
  handleAccountInstanceRegistryCreate,
  handleAccountLocales,
  handleAccountLifecycleTierDropDismiss,
  handleAccountMemberById,
  handleAccountMemberDeleteRoute,
  handleAccountMemberPatch,
  handleAccountMembers,
  handleAccountOwnerTransfer,
  handleAccountPublishContainmentRegistry,
  handleAccounts,
  handleAccountSwitch,
  handleAccountWidgetRegistry,
  handleInvitationAccept,
  handleMe,
  handleMeContactMethodStart,
  handleMeContactMethodVerify,
  handleMeEmailChange,
  handleMeIdentities,
  handleMeUpdate,
  handleSessionBootstrap,
} from './routes-account';
import {
  handleHealthz,
  handleInternalRevokeUserSessions,
  handleJwks,
  handleLogout,
  handleRefresh,
  handleSession,
} from './routes-session';

export { BerlinAuthTicketDO };

type RouteHandlerContext = {
  request: Request;
  env: Env;
  match: RegExpMatchArray;
};

type RouteHandler = (context: RouteHandlerContext) => Response | Promise<Response>;

type BerlinRoute = {
  pattern: RegExp;
  methods: Partial<Record<string, RouteHandler>>;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exact(pathname: string, methods: BerlinRoute['methods']): BerlinRoute {
  return {
    pattern: new RegExp(`^${escapeRegex(pathname)}$`),
    methods,
  };
}

function capture(match: RegExpMatchArray, index: number): string {
  return decodeURIComponent(match[index] || '');
}

const BERLIN_ROUTES: BerlinRoute[] = [
  exact('/internal/healthz', {
    GET: () => handleHealthz(),
  }),
  {
    pattern: /^\/internal\/control\/users\/([^/]+)\/revoke-sessions$/,
    methods: {
      POST: ({ request, env, match }) => handleInternalRevokeUserSessions(request, env, capture(match, 1)),
    },
  },
  exact('/.well-known/jwks.json', {
    GET: ({ env }) => handleJwks(env),
  }),
  exact('/auth/login/provider/start', {
    POST: ({ request, env }) => handleProviderLoginStart(request, env),
  }),
  exact('/auth/login/provider/callback', {
    GET: ({ request, env }) => handleProviderLoginCallback(request, env),
  }),
  {
    pattern: /^\/auth\/login\/([^/]+)\/start$/,
    methods: {
      GET: ({ request, env, match }) => handleProviderLoginRedirectStart(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/auth\/login\/([^/]+)\/callback$/,
    methods: {
      GET: ({ request, env, match }) => handleProviderLoginCallback(request, env, capture(match, 1)),
    },
  },
  exact('/auth/finish', {
    POST: ({ request, env }) => handleFinish(request, env),
  }),
  exact('/auth/session', {
    GET: ({ request, env }) => handleSession(request, env),
  }),
  exact('/v1/me', {
    GET: ({ request, env }) => handleMe(request, env),
    PUT: ({ request, env }) => handleMeUpdate(request, env),
  }),
  exact('/v1/me/email-change', {
    POST: ({ request, env }) => handleMeEmailChange(request, env),
  }),
  {
    pattern: /^\/v1\/me\/contact-methods\/([^/]+)\/start$/,
    methods: {
      POST: ({ request, env, match }) => handleMeContactMethodStart(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/me\/contact-methods\/([^/]+)\/verify$/,
    methods: {
      POST: ({ request, env, match }) => handleMeContactMethodVerify(request, env, capture(match, 1)),
    },
  },
  exact('/v1/me/identities', {
    GET: ({ request, env }) => handleMeIdentities(request, env),
  }),
  exact('/v1/accounts', {
    GET: ({ request, env }) => handleAccounts(request, env),
    POST: ({ request, env }) => handleAccountCreate(request, env),
  }),
  {
    pattern: /^\/v1\/invitations\/([^/]+)\/accept$/,
    methods: {
      POST: ({ request, env, match }) => handleInvitationAccept(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/members\/([^/]+)$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountMemberById(request, env, capture(match, 1), capture(match, 2)),
      PATCH: ({ request, env, match }) => handleAccountMemberPatch(request, env, capture(match, 1), capture(match, 2)),
      DELETE: ({ request, env, match }) =>
        handleAccountMemberDeleteRoute(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/members$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountMembers(request, env, capture(match, 1)),
      POST: ({ request, env, match }) => handleAccountMembers(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/invitations\/([^/]+)$/,
    methods: {
      DELETE: ({ request, env, match }) =>
        handleAccountInvitationDelete(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/invitations$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountInvitations(request, env, capture(match, 1)),
      POST: ({ request, env, match }) => handleAccountInvitations(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/widget-registry$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountWidgetRegistry(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/instances\/public-ids$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountInstancePublicIdsRegistry(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/instances\/registry$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountInstanceRegistryCreate(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/instances\/([^/]+)\/registry$/,
    methods: {
      GET: ({ request, env, match }) =>
        handleAccountInstanceRegistryByPublicId(request, env, capture(match, 1), capture(match, 2)),
      DELETE: ({ request, env, match }) =>
        handleAccountInstanceRegistryByPublicId(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/publish-containment$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountPublishContainmentRegistry(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/locales$/,
    methods: {
      PUT: ({ request, env, match }) => handleAccountLocales(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/switch$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountSwitch(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/lifecycle\/tier-drop\/dismiss$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountLifecycleTierDropDismiss(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/owner-transfer$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountOwnerTransfer(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountById(request, env, capture(match, 1)),
      DELETE: ({ request, env, match }) => handleAccountDelete(request, env, capture(match, 1)),
    },
  },
  exact('/v1/session/bootstrap', {
    GET: ({ request, env }) => handleSessionBootstrap(request, env),
  }),
  exact('/auth/refresh', {
    POST: ({ request, env }) => handleRefresh(request, env),
  }),
  exact('/auth/logout', {
    POST: ({ request, env }) => handleLogout(request, env),
  }),
];

export async function dispatchBerlinRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  for (const route of BERLIN_ROUTES) {
    const match = pathname.match(route.pattern);
    if (!match) continue;
    const handler = route.methods[request.method];
    if (!handler) return methodNotAllowed();
    return await handler({ request, env, match });
  }

  return json({ error: 'NOT_FOUND' }, { status: 404 });
}

export function unexpectedBerlinErrorResponse(error: unknown): Response {
  const detail = error instanceof Error ? error.message : String(error);
  return internalError('berlin.errors.unexpected', detail);
}
