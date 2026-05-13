import { isRecord } from "@clickeen/ck-contracts";
import widgetsManifest from "../../../tokyo/product/widgets/manifest.json";

export type WidgetCatalogEntry = {
  widgetType: string;
  label: string;
  description: string;
  category: string;
  capabilities: {
    seoGeo: boolean;
  };
};

type WidgetCatalogManifestEntry = WidgetCatalogEntry & {
  itemKey?: string | null;
  defaults?: unknown;
};

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return typeof structuredClone === "function"
    ? (structuredClone(value) as Record<string, unknown>)
    : (JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function isCatalogEntry(value: unknown): value is WidgetCatalogManifestEntry {
  if (!isRecord(value)) return false;
  const capabilities = value.capabilities;
  return (
    typeof value.widgetType === "string" &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    isRecord(capabilities) &&
    typeof capabilities.seoGeo === "boolean"
  );
}

const CATALOG_MANIFEST_ENTRIES: WidgetCatalogManifestEntry[] = Array.isArray(
  (widgetsManifest as { widgets?: unknown }).widgets,
)
  ? ((widgetsManifest as { widgets: unknown[] }).widgets.filter(
      isCatalogEntry,
    ) as WidgetCatalogManifestEntry[])
  : [];

function publicEntry(entry: WidgetCatalogManifestEntry): WidgetCatalogEntry {
  return {
    widgetType: entry.widgetType,
    label: entry.label,
    description: entry.description,
    category: entry.category,
    capabilities: {
      seoGeo: entry.capabilities.seoGeo,
    },
  };
}

function resolveManifestEntry(
  widgetType: string,
): WidgetCatalogManifestEntry | null {
  const normalized = String(widgetType || "").trim();
  return (
    CATALOG_MANIFEST_ENTRIES.find(
      (candidate) => candidate.widgetType === normalized,
    ) || null
  );
}

export function listWidgetCatalogEntries(): WidgetCatalogEntry[] {
  return CATALOG_MANIFEST_ENTRIES.map(publicEntry);
}

export function resolveWidgetCatalogEntry(
  widgetType: string,
): WidgetCatalogEntry | null {
  const entry = resolveManifestEntry(widgetType);
  return entry ? publicEntry(entry) : null;
}

export function resolveWidgetDefaults(
  widgetType: string,
): Record<string, unknown> | null {
  const entry = resolveManifestEntry(widgetType);
  return entry && isRecord(entry.defaults) ? cloneRecord(entry.defaults) : null;
}
