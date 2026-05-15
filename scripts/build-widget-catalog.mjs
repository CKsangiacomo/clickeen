import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const widgetsRoot = path.join(repoRoot, "tokyo/product/widgets");
const manifestPath = path.join(widgetsRoot, "manifest.json");
const overlayCodebooksPath = path.join(
  repoRoot,
  "packages/ck-contracts/src/overlay-codebooks.ts",
);
const registryPath = path.join(
  repoRoot,
  "tokyo-worker/src/generated/widget-seo-geo-registry.ts",
);
const checkMode = process.argv.includes("--check");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  console.error(`[build-widget-catalog] ${message}`);
  process.exit(1);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    fail(`${label} must be a boolean`);
  }
  return value;
}

function optionalNumber(value, label) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite number when present`);
  }
  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function variableNameFor(widgetType) {
  return `${widgetType.replace(/[^a-zA-Z0-9]+(.)/g, (_match, char) => char.toUpperCase())}SeoGeoMetaPack`;
}

function objectKeyFor(widgetType) {
  return /^[A-Za-z_$][\w$]*$/.test(widgetType)
    ? widgetType
    : JSON.stringify(widgetType);
}

function readWidgetOverlayCodes() {
  const source = fs.readFileSync(overlayCodebooksPath, "utf8");
  const match = source.match(
    /WIDGET_OVERLAY_CODES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\s*as const\);/,
  );
  if (!match) {
    fail("WIDGET_OVERLAY_CODES must be declared in @clickeen/ck-contracts");
  }
  const body = match[1] || "";
  const codes = new Map();
  const entryRe = /^\s*([a-zA-Z0-9_]+):\s*'([0-9A-Z]{3})',?\s*$/gm;
  let entry;
  while ((entry = entryRe.exec(body))) {
    const widgetType = entry[1];
    const code = entry[2];
    if (codes.has(widgetType)) {
      fail(`duplicate widget codebook entry for ${widgetType}`);
    }
    if ([...codes.values()].includes(code)) {
      fail(`duplicate widget overlay code ${code}`);
    }
    codes.set(widgetType, code);
  }
  if (codes.size === 0) {
    fail("WIDGET_OVERLAY_CODES must not be empty");
  }
  return codes;
}

const widgetNames = fs
  .readdirSync(widgetsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== "shared")
  .filter((name) => fs.existsSync(path.join(widgetsRoot, name, "spec.json")))
  .sort((a, b) => a.localeCompare(b));

const widgets = [];
const widgetOverlayCodes = readWidgetOverlayCodes();

for (const widgetName of widgetNames) {
  const widgetDir = path.join(widgetsRoot, widgetName);
  const specPath = path.join(widgetDir, "spec.json");
  const catalogPath = path.join(widgetDir, "catalog.json");
  const seoGeoPath = path.join(widgetDir, "seo-geo.ts");

  if (!fs.existsSync(catalogPath)) {
    fail(`${widgetName} is missing catalog.json`);
  }

  const spec = readJson(specPath);
  const catalog = readJson(catalogPath);
  const widgetType = assertString(
    spec.widgetname,
    `${widgetName}/spec.json widgetname`,
  );
  if (widgetType !== widgetName) {
    fail(`${widgetName}/spec.json widgetname must match its folder name`);
  }
  const widgetCode = widgetOverlayCodes.get(widgetType);
  if (!widgetCode) {
    fail(`${widgetType} is missing a WIDGET_OVERLAY_CODES entry`);
  }

  if (!isRecord(spec.defaults)) {
    fail(`${widgetName}/spec.json defaults must be an object`);
  }
  if (!isRecord(spec.overlays) || spec.overlays.v !== 1 || !Array.isArray(spec.overlays.text)) {
    fail(`${widgetName}/spec.json overlays.v=1 with text[] is required`);
  }

  if (!isRecord(catalog.capabilities)) {
    fail(`${widgetName}/catalog.json capabilities must be an object`);
  }

  const seoGeo = assertBoolean(
    catalog.capabilities.seoGeo,
    `${widgetName}/catalog.json capabilities.seoGeo`,
  );
  const hasSeoGeoModule = fs.existsSync(seoGeoPath);

  if (seoGeo && !hasSeoGeoModule) {
    fail(`${widgetName} declares seoGeo but is missing seo-geo.ts`);
  }
  if (!seoGeo && hasSeoGeoModule) {
    fail(
      `${widgetName} has seo-geo.ts but catalog.json capabilities.seoGeo is false`,
    );
  }

  widgets.push({
    widgetType,
    widgetCode,
    order: optionalNumber(catalog.order, `${widgetName}/catalog.json order`),
    label: assertString(catalog.label, `${widgetName}/catalog.json label`),
    description: assertString(
      catalog.description,
      `${widgetName}/catalog.json description`,
    ),
    category: assertString(
      catalog.category,
      `${widgetName}/catalog.json category`,
    ),
    capabilities: {
      seoGeo,
    },
    itemKey:
      typeof spec.itemKey === "string" && spec.itemKey.trim()
        ? spec.itemKey.trim()
        : null,
    overlays: spec.overlays,
    defaults: spec.defaults,
  });
}

for (const widgetType of widgetOverlayCodes.keys()) {
  if (!widgetNames.includes(widgetType)) {
    fail(`WIDGET_OVERLAY_CODES contains unsupported widget ${widgetType}`);
  }
}

widgets.sort((a, b) => {
  const orderA = a.order ?? Number.POSITIVE_INFINITY;
  const orderB = b.order ?? Number.POSITIVE_INFINITY;
  return orderA - orderB || a.widgetType.localeCompare(b.widgetType);
});

const seoGeoWidgets = widgets
  .filter((widget) => widget.capabilities.seoGeo)
  .map((widget) => widget.widgetType);

const manifest = {
  v: 1,
  widgets,
};
const manifestText = stableStringify(manifest);

if (!checkMode) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

const imports = seoGeoWidgets
  .map((widgetType) => {
    const alias = variableNameFor(widgetType);
    return `import { generateSeoGeoMetaPack as ${alias} } from "../../../tokyo/product/widgets/${widgetType}/seo-geo";`;
  })
  .join("\n");

const records = seoGeoWidgets
  .map(
    (widgetType) =>
      `  ${objectKeyFor(widgetType)}: ${variableNameFor(widgetType)},`,
  )
  .join("\n");

const registry = `// Generated by scripts/build-widget-catalog.mjs. Do not edit manually.
import type { SeoGeoMetaPackGenerator } from "../../../tokyo/product/widgets/shared/seo-geo";
${imports ? `\n${imports}\n` : ""}
export const SEO_GEO_META_PACK_GENERATORS: Record<
  string,
  SeoGeoMetaPackGenerator
> = {
${records}
};
`;

if (checkMode) {
  const manifestCurrent = fs.existsSync(manifestPath)
    ? fs.readFileSync(manifestPath, "utf8")
    : "";
  const registryCurrent = fs.existsSync(registryPath)
    ? fs.readFileSync(registryPath, "utf8")
    : "";
  if (manifestCurrent !== manifestText || registryCurrent !== registry) {
    fail(
      "generated widget catalog is stale; run `pnpm build:widgets` and commit the generated files",
    );
  }
  console.log("[build-widget-catalog] OK: generated widget catalog is current");
} else {
  fs.writeFileSync(manifestPath, manifestText);
  fs.writeFileSync(registryPath, registry);

  console.log(
    `[build-widget-catalog] Wrote ${path.relative(repoRoot, manifestPath)} and ${path.relative(
      repoRoot,
      registryPath,
    )}`,
  );
}
