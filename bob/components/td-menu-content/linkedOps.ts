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
  customValue: string;
  values: Record<string, Record<string, unknown>>;
  targetPaths: string[];
};

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function coerceFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  return null;
}

export function coercePxNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
  if (!match) return null;
  const numberValue = Number(match[1]);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function buildPresetEntries(raw: unknown): PresetEntry[] {
  if (!isPlainRecord(raw)) return [];
  const entries: PresetEntry[] = [];

  for (const [sourcePath, specRaw] of Object.entries(raw)) {
    if (!sourcePath || !isPlainRecord(specRaw)) continue;
    const valuesRaw = (specRaw as PresetSpec).values;
    if (!isPlainRecord(valuesRaw)) continue;

    const values: Record<string, Record<string, unknown>> = {};
    const targetSet = new Set<string>();
    for (const [presetKey, mappingRaw] of Object.entries(valuesRaw)) {
      if (!presetKey || !isPlainRecord(mappingRaw)) continue;
      values[presetKey] = mappingRaw;
      Object.keys(mappingRaw).forEach((path) => {
        if (path) targetSet.add(path);
      });
    }

    if (Object.keys(values).length === 0 || targetSet.size === 0) continue;
    const customValue =
      typeof (specRaw as PresetSpec).customValue === 'string' && (specRaw as PresetSpec).customValue?.trim()
        ? (specRaw as PresetSpec).customValue!.trim()
        : 'custom';

    entries.push({
      sourcePath,
      customValue,
      values,
      targetPaths: Array.from(targetSet),
    });
  }

  return entries;
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
      const insideShadowLinkMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
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
      if (presetValues) {
        for (const [presetPath, presetValue] of Object.entries(presetValues)) {
          if (presetPath === 'typography.globalFamily') {
            const familyValue = typeof presetValue === 'string' ? presetValue : '';
            if (familyValue) {
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
                  const nextWeight = pickAllowedValue(currentWeight, allowedWeights, '400');
                  if (nextWeight) expanded.push(setOp(weightPath, nextWeight));
                }

                if (allowedStyles.length > 0 && isAllowedPath(stylePath)) {
                  const currentStyle = getAt<unknown>(args.instanceData, stylePath);
                  const nextStyle = pickAllowedValue(currentStyle, allowedStyles, 'normal');
                  if (nextStyle) expanded.push(setOp(stylePath, nextStyle));
                }
              });
            }
          }
          if (isAllowedPath(presetPath)) {
            expanded.push(setOp(presetPath, presetValue));
          }
        }
      }
      continue;
    }

    if (typeof op.value === 'boolean') {
      const radiusLinkMatch = op.path.match(/^(pod|appearance\.cardwrapper)\.radiusLinked$/);
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
          expanded.push(op);
          continue;
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

      const insideShadowLinkMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.linked$/);
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
          return coerceFiniteNumber((value as Record<string, unknown>)[axisKey]);
        };

        const makeShadowFrom = (sourceShadow: Record<string, unknown>) => () => ({ ...sourceShadow });

        if (!nextLinked) {
          if (!isPlainRecord(allValue)) {
            expanded.push(op);
            continue;
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
          expanded.push(op);
          continue;
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
        const numberValue = coerceFiniteNumber(source);
        if (numberValue == null) {
          expanded.push(op);
          continue;
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
        const numberValue = coerceFiniteNumber(source);
        if (numberValue == null) {
          expanded.push(op);
          continue;
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

      if (op.path === 'appearance.ctaPaddingLinked') {
        const nextLinked = op.value;
        if (nextLinked === true) {
          const inlineValue = getAt<unknown>(args.instanceData, 'appearance.ctaPaddingInline');
          const numberValue = coerceFiniteNumber(inlineValue);
          if (numberValue == null) {
            expanded.push(op);
            continue;
          }
          expanded.push(setOp(op.path, true), setOp('appearance.ctaPaddingBlock', numberValue));
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
      const numberValue = coerceFiniteNumber(op.value);
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

    const insideShadowAllMatch = op.path.match(/^(stage|pod|appearance\.cardwrapper)\.insideShadow\.all$/);
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

    const radiusValueMatch = op.path.match(/^(pod|appearance\.cardwrapper)\.radius$/);
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

    if (op.path === 'layout.itemPadding') {
      const linkedValue = getAt<unknown>(args.instanceData, 'layout.itemPaddingLinked');
      const linked = linkedValue !== false;
      const numberValue = coerceFiniteNumber(op.value);
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

    if (op.path === 'appearance.ctaPaddingInline') {
      const linkedValue = getAt<unknown>(args.instanceData, 'appearance.ctaPaddingLinked');
      const linked = linkedValue === true;
      const numberValue = coerceFiniteNumber(op.value);
      if (linked && numberValue != null) {
        expanded.push(setOp(op.path, numberValue), setOp('appearance.ctaPaddingBlock', numberValue));
        continue;
      }
    }

    expanded.push(op);
  }

  return expanded;
}
