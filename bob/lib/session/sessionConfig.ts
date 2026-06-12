import type { CompiledControl, CompiledWidget } from '../types';
const TOKEN_SEGMENT = /^__[^.]+__$/;
function isPlainRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function invalid(path: string): never { throw new Error(`coreui.errors.instance.config.invalid:${path}`); }
function assertShape(value: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(value)) invalid(path);
    if (expected.length) value.forEach((entry, index) => assertShape(entry, expected[0], `${path}.${index}`));
    return;
  } else if (isPlainRecord(expected)) {
    if (!isPlainRecord(value)) invalid(path);
    for (const [key, child] of Object.entries(expected)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(path ? `${path}.${key}` : key);
      assertShape(value[key], child, path ? `${path}.${key}` : key);
    }
    Object.keys(value).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(expected, key)) invalid(path ? `${path}.${key}` : key); });
    return;
  }
  if (expected === null ? value !== null : typeof value !== typeof expected) invalid(path);
}
function collectValues(root: Record<string, unknown>, path: string): Array<{ path: string; value: unknown }> {
  const segments = path.split('.');
  if (!path || segments.some((segment) => !segment)) invalid(path);
  const out: Array<{ path: string; value: unknown }> = [];
  const visit = (value: unknown, index: number, concretePath: string): void => {
    if (index >= segments.length) return void out.push({ path: concretePath || path, value });
    const segment = segments[index];
    const arraySuffix = segment.endsWith('[]');
    const key = arraySuffix ? segment.slice(0, -2) : segment;
    if (!key) invalid(path);
    if (TOKEN_SEGMENT.test(segment)) { if (!Array.isArray(value)) invalid(concretePath || segment); return void value.forEach((entry, itemIndex) => visit(entry, index + 1, concretePath ? `${concretePath}.${itemIndex}` : String(itemIndex))); }
    if (!isPlainRecord(value)) invalid(concretePath ? `${concretePath}.${key}` : key);
    const nextPath = concretePath ? `${concretePath}.${key}` : key;
    const next = value[key];
    if (arraySuffix) { if (!Array.isArray(next)) invalid(nextPath); return void next.forEach((entry, itemIndex) => visit(entry, index + 1, `${nextPath}.${itemIndex}`)); }
    visit(next, index + 1, nextPath);
  };
  visit(root, 0, '');
  return out;
}
function assertControl(control: CompiledControl, value: unknown, path: string): void {
  if (!control.kind || control.kind === 'unknown') invalid(path);
  if ((control.required === true && (value == null || value === '' || (typeof value === 'string' && value.trim() === ''))) || (control.kind === 'boolean' && typeof value !== 'boolean')) invalid(path);
  if ((control.kind === 'string' || control.kind === 'color') && (typeof value !== 'string' || !value)) invalid(path);
  if (control.kind === 'enum' && (typeof value !== 'string' || !control.enumValues?.includes(value))) invalid(path);
  if (control.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || (typeof control.min === 'number' && value < control.min) || (typeof control.max === 'number' && value > control.max))) invalid(path);
  if ((control.kind === 'object' && !isPlainRecord(value)) || (control.kind === 'array' && !Array.isArray(value)) || (control.kind === 'json' && (value == null || typeof value === 'string'))) invalid(path);
  if (control.kind === 'array' && control.itemIdPath) (value as unknown[]).forEach((item, index) => { if (!isPlainRecord(item)) invalid(`${path}.${index}`); const id = item[control.itemIdPath!]; if (typeof id !== 'string' || !id) invalid(`${path}.${index}.${control.itemIdPath}`); });
  if (control.type === 'dropdown-fill') assertFillValue(control, value, path);
}

function assertFillValue(control: CompiledControl, value: unknown, path: string): void {
  if (!isPlainRecord(value) || typeof value.type !== 'string') invalid(path);
  if (value.type !== 'none' && value.type !== 'color' && value.type !== 'gradient' && value.type !== 'image' && value.type !== 'video') invalid(path);
  if (value.type !== 'none' && control.enumValues?.length && !control.enumValues.includes(value.type)) invalid(path);
  if (value.type === 'none') { if (Object.keys(value).length !== 1) invalid(path); return; }
  if (value.type === 'color') { if (Object.keys(value).some((key) => key !== 'type' && key !== 'color') || typeof value.color !== 'string' || !value.color) invalid(path); return; }
  if (value.type === 'gradient') {
    const gradient = value.gradient;
    if (Object.keys(value).some((key) => key !== 'type' && key !== 'gradient') || !isPlainRecord(gradient)) invalid(path);
    if (typeof gradient.css === 'string' && gradient.css && Object.keys(gradient).length === 1) return;
    if ((gradient.kind !== 'linear' && gradient.kind !== 'radial' && gradient.kind !== 'conic') || typeof gradient.angle !== 'number' || !Number.isFinite(gradient.angle) || !Array.isArray(gradient.stops) || gradient.stops.length < 2) invalid(path);
    gradient.stops.forEach((stop) => { if (!isPlainRecord(stop) || Object.keys(stop).some((key) => key !== 'color' && key !== 'position') || typeof stop.color !== 'string' || !stop.color || typeof stop.position !== 'number' || !Number.isFinite(stop.position)) invalid(path); });
    return;
  }
  const media = value.type === 'image' ? value.image : value.type === 'video' ? value.video : null;
  const positions = new Set(['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']);
  if (!isPlainRecord(media) || Object.keys(value).some((key) => key !== 'type' && key !== value.type) || typeof media.assetRef !== 'string' || !media.assetRef.trim() || (media.name != null && typeof media.name !== 'string') || (media.fit !== 'cover' && media.fit !== 'contain') || typeof media.position !== 'string' || !positions.has(media.position)) invalid(path);
  if (value.type === 'image' && (Object.keys(media).some((key) => key !== 'assetRef' && key !== 'name' && key !== 'fit' && key !== 'position' && key !== 'repeat') || (media.repeat !== 'no-repeat' && media.repeat !== 'repeat' && media.repeat !== 'repeat-x' && media.repeat !== 'repeat-y'))) invalid(path);
  if (value.type === 'video' && (Object.keys(media).some((key) => key !== 'assetRef' && key !== 'name' && key !== 'posterAssetRef' && key !== 'fit' && key !== 'position' && key !== 'loop' && key !== 'muted' && key !== 'autoplay') || (media.posterAssetRef != null && typeof media.posterAssetRef !== 'string') || typeof media.loop !== 'boolean' || typeof media.muted !== 'boolean' || typeof media.autoplay !== 'boolean')) invalid(path);
}

export function assertSessionConfigContract(config: Record<string, unknown>, compiled: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'>): void {
  assertShape(config, compiled.defaults, '');
  compiled.controls.forEach((control) => collectValues(config, control.path).forEach((entry) => assertControl(control, entry.value, entry.path)));
  compiled.normalization?.idRules?.forEach((rule) => collectValues(config, rule.arrayPath).forEach((entry) => {
    if (!Array.isArray(entry.value)) invalid(entry.path);
    const seen = new Set<string>();
    entry.value.forEach((item, index) => {
      if (!isPlainRecord(item)) invalid(`${entry.path}.${index}`);
      const id = item[rule.idKey];
      if (typeof id !== 'string' || !id || seen.has(id)) invalid(`${entry.path}.${index}.${rule.idKey}`);
      seen.add(id);
    });
  }));
}
