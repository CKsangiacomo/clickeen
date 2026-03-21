import { classifyWidgetPublicId, isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';
import {
  asTrimmedString,
  createMichaelHeaders,
  encodeFilterValue,
  formatCuratedDisplayName,
  isRecord,
  michaelUnavailableResult,
  resolveMichaelAccessToken,
  resolveMichaelBaseUrlForTests,
  type MichaelAccountInstanceResult,
  type MichaelAccountPublishContainmentResult,
  type MichaelCuratedInstanceRow,
  type MichaelDeleteInstanceResult,
  type MichaelPublishedInstanceCountResult,
  type MichaelRenameInstanceResult,
  type MichaelStatusInstanceResult,
  type MichaelWidgetInstanceRow,
  type MichaelWidgetRow,
} from './michael-shared';

async function resolveWidgetTypeById(headers: Headers, widgetId: string): Promise<
  | { ok: true; widgetType: string }
  | { ok: false; status: number; reasonKey: string; detail?: string }
> {
  const widgetResponse = await fetch(
    `${resolveMichaelBaseUrlForTests()}/rest/v1/widgets?select=id,type&id=eq.${encodeFilterValue(widgetId)}&limit=1`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    },
  );
  const widgetText = await widgetResponse.text().catch(() => '');
  const widgetPayload = widgetText ? (JSON.parse(widgetText) as unknown) : null;
  if (!widgetResponse.ok) {
    return {
      ok: false,
      status: widgetResponse.status,
      reasonKey:
        widgetResponse.status === 401
          ? 'coreui.errors.auth.required'
          : 'coreui.errors.db.readFailed',
      detail: widgetText || undefined,
    };
  }

  const widgetRows = Array.isArray(widgetPayload) ? (widgetPayload as MichaelWidgetRow[]) : [];
  const widgetType = asTrimmedString(widgetRows[0]?.type);
  if (!widgetType) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'coreui.errors.instance.widgetMissing',
      detail: 'missing widget type',
    };
  }
  return { ok: true, widgetType };
}

export async function getAccountInstanceCoreRow(
  accountId: string,
  publicId: string,
  accessToken: string,
): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(accessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);

    if (isCuratedOrMainWidgetPublicId(publicId)) {
      const instanceResponse = await fetch(
        `${resolveMichaelBaseUrlForTests()}/rest/v1/curated_widget_instances?select=public_id,status,updated_at,widget_type,owner_account_id,meta&public_id=eq.${encodeFilterValue(publicId)}&limit=1`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
        },
      );
      const instanceText = await instanceResponse.text().catch(() => '');
      const instancePayload = instanceText ? (JSON.parse(instanceText) as unknown) : null;

      if (!instanceResponse.ok) {
        return {
          ok: false,
          status: instanceResponse.status,
          reasonKey:
            instanceResponse.status === 401
              ? 'coreui.errors.auth.required'
              : 'coreui.errors.db.readFailed',
          detail: instanceText || undefined,
        };
      }

      const instanceRows = Array.isArray(instancePayload)
        ? (instancePayload as MichaelCuratedInstanceRow[])
        : [];
      const instanceRow = instanceRows[0] ?? null;
      if (!instanceRow) {
        return { ok: true, row: null };
      }

      const widgetType = asTrimmedString(instanceRow.widget_type);
      if (!widgetType) {
        return {
          ok: false,
          status: 502,
          reasonKey: 'coreui.errors.instance.invalidPayload',
          detail: 'invalid curated_widget_instances payload',
        };
      }

      return {
        ok: true,
        row: {
          publicId: asTrimmedString(instanceRow.public_id) ?? publicId,
          displayName: formatCuratedDisplayName(instanceRow.meta, publicId),
          status: instanceRow.status === 'published' ? 'published' : 'unpublished',
          updatedAt: asTrimmedString(instanceRow.updated_at),
          widgetId: `curated:${widgetType}`,
          accountId: asTrimmedString(instanceRow.owner_account_id) ?? accountId,
          widgetType,
          meta: isRecord(instanceRow.meta) ? (instanceRow.meta as Record<string, unknown>) : null,
          source: 'curated',
        },
      };
    }

    const instanceResponse = await fetch(
      `${resolveMichaelBaseUrlForTests()}/rest/v1/widget_instances?select=public_id,display_name,status,updated_at,widget_id,account_id&account_id=eq.${encodeFilterValue(accountId)}&public_id=eq.${encodeFilterValue(publicId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const instanceText = await instanceResponse.text().catch(() => '');
    const instancePayload = instanceText ? (JSON.parse(instanceText) as unknown) : null;

    if (!instanceResponse.ok) {
      return {
        ok: false,
        status: instanceResponse.status,
        reasonKey:
          instanceResponse.status === 401
            ? 'coreui.errors.auth.required'
            : 'coreui.errors.db.readFailed',
        detail: instanceText || undefined,
      };
    }

    const instanceRows = Array.isArray(instancePayload)
      ? (instancePayload as MichaelWidgetInstanceRow[])
      : [];
    const instanceRow = instanceRows[0] ?? null;
    if (!instanceRow) {
      return { ok: true, row: null };
    }

    const widgetId = asTrimmedString(instanceRow.widget_id);
    const resolvedAccountId = asTrimmedString(instanceRow.account_id);
    if (!widgetId || !resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    const widgetType = await resolveWidgetTypeById(headers, widgetId);
    if (!widgetType.ok) {
      return widgetType;
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(instanceRow.public_id) ?? publicId,
        displayName: asTrimmedString(instanceRow.display_name),
        status: instanceRow.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(instanceRow.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType: widgetType.widgetType,
        meta: null,
        source: 'account',
      },
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function createAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  displayName?: string | null;
  status?: 'published' | 'unpublished';
  meta?: Record<string, unknown> | null;
  berlinAccessToken: string;
}): Promise<MichaelAccountInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    headers.set('content-type', 'application/json');
    headers.set('prefer', 'return=representation');

    const publicIdKind = classifyWidgetPublicId(args.publicId);
    if (!publicIdKind) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'invalid publicId',
      };
    }
    if (publicIdKind === 'main' || publicIdKind === 'curated') {
      return {
        ok: false,
        status: 403,
        reasonKey: 'coreui.errors.auth.forbidden',
      };
    }

    const widgetLookupResponse = await fetch(
      `${resolveMichaelBaseUrlForTests()}/rest/v1/widgets?select=id,type&type=eq.${encodeFilterValue(args.widgetType)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const widgetLookupText = await widgetLookupResponse.text().catch(() => '');
    const widgetLookupPayload = widgetLookupText ? (JSON.parse(widgetLookupText) as unknown) : null;
    if (!widgetLookupResponse.ok) {
      return {
        ok: false,
        status: widgetLookupResponse.status,
        reasonKey:
          widgetLookupResponse.status === 401
            ? 'coreui.errors.auth.required'
            : 'coreui.errors.db.readFailed',
        detail: widgetLookupText || undefined,
      };
    }

    const widgetRows = Array.isArray(widgetLookupPayload)
      ? (widgetLookupPayload as MichaelWidgetRow[])
      : [];
    const widgetId = asTrimmedString(widgetRows[0]?.id);
    if (!widgetId) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.widgetType.invalid',
        detail: `unknown widget type: ${args.widgetType}`,
      };
    }

    const instanceResponse = await fetch(
      `${resolveMichaelBaseUrlForTests()}/rest/v1/widget_instances?select=public_id,display_name,status,updated_at,widget_id,account_id`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          account_id: args.accountId,
          widget_id: widgetId,
          public_id: args.publicId,
          status: args.status === 'published' ? 'published' : 'unpublished',
          display_name: asTrimmedString(args.displayName) ?? 'Untitled widget',
          // Michael still requires config at the schema level, but the active
          // product document truth lives in Tokyo. Keep this as inert residue
          // instead of persisting a second live widget document copy.
          config: {},
          kind: 'user',
        }),
        cache: 'no-store',
      },
    );
    const instanceText = await instanceResponse.text().catch(() => '');
    const instancePayload = instanceText ? (JSON.parse(instanceText) as unknown) : null;
    if (!instanceResponse.ok) {
      return {
        ok: false,
        status: instanceResponse.status,
        reasonKey:
          instanceResponse.status === 401
            ? 'coreui.errors.auth.required'
            : instanceResponse.status === 409
              ? 'coreui.errors.publicId.conflict'
              : 'coreui.errors.db.writeFailed',
        detail: instanceText || undefined,
      };
    }

    const instanceRows = Array.isArray(instancePayload)
      ? (instancePayload as MichaelWidgetInstanceRow[])
      : [];
    const instanceRow = instanceRows[0] ?? null;
    if (!instanceRow) {
      return { ok: true, row: null };
    }

    const resolvedAccountId = asTrimmedString(instanceRow.account_id);
    if (!resolvedAccountId) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid widget_instances payload',
      };
    }

    return {
      ok: true,
      row: {
        publicId: asTrimmedString(instanceRow.public_id) ?? args.publicId,
        displayName: asTrimmedString(instanceRow.display_name),
        status: instanceRow.status === 'published' ? 'published' : 'unpublished',
        updatedAt: asTrimmedString(instanceRow.updated_at),
        widgetId,
        accountId: resolvedAccountId,
        widgetType: args.widgetType,
        meta: null,
        source: 'account',
      },
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function deleteAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  berlinAccessToken: string;
}): Promise<MichaelDeleteInstanceResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    headers.set('prefer', 'return=minimal');

    const publicIdKind = classifyWidgetPublicId(args.publicId);
    if (!publicIdKind) {
      return {
        ok: false,
        status: 422,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'invalid publicId',
      };
    }

    const path =
      publicIdKind === 'main' || publicIdKind === 'curated'
        ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeFilterValue(args.publicId)}`
        : `/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(args.accountId)}&public_id=eq.${encodeFilterValue(args.publicId)}`;

    const response = await fetch(`${resolveMichaelBaseUrlForTests()}${path}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : 'coreui.errors.db.writeFailed',
        detail: text || undefined,
      };
    }

    return { ok: true };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function loadAccountPublishContainment(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelAccountPublishContainmentResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    const response = await fetch(
      `${resolveMichaelBaseUrlForTests()}/rest/v1/account_publish_containment?select=account_id,reason&account_id=eq.${encodeFilterValue(accountId)}&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : response.status === 403
              ? 'coreui.errors.auth.forbidden'
              : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }

    const rows = Array.isArray(payload) ? payload : [];
    const row = (rows[0] as { account_id?: unknown; reason?: unknown } | undefined) ?? null;
    return {
      ok: true,
      containment: {
        active: Boolean(asTrimmedString(row?.account_id)),
        reason: asTrimmedString(row?.reason),
      },
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function countPublishedAccountInstances(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelPublishedInstanceCountResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    headers.set('prefer', 'count=exact');

    const response = await fetch(
      `${resolveMichaelBaseUrlForTests()}/rest/v1/widget_instances?select=public_id&account_id=eq.${encodeFilterValue(accountId)}&status=eq.published&limit=1`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reasonKey:
          response.status === 401
            ? 'coreui.errors.auth.required'
            : response.status === 403
              ? 'coreui.errors.auth.forbidden'
              : 'coreui.errors.db.readFailed',
        detail: text || undefined,
      };
    }
    const range = response.headers.get('content-range') || '';
    const match = range.match(/\/(\d+)$/);
    if (match) {
      return { ok: true, count: Number.parseInt(match[1] || '0', 10) };
    }
    const payload = text ? (JSON.parse(text) as unknown) : null;
    const rows = Array.isArray(payload) ? payload : [];
    return { ok: true, count: rows.length };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

async function patchAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  berlinAccessToken: string;
  body: Record<string, unknown>;
}): Promise<MichaelRenameInstanceResult> {
  const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
  if (!michaelAccess.ok) {
    return michaelAccess;
  }

  const headers = createMichaelHeaders(michaelAccess.accessToken);
  headers.set('content-type', 'application/json');
  headers.set('prefer', 'return=representation');

  const response = await fetch(
    `${resolveMichaelBaseUrlForTests()}/rest/v1/widget_instances?account_id=eq.${encodeFilterValue(args.accountId)}&public_id=eq.${encodeFilterValue(args.publicId)}&select=public_id,display_name,status,updated_at,widget_id,account_id`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(args.body),
      cache: 'no-store',
    },
  );
  const text = await response.text().catch(() => '');
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reasonKey:
        response.status === 401
          ? 'coreui.errors.auth.required'
          : 'coreui.errors.db.writeFailed',
      detail: text || undefined,
    };
  }

  const rows = Array.isArray(payload) ? (payload as MichaelWidgetInstanceRow[]) : [];
  const row = rows[0] ?? null;
  if (!row) {
    return { ok: true, row: null };
  }

  const widgetId = asTrimmedString(row.widget_id);
  const resolvedAccountId = asTrimmedString(row.account_id);
  if (!widgetId || !resolvedAccountId) {
    return {
      ok: false,
      status: 502,
      reasonKey: 'coreui.errors.instance.invalidPayload',
      detail: 'invalid widget_instances payload',
    };
  }

  const widgetType = await resolveWidgetTypeById(headers, widgetId);
  if (!widgetType.ok) {
    return widgetType;
  }

  return {
    ok: true,
    row: {
      publicId: asTrimmedString(row.public_id) ?? args.publicId,
      displayName: asTrimmedString(row.display_name),
      status: row.status === 'published' ? 'published' : 'unpublished',
      updatedAt: asTrimmedString(row.updated_at),
      widgetId,
      accountId: resolvedAccountId,
      widgetType: widgetType.widgetType,
    },
  };
}

export async function updateAccountInstanceStatusRow(args: {
  accountId: string;
  publicId: string;
  status: 'published' | 'unpublished';
  berlinAccessToken: string;
}): Promise<MichaelStatusInstanceResult> {
  try {
    return await patchAccountInstanceRow({
      accountId: args.accountId,
      publicId: args.publicId,
      berlinAccessToken: args.berlinAccessToken,
      body: { status: args.status },
    });
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}
