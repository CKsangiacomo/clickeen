import { isRecord as isPlainRecord } from '@clickeen/ck-contracts';
import type { CompiledWidget } from '../types';
import type { WidgetOp } from '../ops';
import { getAt } from '../utils/paths';
import { buildControlMatchers, findBestControlForPath } from './controls';
import { getCkTypographyAllowedStyles, getCkTypographyAllowedWeights } from './typography-fonts';

type PresetSpec = {
  customValue?: string;
  values?: Record<string, Record<string, unknown>>;
};

type PresetEntry = {
  sourcePath: string;
  customValue: string;
  values: Record<string, Record<string, unknown>>;
  targetPaths: string[];
};

const surfaceOwnerPattern = '(?:stage|pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper)';
const layoutOwnerPattern = '(?:(?:[a-zA-Z0-9_-]+\\.)?layout)';

export { isPlainRecord };

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function buildPresetEntries(raw: unknown): PresetEntry[] {
  if (raw == null) return [];
  if (!isPlainRecord(raw)) throw new Error('[BobEditor] compiled presets must be an object');
  const entries: PresetEntry[] = [];

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    const normalizedSourcePath = sourcePath.trim();
    if (!normalizedSourcePath) throw new Error('[BobEditor] compiled preset source path is required');
    if (!isPlainRecord(specRaw)) throw new Error(`[BobEditor] compiled preset "${normalizedSourcePath}" must be an object`);
    const valuesRaw = (specRaw as PresetSpec).values;
    if (!isPlainRecord(valuesRaw)) throw new Error(`[BobEditor] compiled preset "${normalizedSourcePath}" requires values`);

    const values: Record<string, Record<string, unknown>> = {};
    const targetSet = new Set<string>();
    for (const [presetKey, mappingRaw] of Object.entries(valuesRaw)) {
      const normalizedPresetKey = presetKey.trim();
      if (!normalizedPresetKey) throw new Error(`[BobEditor] compiled preset "${normalizedSourcePath}" has an empty value key`);
      if (!isPlainRecord(mappingRaw)) {
        throw new Error(
          `[BobEditor] compiled preset "${normalizedSourcePath}" value "${normalizedPresetKey}" must be an object`,
        );
      }
      values[normalizedPresetKey] = mappingRaw;
      Object.keys(mappingRaw).forEach((path) => {
        if (path) targetSet.add(path);
      });
    }

    if (Object.keys(values).length === 0 || targetSet.size === 0) {
      throw new Error(`[BobEditor] compiled preset "${normalizedSourcePath}" requires target values`);
    }
    const customValueRaw = (specRaw as PresetSpec).customValue;
    if (customValueRaw != null && (typeof customValueRaw !== 'string' || !customValueRaw.trim())) {
      throw new Error(`[BobEditor] compiled preset "${normalizedSourcePath}" customValue must be a non-empty string`);
    }
    const customValue =
      typeof customValueRaw === 'string' && customValueRaw.trim()
        ? customValueRaw.trim()
        : 'custom';

    entries.push({
      sourcePath: normalizedSourcePath,
      customValue,
      values,
      targetPaths: Array.from(targetSet),
    });
  }

  return entries;
}

function linkedOpError(path: string, detail: string): never {
  throw new Error(`[BobEditor] Cannot apply linked operation "${path}": ${detail}`);
}

function pathMatchesTarget(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}.`);
}

function pickAllowedValue(current: unknown, allowed: string[], preferred: string): string {
  const trimmed = typeof current === 'string' ? current.trim() : '';
  if (trimmed && allowed.includes(trimmed)) return trimmed;
  if (allowed.includes(preferred)) return preferred;
  return allowed[0] ?? '';
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

    const presetEntry = presetByPath.get(op.path);
    if (presetEntry && typeof op.value === 'string') {
      expanded.push(op);
      const presetValues = op.value !== presetEntry.customValue ? presetEntry.values[op.value] : null;
      if (op.value !== presetEntry.customValue && !presetValues) {
        linkedOpError(op.path, `unknown preset value "${op.value}"`);
      }
      if (presetValues) {
        for (const [presetPath, presetValue] of Object.entries(presetValues)) {
          if (presetPath === 'typography.globalFamily') {
            if (typeof presetValue !== 'string' || !presetValue.trim()) {
              linkedOpError(op.path, 'typography.globalFamily preset value must be a non-empty string');
            }
            const familyValue = presetValue.trim();
            const allowedWeights = getCkTypographyAllowedWeights(familyValue);
            const allowedStyles = getCkTypographyAllowedStyles(familyValue);
            typographyFamilyPaths.forEach((familyPath) => {
              if (!isAllowedPath(familyPath)) linkedOpError(op.path, `preset target "${familyPath}" is not editable`);
              expanded.push(setOp(familyPath, familyValue));

              const roleBase = familyPath.replace(/\.family$/, '');
              const weightPath = `${roleBase}.weight`;
              const stylePath = `${roleBase}.fontStyle`;

              if (allowedWeights.length > 0) {
                if (!isAllowedPath(weightPath)) linkedOpError(op.path, `preset target "${weightPath}" is not editable`);
                const currentWeight = getAt<unknown>(args.instanceData, weightPath);
                const nextWeight = pickAllowedValue(currentWeight, allowedWeights, '400');
                if (nextWeight) expanded.push(setOp(weightPath, nextWeight));
              }

              if (allowedStyles.length > 0) {
                if (!isAllowedPath(stylePath)) linkedOpError(op.path, `preset target "${stylePath}" is not editable`);
                const currentStyle = getAt<unknown>(args.instanceData, stylePath);
                const nextStyle = pickAllowedValue(currentStyle, allowedStyles, 'normal');
                if (nextStyle) expanded.push(setOp(stylePath, nextStyle));
              }
            });
            continue;
          }
          if (!isAllowedPath(presetPath)) linkedOpError(op.path, `preset target "${presetPath}" is not editable`);
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
          linkedOpError(op.path, `missing source value for ${nextLinked ? tlPath : linkedPath}`);
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

        const pickAxis = (value: unknown, axisKey: 'x' | 'y'): number | null => {
          if (!isPlainRecord(value)) return null;
          return finiteNumber((value as Record<string, unknown>)[axisKey]);
        };

        const makeShadowFrom = (sourceShadow: Record<string, unknown>) => () => ({ ...sourceShadow });

        if (!nextLinked) {
          if (!isPlainRecord(allValue)) {
            linkedOpError(op.path, `missing source value for ${allPath}`);
          }

          const makeShadow = makeShadowFrom(allValue as Record<string, unknown>);
          expanded.push(
            setOp(op.path, nextLinked),
            setOp(topPath, makeShadow()),
            setOp(rightPath, makeShadow()),
            setOp(bottomPath, makeShadow()),
            setOp(leftPath, makeShadow()),
          );
          continue;
        }

        const baseShadowRaw =
          (isPlainRecord(topValue) ? topValue : null) ??
          (isPlainRecord(allValue) ? allValue : null) ??
          (isPlainRecord(leftValue) ? leftValue : null) ??
          (isPlainRecord(rightValue) ? rightValue : null) ??
          (isPlainRecord(bottomValue) ? bottomValue : null);

        if (!baseShadowRaw) {
          linkedOpError(op.path, 'missing source shadow value');
        }

        const baseShadow = baseShadowRaw as Record<string, unknown>;
        const mergedShadow: Record<string, unknown> = { ...baseShadow };
        const xFromSides = pickAxis(leftValue, 'x') ?? pickAxis(rightValue, 'x');
        const yFromSides = pickAxis(topValue, 'y') ?? pickAxis(bottomValue, 'y');
        if (xFromSides != null) mergedShadow.x = xFromSides;
        if (yFromSides != null) mergedShadow.y = yFromSides;

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
          linkedOpError(op.path, `missing numeric source value for ${nextLinked ? topPath : allPath}`);
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

      const itemPaddingLinkedMatch = op.path.match(new RegExp(`^(${layoutOwnerPattern})\\.itemPaddingLinked$`));
      if (itemPaddingLinkedMatch) {
        const nextLinked = op.value;
        const base = itemPaddingLinkedMatch[1];
        const linkedPath = `${base}.itemPadding`;
        const topPath = `${base}.itemPaddingTop`;
        const rightPath = `${base}.itemPaddingRight`;
        const bottomPath = `${base}.itemPaddingBottom`;
        const leftPath = `${base}.itemPaddingLeft`;
        const linkedValue = getAt<unknown>(args.instanceData, linkedPath);
        const topValue = getAt<unknown>(args.instanceData, topPath);
        const source = nextLinked ? topValue : linkedValue;
        const numberValue = finiteNumber(source);
        if (numberValue == null) {
          linkedOpError(op.path, `missing numeric source value for ${nextLinked ? topPath : linkedPath}`);
        }

        expanded.push(
          setOp(op.path, nextLinked),
          ...(nextLinked ? [setOp(linkedPath, numberValue)] : []),
          setOp(topPath, numberValue),
          setOp(rightPath, numberValue),
          setOp(bottomPath, numberValue),
          setOp(leftPath, numberValue),
        );
        continue;
      }

      if (op.path === 'appearance.headerCta.paddingLinked') {
        const nextLinked = op.value;
        if (nextLinked === true) {
          const inlineValue = getAt<unknown>(args.instanceData, 'appearance.headerCta.paddingInline');
          const numberValue = finiteNumber(inlineValue);
          if (numberValue == null) {
            linkedOpError(op.path, 'missing numeric source value for appearance.headerCta.paddingInline');
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
      const linked = linkedValue !== false;
      const numberValue = finiteNumber(op.value);
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
      const linked = linkedValue !== false;
      if (linked && isPlainRecord(op.value)) {
        const sourceShadow = op.value as Record<string, unknown>;
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
      const linked = linkedValue !== false;
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

    const itemPaddingMatch = op.path.match(new RegExp(`^(${layoutOwnerPattern})\\.itemPadding$`));
    if (itemPaddingMatch) {
      const base = itemPaddingMatch[1];
      const linkedValue = getAt<unknown>(args.instanceData, `${base}.itemPaddingLinked`);
      const linked = linkedValue !== false;
      const numberValue = finiteNumber(op.value);
      if (linked && numberValue != null) {
        expanded.push(
          setOp(op.path, numberValue),
          setOp(`${base}.itemPaddingTop`, numberValue),
          setOp(`${base}.itemPaddingRight`, numberValue),
          setOp(`${base}.itemPaddingBottom`, numberValue),
          setOp(`${base}.itemPaddingLeft`, numberValue),
        );
        continue;
      }
    }

    if (op.path === 'appearance.headerCta.paddingInline') {
      const linkedValue = getAt<unknown>(args.instanceData, 'appearance.headerCta.paddingLinked');
      const linked = linkedValue === true;
      const numberValue = finiteNumber(op.value);
      if (linked && numberValue != null) {
        expanded.push(setOp(op.path, numberValue), setOp('appearance.headerCta.paddingBlock', numberValue));
        continue;
      }
    }

    expanded.push(op);
  }

  return expanded;
}
