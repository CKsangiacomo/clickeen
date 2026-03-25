import {
  asTrimmedString,
  createMichaelHeaders,
  encodeFilterValue,
  fetchMichaelListRows,
  formatCuratedDisplayName,
  michaelUnavailableResult,
  parseJsonTextOrNull,
  resolveMichaelAccessToken,
  resolveMichaelBaseUrlForTests,
  type MichaelAccountWidgetCatalogResult,
  type MichaelListedWidgetInstance,
  type MichaelTemplateCatalogResult,
  type MichaelWidgetRow,
} from './michael-shared';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceServeStates,
} from './account-instance-direct';

export async function loadAccountWidgetCatalog(args: {
  accountId: string;
  berlinAccessToken: string;
  tokyoAccessToken: string;
  accountCapsule?: string | null;
}): Promise<MichaelAccountWidgetCatalogResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(args.berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);

    const [accountRows, curatedRows, widgetRows, containmentResponse] = await Promise.all([
      fetchMichaelListRows<{
        public_id?: unknown;
      }>({
        headers,
        pathname: `/rest/v1/widget_instances?select=public_id&account_id=eq.${encodeFilterValue(args.accountId)}&order=created_at.desc,public_id.desc`,
      }),
      fetchMichaelListRows<{
        public_id?: unknown;
        widget_type?: unknown;
        meta?: unknown;
      }>({
        headers,
        pathname: `/rest/v1/curated_widget_instances?select=public_id,widget_type,meta&owner_account_id=eq.${encodeFilterValue(args.accountId)}&order=created_at.desc,public_id.desc`,
      }),
      fetchMichaelListRows<MichaelWidgetRow>({
        headers,
        pathname: '/rest/v1/widgets?select=id,type&order=type.asc,id.asc',
      }),
      fetch(
        `${resolveMichaelBaseUrlForTests()}/rest/v1/account_publish_containment?select=account_id,reason&account_id=eq.${encodeFilterValue(args.accountId)}&limit=1`,
        {
          method: 'GET',
          headers,
          cache: 'no-store',
        },
      ),
    ]);

    if (!accountRows.ok) return accountRows;
    if (!curatedRows.ok) return curatedRows;
    if (!widgetRows.ok) return widgetRows;

    const widgetTypeSet = new Set<string>();
    for (const row of widgetRows.rows) {
      const type = asTrimmedString(row.type);
      if (!type || type === 'unknown') continue;
      widgetTypeSet.add(type.toLowerCase());
    }

    const serveStatesResult = await loadTokyoAccountInstanceServeStates({
      accountId: args.accountId,
      publicIds: [
        ...accountRows.rows.map((row) => asTrimmedString(row.public_id)),
        ...curatedRows.rows.map((row) => asTrimmedString(row.public_id)),
      ].filter((publicId): publicId is string => Boolean(publicId)),
      tokyoAccessToken: args.tokyoAccessToken,
      accountCapsule: args.accountCapsule,
    });
    if (!serveStatesResult.ok) {
      return {
        ok: false,
        status: serveStatesResult.status,
        reasonKey: serveStatesResult.error.reasonKey,
        detail: serveStatesResult.error.detail,
      };
    }
    const serveStates = serveStatesResult.value.serveStates;

    const accountIdentityResults = await Promise.all(
      accountRows.rows.map(async (row) => {
        const publicId = asTrimmedString(row.public_id);
        if (!publicId) return { ok: true as const, value: null };

        const saved = await loadTokyoAccountInstanceDocument({
          accountId: args.accountId,
          publicId,
          tokyoAccessToken: args.tokyoAccessToken,
          accountCapsule: args.accountCapsule,
        });
        if (!saved.ok) {
          if (saved.status === 404) {
            return { ok: true as const, value: null };
          }
          return {
            ok: false as const,
            status: saved.status,
            reasonKey: saved.error.reasonKey,
            detail: saved.error.detail,
          };
        }

        const widgetType = saved.value.row.widgetType.trim() || 'unknown';
        if (widgetType !== 'unknown') widgetTypeSet.add(widgetType.toLowerCase());
        return {
          ok: true as const,
          value: {
            publicId: saved.value.row.publicId,
            widgetType,
            displayName: saved.value.row.displayName || 'Untitled widget',
            status: serveStates[saved.value.row.publicId] ?? 'unpublished',
          },
        };
      }),
    );

    const accountIdentityFailure = accountIdentityResults.find((result) => result.ok === false);
    if (accountIdentityFailure) {
      return accountIdentityFailure;
    }

    const accountInstances: MichaelListedWidgetInstance[] = accountIdentityResults.flatMap((result) =>
      result.ok && result.value ? [result.value] : [],
    );

    const curatedInstances: MichaelListedWidgetInstance[] = curatedRows.rows.map((row) => {
      const publicId = asTrimmedString(row.public_id) ?? 'unknown';
      const widgetType = asTrimmedString(row.widget_type) ?? 'unknown';
      if (widgetType !== 'unknown') widgetTypeSet.add(widgetType);
      return {
        publicId,
        widgetType,
        displayName: formatCuratedDisplayName(row.meta, publicId),
        status: serveStates[publicId] ?? 'unpublished',
      };
    });

    const containmentText = await containmentResponse.text().catch(() => '');
    const containmentPayload = parseJsonTextOrNull(containmentText);
    const containment =
      containmentResponse.ok && Array.isArray(containmentPayload)
        ? {
            active: Boolean(
              asTrimmedString(
                (containmentPayload[0] as { account_id?: unknown } | undefined)?.account_id,
              ),
            ),
            reason: asTrimmedString(
              (containmentPayload[0] as { reason?: unknown } | undefined)?.reason,
            ),
          }
        : {
            active: true,
            reason: 'account_publish_containment_unavailable',
          };

    return {
      ok: true,
      accountInstances,
      curatedInstances,
      widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
      containment,
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function loadTemplateCatalog(
  berlinAccessToken: string,
): Promise<MichaelTemplateCatalogResult> {
  try {
    const michaelAccess = await resolveMichaelAccessToken(berlinAccessToken);
    if (!michaelAccess.ok) {
      return michaelAccess;
    }

    const headers = createMichaelHeaders(michaelAccess.accessToken);
    const rows = await fetchMichaelListRows<{
      public_id?: unknown;
      widget_type?: unknown;
      meta?: unknown;
    }>({
      headers,
      pathname:
        '/rest/v1/curated_widget_instances?select=public_id,widget_type,meta&order=created_at.desc,public_id.desc',
    });
    if (!rows.ok) return rows;

    const widgetTypeSet = new Set<string>();
    const instances = rows.rows
      .map((row) => {
        const publicId = asTrimmedString(row.public_id);
        if (!publicId) return null;
        const widgetType = asTrimmedString(row.widget_type) ?? 'unknown';
        if (widgetType !== 'unknown') widgetTypeSet.add(widgetType);
        return {
          publicId,
          widgetType,
          displayName: formatCuratedDisplayName(row.meta, publicId),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return {
      ok: true,
      instances,
      widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}
