import type { CompiledControl, CompiledWidget } from '../types';
const TOKEN_SEGMENT = /^__[^.]+__$/;
function isPlainRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function invalid(path: string): never { throw new Error(`coreui.errors.instance.config.invalid:${path}`); }
function pathMatchesPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split('.').filter(Boolean);
  const pathParts = path.split('.').filter(Boolean);
  const visit = (patternIndex: number, pathIndex: number): boolean => {
    if (patternIndex === patternParts.length && pathIndex === pathParts.length) return true;
    if (patternIndex >= patternParts.length || pathIndex >= pathParts.length) return false;
    const patternPart = patternParts[patternIndex];
    if (TOKEN_SEGMENT.test(patternPart)) return visit(patternIndex + 1, pathIndex + 1);
    if (patternPart.endsWith('[]')) {
      const key = patternPart.slice(0, -2);
      return pathParts[pathIndex] === key && /^\d+$/.test(pathParts[pathIndex + 1] ?? '') && visit(patternIndex + 1, pathIndex + 2);
    }
    return patternPart === pathParts[pathIndex] && visit(patternIndex + 1, pathIndex + 1);
  };
  return visit(0, 0);
}
function assertShape(
  value: unknown,
  expected: unknown,
  path: string,
  fillPaths: readonly string[],
  optionalUploadMetaPaths: readonly string[],
): void {
  if (path && fillPaths.some((fillPath) => pathMatchesPattern(fillPath, path))) {
    if (typeof value === 'undefined') invalid(path);
    return;
  }
  if (path && optionalUploadMetaPaths.some((jsonPath) => pathMatchesPattern(jsonPath, path))) {
    if (typeof value === 'undefined') invalid(path);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(value)) invalid(path);
    if (expected.length) value.forEach((entry, index) => assertShape(entry, expected[0], `${path}.${index}`, fillPaths, optionalUploadMetaPaths));
    return;
  } else if (isPlainRecord(expected)) {
    if (!isPlainRecord(value)) invalid(path);
    for (const [key, child] of Object.entries(expected)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(path ? `${path}.${key}` : key);
      assertShape(value[key], child, path ? `${path}.${key}` : key, fillPaths, optionalUploadMetaPaths);
    }
    Object.keys(value).forEach((key) => {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.prototype.hasOwnProperty.call(expected, key) && !optionalUploadMetaPaths.some((jsonPath) => pathMatchesPattern(jsonPath, childPath))) invalid(childPath);
    });
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
    if (!Object.prototype.hasOwnProperty.call(value, key)) return;
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
  if ((control.kind === 'string' || control.kind === 'color') && typeof value !== 'string') invalid(path);
  if (control.kind === 'enum' && (typeof value !== 'string' || !control.enumValues?.includes(value))) invalid(path);
  if (control.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || (typeof control.min === 'number' && value < control.min) || (typeof control.max === 'number' && value > control.max))) invalid(path);
  if ((control.kind === 'object' && !isPlainRecord(value)) || (control.kind === 'array' && !Array.isArray(value)) || (control.kind === 'json' && (value == null || typeof value === 'string'))) invalid(path);
  if (control.kind === 'json' && control.type === 'dropdown-upload-meta') assertUploadAssetMetadata(value, path);
  if (control.kind === 'array' && control.itemIdPath) (value as unknown[]).forEach((item, index) => { if (!isPlainRecord(item)) invalid(`${path}.${index}`); const id = item[control.itemIdPath!]; if (typeof id !== 'string' || !id) invalid(`${path}.${index}.${control.itemIdPath}`); });
  if (control.type === 'dropdown-fill') assertFillValue(control, value, path);
}

function assertUploadAssetMetadata(value: unknown, path: string): void {
  if (!isPlainRecord(value)) invalid(path);
  const allowed = new Set(['assetRef', 'name', 'source']);
  Object.keys(value).forEach((key) => { if (!allowed.has(key)) invalid(`${path}.${key}`); });
  const assetRef = value.assetRef;
  if (typeof assetRef !== 'string' || !assetRef || assetRef !== assetRef.trim()) invalid(`${path}.assetRef`);
  if (value.name != null && typeof value.name !== 'string') invalid(`${path}.name`);
  if (value.source != null && typeof value.source !== 'string') invalid(`${path}.source`);
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
  const mediaRecord = isPlainRecord(media) ? media : null;
  const positions = new Set(['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']);
  const hasAssetRef = typeof mediaRecord?.assetRef === 'string' && mediaRecord.assetRef && mediaRecord.assetRef === mediaRecord.assetRef.trim();
  const hasSrc = typeof mediaRecord?.src === 'string' && mediaRecord.src && mediaRecord.src === mediaRecord.src.trim();
  if (!mediaRecord || Object.keys(value).some((key) => key !== 'type' && key !== value.type) || (!hasAssetRef && !hasSrc) || (mediaRecord.name != null && typeof mediaRecord.name !== 'string') || (mediaRecord.fit !== 'cover' && mediaRecord.fit !== 'contain') || typeof mediaRecord.position !== 'string' || !positions.has(mediaRecord.position)) invalid(path);
  if (value.type === 'image' && (Object.keys(mediaRecord).some((key) => key !== 'assetRef' && key !== 'src' && key !== 'name' && key !== 'fit' && key !== 'position' && key !== 'repeat') || (mediaRecord.repeat !== 'no-repeat' && mediaRecord.repeat !== 'repeat' && mediaRecord.repeat !== 'repeat-x' && mediaRecord.repeat !== 'repeat-y'))) invalid(path);
  if (value.type === 'video' && (Object.keys(mediaRecord).some((key) => key !== 'assetRef' && key !== 'src' && key !== 'name' && key !== 'posterAssetRef' && key !== 'poster' && key !== 'fit' && key !== 'position' && key !== 'loop' && key !== 'muted' && key !== 'autoplay') || (mediaRecord.posterAssetRef != null && (typeof mediaRecord.posterAssetRef !== 'string' || !mediaRecord.posterAssetRef || mediaRecord.posterAssetRef !== mediaRecord.posterAssetRef.trim())) || (mediaRecord.poster != null && (typeof mediaRecord.poster !== 'string' || !mediaRecord.poster || mediaRecord.poster !== mediaRecord.poster.trim())) || typeof mediaRecord.loop !== 'boolean' || typeof mediaRecord.muted !== 'boolean' || typeof mediaRecord.autoplay !== 'boolean')) invalid(path);
}

export function assertSessionConfigContract(config: Record<string, unknown>, compiled: Pick<CompiledWidget, 'controls' | 'defaults' | 'normalization'>): void {
  const fillPaths = compiled.controls
    .filter((control) => control.type === 'dropdown-fill' && typeof control.path === 'string' && control.path)
    .map((control) => control.path);
  const optionalUploadMetaPaths = compiled.controls
    .filter((control) => control.kind === 'json' && control.type === 'dropdown-upload-meta')
    .map((control) => control.path);
  assertShape(config, compiled.defaults, '', fillPaths, optionalUploadMetaPaths);
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
