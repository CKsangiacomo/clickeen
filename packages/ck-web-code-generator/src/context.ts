import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type {
  ResolvedWebCodeContext,
  SavedInstanceStructuredSource,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readResolvedAsset(
  assetsByRef: Record<string, ResolvedAccountAsset>,
  assetRef: unknown,
): ResolvedAccountAsset {
  if (typeof assetRef !== 'string' || !assetRef.trim()) {
    throw new Error('ck.web_code.asset_ref_invalid');
  }
  const resolved = assetsByRef[assetRef];
  if (
    !resolved ||
    resolved.assetRef !== assetRef ||
    !resolved.url ||
    !resolved.assetType ||
    !resolved.contentType
  ) {
    throw new Error(`ck.web_code.asset_unresolved:${assetRef}`);
  }
  return resolved;
}

function materializeFill(
  value: Record<string, unknown>,
  assetsByRef: Record<string, ResolvedAccountAsset>,
): Record<string, unknown> {
  if (value.type === 'image') {
    if (!isRecord(value.image)) throw new Error('ck.web_code.image_fill_invalid');
    const image = { ...value.image };
    if (Object.prototype.hasOwnProperty.call(image, 'assetRef')) {
      image.src = readResolvedAsset(assetsByRef, image.assetRef).url;
    } else if (typeof image.src !== 'string' || !image.src.trim()) {
      throw new Error('ck.web_code.image_fill_invalid');
    }
    return { ...value, image };
  }
  if (value.type === 'video') {
    if (!isRecord(value.video)) throw new Error('ck.web_code.video_fill_invalid');
    const video = { ...value.video };
    if (Object.prototype.hasOwnProperty.call(video, 'assetRef')) {
      video.src = readResolvedAsset(assetsByRef, video.assetRef).url;
    } else if (typeof video.src !== 'string' || !video.src.trim()) {
      throw new Error('ck.web_code.video_fill_invalid');
    }
    if (Object.prototype.hasOwnProperty.call(video, 'posterAssetRef')) {
      video.poster = readResolvedAsset(assetsByRef, video.posterAssetRef).url;
    }
    return { ...value, video };
  }
  return value;
}

export function materializeResolvedContext(
  source: SavedInstanceStructuredSource,
  context: ResolvedWebCodeContext,
): SavedInstanceStructuredSource {
  if (!isRecord(source)) throw new Error('ck.web_code.instance_source_invalid');
  if (
    !isRecord(context) ||
    !isRecord(context.assetsByRef) ||
    !isRecord(context.typography) ||
    !isRecord(context.typography.curatedFonts)
  ) {
    throw new Error('ck.web_code.context_invalid');
  }

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isRecord(value)) return value;
    const next: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, child]) => {
      next[key] = visit(child);
    });
    return materializeFill(next, context.assetsByRef);
  };

  return visit(source) as SavedInstanceStructuredSource;
}
