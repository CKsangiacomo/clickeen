#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = [
  "admin",
  "bob",
  "packages",
  "prague",
  "roma",
  "scripts",
  "tokyo",
  "tokyo-worker",
  "venice",
];

const EXCLUDED_PARTS = new Set([
  ".astro",
  ".next",
  ".turbo",
  ".vercel",
  ".wrangler",
  "build",
  "dist",
  "node_modules",
  "test-results",
]);

const EXCLUDED_FILES = new Set([
  "scripts/prd99a-r2-inventory.mjs",
  "scripts/prd99g-admin-account-recreate.mjs",
  "scripts/prd99h-r2-cleanup.mjs",
  "scripts/verify/prd99-storage-guard.mjs",
  "tokyo-worker/src/route-helpers.test.ts",
]);

const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".toml",
  ".yml",
  ".yaml",
]);

const publicInstances = "public" + "/instances";
const publishedWidgets = "published" + "/widgets";
const legacyL10nWidgets = "/" + "l10n" + "/widgets";
const legacyL10nBase = "l10n" + "/base";
const legacyWidgetId = "wgt" + "_";
const legacyInstanceId = "ins" + "_";

const guards = [
  { name: "root public instance path", pattern: new RegExp(escapeRegExp(publicInstances)) },
  { name: "root published widget path", pattern: new RegExp(escapeRegExp(publishedWidgets)) },
  { name: "root l10n widget path", pattern: new RegExp(escapeRegExp(legacyL10nWidgets)) },
  { name: "root l10n base path", pattern: new RegExp(escapeRegExp(legacyL10nBase)) },
  {
    name: "private UUID account folder",
    pattern: /accounts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  },
  { name: "account-owned widgets path", pattern: /accounts\/[^/\s"'`{}$]+\/widgets/i },
  { name: "legacy widget-prefixed id", pattern: new RegExp(escapeRegExp(legacyWidgetId)) },
  { name: "legacy instance-prefixed id", pattern: new RegExp(escapeRegExp(legacyInstanceId)) },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shouldSkip(relativePath, dirent) {
  if (EXCLUDED_FILES.has(relativePath)) return true;
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => EXCLUDED_PARTS.has(part))) return true;
  if (dirent.isFile()) {
    if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) return true;
    if (relativePath.endsWith(".spec.ts") || relativePath.endsWith(".spec.tsx")) return true;
    if (relativePath.endsWith(".pdf")) return true;
    return !TEXT_EXTENSIONS.has(path.extname(relativePath));
  }
  return false;
}

async function* walk(relativeDir) {
  if (!(await exists(path.join(ROOT, relativeDir)))) return;
  const entries = await fs.readdir(path.join(ROOT, relativeDir), { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (shouldSkip(relativePath, entry)) continue;
    if (entry.isDirectory()) {
      yield* walk(relativePath);
    } else if (entry.isFile()) {
      yield relativePath;
    }
  }
}

function lineNumberForOffset(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

const violations = [];

for (const scanRoot of SCAN_ROOTS) {
  for await (const relativePath of walk(scanRoot)) {
    const text = await fs.readFile(path.join(ROOT, relativePath), "utf8");
    for (const guard of guards) {
      guard.pattern.lastIndex = 0;
      const match = guard.pattern.exec(text);
      if (match) {
        violations.push({
          file: relativePath,
          line: lineNumberForOffset(text, match.index),
          guard: guard.name,
          match: match[0],
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("[prd99-storage-guard] blocked legacy R2 taxonomy in active paths:");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} ${violation.guard}: ${JSON.stringify(violation.match)}`,
    );
  }
  process.exit(1);
}

console.log("[prd99-storage-guard] active product paths are clean.");
