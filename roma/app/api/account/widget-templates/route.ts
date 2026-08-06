import { NextRequest, NextResponse } from 'next/server';
import {
  loadAccountWidgetInstanceFacts,
  listTokyoWidgetDefinitions,
} from '@roma/lib/account-instance-direct';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const accountId = current.value.authzPayload.accountPublicId;
  const [facts, definitions] = await Promise.all([
    loadAccountWidgetInstanceFacts({
      accountId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    }),
    listTokyoWidgetDefinitions({
      accountId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    }),
  ]);
  if (!facts.ok) {
    return withSession(
      request,
      NextResponse.json({ error: facts.error }, { status: facts.status }),
      current.value.setCookies,
    );
  }
  if (!definitions.ok) {
    return withSession(
      request,
      NextResponse.json({ error: definitions.error }, { status: definitions.status }),
      current.value.setCookies,
    );
  }
  const displayNameByType = new Map(
    definitions.value.widgetDefinitions.map((definition) => [definition.widgetType, definition.displayName]),
  );
  const invalidTemplate = facts.value.instances.find(
    (instance) => instance.isTemplate && !instance.displayName,
  );
  if (invalidTemplate) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: `template_display_name_missing:${invalidTemplate.instanceId}`,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
  const templates = facts.value.instances
    .filter((instance) => instance.isTemplate)
    .map((instance) => ({
      templateId: instance.instanceId,
      templateName: instance.displayName!,
      widgetType: instance.widgetType,
      widget: displayNameByType.get(instance.widgetType) ?? instance.widgetType,
      updatedAt: instance.updatedAt,
      ...(instance.catalogPresentation
        ? { catalogPresentation: instance.catalogPresentation }
        : {}),
    }));
  return withSession(
    request,
    NextResponse.json({ accountId, templates }),
    current.value.setCookies,
  );
}
