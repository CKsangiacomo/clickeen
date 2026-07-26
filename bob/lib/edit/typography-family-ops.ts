import {
  resolveAccountTypographyFamilySelection,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import type { WidgetOp } from '../ops';
import { getAt } from '../utils/paths';

const FAMILY_PATH = /^(typography\.roles\.[^.]+)\.family$/;

export function expandTypographyFamilyOps(args: {
  instanceData: Record<string, unknown>;
  fontLibrary: AccountFontLibrary | null;
  ops: WidgetOp[];
}): WidgetOp[] | null {
  if (!args.fontLibrary) return args.ops;
  const familyOps = args.ops.filter(
    (op): op is Extract<WidgetOp, { op: 'set' }> =>
      op.op === 'set' && FAMILY_PATH.test(op.path),
  );
  const familyBases = new Set(
    familyOps.map((op) => op.path.match(FAMILY_PATH)![1]!),
  );
  if (!familyBases.size) return args.ops;
  if (familyBases.size !== familyOps.length) return null;

  const expanded: WidgetOp[] = [];
  for (const op of args.ops) {
    const familyMatch = op.op === 'set' ? op.path.match(FAMILY_PATH) : null;
    if (op.op === 'set' && familyMatch) {
      const roleBase = familyMatch[1]!;
      const requestedWeight = args.ops.find(
        (candidate): candidate is Extract<WidgetOp, { op: 'set' }> =>
          candidate.op === 'set' && candidate.path === `${roleBase}.weight`,
      );
      const requestedFontStyle = args.ops.find(
        (candidate): candidate is Extract<WidgetOp, { op: 'set' }> =>
          candidate.op === 'set' && candidate.path === `${roleBase}.fontStyle`,
      );
      if (
        args.ops.filter(
          (candidate) =>
            candidate.op === 'set' && candidate.path === `${roleBase}.weight`,
        ).length > 1 ||
        args.ops.filter(
          (candidate) =>
            candidate.op === 'set' && candidate.path === `${roleBase}.fontStyle`,
        ).length > 1
      ) {
        return null;
      }
      const resolved = resolveAccountTypographyFamilySelection({
        fontLibrary: args.fontLibrary,
        requestedFamily: op.value,
        currentWeight: getAt(args.instanceData, `${roleBase}.weight`),
        currentFontStyle: getAt(args.instanceData, `${roleBase}.fontStyle`),
        ...(requestedWeight ? { requestedWeight: requestedWeight.value } : {}),
        ...(requestedFontStyle
          ? { requestedFontStyle: requestedFontStyle.value }
          : {}),
      });
      if (!resolved) return null;
      expanded.push(
        { op: 'set', path: `${roleBase}.family`, value: resolved.family },
        { op: 'set', path: `${roleBase}.weight`, value: resolved.weight },
        { op: 'set', path: `${roleBase}.fontStyle`, value: resolved.fontStyle },
      );
      continue;
    }
    if (
      op.op === 'set' &&
      Array.from(familyBases).some(
        (roleBase) =>
          op.path === `${roleBase}.weight` || op.path === `${roleBase}.fontStyle`,
      )
    ) {
      continue;
    }
    expanded.push(op);
  }
  return expanded;
}
