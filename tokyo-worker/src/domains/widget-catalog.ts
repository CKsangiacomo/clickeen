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

export type WidgetConfigContractIssue = {
  path: string;
  message: string;
};

export type WidgetConfigContractResult =
  | { ok: true }
  | {
      ok: false;
      reasonKey:
        | "coreui.errors.instance.widgetMissing"
        | "coreui.errors.instance.config.invalid";
      issues: WidgetConfigContractIssue[];
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

function pushIssue(
  issues: WidgetConfigContractIssue[],
  path: string,
  message: string,
) {
  issues.push({ path, message });
}

function describeKind(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
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

function validateDefaultOwnedShape(args: {
  defaults: unknown;
  config: unknown;
  path: string;
  issues: WidgetConfigContractIssue[];
  requireObjectKeys: boolean;
}) {
  const { config, defaults, issues, path, requireObjectKeys } = args;
  if (Array.isArray(defaults)) {
    if (!Array.isArray(config)) {
      pushIssue(
        issues,
        path,
        `Expected array, received ${describeKind(config)}`,
      );
      return;
    }

    const itemDefaults = defaults[0];
    if (itemDefaults === undefined) return;

    config.forEach((item, index) => {
      validateDefaultOwnedShape({
        defaults: itemDefaults,
        config: item,
        path: `${path}.${index}`,
        issues,
        requireObjectKeys: false,
      });
    });
    return;
  }

  if (isRecord(defaults)) {
    if (!isRecord(config)) {
      pushIssue(
        issues,
        path,
        `Expected object, received ${describeKind(config)}`,
      );
      return;
    }

    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in config)) {
        if (requireObjectKeys) {
          pushIssue(
            issues,
            `${path}.${key}`,
            "Missing required saved config field",
          );
        }
        continue;
      }

      validateDefaultOwnedShape({
        defaults: value,
        config: config[key],
        path: `${path}.${key}`,
        issues,
        requireObjectKeys,
      });
    }
    return;
  }

  if (defaults === null) return;
  if (!requireObjectKeys && config == null) return;

  if (typeof config !== typeof defaults) {
    pushIssue(
      issues,
      path,
      `Expected ${typeof defaults}, received ${describeKind(config)}`,
    );
  }
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

export function validateWidgetConfigContract(args: {
  widgetType: unknown;
  config: unknown;
}): WidgetConfigContractResult {
  const widgetType =
    typeof args.widgetType === "string" ? args.widgetType.trim() : "";
  if (!widgetType) {
    return {
      ok: false,
      reasonKey: "coreui.errors.instance.widgetMissing",
      issues: [{ path: "widgetType", message: "widgetType is required" }],
    };
  }

  const entry = resolveManifestEntry(widgetType);
  if (!entry) {
    return {
      ok: false,
      reasonKey: "coreui.errors.instance.widgetMissing",
      issues: [
        {
          path: "widgetType",
          message: `Unsupported widgetType "${widgetType}"`,
        },
      ],
    };
  }

  if (!isRecord(args.config)) {
    return {
      ok: false,
      reasonKey: "coreui.errors.instance.config.invalid",
      issues: [{ path: "config", message: "config must be an object" }],
    };
  }

  if (!isRecord(entry.defaults)) {
    return {
      ok: false,
      reasonKey: "coreui.errors.instance.config.invalid",
      issues: [
        { path: "defaults", message: "widget defaults must be an object" },
      ],
    };
  }

  const issues: WidgetConfigContractIssue[] = [];
  validateDefaultOwnedShape({
    defaults: entry.defaults,
    config: args.config,
    path: "config",
    issues,
    requireObjectKeys: true,
  });

  if (issues.length > 0) {
    return {
      ok: false,
      reasonKey: "coreui.errors.instance.config.invalid",
      issues,
    };
  }

  return { ok: true };
}
