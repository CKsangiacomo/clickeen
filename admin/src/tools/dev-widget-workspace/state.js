export const DEFAULT_INSTANCE_DISPLAY_NAME = 'Untitled widget';
export const LOCAL_DEFAULT_INSTANCE_PREFIX = 'devstudio_local_';

export function normalizeWidgetname(raw) {
  if (!raw) return null;
  if (/^[a-z0-9_]+$/.test(raw)) return raw;
  const parts = String(raw)
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean);
  if (!parts.length) return null;
  return parts[parts.length - 1].toLowerCase();
}

export function formatWidgetLabel(widgetSlug) {
  const slug = normalizeWidgetname(widgetSlug);
  if (!slug) return 'Unknown';
  return slug
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildLocalDefaultPublicId(widgetSlug) {
  const normalized = normalizeWidgetname(widgetSlug);
  if (!normalized) throw new Error('[DevStudio] Invalid widget type for widget defaults.');
  return `${LOCAL_DEFAULT_INSTANCE_PREFIX}${normalized}`;
}

export function isLocalDefaultPublicId(publicId) {
  return typeof publicId === 'string' && publicId.startsWith(LOCAL_DEFAULT_INSTANCE_PREFIX);
}

export function buildLocalDefaultInstance(widgetSlug) {
  const normalized = normalizeWidgetname(widgetSlug);
  if (!normalized) return null;
  return {
    publicId: buildLocalDefaultPublicId(normalized),
    widgetname: normalized,
    widgetSlug: normalized,
    label: 'Main instance',
    status: 'draft',
    source: 'local',
    actions: null,
    config: null,
    localization: null,
    policy: null,
    meta: null,
  };
}

export function isMainInstancePublicId(publicId, widgetSlug) {
  const normalized = normalizeWidgetname(widgetSlug);
  if (!normalized || typeof publicId !== 'string') return false;
  return publicId.trim().toLowerCase() === `wgt_main_${normalized}`;
}

export function formatInstanceLabel(instance) {
  if (!instance || typeof instance !== 'object') return DEFAULT_INSTANCE_DISPLAY_NAME;
  if (isMainInstancePublicId(instance.publicId, instance.widgetSlug || instance.widgetname)) {
    return 'Main instance';
  }
  const raw = typeof instance.label === 'string' ? instance.label.trim() : '';
  return raw || DEFAULT_INSTANCE_DISPLAY_NAME;
}

export function findInstanceByPublicId(instances, publicId) {
  if (!publicId) return null;
  const existing = instances.find((inst) => inst.publicId === publicId);
  if (existing) return existing;
  if (isLocalDefaultPublicId(publicId)) {
    const widgetSlug = publicId.slice(LOCAL_DEFAULT_INSTANCE_PREFIX.length);
    return buildLocalDefaultInstance(widgetSlug);
  }
  return null;
}

export function listWidgetSlugs(widgetTypes, instances) {
  if (widgetTypes.length) return widgetTypes.slice();
  return Array.from(
    new Set(
      instances
        .map((inst) => inst.widgetSlug)
        .filter((slug) => typeof slug === 'string' && slug),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function getScopedInstances({ instances, selectedWidgetSlug, profile }) {
  if (!selectedWidgetSlug) return instances;
  const scoped = instances.filter((inst) => inst.widgetSlug === selectedWidgetSlug);
  if (scoped.length) return scoped;
  if (profile === 'source') {
    const localDefault = buildLocalDefaultInstance(selectedWidgetSlug);
    return localDefault ? [localDefault] : [];
  }
  return [];
}
