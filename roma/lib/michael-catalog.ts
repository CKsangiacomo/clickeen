import {
  asTrimmedString,
  fetchBerlinProductJson,
  michaelUnavailableResult,
  type MichaelAccountWidgetCatalogResult,
  type MichaelListedWidgetInstance,
  type MichaelTemplateCatalogResult,
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
    const registry = await fetchBerlinProductJson<{
      accountPublicIds?: unknown;
      curatedInstances?: unknown;
      widgetTypes?: unknown;
      containment?: unknown;
    }>({
      accessToken: args.berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(args.accountId)}/widget-registry`,
    });
    if (!registry.ok) return registry;

    const widgetTypeSet = new Set<string>();
    const registryWidgetTypes = Array.isArray(registry.value.widgetTypes)
      ? registry.value.widgetTypes
      : [];
    for (const typeRaw of registryWidgetTypes) {
      const type = asTrimmedString(typeRaw);
      if (type && type !== 'unknown') widgetTypeSet.add(type.toLowerCase());
    }
    const accountPublicIds = Array.isArray(registry.value.accountPublicIds)
      ? registry.value.accountPublicIds
          .map((publicId) => asTrimmedString(publicId))
          .filter((publicId): publicId is string => Boolean(publicId))
      : [];
    const registryCuratedInstances = Array.isArray(registry.value.curatedInstances)
      ? (registry.value.curatedInstances as Array<{
          publicId?: unknown;
          widgetType?: unknown;
          displayName?: unknown;
        }>)
      : [];

    const serveStatesResult = await loadTokyoAccountInstanceServeStates({
      accountId: args.accountId,
      publicIds: [
        ...accountPublicIds,
        ...registryCuratedInstances
          .map((row) => asTrimmedString(row.publicId))
          .filter((publicId): publicId is string => Boolean(publicId)),
      ],
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
      accountPublicIds.map(async (publicId) => {
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

    const curatedInstances: MichaelListedWidgetInstance[] = registryCuratedInstances.map((row) => {
      const publicId = asTrimmedString(row.publicId) ?? 'unknown';
      const widgetType = asTrimmedString(row.widgetType) ?? 'unknown';
      if (widgetType !== 'unknown') widgetTypeSet.add(widgetType.toLowerCase());
      return {
        publicId,
        widgetType,
        displayName: asTrimmedString(row.displayName) ?? publicId,
        status: serveStates[publicId] ?? 'unpublished',
      };
    });

    const containmentRecord =
      registry.value.containment &&
      typeof registry.value.containment === 'object' &&
      !Array.isArray(registry.value.containment)
        ? (registry.value.containment as { active?: unknown; reason?: unknown })
        : null;
    const containment = {
      active: Boolean(containmentRecord?.active),
      reason: asTrimmedString(containmentRecord?.reason),
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
    const registry = await fetchBerlinProductJson<{
      instances?: unknown;
      widgetTypes?: unknown;
    }>({
      accessToken: berlinAccessToken,
      path: '/v1/templates/registry',
    });
    if (!registry.ok) return registry;

    const widgetTypeSet = new Set<string>();
    const registryWidgetTypes = Array.isArray(registry.value.widgetTypes)
      ? registry.value.widgetTypes
      : [];
    for (const typeRaw of registryWidgetTypes) {
      const type = asTrimmedString(typeRaw);
      if (type && type !== 'unknown') widgetTypeSet.add(type.toLowerCase());
    }
    const rows = Array.isArray(registry.value.instances)
      ? (registry.value.instances as Array<{
          publicId?: unknown;
          widgetType?: unknown;
          displayName?: unknown;
        }>)
      : [];
    const instances = rows
      .map((row) => {
        const publicId = asTrimmedString(row.publicId);
        if (!publicId) return null;
        const widgetType = asTrimmedString(row.widgetType) ?? 'unknown';
        if (widgetType !== 'unknown') widgetTypeSet.add(widgetType.toLowerCase());
        return {
          publicId,
          widgetType,
          displayName: asTrimmedString(row.displayName) ?? publicId,
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
