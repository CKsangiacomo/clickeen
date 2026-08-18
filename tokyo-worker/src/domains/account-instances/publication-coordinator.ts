import type { Env } from '../../types';
import { json } from '../../http';
import { transitionErrorResponse } from '../../routes/internal-product-route-utils';
import {
  AccountInstanceTransitionError,
  publishAccountInstanceTransition,
  purgeClkLiveEntryCache,
} from './operations';
import type { SubmittedInstancePublicPackage } from './package-files';

type AccountPublicationRequest = {
  accountId: string;
  instanceId: string;
  publishedLimit: number;
  publicPackage: SubmittedInstancePublicPackage;
};

const COORDINATOR_LIFECYCLE_FENCE_KEY = 'publication-lifecycle-fence';

export class AccountPublicationCoordinator {
  private active = false;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  private async publish(request: Request): Promise<Response> {
    if (this.active) {
      return transitionErrorResponse(
        new AccountInstanceTransitionError({
          status: 409,
          kind: 'DENY',
          reasonKey: 'coreui.errors.instance.publishInProgress',
        }),
      );
    }

    this.active = true;
    let body: AccountPublicationRequest;
    let transition: { instanceId: string; status: 'published'; changed: boolean };
    try {
      await this.state.storage.get(COORDINATOR_LIFECYCLE_FENCE_KEY);
      body = (await request.json()) as AccountPublicationRequest;
      transition = await publishAccountInstanceTransition({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
        publishedLimit: body.publishedLimit,
        publicPackage: body.publicPackage,
      });
    } catch (error) {
      return transitionErrorResponse(error);
    } finally {
      this.active = false;
    }

    try {
      await purgeClkLiveEntryCache({
        env: this.env,
        accountId: body.accountId,
        instanceId: body.instanceId,
      });
    } catch (error) {
      return transitionErrorResponse(error);
    }

    return json({ ok: true, ...transition });
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (request.method === 'POST' && pathname === '/publish') {
      return this.publish(request);
    }
    return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, { status: 404 });
  }
}

export async function coordinateAccountInstancePublish(args: AccountPublicationRequest & {
  env: Env;
}): Promise<Response> {
  const namespace = args.env.ACCOUNT_PUBLICATION_COORDINATOR;
  const stub = namespace.get(namespace.idFromName(args.accountId));
  return stub.fetch('https://account-publication.internal/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: args.accountId,
      instanceId: args.instanceId,
      publishedLimit: args.publishedLimit,
      publicPackage: args.publicPackage,
    } satisfies AccountPublicationRequest),
  });
}
