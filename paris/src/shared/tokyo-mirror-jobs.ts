import { generateMetaPack } from './seo-geo';
import type {
  LocalePolicy,
  SyncLiveSurfaceJob,
  WriteConfigPackJob,
  WriteMetaPackJob,
  WriteTextPackJob,
} from './types';
import { applyTextPackToConfig } from './text-packs';

type MirrorEnqueueResult = { ok: true } | { ok: false; error: string };
type MirrorEnqueueFailure = { locale: string; error: string };
type MirrorEnqueueKind = 'write-text-pack' | 'write-meta-pack' | 'write-config-pack' | 'sync-live-surface';

export async function enqueueLocaleTextPacks(args: {
  publicId: string;
  baseFingerprint: string;
  localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }>;
  enqueue: (job: WriteTextPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<MirrorEnqueueFailure[]> {
  const failures: MirrorEnqueueFailure[] = [];
  for (const { locale, textPack } of args.localeTextPacks) {
    const result = await args.enqueue({
      v: 1,
      kind: 'write-text-pack',
      publicId: args.publicId,
      locale,
      baseFingerprint: args.baseFingerprint,
      textPack,
    });
    if (!result.ok) failures.push({ locale, error: result.error });
  }
  return failures;
}

export async function enqueueLocaleMetaPacks(args: {
  publicId: string;
  widgetType: string;
  configPack: Record<string, unknown>;
  localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }>;
  enqueue: (job: WriteMetaPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<MirrorEnqueueFailure[]> {
  const failures: MirrorEnqueueFailure[] = [];
  for (const { locale, textPack } of args.localeTextPacks) {
    const metaState = applyTextPackToConfig(args.configPack, textPack);
    const metaPack = generateMetaPack({ widgetType: args.widgetType, state: metaState, locale });
    const result = await args.enqueue({
      v: 1,
      kind: 'write-meta-pack',
      publicId: args.publicId,
      locale,
      metaPack,
    });
    if (!result.ok) failures.push({ locale, error: result.error });
  }
  return failures;
}

export async function enqueueConfigPack(args: {
  publicId: string;
  widgetType: string;
  configFp: string;
  configPack: Record<string, unknown>;
  enqueue: (job: WriteConfigPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<string | null> {
  const result = await args.enqueue({
    v: 1,
    kind: 'write-config-pack',
    publicId: args.publicId,
    widgetType: args.widgetType,
    configFp: args.configFp,
    configPack: args.configPack,
  });
  return result.ok ? null : result.error;
}

export async function enqueueLiveSurfaceSync(args: {
  publicId: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
  enqueue: (job: SyncLiveSurfaceJob) => Promise<MirrorEnqueueResult>;
}): Promise<string | null> {
  const result = await args.enqueue({
    v: 1,
    kind: 'sync-live-surface',
    publicId: args.publicId,
    live: true,
    widgetType: args.widgetType,
    configFp: args.configFp,
    localePolicy: args.localePolicy,
    seoGeo: args.seoGeo,
  });
  return result.ok ? null : result.error;
}

export function logMirrorEnqueueFailures(args: {
  kind: Extract<MirrorEnqueueKind, 'write-text-pack' | 'write-meta-pack'>;
  failures: MirrorEnqueueFailure[];
  context?: string;
}): void {
  if (args.failures.length === 0) return;
  const suffix = args.context ? ` (${args.context})` : '';
  for (const failure of args.failures) {
    console.error(`[ParisWorker] tokyo ${args.kind} enqueue failed${suffix}`, failure.error);
  }
}

export function logMirrorEnqueueError(args: {
  kind: Extract<MirrorEnqueueKind, 'write-config-pack' | 'sync-live-surface'>;
  error: string | null;
  context?: string;
}): void {
  if (!args.error) return;
  const suffix = args.context ? ` (${args.context})` : '';
  console.error(`[ParisWorker] tokyo ${args.kind} enqueue failed${suffix}`, args.error);
}
