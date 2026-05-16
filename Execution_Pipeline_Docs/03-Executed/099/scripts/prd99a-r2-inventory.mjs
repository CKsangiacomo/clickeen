#!/usr/bin/env node

import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const ACCOUNT_ID = "a8528ec394ae2da9e5521d2ddd3aeb87";
const BUCKET = "tokyo-assets-dev";
const API_BASE = "https://api.cloudflare.com/client/v4";
const OUTPUT_DIR = "Execution_Pipeline_Docs/02-Executing/evidence";
const MANIFEST_PATH = `${OUTPUT_DIR}/099A__r2_inventory_manifest.json`;
const REPORT_PATH = "Execution_Pipeline_Docs/02-Executing/099A__R2_Inventory_Report.md";

const CANONICAL_ROOTS = new Set(["accounts", "dieter", "fonts", "product", "prague"]);
const KNOWN_STALE_ROOTS = new Set(["l10n", "public", "published", "widgets"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_PUBLIC_ID_RE = /^[0-9A-Z]{8}$/;
const LEGACY_WIDGET_ID_RE = new RegExp(`(^|/)${"wgt"}_[^/]+`);
const LEGACY_INSTANCE_ID_RE = new RegExp(`(^|/)${"ins"}_[^/]+`);
const LEGACY_PUBLISHED_WIDGETS_RE = new RegExp(`^${"published"}/${"widgets"}/`);

function readWranglerOauthToken() {
  const configPath = path.join(
    process.env.HOME ?? "",
    "Library/Preferences/.wrangler/config/default.toml",
  );
  const config = readFileSync(configPath, "utf8");
  const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  if (!token) {
    throw new Error(`No oauth_token found in ${configPath}`);
  }
  return token;
}

async function cloudflareFetch(token, resource) {
  const response = await fetch(`${API_BASE}${resource}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "clickeen-prd99a-r2-inventory",
    },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Cloudflare API returned non-JSON ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok || json.success !== true) {
    throw new Error(
      `Cloudflare API failed ${response.status} for ${resource}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`,
    );
  }
  return json;
}

async function listR2Objects(token) {
  const objects = [];
  let cursor;

  do {
    const params = new URLSearchParams({ per_page: "1000" });
    if (cursor) params.set("cursor", cursor);
    const json = await cloudflareFetch(
      token,
      `/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects?${params.toString()}`,
    );
    objects.push(...json.result);
    cursor = json.result_info?.is_truncated ? json.result_info?.cursor : undefined;
  } while (cursor);

  return objects.sort((a, b) => a.key.localeCompare(b.key));
}

function classifyObject(object) {
  const key = object.key;
  const [root, second, third] = key.split("/");

  if (!root) {
    return { root: "(empty)", classification: "blocker", reason: "empty object key" };
  }

  if (root === "accounts") {
    if (!second) {
      return { root, classification: "blocker", reason: "accounts key without account id" };
    }
    if (UUID_RE.test(second)) {
      return {
        root,
        classification: "move/recreate",
        reason: "legacy UUID account storage; PRD99 requires account public IDs such as 00000001",
      };
    }
    if (!ACCOUNT_PUBLIC_ID_RE.test(second)) {
      return {
        root,
        classification: "blocker",
        reason: "account folder is neither legacy UUID nor PRD99 account public ID",
      };
    }
    if (third === "widgets") {
      return {
        root,
        classification: "delete",
        reason: "accounts must never own widget software; widgets live under product/widgets",
      };
    }
    if (third === "instances" || third === "assets" || !third) {
      return {
        root,
        classification: "keep",
        reason: "PRD99 account-owned runtime state path",
      };
    }
    return {
      root,
      classification: "blocker",
      reason: "unknown PRD99 account subfolder",
    };
  }

  if (root === "fonts") {
    return { root, classification: "keep", reason: "canonical git-authored CDN font root" };
  }

  if (root === "dieter") {
    return { root, classification: "keep", reason: "canonical git-authored design-system root" };
  }

  if (root === "product") {
    return { root, classification: "keep", reason: "canonical git-authored product software root" };
  }

  if (root === "prague") {
    return { root, classification: "keep", reason: "canonical git-authored marketing/GTM root" };
  }

  if (root === "widgets") {
    return {
      root,
      classification: "delete",
      reason: "legacy root widget software; PRD99 serves widget software from product/widgets",
    };
  }

  if (root === "public") {
    return {
      root,
      classification: "delete",
      reason: "legacy root public bucket content; PRD99 has no root public namespace",
    };
  }

  if (root === "l10n") {
    return {
      root,
      classification: "move/recreate",
      reason: "legacy root localization; PRD99 requires ownership under product, prague, or account paths",
    };
  }

  if (root === "published") {
    return {
      root,
      classification: "move/recreate",
      reason: "legacy root published projection; PRD99 moves public projections under account-scoped ownership",
    };
  }

  return {
    root,
    classification: "blocker",
    reason: "root is not canonical and not a known stale PRD99 source",
  };
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function summarize(objects) {
  const rootCounts = new Map();
  const rootBytes = new Map();
  const classificationCounts = new Map();
  const rootClassifications = new Map();
  const reasonCounts = new Map();
  const samplesByClassification = new Map();
  const patternCounts = new Map();

  const classified = objects.map((object) => {
    const classification = classifyObject(object);
    increment(rootCounts, classification.root);
    increment(rootBytes, classification.root, object.size ?? 0);
    increment(classificationCounts, classification.classification);
    increment(reasonCounts, classification.reason);

    if (!rootClassifications.has(classification.root)) {
      rootClassifications.set(classification.root, new Set());
    }
    rootClassifications.get(classification.root).add(classification.classification);

    if (!samplesByClassification.has(classification.classification)) {
      samplesByClassification.set(classification.classification, []);
    }
    const samples = samplesByClassification.get(classification.classification);
    if (samples.length < 20) samples.push(object.key);

    if (/^accounts\/[0-9a-f-]{36}\//i.test(object.key)) increment(patternCounts, "legacy UUID account path");
    if (/\/widgets(\/|$)/.test(object.key)) increment(patternCounts, "account/root widgets path");
    if (LEGACY_WIDGET_ID_RE.test(object.key)) increment(patternCounts, "legacy widget-prefixed id");
    if (LEGACY_INSTANCE_ID_RE.test(object.key)) increment(patternCounts, "legacy instance-prefixed id");
    if (LEGACY_PUBLISHED_WIDGETS_RE.test(object.key)) increment(patternCounts, "legacy published widget registry path");
    if (/^public\//.test(object.key)) increment(patternCounts, "public root path");
    if (/^l10n\//.test(object.key)) increment(patternCounts, "l10n root path");

    return { ...object, ...classification };
  });

  return {
    classified,
    rootCounts,
    rootBytes,
    classificationCounts,
    rootClassifications,
    reasonCounts,
    samplesByClassification,
    patternCounts,
  };
}

function mapToObject(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function renderTable(rows) {
  if (rows.length === 0) return "_None._";
  const headers = Object.keys(rows[0]);
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${headers.map((header) => String(row[header]).replace(/\|/g, "\\|")).join(" | ")} |`);
  }
  return lines.join("\n");
}

function rootDisposition(root) {
  switch (root) {
    case "accounts":
      return "keep root; move/recreate legacy UUID children";
    case "fonts":
    case "dieter":
    case "product":
    case "prague":
      return "keep";
    case "l10n":
      return "delete root after owned content is recreated under product/prague/account paths";
    case "published":
      return "delete root after account-scoped projections are recreated";
    case "public":
    case "widgets":
      return "delete root";
    default:
      return "blocker";
  }
}

function renderReport(objects, summary) {
  const observedRoots = [...summary.rootCounts.keys()].sort();
  const unclassifiedRoots = observedRoots.filter(
    (root) => !CANONICAL_ROOTS.has(root) && !KNOWN_STALE_ROOTS.has(root),
  );
  const blockerCount = summary.classificationCounts.get("blocker") ?? 0;
  const totalBytes = objects.reduce((sum, object) => sum + (object.size ?? 0), 0);

  const rootRows = observedRoots.map((root) => ({
    root: `${root}/`,
    objects: summary.rootCounts.get(root),
    bytes: summary.rootBytes.get(root),
    rootDisposition: rootDisposition(root),
    classifications: [...summary.rootClassifications.get(root)].sort().join(", "),
  }));

  const classificationRows = [...summary.classificationCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([classification, count]) => ({ classification, objects: count }));

  const reasonRows = [...summary.reasonCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, count]) => ({ reason, objects: count }));

  const patternRows = [...summary.patternCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pattern, count]) => ({ pattern, objects: count }));

  const sampleSections = [...summary.samplesByClassification.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([classification, samples]) => {
      const body = samples.map((sample) => `- \`${sample}\``).join("\n");
      return `### ${classification}\n${body}`;
    })
    .join("\n\n");

  const status = unclassifiedRoots.length === 0 && blockerCount === 0 ? "GREEN" : "BLOCKED";

  return `# PRD 099A R2 Inventory Report

Generated: ${new Date().toISOString()}

Bucket: \`${BUCKET}\`  
Account: \`${ACCOUNT_ID}\`  
Method: Cloudflare R2 object API via the existing Wrangler OAuth browser-auth session, read-only \`GET /accounts/{account_id}/r2/buckets/{bucket}/objects?per_page=1000\`.

Status: **${status}**

## Totals

- Objects listed: ${objects.length}
- Total bytes listed: ${totalBytes}
- Complete manifest: \`${MANIFEST_PATH}\`
- R2 mutations performed: none

## Root Folders

${renderTable(rootRows)}

## Object Classifications

${renderTable(classificationRows)}

## Reasons

${renderTable(reasonRows)}

## Toxic / Migration Pattern Counts

${renderTable(patternRows)}

## 099A Gate Checks

- Unclassified roots: ${unclassifiedRoots.length === 0 ? "none" : unclassifiedRoots.map((root) => `\`${root}/\``).join(", ")}
- Blocker-classified objects: ${blockerCount}
- Root \`widgets/\`: ${observedRoots.includes("widgets") ? rootDisposition("widgets") : "not observed"}
- Root \`l10n/\`: ${observedRoots.includes("l10n") ? rootDisposition("l10n") : "not observed"}
- Root \`${"public"}/\`: ${observedRoots.includes("public") ? rootDisposition("public") : "not observed"}
- Root \`${"published"}/\`: ${observedRoots.includes("published") ? rootDisposition("published") : "not observed"}

## Classification Samples

${sampleSections}
`;
}

async function main() {
  const token = readWranglerOauthToken();
  const objects = await listR2Objects(token);
  const summary = summarize(objects);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        bucket: BUCKET,
        accountId: ACCOUNT_ID,
        totals: {
          objects: objects.length,
          bytes: objects.reduce((sum, object) => sum + (object.size ?? 0), 0),
        },
        rootCounts: mapToObject(summary.rootCounts),
        classificationCounts: mapToObject(summary.classificationCounts),
        patternCounts: mapToObject(summary.patternCounts),
        objects: summary.classified,
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(REPORT_PATH, renderReport(objects, summary));

  const unclassifiedRoots = [...summary.rootCounts.keys()].filter(
    (root) => !CANONICAL_ROOTS.has(root) && !KNOWN_STALE_ROOTS.has(root),
  );
  const blockerCount = summary.classificationCounts.get("blocker") ?? 0;
  console.log(`Wrote ${MANIFEST_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Objects: ${objects.length}`);
  console.log(`Roots: ${[...summary.rootCounts.keys()].sort().map((root) => `${root}/`).join(", ")}`);
  console.log(`Unclassified roots: ${unclassifiedRoots.length}`);
  console.log(`Blocker objects: ${blockerCount}`);

  if (unclassifiedRoots.length > 0 || blockerCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
