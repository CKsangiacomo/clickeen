#!/usr/bin/env node
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const widgetsRoot = path.join(repoRoot, "tokyo/product/widgets");
const overlayCodebooksPath = path.join(
  repoRoot,
  "packages/ck-contracts/src/overlay-codebooks.ts",
);
const entitlementsMatrixPath = path.join(
  repoRoot,
  "packages/ck-policy/entitlements.matrix.json",
);
const forbiddenGeneratedPaths = [
  path.join(widgetsRoot, "manifest.json"),
  path.join(repoRoot, "tokyo-worker/src/generated/widget-seo-geo-registry.ts"),
];
const forbiddenDeletedWidgetSourcePaths = [
  path.join(widgetsRoot, "shared/seo-geo.ts"),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  console.error(`[validate-widget-source] ${message}`);
  process.exit(1);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalNumber(value, label) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite number when present`);
  }
  return value;
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`));
}

function readWidgetEditableFieldsContract(editableFields, widgetName) {
  if (!isRecord(editableFields) || editableFields.v !== 1 || !Array.isArray(editableFields.fields)) {
    fail(`${widgetName}/editable-fields.json v=1 with fields[] is required`);
  }
  const widgetType = assertString(editableFields.widgetType, `${widgetName}/editable-fields.json widgetType`);
  if (widgetType !== widgetName) {
    fail(`${widgetName}/editable-fields.json widgetType must match its folder name`);
  }

  const seen = new Set();
  for (const [index, field] of editableFields.fields.entries()) {
    if (!isRecord(field)) {
      fail(`${widgetName}/editable-fields.json fields[${index}] must be an object`);
    }
    const pathValue = assertString(field.path, `${widgetName}/editable-fields.json fields[${index}].path`);
    assertString(field.label, `${widgetName}/editable-fields.json fields[${index}].label`);
    assertString(field.role, `${widgetName}/editable-fields.json fields[${index}].role`);
    const type = assertString(field.type, `${widgetName}/editable-fields.json fields[${index}].type`);
    if (type !== "string" && type !== "richtext") {
      fail(`${widgetName}/editable-fields.json fields[${index}].type must be string or richtext`);
    }
    assertStringArray(field.arrayItemIdentity, `${widgetName}/editable-fields.json fields[${index}].arrayItemIdentity`);
    if (!Array.isArray(field.limits)) {
      fail(`${widgetName}/editable-fields.json fields[${index}].limits must be an array`);
    }
    if (seen.has(pathValue)) {
      fail(`${widgetName}/editable-fields.json duplicate field path: ${pathValue}`);
    }
    seen.add(pathValue);
  }
}

function readEntitlementKinds() {
  const matrix = readJson(entitlementsMatrixPath);
  if (!isRecord(matrix) || matrix.v !== 1 || !isRecord(matrix.entitlements)) {
    fail("packages/ck-policy/entitlements.matrix.json v=1 with entitlements is required");
  }
  const kinds = new Map();
  for (const [key, entry] of Object.entries(matrix.entitlements)) {
    if (!isRecord(entry) || (entry.kind !== "flag" && entry.kind !== "limit")) {
      fail(`entitlement ${key} must declare kind flag or limit`);
    }
    kinds.set(key, entry.kind);
  }
  return kinds;
}

function assertNoWidgetOwnedEntitlementTruth(value, label) {
  for (const forbiddenKey of ["values", "tiers", "entitlements", "plans", "profile", "profiles"]) {
    if (forbiddenKey in value) {
      fail(`${label} must not define ${forbiddenKey}; widget limits map to ck-policy keys only`);
    }
  }
}

function assertEnforceMap(value, label, allowedValues) {
  if (value == null) return;
  if (!isRecord(value)) {
    fail(`${label} must be an object when present`);
  }
  for (const [context, mode] of Object.entries(value)) {
    if (context !== "load" && context !== "ops" && context !== "publish") {
      fail(`${label}.${context} is not a supported enforcement context`);
    }
    if (!allowedValues.includes(mode)) {
      fail(`${label}.${context} must be one of ${allowedValues.join(", ")}`);
    }
  }
}

function readWidgetLimitsSpec(limits, widgetName, entitlementKinds) {
  if (!isRecord(limits) || limits.v !== 1 || !Array.isArray(limits.limits)) {
    fail(`${widgetName}/limits.json v=1 with limits[] is required`);
  }
  assertNoWidgetOwnedEntitlementTruth(limits, `${widgetName}/limits.json`);

  for (const [index, entry] of limits.limits.entries()) {
    const label = `${widgetName}/limits.json limits[${index}]`;
    if (!isRecord(entry)) {
      fail(`${label} must be an object`);
    }
    assertNoWidgetOwnedEntitlementTruth(entry, label);

    const key = assertString(entry.key, `${label}.key`);
    const kind = assertString(entry.kind, `${label}.kind`);
    const expectedKind = entitlementKinds.get(key);
    if (!expectedKind) {
      fail(`${label}.key references unknown ck-policy entitlement ${key}`);
    }
    if (kind !== expectedKind) {
      fail(`${label}.kind must match ck-policy kind ${expectedKind} for ${key}`);
    }

    if (kind === "flag") {
      const paths = Array.isArray(entry.paths)
        ? assertStringArray(entry.paths, `${label}.paths`)
        : [assertString(entry.path, `${label}.path`)];
      if (paths.length === 0) {
        fail(`${label} must specify path or paths`);
      }
      const mode = assertString(entry.mode, `${label}.mode`);
      if (mode !== "boolean" && mode !== "nonempty-string") {
        fail(`${label}.mode must be boolean or nonempty-string`);
      }
      if (mode === "boolean" && typeof entry.deny !== "boolean") {
        fail(`${label}.deny must be boolean for boolean flag limits`);
      }
      if (mode === "nonempty-string" && entry.deny !== "nonempty") {
        fail(`${label}.deny must be nonempty for nonempty-string flag limits`);
      }
      assertEnforceMap(entry.enforce, `${label}.enforce`, ["reject", "sanitize", "ignore"]);
      continue;
    }

    if (kind !== "limit") {
      fail(`${label}.kind must be flag or limit`);
    }
    const metric = assertString(entry.metric, `${label}.metric`);
    if (metric !== "count" && metric !== "count-total" && metric !== "chars") {
      fail(`${label}.metric must be count, count-total, or chars`);
    }
    const pathValue = assertString(entry.path, `${label}.path`);
    if ((metric === "count" || metric === "count-total") && !pathValue.includes("[]")) {
      fail(`${label}.path must include [] for ${metric}`);
    }
    assertEnforceMap(entry.enforce, `${label}.enforce`, ["reject", "ignore"]);
  }
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

for (const generatedPath of forbiddenGeneratedPaths) {
  if (fs.existsSync(generatedPath)) {
    fail(`${path.relative(repoRoot, generatedPath)} is deleted product authority and must not exist`);
  }
}

for (const deletedPath of forbiddenDeletedWidgetSourcePaths) {
  if (fs.existsSync(deletedPath)) {
    fail(`${path.relative(repoRoot, deletedPath)} is deleted widget source and must not exist`);
  }
}

const widgetNames = fs
  .readdirSync(widgetsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== "shared")
  .filter((name) => fs.existsSync(path.join(widgetsRoot, name, "spec.json")))
  .sort((a, b) => a.localeCompare(b));

const widgetOverlayCodes = readWidgetOverlayCodes();
const entitlementKinds = readEntitlementKinds();

for (const widgetName of widgetNames) {
  const widgetDir = path.join(widgetsRoot, widgetName);
  const specPath = path.join(widgetDir, "spec.json");
  const editableFieldsPath = path.join(widgetDir, "editable-fields.json");
  const catalogPath = path.join(widgetDir, "catalog.json");
  const limitsPath = path.join(widgetDir, "limits.json");
  const seoGeoPath = path.join(widgetDir, "seo-geo.ts");
  const agentPath = path.join(widgetDir, "agent.md");

  if (!fs.existsSync(catalogPath)) {
    fail(`${widgetName} is missing catalog.json`);
  }
  if (fs.existsSync(agentPath)) {
    fail(`${widgetName}/agent.md is deleted widget source and must not exist`);
  }
  if (fs.existsSync(seoGeoPath)) {
    fail(`${widgetName}/seo-geo.ts is deleted widget source and must not exist`);
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
  if (!widgetOverlayCodes.has(widgetType)) {
    fail(`${widgetType} is missing a WIDGET_OVERLAY_CODES entry`);
  }

  if (!isRecord(spec.defaults)) {
    fail(`${widgetName}/spec.json defaults must be an object`);
  }
  if (!fs.existsSync(editableFieldsPath)) {
    fail(`${widgetName} is missing editable-fields.json`);
  }
  readWidgetEditableFieldsContract(readJson(editableFieldsPath), widgetName);
  if (!fs.existsSync(limitsPath)) {
    fail(`${widgetName} is missing limits.json`);
  }
  readWidgetLimitsSpec(readJson(limitsPath), widgetName, entitlementKinds);
  if (isRecord(spec.overlays) && Array.isArray(spec.overlays.text)) {
    fail(`${widgetName}/spec.json overlays.text is deleted translation field authority`);
  }

  if ("capabilities" in catalog) {
    fail(`${widgetName}/catalog.json capabilities are deleted widget catalog source`);
  }

  optionalNumber(catalog.order, `${widgetName}/catalog.json order`);
  assertString(catalog.label, `${widgetName}/catalog.json label`);
  assertString(catalog.description, `${widgetName}/catalog.json description`);
  assertString(catalog.category, `${widgetName}/catalog.json category`);
}

for (const widgetType of widgetOverlayCodes.keys()) {
  if (!widgetNames.includes(widgetType)) {
    fail(`WIDGET_OVERLAY_CODES contains unsupported widget ${widgetType}`);
  }
}

console.log(`[validate-widget-source] OK: ${widgetNames.length} widget sources are valid`);
