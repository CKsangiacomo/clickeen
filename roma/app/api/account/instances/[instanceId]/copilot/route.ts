import { NextRequest, NextResponse } from 'next/server';
import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { parseCopilotTurnRequest } from '@clickeen/ck-contracts/ai';
import {
  issueAccountCopilotGrant,
  streamCopilotTurn,
} from '@roma/lib/ai/account-copilot';
import { loadTokyoAccountInstanceDocument } from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';
import {
  type AiModelRef,
  type AiProvider,
} from '@clickeen/ck-contracts/ai';
import { isProductCopilotManagedModel } from '@clickeen/ck-contracts/ai-model-management';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

type SelectedModelParseResult =
  | { ok: true; value: AiModelRef | null }
  | { ok: false; message: string };

function parseSelectedModel(value: unknown): SelectedModelParseResult {
  if (value == null) return { ok: true, value: null };
  if (!isRecord(value)) {
    return { ok: false, message: 'selectedModel must be an object with provider and model' };
  }
  const provider = asTrimmedString(value.provider);
  const model = asTrimmedString(value.model);
  if (!provider || !model) {
    return { ok: false, message: 'selectedModel.provider and selectedModel.model are required' };
  }
  const selected = { provider: provider as AiProvider, model };
  if (!isProductCopilotManagedModel(selected)) {
    return { ok: false, message: `selectedModel is not managed for Product Copilot: ${provider}:${model}` };
  }
  return { ok: true, value: selected };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as unknown;

    // PRD 128D: full request validation via the SHARED parser BEFORE any
    // usage reservation or grant issuance. One Clickeen-owned parser —
    // no drifting validators between Roma and Product Copilot.
    const parsed = parseCopilotTurnRequest(body, { routeInstanceId: instanceId });
    if (!parsed.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.copilot.invalidRequest',
              detail: 'Invalid Product Copilot turn request.',
              issues: parsed.issues,
            },
          },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }
    const turnRequest = parsed.request;

    // Validate selected model against the managed set
    const selectedModelResult = parseSelectedModel(turnRequest.selectedModel);
    if (!selectedModelResult.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.copilot.invalidRequest',
              detail: selectedModelResult.message,
            },
          },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }
    const selectedModel = selectedModelResult.value;

    // Verify the instance exists and is accessible
    const currentInstance = await loadTokyoAccountInstanceDocument({
      accountId: current.value.authzPayload.accountPublicId,
      instanceId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!currentInstance.ok) {
      return withSession(
        request,
        NextResponse.json({ error: currentInstance.error }, { status: currentInstance.status }),
        current.value.setCookies,
      );
    }

    // Issue grant — reserve turn only on initial (kind is already validated).
    const isInitial = turnRequest.kind === 'initial';
    const issued = await issueAccountCopilotGrant({
      authz: current.value.authzPayload,
      ...(selectedModel ? { selectedModel } : {}),
      trace: { sessionId: turnRequest.sessionId, instanceId },
      usageKv: current.value.usageKv,
      ...(isInitial ? {} : { skipTurnReservation: true }),
    });
    if (!issued.ok) {
      if (issued.status === 403) {
        return withSession(
          request,
          NextResponse.json(
            { error: { kind: 'DENY', reasonKey: issued.reasonKey, detail: issued.detail } },
            { status: 403 },
          ),
          current.value.setCookies,
        );
      }
      return withSession(
        request,
        NextResponse.json({ message: issued.reasonKey }, { status: issued.status }),
        current.value.setCookies,
      );
    }

    // Forward to Product Copilot Worker /turn and pipe the SSE stream through.
    // streamCopilotTurn constructs the upstream body from validated fields
    // only — the Roma-issued grant is authoritative and cannot be overwritten.
    const streamResult = await streamCopilotTurn({
      grant: issued.grant,
      turnRequest,
      requestId: current.value.requestId,
      signal: request.signal,
    });

    if (!streamResult.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: streamResult.reasonKey ?? 'coreui.errors.copilot.failed',
              detail: streamResult.message,
            },
          },
          { status: streamResult.status },
        ),
        current.value.setCookies,
      );
    }

    // Transparent SSE relay — pipe the Product Copilot stream through to Bob.
    return withSession(
      request,
      new NextResponse(streamResult.response.body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
        },
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.copilot.failed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}
