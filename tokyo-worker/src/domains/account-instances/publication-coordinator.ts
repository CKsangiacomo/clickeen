import type { Env } from '../../types';
import { json } from '../../http';
import { transitionErrorResponse } from '../../routes/internal-product-route-utils';
import {
  AccountInstanceTransitionError,
  deleteAccountInstanceTransition,
  publishAccountInstanceTransition,
  saveAccountInstanceSource,
  unpublishAccountInstanceTransition,
} from './operations';
import type { SubmittedInstancePublicPackage } from './package-files';
import { renameAccountInstanceDisplay } from './source';
import type { AccountInstanceContentDocument } from './types';

type AccountPublicationRequest = {
  accountId: string;
  instanceId: string;
  sourceUpdatedAt: string;
  publishedLimit: number;
  publicPackage: SubmittedInstancePublicPackage;
};

type AccountInstanceSaveRequest = {
  accountId: string;
  instanceId: string;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
};

type AccountInstanceRenameRequest = {
  accountId: string;
  instanceId: string;
  displayName: string;
};

type AccountInstanceCoordinate = {
  accountId: string;
  instanceId: string;
};

const COORDINATOR_LIFECYCLE_FENCE_KEY = 'publication-lifecycle-fence';

export class AccountPublicationCoordinator {
  private active = false;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  private async runExclusive(operation: () => Promise<Response>): Promise<Response> {
    if (this.active) {
      return transitionErrorResponse(
        new AccountInstanceTransitionError({
          status: 409,
          kind: 'DENY',
          reasonKey: 'coreui.errors.instance.commandInProgress',
        }),
      );
    }

    this.active = true;
    try {
      await this.state.storage.get(COORDINATOR_LIFECYCLE_FENCE_KEY);
      return await operation();
    } catch (error) {
      return transitionErrorResponse(error);
    } finally {
      this.active = false;
    }
  }

  private publish(request: Request): Promise<Response> {
    return this.runExclusive(async () => {
      const body = (await request.json()) as AccountPublicationRequest;
      const transition = await publishAccountInstanceTransition({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
        sourceUpdatedAt: body.sourceUpdatedAt,
        publishedLimit: body.publishedLimit,
        publicPackage: body.publicPackage,
      });
      return json({ ok: true, ...transition });
    });
  }

  private save(request: Request): Promise<Response> {
    return this.runExclusive(async () => {
      const body = (await request.json()) as AccountInstanceSaveRequest;
      const saved = await saveAccountInstanceSource({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
        config: body.config,
        content: body.content,
      });
      return json({
        ok: true,
        instanceId: body.instanceId,
        widgetType: saved.pointer.widgetType,
        displayName: saved.pointer.displayName,
        publishStatus: saved.pointer.publishStatus,
        updatedAt: saved.pointer.updatedAt,
      });
    });
  }

  private rename(request: Request): Promise<Response> {
    return this.runExclusive(async () => {
      const body = (await request.json()) as AccountInstanceRenameRequest;
      try {
        const renamed = await renameAccountInstanceDisplay({
          env: this.env,
          accountId: body.accountId,
          instanceId: body.instanceId,
          displayName: body.displayName,
        });
        return json({ ok: true, ...renamed });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new AccountInstanceTransitionError({
          status: detail === 'coreui.errors.instance.notFound' ? 404 : 422,
          kind: detail === 'coreui.errors.instance.notFound' ? 'NOT_FOUND' : 'VALIDATION',
          reasonKey: detail,
          detail,
        });
      }
    });
  }

  private unpublish(request: Request): Promise<Response> {
    return this.runExclusive(async () => {
      const body = (await request.json()) as AccountInstanceCoordinate;
      const transition = await unpublishAccountInstanceTransition({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
      });
      return json({ ok: true, ...transition });
    });
  }

  private delete(request: Request): Promise<Response> {
    return this.runExclusive(async () => {
      const body = (await request.json()) as AccountInstanceCoordinate;
      const deleted = await deleteAccountInstanceTransition({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
      });
      return json({ ok: true, existed: deleted.existed });
    });
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (request.method !== 'POST') {
      return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, { status: 404 });
    }
    if (pathname === '/publish') return this.publish(request);
    if (pathname === '/save') return this.save(request);
    if (pathname === '/rename') return this.rename(request);
    if (pathname === '/unpublish') return this.unpublish(request);
    if (pathname === '/delete') return this.delete(request);
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, { status: 404 });
  }
}

async function coordinateAccountInstanceCommand(args: {
  env: Env;
  accountId: string;
  path: '/publish' | '/save' | '/rename' | '/unpublish' | '/delete';
  body: Record<string, unknown>;
}): Promise<Response> {
  const namespace = args.env.ACCOUNT_PUBLICATION_COORDINATOR;
  const stub = namespace.get(namespace.idFromName(args.accountId));
  return stub.fetch(`https://account-publication.internal${args.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId: args.accountId, ...args.body }),
  });
}

export function coordinateAccountInstancePublish(args: AccountPublicationRequest & {
  env: Env;
}): Promise<Response> {
  return coordinateAccountInstanceCommand({
    env: args.env,
    accountId: args.accountId,
    path: '/publish',
    body: {
      instanceId: args.instanceId,
      sourceUpdatedAt: args.sourceUpdatedAt,
      publishedLimit: args.publishedLimit,
      publicPackage: args.publicPackage,
    },
  });
}

export function coordinateAccountInstanceSave(args: AccountInstanceSaveRequest & {
  env: Env;
}): Promise<Response> {
  return coordinateAccountInstanceCommand({
    env: args.env,
    accountId: args.accountId,
    path: '/save',
    body: {
      instanceId: args.instanceId,
      config: args.config,
      content: args.content,
    },
  });
}

export function coordinateAccountInstanceRename(args: AccountInstanceRenameRequest & {
  env: Env;
}): Promise<Response> {
  return coordinateAccountInstanceCommand({
    env: args.env,
    accountId: args.accountId,
    path: '/rename',
    body: {
      instanceId: args.instanceId,
      displayName: args.displayName,
    },
  });
}

export function coordinateAccountInstanceUnpublish(args: AccountInstanceCoordinate & {
  env: Env;
}): Promise<Response> {
  return coordinateAccountInstanceCommand({
    env: args.env,
    accountId: args.accountId,
    path: '/unpublish',
    body: { instanceId: args.instanceId },
  });
}

export function coordinateAccountInstanceDelete(args: AccountInstanceCoordinate & {
  env: Env;
}): Promise<Response> {
  return coordinateAccountInstanceCommand({
    env: args.env,
    accountId: args.accountId,
    path: '/delete',
    body: { instanceId: args.instanceId },
  });
}
