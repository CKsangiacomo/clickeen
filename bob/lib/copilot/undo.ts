import type { CompiledControl } from '../types';
import type { WidgetOp } from '../ops';
import { buildControlMatchers, findBestControlForPath } from '../edit/controls';
import { getAt } from '../utils/paths';

function itemIdFromValue(value: unknown, itemIdPath: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const itemId = (value as Record<string, unknown>)[itemIdPath];
  return typeof itemId === 'string' && itemId.trim() ? itemId : null;
}

function indexForItemId(items: unknown[], itemIdPath: string, itemId: string): number {
  return items.findIndex((item) => itemIdFromValue(item, itemIdPath) === itemId);
}

export function buildCopilotUndoOps(args: {
  before: Record<string, unknown>;
  ops: WidgetOp[];
  controls: CompiledControl[];
}): WidgetOp[] | null {
  const inverse: WidgetOp[] = [];
  const matchers = buildControlMatchers(args.controls);
  for (const op of args.ops) {
    const control = findBestControlForPath(matchers, op.path);
    if (!control) return null;
    if (op.op === 'set') {
      const previousValue = getAt(args.before, op.path);
      if (previousValue === undefined) return null;
      inverse.push({ op: 'set', path: op.path, value: previousValue });
      continue;
    }
    if (op.op === 'insert') {
      if (control.itemIdPath) {
        const insertedId = itemIdFromValue(op.value, control.itemIdPath);
        if (!insertedId) return null;
        inverse.push({ op: 'remove', path: op.path, itemId: insertedId });
      } else {
        inverse.push({ op: 'remove', path: op.path, index: op.index });
      }
      continue;
    }
    if (op.op === 'remove') {
      const current = getAt<unknown>(args.before, op.path);
      if (!Array.isArray(current)) return null;
      const index =
        'itemId' in op
          ? control.itemIdPath
            ? indexForItemId(current, control.itemIdPath, op.itemId)
            : -1
          : op.index;
      if (index < 0 || index >= current.length) return null;
      inverse.push({ op: 'insert', path: op.path, index, value: current[index] });
      continue;
    }
    if (op.op === 'move') {
      inverse.push({ op: 'move', path: op.path, from: op.to, to: op.from });
      continue;
    }
    return null;
  }
  return inverse.reverse();
}
