import { isRecord as isPlainRecord } from '@clickeen/ck-contracts';
import type { CompiledWidget } from '../../lib/types';
import type { WidgetOp } from '../../lib/ops';
import { getAt } from '../../lib/utils/paths';
import { buildControlMatchers, findBestControlForPath } from '../../lib/edit/controls';
import { getCkTypographyAllowedStyles, getCkTypographyAllowedWeights } from '../../lib/edit/typography-fonts';

type PresetSpec = {
  customValue?: string;
  values?: Record<string, Record<string, unknown>>;
};

type PresetEntry = {
  sourcePath: string;
  customValue?: string;
  values: Record<string, Record<string, unknown>>;
  targetPaths: string[];
};

const surfaceOwnerPattern = '(?:stage|pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper)';

export { isPlainRecord };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function buildPresetEntries(raw: unknown): PresetEntry[] {
  if (raw == null) return [];
  if (!isPlainRecord(raw)) throw new Error('[BobLinkedOps] compiled presets must be an object');
  const entries: PresetEntry[] = [];

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    if (!sourcePath.trim()) throw new Error('[BobLinkedOps] compiled preset source path is missing');
    if (!isPlainRecord(specRaw)) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" must be an object`);
    const valuesRaw = (specRaw as PresetSpec).values;
    if (!isPlainRecord(valuesRaw)) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" values must be an object`);

    const values: Record<string, Record<string, unknown>> = {};
    const targetSet = new Set<string>();
    for (const [presetKey, mappingRaw] of Object.entries(valuesRaw)) {
      if (!presetKey.trim()) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" has an empty preset key`);
      if (!isPlainRecord(mappingRaw)) {
        throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}.${presetKey}" values must be an object`);
      }
      if (Object.keys(mappingRaw).length === 0) {
        throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}.${presetKey}" values cannot be empty`);
      }
      values[presetKey] = mappingRaw;
      Object.keys(mappingRaw).forEach((path) => {
        if (!path.trim()) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}.${presetKey}" has an empty target path`);
        targetSet.add(path);
      });
    }

    if (Object.keys(values).length === 0) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" values cannot be empty`);
    if (targetSet.size === 0) throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" has no target paths`);
    const customValue = (specRaw as PresetSpec).customValue;
    if (customValue != null && (typeof customValue !== 'string' || !customValue.trim())) {
      throw new Error(`[BobLinkedOps] compiled preset "${sourcePath}" customValue must be a non-empty string`);
    }

    entries.push({
      sourcePath,
      ...(typeof customValue === 'string' ? { customValue: customValue.trim() } : {}),
      values,
      targetPaths: Array.from(targetSet),
    });
  }

  return entries;
}

function pathMatchesTarget(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}.`);
}

function pickAllowedValue(current: unknown, allowed: string[], path: string): string {
  const trimmed = typeof current === 'string' ? current.trim() : '';
  if (trimmed && allowed.includes(trimmed)) return trimmed;
  throw new Error(`[BobLinkedOps] current value for "${path}" is not allowed by the selected typography family`);
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value === 'boolean') return value;
  throw new Error(`[BobLinkedOps] "${path}" must be a boolean`);
}

function requireShadowRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new Error(`[BobLinkedOps] "${path}" must be an object`);
  if (finiteNumber((value as Record<string, unknown>).x) == null) {
    throw new Error(`[BobLinkedOps] "${path}.x" must be a number`);
  }
  if (finiteNumber((value as Record<string, unknown>).y) == null) {
    throw new Error(`[BobLinkedOps] "${path}.y" must be a number`);
  }
  return value as Record<string, unknown>;
}

function isLinkedTogglePath(path: string): boolean {
  return (
    new RegExp(`^((?:pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper))\\.radiusLinked$`).test(path) ||
    new RegExp(`^(${surfaceOwnerPattern})\\.insideShadow\\.linked$`).test(path) ||
    /^(pod|stage)\.padding\.(desktop|mobile)\.linked$/.test(path) ||
    path === 'layout.itemPaddingLinked' ||
    path === 'appearance.headerCta.paddingLinked'
  );
}

export function expandLinkedOps(args: {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  ops: WidgetOp[];
}): WidgetOp[] {
  const setOp = (path: string, value: unknown): WidgetOp => ({ op: 'set', path, value });
  const presetEntries = buildPresetEntries(args.compiled?.presets);
  const controlMatchers = buildControlMatchers(args.compiled?.controls ?? []);
  const typographyFamilyPaths = Array.from(
    new Set(
      (args.compiled?.controls ?? [])
        .map((control) => control.path)
        .filter((path) => /^typography\.roles\.[^.]+\.family$/.test(path)),
    ),
  );
  const isAllowedPath = (path: string) => Boolean(findBestControlForPath(controlMatchers, path));

  const expanded: WidgetOp[] = [];
  const presetByPath = new Map(presetEntries.map((entry) => [entry.sourcePath, entry]));
  const presetOps = new Map<string, WidgetOp>();
  const themeScopePrefixes = ['stage.', 'pod.', 'appearance.', 'typography.'];
  const insideShadowLinkedOverrides = new Map<string, boolean>();
  const requireAllowedPath = (path: string) => {
    if (!isAllowedPath(path)) throw new Error(`[BobLinkedOps] preset target path "${path}" has no compiled control`);
  };

  presetEntries.forEach((entry) => {
    entry.targetPaths.forEach((targetPath) => {
      if (targetPath === 'typography.globalFamily') {
        if (typographyFamilyPaths.length === 0) {
          throw new Error('[BobLinkedOps] typography.globalFamily preset has no typography family controls');
        }
        return;
      }
      requireAllowedPath(targetPath);
    });
  });

  for (const op of args.ops) {
    if (op.op === 'set' && typeof op.path === 'string' && presetByPath.has(op.path)) {
      presetOps.set(op.path, op);
    }
    if (op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'boolean') {
      const insideShadowLinkMatch = op.path.match(new RegExp(`^(${surfaceOwnerPattern})\\.insideShadow\\.linked$`));
      if (insideShadowLinkMatch) insideShadowLinkedOverrides.set(insideShadowLinkMatch[1], op.value);
    }
  }

  for (const entry of presetEntries) {
    const targetPaths = entry.targetPaths.includes('typography.globalFamily')
      ? Array.from(new Set([...entry.targetPaths, ...typographyFamilyPaths]))
      : entry.targetPaths;
    const currentValue = getAt<unknown>(args.instanceData, entry.sourcePath);
    const shouldResetPreset =
      !presetOps.has(entry.sourcePath) &&
      typeof entry.customValue === 'string' &&
      typeof currentValue === 'string' &&
      currentValue !== entry.customValue &&
      args.ops.some((op) => {
        if (typeof op.path !== 'string') return false;
        if (op.path === entry.sourcePath) return false;
        if (entry.sourcePath === 'appearance.theme') {
          return themeScopePrefixes.some((prefix) => op.path.startsWith(prefix));
        }
        return targetPaths.some((target) => pathMatchesTarget(op.path, target));
      });

    if (shouldResetPreset) {
      expanded.push(setOp(entry.sourcePath, entry.customValue));
    }
  }

  for (const op of args.ops) {
    if (op.op !== 'set' || typeof op.path !== 'string') {
      expanded.push(op);
      continue;
    }
    if (isLinkedTogglePath(op.path) && typeof op.value !== 'boolean') requireBoolean(op.value, op.path);

    const presetEntry = presetByPath.get(op.path);
    if (presetEntry && typeof op.value === 'string') {
      expanded.push(op);
      const isCustomValue = typeof presetEntry.customValue === 'string' && op.value === presetEntry.customValue;
      const presetValues = isCustomValue ? null : presetEntry.values[op.value];
      if (!isCustomValue && !presetValues) {
        throw new Error(`[BobLinkedOps] preset "${op.value}" is not defined for "${op.path}"`);
      }
      if (presetValues) {
        for (const [presetPath, presetValue] of Object.entries(presetValues)) {
          if (presetPath === 'typography.globalFamily') {
            const familyValue = typeof presetValue === 'string' ? presetValue : '';
            if (!familyValue) throw new Error(`[BobLinkedOps] preset "${op.value}" has an invalid typography.globalFamily value`);
            const allowedWeights = getCkTypographyAllowedWeights(familyValue);
            const allowedStyles = getCkTypographyAllowedStyles(familyValue);
            typographyFamilyPaths.forEach((familyPath) => {
              if (isAllowedPath(familyPath)) {
                expanded.push(setOp(familyPath, familyValue));
              }

              const roleBase = familyPath.replace(/\.family$/, '');
              const weightPath = `${roleBase}.weight`;
              const stylePath = `${roleBase}.fontStyle`;

              if (allowedWeights.length > 0 && isAllowedPath(weightPath)) {
                const currentWeight = getAt<unknown>(args.instanceData, weightPath);
                expanded.push(setOp(weightPath, pickAllowedValue(currentWeight, allowedWeights, weightPath)));
              }

              if (allowedStyles.length > 0 && isAllowedPath(stylePath)) {
                const currentStyle = getAt<unknown>(args.instanceData, stylePath);
                expanded.push(setOp(stylePath, pickAllowedValue(currentStyle, allowedStyles, stylePath)));
              }
            });
            continue;
          }
          requireAllowedPath(presetPath);
          expanded.push(setOp(presetPath, presetValue));
        }
      }
      continue;
    }

    if (typeof op.value === 'boolean') {
      const radiusLinkMatch = op.path.match(new RegExp(`^((?:pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper))\\.radiusLinked$`));
      if (radiusLinkMatch) {
        const nextLinked = op.value;
        const base = radiusLinkMatch[1];
        const linkedPath = `${base}.radius`;
        const tlPath = `${base}.radiusTL`;
        const trPath = `${base}.radiusTR`;
        const brPath = `${base}.radiusBR`;
        const blPath = `${base}.radiusBL`;

        const linkedValue = getAt<unknown>(args.instanceData, linkedPath);
        const tlValue = getAt<unknown>(args.instanceData, tlPath);
        const source = nextLinked ? tlValue : linkedValue;
        if (typeof source !== 'string' || !source.trim()) {
          throw new Error(`[BobLinkedOps] "${op.path}" cannot link radius from malformed source value`);
        }

        expanded.push(
          setOp(op.path, nextLinked),
          ...(nextLinked ? [setOp(linkedPath, source)] : []),
          setOp(tlPath, source),
          setOp(trPath, source),
          setOp(brPath, source),
          setOp(blPath, source),
        );
        continue;
      }

      const insideShadowLinkMatch = op.path.match(new RegExp(`^(${surfaceOwnerPattern})\\.insideShadow\\.linked$`));
      if (insideShadowLinkMatch) {
        const nextLinked = op.value;
        const base = insideShadowLinkMatch[1];
        const allPath = `${base}.insideShadow.all`;
        const topPath = `${base}.insideShadow.top`;
        const rightPath = `${base}.insideShadow.right`;
        const bottomPath = `${base}.insideShadow.bottom`;
        const leftPath = `${base}.insideShadow.left`;

        const allValue = getAt<unknown>(args.instanceData, allPath);
        const topValue = getAt<unknown>(args.instanceData, topPath);
        const rightValue = getAt<unknown>(args.instanceData, rightPath);
        const bottomValue = getAt<unknown>(args.instanceData, bottomPath);
        const leftValue = getAt<unknown>(args.instanceData, leftPath);

        const makeShadowFrom = (sourceShadow: Record<string, unknown>) => () => ({ ...sourceShadow });

        if (!nextLinked) {
          const makeShadow = makeShadowFrom(requireShadowRecord(allValue, allPath));
          expanded.push(
            setOp(op.path, nextLinked),
            setOp(topPath, makeShadow()),
            setOp(rightPath, makeShadow()),
            setOp(bottomPath, makeShadow()),
            setOp(leftPath, makeShadow()),
          );
          continue;
        }

        const topShadow = requireShadowRecord(topValue, topPath);
        requireShadowRecord(rightValue, rightPath);
        requireShadowRecord(bottomValue, bottomPath);
        const leftShadow = requireShadowRecord(leftValue, leftPath);
        const baseShadow = topShadow;
        const mergedShadow: Record<string, unknown> = { ...baseShadow };
        const xFromLeft = leftShadow.x as number;
        const yFromTop = topShadow.y as number;
        mergedShadow.x = xFromLeft;
        mergedShadow.y = yFromTop;

        const makeShadow = makeShadowFrom(mergedShadow);

        expanded.push(
          setOp(op.path, nextLinked),
          setOp(allPath, makeShadow()),
          setOp(topPath, makeShadow()),
          setOp(rightPath, makeShadow()),
          setOp(bottomPath, makeShadow()),
          setOp(leftPath, makeShadow()),
        );
        continue;
      }

      const v2PaddingMatch = op.path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.linked$/);
      if (v2PaddingMatch) {
        const nextLinked = op.value;
        const rootKey = v2PaddingMatch[1];
        const deviceKey = v2PaddingMatch[2];
        const base = `${rootKey}.padding.${deviceKey}`;
        const allPath = `${base}.all`;
        const topPath = `${base}.top`;
        const rightPath = `${base}.right`;
        const bottomPath = `${base}.bottom`;
        const leftPath = `${base}.left`;

        const linkedValue = getAt<unknown>(args.instanceData, allPath);
        const topValue = getAt<unknown>(args.instanceData, topPath);
        const source = nextLinked ? topValue : linkedValue;
        const numberValue = finiteNumber(source);
        if (numberValue == null) {
          throw new Error(`[BobLinkedOps] "${op.path}" cannot link padding from malformed source value`);
        }

        expanded.push(
          setOp(op.path, nextLinked),
          ...(nextLinked ? [setOp(allPath, numberValue)] : []),
          setOp(topPath, numberValue),
          setOp(rightPath, numberValue),
          setOp(bottomPath, numberValue),
          setOp(leftPath, numberValue),
        );
        continue;
      }

      if (op.path === 'layout.itemPaddingLinked') {
        const nextLinked = op.value;
        const linkedValue = getAt<unknown>(args.instanceData, 'layout.itemPadding');
        const topValue = getAt<unknown>(args.instanceData, 'layout.itemPaddingTop');
        const source = nextLinked ? topValue : linkedValue;
        const numberValue = finiteNumber(source);
        if (numberValue == null) {
          throw new Error(`[BobLinkedOps] "${op.path}" cannot link item padding from malformed source value`);
        }

        expanded.push(
          setOp(op.path, nextLinked),
          ...(nextLinked ? [setOp('layout.itemPadding', numberValue)] : []),
          setOp('layout.itemPaddingTop', numberValue),
          setOp('layout.itemPaddingRight', numberValue),
          setOp('layout.itemPaddingBottom', numberValue),
          setOp('layout.itemPaddingLeft', numberValue),
        );
        continue;
      }

      if (op.path === 'appearance.headerCta.paddingLinked') {
        const nextLinked = op.value;
        if (nextLinked === true) {
          const inlineValue = getAt<unknown>(args.instanceData, 'appearance.headerCta.paddingInline');
          const numberValue = finiteNumber(inlineValue);
          if (numberValue == null) {
            throw new Error(`[BobLinkedOps] "${op.path}" cannot link header CTA padding from malformed source value`);
          }
          expanded.push(setOp(op.path, true), setOp('appearance.headerCta.paddingBlock', numberValue));
          continue;
        }
      }
    }

    const v2PaddingAllMatch = op.path.match(/^(pod|stage)\.padding\.(desktop|mobile)\.all$/);
    if (v2PaddingAllMatch) {
      const rootKey = v2PaddingAllMatch[1];
      const deviceKey = v2PaddingAllMatch[2];
      const base = `${rootKey}.padding.${deviceKey}`;
      const linkedValue = getAt<unknown>(args.instanceData, `${base}.linked`);
      const linked = requireBoolean(linkedValue, `${base}.linked`);
      const numberValue = finiteNumber(op.value);
      if (linked && numberValue == null) {
        throw new Error(`[BobLinkedOps] "${op.path}" cannot update linked padding from malformed value`);
      }
      if (linked && numberValue != null) {
        expanded.push(
          setOp(op.path, numberValue),
          setOp(`${base}.top`, numberValue),
          setOp(`${base}.right`, numberValue),
          setOp(`${base}.bottom`, numberValue),
          setOp(`${base}.left`, numberValue),
        );
        continue;
      }
    }

    const insideShadowAllMatch = op.path.match(new RegExp(`^(${surfaceOwnerPattern})\\.insideShadow\\.all$`));
    if (insideShadowAllMatch) {
      const base = insideShadowAllMatch[1];
      const linkedOverride = insideShadowLinkedOverrides.get(base);
      const linkedValue = linkedOverride != null ? linkedOverride : getAt<unknown>(args.instanceData, `${base}.insideShadow.linked`);
      const linked = requireBoolean(linkedValue, `${base}.insideShadow.linked`);
      if (linked) {
        const sourceShadow = requireShadowRecord(op.value, op.path);
        const makeShadow = () => ({ ...sourceShadow });
        expanded.push(
          setOp(op.path, makeShadow()),
          setOp(`${base}.insideShadow.top`, makeShadow()),
          setOp(`${base}.insideShadow.right`, makeShadow()),
          setOp(`${base}.insideShadow.bottom`, makeShadow()),
          setOp(`${base}.insideShadow.left`, makeShadow()),
        );
        continue;
      }
    }

    const radiusValueMatch = op.path.match(new RegExp(`^((?:pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper))\\.radius$`));
    if (radiusValueMatch) {
      const base = radiusValueMatch[1];
      const linkedValue = getAt<unknown>(args.instanceData, `${base}.radiusLinked`);
      const linked = requireBoolean(linkedValue, `${base}.radiusLinked`);
      if (linked && (typeof op.value !== 'string' || !op.value.trim())) {
        throw new Error(`[BobLinkedOps] "${op.path}" cannot update linked radius from malformed value`);
      }
      if (linked && typeof op.value === 'string' && op.value.trim()) {
        expanded.push(
          op,
          setOp(`${base}.radiusTL`, op.value),
          setOp(`${base}.radiusTR`, op.value),
          setOp(`${base}.radiusBR`, op.value),
          setOp(`${base}.radiusBL`, op.value),
        );
        continue;
      }
    }

    if (op.path === 'layout.itemPadding') {
      const linkedValue = getAt<unknown>(args.instanceData, 'layout.itemPaddingLinked');
      const linked = requireBoolean(linkedValue, 'layout.itemPaddingLinked');
      const numberValue = finiteNumber(op.value);
      if (linked && numberValue == null) {
        throw new Error(`[BobLinkedOps] "${op.path}" cannot update linked item padding from malformed value`);
      }
      if (linked && numberValue != null) {
        expanded.push(
          setOp(op.path, numberValue),
          setOp('layout.itemPaddingTop', numberValue),
          setOp('layout.itemPaddingRight', numberValue),
          setOp('layout.itemPaddingBottom', numberValue),
          setOp('layout.itemPaddingLeft', numberValue),
        );
        continue;
      }
    }

    if (op.path === 'appearance.headerCta.paddingInline') {
      const linkedValue = getAt<unknown>(args.instanceData, 'appearance.headerCta.paddingLinked');
      const linked = requireBoolean(linkedValue, 'appearance.headerCta.paddingLinked');
      const numberValue = finiteNumber(op.value);
      if (linked && numberValue == null) {
        throw new Error(`[BobLinkedOps] "${op.path}" cannot update linked header CTA padding from malformed value`);
      }
      if (linked && numberValue != null) {
        expanded.push(setOp(op.path, numberValue), setOp('appearance.headerCta.paddingBlock', numberValue));
        continue;
      }
    }

    expanded.push(op);
  }

  return expanded;
}
