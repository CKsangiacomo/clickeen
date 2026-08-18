import type { CompiledWidget } from '../../lib/types';
import type { WidgetOp } from '../../lib/ops';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import { getAt } from '../../lib/utils/paths';
import { expandTypographyFamilyOps } from '../../lib/edit/typography-family-ops';

type PresetEntry = {
  sourcePath: string;
  customValue?: string;
  values: Record<string, Record<string, unknown>>;
  targetPaths: string[];
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function buildPresetEntries(compiled: CompiledWidget | null): PresetEntry[] {
  return Object.entries(compiled?.presets ?? {}).map(([sourcePath, spec]) => ({
    sourcePath,
    ...(spec.customValue ? { customValue: spec.customValue } : {}),
    values: spec.values,
    targetPaths: Array.from(
      new Set(Object.values(spec.values).flatMap((values) => Object.keys(values))),
    ),
  }));
}

function pathMatchesTarget(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}.`);
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value === 'boolean') return value;
  throw new Error(`[BobLinkedOps] "${path}" must be a boolean`);
}

function isLinkedTogglePath(path: string): boolean {
  return (
    new RegExp(`^((?:pod|(?:[a-zA-Z0-9_-]+\\.)?appearance\\.cardwrapper))\\.radiusLinked$`).test(path) ||
    /^(stage|pod|(?:[a-zA-Z0-9_-]+\.)?appearance\.cardwrapper)\.insideShadow\.linked$/.test(path) ||
    /^(pod|stage)\.padding\.(desktop|mobile)\.linked$/.test(path) ||
    path === 'layout.itemPaddingLinked' ||
    path === 'appearance.headerCta.paddingLinked'
  );
}

export function expandLinkedOps(args: {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  ops: WidgetOp[];
  fontLibrary: AccountFontLibrary | null;
}): WidgetOp[] {
  const setOp = (path: string, value: unknown): WidgetOp => ({ op: 'set', path, value });
  const presetEntries = buildPresetEntries(args.compiled);
  const typographyFamilyPaths = Array.from(
    new Set(
      (args.compiled?.controls ?? [])
        .map((control) => control.path)
        .filter((path) => /^typography\.roles\.[^.]+\.family$/.test(path)),
    ),
  );
  const expanded: WidgetOp[] = [];
  const presetByPath = new Map(presetEntries.map((entry) => [entry.sourcePath, entry]));
  const presetOps = new Map<string, WidgetOp>();

  for (const op of args.ops) {
    if (op.op === 'set' && typeof op.path === 'string' && presetByPath.has(op.path)) {
      presetOps.set(op.path, op);
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
            const familyValue = presetValue as string;
            if (!args.fontLibrary) throw new Error('[BobLinkedOps] missing account font library');
            typographyFamilyPaths.forEach((familyPath) => {
              expanded.push(setOp(familyPath, familyValue));
            });
            continue;
          }
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

  const typographyOps = expandTypographyFamilyOps({
    instanceData: args.instanceData,
    fontLibrary: args.fontLibrary,
    ops: expanded,
  });
  if (!typographyOps) {
    throw new Error('coreui.errors.typography.selection.invalid');
  }
  return typographyOps;
}
