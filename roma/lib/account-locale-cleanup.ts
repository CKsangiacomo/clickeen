export type RemovedLocaleCleanupError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
  reasonKey: string;
  detail?: string;
};

export type RemovedLocaleCleanup = {
  ok: boolean;
  instancesChecked: number;
  deleted: Array<{ instanceId: string; locale: string }>;
  deletedPackages: Array<{ accountId: string; instanceId: string; locale: string }>;
  failed: Array<{
    instanceId: string;
    locale: string;
    phase: 'translation-delete' | 'locale-package-delete' | 'cache-refresh';
    reasonKey: string;
    detail?: string;
  }>;
  error?: RemovedLocaleCleanupError;
};

export function emptyRemovedLocaleCleanup(): RemovedLocaleCleanup {
  return {
    ok: true,
    instancesChecked: 0,
    deleted: [],
    deletedPackages: [],
    failed: [],
  };
}

function unexpectedCleanupError(error: unknown): RemovedLocaleCleanupError {
  return {
    kind: 'UPSTREAM_UNAVAILABLE',
    reasonKey: 'coreui.errors.db.writeFailed',
    detail: error instanceof Error ? error.message : String(error),
  };
}

export async function runRemovedLocaleCleanup(args: {
  accountId: string;
  instanceIds: string[];
  removedLocales: string[];
  deleteTranslation: (instanceId: string, locale: string) => Promise<
    { ok: true } | { ok: false; error: RemovedLocaleCleanupError }
  >;
  deletePackage: (instanceId: string, locale: string) => Promise<
    | { ok: true; value: { accountId: string; instanceId: string; locale: string } }
    | { ok: false; error: RemovedLocaleCleanupError }
  >;
}): Promise<RemovedLocaleCleanup> {
  const removedLocales = Array.from(new Set(args.removedLocales));
  if (removedLocales.length === 0) return emptyRemovedLocaleCleanup();

  const deleted: RemovedLocaleCleanup['deleted'] = [];
  const deletedPackages: RemovedLocaleCleanup['deletedPackages'] = [];
  const failed: RemovedLocaleCleanup['failed'] = [];
  let firstError: RemovedLocaleCleanupError | null = null;
  let instancesChecked = 0;

  for (const instanceId of args.instanceIds) {
    instancesChecked += 1;
    for (const locale of removedLocales) {
      const translationDelete = await args.deleteTranslation(instanceId, locale).catch((error) => ({
        ok: false as const,
        error: unexpectedCleanupError(error),
      }));
      if (!translationDelete.ok) {
        const detail = `delete:${instanceId}:${locale}:${translationDelete.error.detail ?? translationDelete.error.reasonKey}`;
        firstError ??= {
          kind: translationDelete.error.kind,
          reasonKey: translationDelete.error.reasonKey,
          detail,
        };
        failed.push({
          instanceId,
          locale,
          phase: 'translation-delete',
          reasonKey: translationDelete.error.reasonKey,
          detail,
        });
      } else {
        deleted.push({ instanceId, locale });
      }

      const packageDelete = await args.deletePackage(instanceId, locale).catch((error) => ({
        ok: false as const,
        error: unexpectedCleanupError(error),
      }));
      if (!packageDelete.ok) {
        const detail = `locale-package-delete:${instanceId}:${locale}:${packageDelete.error.detail ?? packageDelete.error.reasonKey}`;
        firstError ??= {
          kind: packageDelete.error.kind,
          reasonKey: packageDelete.error.reasonKey,
          detail,
        };
        failed.push({
          instanceId,
          locale,
          phase: packageDelete.error.reasonKey.startsWith('tokyo.errors.publicCache.')
            ? 'cache-refresh'
            : 'locale-package-delete',
          reasonKey: packageDelete.error.reasonKey,
          detail,
        });
      } else {
        deletedPackages.push(packageDelete.value);
      }
    }
  }

  return {
    ok: failed.length === 0,
    instancesChecked,
    deleted,
    deletedPackages,
    failed,
    ...(firstError ? { error: firstError } : {}),
  };
}
