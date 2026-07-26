import {
  ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
  resolveAccountTypographyFamilySelection,
  validateAccountTypographyFontSelections,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
import type { WidgetOp } from '../ops';
import { getAt, setAt } from '../utils/paths';

const FAMILY_PATH = /^(typography\.roles\.[^.]+)\.family$/;
const TYPOGRAPHY_SELECTION_PATH =
  /^typography\.roles\.[^.]+\.(family|weight|fontStyle)$/;

export function typographySelectionRoleBase(path: string): string | null {
  return path.match(TYPOGRAPHY_SELECTION_PATH)?.[0]?.replace(
    /\.(family|weight|fontStyle)$/,
    '',
  ) ?? null;
}

export const TYPOGRAPHY_SELECTION_INVALID_COPY =
  'That font choice is not available. Choose another font, weight, or style.';

export class TypographyFamilySelectionError extends Error {
  readonly reasonKey = ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY;

  constructor() {
    super(ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY);
    this.name = 'TypographyFamilySelectionError';
  }
}

export function isTypographyFamilySelectionError(
  error: unknown,
): error is TypographyFamilySelectionError {
  return (
    error instanceof TypographyFamilySelectionError ||
    (Boolean(error) &&
      typeof error === 'object' &&
      (error as { reasonKey?: unknown }).reasonKey ===
        ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY)
  );
}

export function expandTypographyFamilyOps(args: {
  instanceData: Record<string, unknown>;
  fontLibrary: AccountFontLibrary | null;
  ops: WidgetOp[];
}): WidgetOp[] {
  const familyOps = new Map<string, Extract<WidgetOp, { op: 'set' }>>();
  for (const op of args.ops) {
    if (op.op !== 'set') continue;
    const match = op.path.match(FAMILY_PATH);
    if (!match) continue;
    if (familyOps.has(match[1]!)) throw new TypographyFamilySelectionError();
    familyOps.set(match[1]!, op);
  }
  const hasTypographySelectionOp = args.ops.some(
    (op) => op.op === 'set' && TYPOGRAPHY_SELECTION_PATH.test(op.path),
  );
  if (!hasTypographySelectionOp) return args.ops;
  if (!args.fontLibrary) throw new TypographyFamilySelectionError();

  const companions = new Map<string, { weight?: unknown; fontStyle?: unknown }>();
  for (const op of args.ops) {
    if (op.op !== 'set') continue;
    for (const roleBase of familyOps.keys()) {
      if (op.path === `${roleBase}.weight`) {
        companions.set(roleBase, { ...companions.get(roleBase), weight: op.value });
      }
      if (op.path === `${roleBase}.fontStyle`) {
        companions.set(roleBase, { ...companions.get(roleBase), fontStyle: op.value });
      }
    }
  }

  const expanded: WidgetOp[] = [];
  for (const op of args.ops) {
    const familyMatch = op.op === 'set' ? op.path.match(FAMILY_PATH) : null;
    if (op.op === 'set' && familyMatch) {
      const roleBase = familyMatch[1]!;
      const requested = companions.get(roleBase);
      const resolved = resolveAccountTypographyFamilySelection({
        fontLibrary: args.fontLibrary,
        requestedFamily: op.value,
        currentWeight: getAt(args.instanceData, `${roleBase}.weight`),
        currentFontStyle: getAt(args.instanceData, `${roleBase}.fontStyle`),
        ...(requested && Object.prototype.hasOwnProperty.call(requested, 'weight')
          ? { requestedWeight: requested.weight }
          : {}),
        ...(requested && Object.prototype.hasOwnProperty.call(requested, 'fontStyle')
          ? { requestedFontStyle: requested.fontStyle }
          : {}),
      });
      if (!resolved.ok) throw new TypographyFamilySelectionError();
      expanded.push(
        { op: 'set', path: `${roleBase}.family`, value: resolved.value.family },
        { op: 'set', path: `${roleBase}.weight`, value: resolved.value.weight },
        { op: 'set', path: `${roleBase}.fontStyle`, value: resolved.value.fontStyle },
      );
      continue;
    }
    if (
      op.op === 'set' &&
      Array.from(familyOps.keys()).some(
        (roleBase) =>
          op.path === `${roleBase}.weight` || op.path === `${roleBase}.fontStyle`,
      )
    ) {
      continue;
    }
    expanded.push(op);
  }
  let candidate = args.instanceData;
  for (const op of expanded) {
    if (op.op === 'set' && TYPOGRAPHY_SELECTION_PATH.test(op.path)) {
      candidate = setAt(candidate, op.path, op.value) as Record<string, unknown>;
    }
  }
  if (
    validateAccountTypographyFontSelections({
      fontLibrary: args.fontLibrary,
      typography: candidate.typography,
    }).length
  ) {
    throw new TypographyFamilySelectionError();
  }
  return expanded;
}
