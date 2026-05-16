#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const ACCOUNT_ID = "a8528ec394ae2da9e5521d2ddd3aeb87";
const BUCKET = "tokyo-assets-dev";
const API_BASE = "https://api.cloudflare.com/client/v4";
const OUTPUT_DIR = "Execution_Pipeline_Docs/02-Executing/evidence";
const RESTORE_OBJECT_DIR = `${OUTPUT_DIR}/099H_restore_objects`;
const DRY_RUN_JSON = `${OUTPUT_DIR}/099H__r2_cleanup_dry_run.json`;
const DRY_RUN_REPORT = "Execution_Pipeline_Docs/02-Executing/099H__R2_Cleanup_Dry_Run_Report.md";
const ASSET_MIGRATION_JSON = `${OUTPUT_DIR}/099H__asset_migration_result.json`;
const RESTORE_MANIFEST_JSON = `${OUTPUT_DIR}/099H__restore_manifest.json`;
const ROLLBACK_REHEARSAL_JSON = `${OUTPUT_DIR}/099H__rollback_rehearsal_result.json`;
const DELETE_RESULT_JSON = `${OUTPUT_DIR}/099H__r2_delete_result.json`;
const FINAL_INVENTORY_JSON = `${OUTPUT_DIR}/099H__r2_inventory_final.json`;
const FINAL_REPORT = "Execution_Pipeline_Docs/02-Executing/099H__R2_Final_Cleanup_Report.md";

const ADMIN_OLD_ACCOUNT_ID = "00000000-0000-0000-0000-000000000100";
const ADMIN_ACCOUNT_PUBLIC_ID = "00000001";
const CANONICAL_ROOTS = ["accounts", "dieter", "fonts", "product", "prague"];
const SORTED_CANONICAL_ROOTS = [...CANONICAL_ROOTS].sort();
const WIDGET_TYPES = ["countdown", "faq", "logoshowcase"];
const ADMIN_INSTANCE_IDS = ["UZ3JEJSHII", "H7IF9M2K9B", "8FMVZFFPJV"];
const UUID_ACCOUNT_RE = /^accounts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
const STALE_ROOT_RE = /^(l10n|public|published|widgets)\//;
const CONCURRENCY = 4;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

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

function objectUrl(key) {
  return `${API_BASE}/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
}

async function cloudflareJsonFetch(token, resource, init = {}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response;
    try {
      response = await fetch(`${API_BASE}${resource}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "clickeen-prd99h-r2-cleanup",
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      if (attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw error;
    }
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      if (RETRY_STATUSES.has(response.status) && attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`Cloudflare API returned non-JSON ${response.status}: ${text.slice(0, 300)}`);
    }
    if (response.ok && json.success === true) {
      return json;
    }
    if (RETRY_STATUSES.has(response.status) && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(
      `Cloudflare API failed ${response.status} for ${resource}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`,
    );
  }
  throw new Error(`Cloudflare API retry budget exhausted for ${resource}`);
}

async function listR2Objects(token) {
  const objects = [];
  let cursor;

  do {
    const params = new URLSearchParams({ per_page: "1000" });
    if (cursor) params.set("cursor", cursor);
    const json = await cloudflareJsonFetch(
      token,
      `/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects?${params.toString()}`,
    );
    objects.push(...json.result);
    cursor = json.result_info?.is_truncated ? json.result_info?.cursor : undefined;
  } while (cursor);

  return objects.sort((a, b) => a.key.localeCompare(b.key));
}

async function getObjectBytes(token, key) {
  const response = await fetch(objectUrl(key), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "clickeen-prd99h-r2-cleanup",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET ${key} failed ${response.status}: ${text.slice(0, 300)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

async function putObjectBytes(token, key, bytes, contentType) {
  const response = await fetch(objectUrl(key), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "clickeen-prd99h-r2-cleanup",
      ...(contentType ? { "content-type": contentType } : {}),
    },
    body: bytes,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`PUT ${key} returned non-JSON ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok || json.success !== true) {
    throw new Error(`PUT ${key} failed ${response.status}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  }
  return json.result;
}

async function deleteObject(token, key) {
  const resource = `/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response;
    try {
      response = await fetch(`${API_BASE}${resource}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "clickeen-prd99h-r2-cleanup",
        },
      });
    } catch (error) {
      if (attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw error;
    }
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      if (RETRY_STATUSES.has(response.status) && attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`DELETE ${key} returned non-JSON ${response.status}: ${text.slice(0, 300)}`);
    }
    if (response.ok && json.success === true) {
      return { key, status: "deleted" };
    }
    const missing = response.status === 404 && json.errors?.some((error) => error.code === 10007);
    if (missing) {
      return { key, status: "already-missing" };
    }
    if (RETRY_STATUSES.has(response.status) && attempt < 5) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`DELETE ${key} failed ${response.status}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  }
  throw new Error(`DELETE retry budget exhausted for ${key}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function isDeletionTarget(key) {
  return STALE_ROOT_RE.test(key) || UUID_ACCOUNT_RE.test(key);
}

function deletionReason(key) {
  const staleRoot = STALE_ROOT_RE.exec(key)?.[1];
  if (staleRoot) {
    return `${staleRoot}/ is a deleted PRD99 root; ownership moved to product/, prague/, or accounts/`;
  }
  if (key.startsWith(`accounts/${ADMIN_OLD_ACCOUNT_ID}/assets/`)) {
    return "legacy private UUID account assets; copied to accounts/00000001/assets/ before deletion";
  }
  if (key.startsWith(`accounts/${ADMIN_OLD_ACCOUNT_ID}/widgets/`)) {
    return "legacy account-owned widget taxonomy; widget software now lives under product/widgets/";
  }
  if (key.startsWith(`accounts/${ADMIN_OLD_ACCOUNT_ID}/instances/`)) {
    return "legacy private UUID account instance state; admin instances were recreated under accounts/00000001/instances/";
  }
  return "legacy private UUID account folder; PRD99 uses accountPublicId R2 account folders";
}

function targetObjects(objects) {
  return objects.filter((object) => isDeletionTarget(object.key));
}

function groupCounts(objects, groupFn) {
  const groups = new Map();
  for (const object of objects) {
    const group = groupFn(object.key);
    const current = groups.get(group) ?? { objects: 0, bytes: 0 };
    current.objects += 1;
    current.bytes += Number(object.size ?? 0);
    groups.set(group, current);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function targetGroup(key) {
  const staleRoot = STALE_ROOT_RE.exec(key)?.[1];
  if (staleRoot) return `${staleRoot}/`;
  const parts = key.split("/");
  return `accounts/{uuid}/${parts[2] ?? "(root)"}/`;
}

function assetMigrationTargets(objects) {
  return objects
    .filter((object) => object.key.startsWith(`accounts/${ADMIN_OLD_ACCOUNT_ID}/assets/`))
    .map((object) => ({
      sourceKey: object.key,
      destinationKey: object.key.replace(
        `accounts/${ADMIN_OLD_ACCOUNT_ID}/assets/`,
        `accounts/${ADMIN_ACCOUNT_PUBLIC_ID}/assets/`,
      ),
      size: Number(object.size ?? 0),
      etag: object.etag,
      contentType: object.http_metadata?.contentType,
    }));
}

function verifyNewModel(objects) {
  const keys = new Set(objects.map((object) => object.key));
  const rootCounts = groupCounts(objects, (key) => key.split("/")[0] || "(empty)");
  const widgetResults = WIDGET_TYPES.map((widgetType) => {
    const prefix = `product/widgets/${widgetType}/`;
    return {
      widgetType,
      objects: objects.filter((object) => object.key.startsWith(prefix)).length,
      hasCatalog: keys.has(`${prefix}catalog.json`),
      hasSpec: keys.has(`${prefix}spec.json`),
      hasRuntime:
        keys.has(`${prefix}widget.client.js`) ||
        keys.has(`${prefix}widget.dom.js`) ||
        keys.has(`${prefix}widget.html`),
    };
  });
  const adminInstanceResults = ADMIN_INSTANCE_IDS.map((instanceId) => {
    const prefix = `accounts/${ADMIN_ACCOUNT_PUBLIC_ID}/instances/${instanceId}/`;
    return {
      instanceId,
      hasInstance: keys.has(`${prefix}instance.json`),
      hasConfig: keys.has(`${prefix}config.json`),
      hasPublish: keys.has(`${prefix}publish.json`),
      hasPublishedConfig: keys.has(`${prefix}published/config.json`),
      objects: objects.filter((object) => object.key.startsWith(prefix)).length,
    };
  });
  const accountPublicAssets = objects.filter((object) =>
    object.key.startsWith(`accounts/${ADMIN_ACCOUNT_PUBLIC_ID}/assets/`),
  );
  const oldUuidAssets = objects.filter((object) =>
    object.key.startsWith(`accounts/${ADMIN_OLD_ACCOUNT_ID}/assets/`),
  );
  const pragueObjects = objects.filter((object) => object.key.startsWith("prague/"));

  const failures = [];
  for (const widget of widgetResults) {
    if (!widget.hasCatalog || !widget.hasSpec || !widget.hasRuntime) {
      failures.push(`product/widgets/${widget.widgetType}/ is missing catalog/spec/runtime`);
    }
  }
  for (const instance of adminInstanceResults) {
    if (!instance.hasInstance || !instance.hasConfig || !instance.hasPublish || !instance.hasPublishedConfig) {
      failures.push(`accounts/${ADMIN_ACCOUNT_PUBLIC_ID}/instances/${instance.instanceId}/ is incomplete`);
    }
  }
  if (pragueObjects.length === 0) {
    failures.push("prague/ has no retained marketing/GTM objects");
  }
  if (oldUuidAssets.length > 0 && accountPublicAssets.length < oldUuidAssets.length) {
    failures.push(
      `admin assets are not yet fully copied to accounts/${ADMIN_ACCOUNT_PUBLIC_ID}/assets/ (${accountPublicAssets.length}/${oldUuidAssets.length})`,
    );
  }

  return {
    canonicalRoots: CANONICAL_ROOTS,
    observedRoots: Object.keys(rootCounts).sort(),
    rootCounts,
    widgetResults,
    adminInstanceResults,
    accountPublicAssets: accountPublicAssets.length,
    oldUuidAssets: oldUuidAssets.length,
    pragueObjects: pragueObjects.length,
    status: failures.length === 0 ? "green" : "blocked",
    failures,
  };
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

async function ensureOutputDirs() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(RESTORE_OBJECT_DIR, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function renderDryRunReport(plan) {
  const targetRows = Object.entries(plan.targetGroups)
    .map(([group, value]) => `| ${group} | ${value.objects} | ${value.bytes} |`)
    .join("\n");
  const widgetRows = plan.newModel.widgetResults
    .map(
      (widget) =>
        `| ${widget.widgetType} | ${widget.objects} | ${widget.hasCatalog} | ${widget.hasSpec} | ${widget.hasRuntime} |`,
    )
    .join("\n");
  const instanceRows = plan.newModel.adminInstanceResults
    .map(
      (instance) =>
        `| ${instance.instanceId} | ${instance.objects} | ${instance.hasInstance} | ${instance.hasConfig} | ${instance.hasPublish} | ${instance.hasPublishedConfig} |`,
    )
    .join("\n");

  return `# PRD 099H R2 Cleanup Dry Run Report

Generated: ${plan.generatedAt}

Bucket: \`${BUCKET}\`

Status: **${plan.status.toUpperCase()}**

## Targeted Deletions

No R2 deletion was performed by this dry run.

| group | objects | bytes |
| --- | ---: | ---: |
${targetRows}

Total targeted objects: ${plan.targetTotals.objects}  
Total targeted bytes: ${plan.targetTotals.bytes}

## Asset Copy Gate

Admin asset copies needed before deletion: ${plan.assetMigrations.length}

## New Model Verification

Widgets:

| widget | objects | catalog | spec | runtime |
| --- | ---: | --- | --- | --- |
${widgetRows}

Admin instances:

| instance | objects | instance.json | config.json | publish.json | published/config.json |
| --- | ---: | --- | --- | --- | --- |
${instanceRows}

Admin public asset objects: ${plan.newModel.accountPublicAssets}  
Old UUID asset objects: ${plan.newModel.oldUuidAssets}  
Prague objects: ${plan.newModel.pragueObjects}

Failures:

${plan.newModel.failures.length === 0 ? "- none" : plan.newModel.failures.map((failure) => `- ${failure}`).join("\n")}
`;
}

async function planCleanup(token) {
  const objects = await listR2Objects(token);
  const targets = targetObjects(objects);
  const migrations = assetMigrationTargets(objects);
  const newModel = verifyNewModel(objects);
  const plan = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    accountId: ACCOUNT_ID,
    status: targets.length > 0 ? "ready" : "clean",
    targetTotals: {
      objects: targets.length,
      bytes: targets.reduce((sum, object) => sum + Number(object.size ?? 0), 0),
    },
    targetGroups: groupCounts(targets, targetGroup),
    assetMigrations: migrations,
    newModel,
    targets: targets.map((object) => ({
      key: object.key,
      size: Number(object.size ?? 0),
      etag: object.etag,
      contentType: object.http_metadata?.contentType,
      reason: deletionReason(object.key),
    })),
  };
  await writeJson(DRY_RUN_JSON, plan);
  await fs.writeFile(DRY_RUN_REPORT, renderDryRunReport(plan));
  console.log(`Wrote ${DRY_RUN_JSON}`);
  console.log(`Wrote ${DRY_RUN_REPORT}`);
  console.log(`Targets: ${plan.targetTotals.objects}`);
  console.log(`Status: ${plan.status}`);
  if (plan.newModel.status !== "green") {
    console.log(`New model gate: ${plan.newModel.status}`);
    process.exitCode = 1;
  }
  return plan;
}

async function migrateAssets(token) {
  const objects = await listR2Objects(token);
  const migrations = assetMigrationTargets(objects);
  const existingKeys = new Set(objects.map((object) => object.key));
  const result = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    sourceAccount: ADMIN_OLD_ACCOUNT_ID,
    destinationAccount: ADMIN_ACCOUNT_PUBLIC_ID,
    copied: [],
    skipped: [],
  };

  await runPool(migrations, async (migration) => {
    if (existingKeys.has(migration.destinationKey)) {
      result.skipped.push({ ...migration, reason: "destination already exists" });
      return;
    }
    const source = await getObjectBytes(token, migration.sourceKey);
    const putResult = await putObjectBytes(token, migration.destinationKey, source.bytes, source.contentType);
    result.copied.push({
      ...migration,
      destinationEtag: putResult.etag,
      destinationSize: Number(putResult.size ?? source.bytes.length),
      sha256: sha256(source.bytes),
    });
  });

  result.copied.sort((a, b) => a.destinationKey.localeCompare(b.destinationKey));
  result.skipped.sort((a, b) => a.destinationKey.localeCompare(b.destinationKey));
  result.status = result.copied.length + result.skipped.length === migrations.length ? "green" : "blocked";
  await writeJson(ASSET_MIGRATION_JSON, result);
  console.log(`Wrote ${ASSET_MIGRATION_JSON}`);
  console.log(`Copied: ${result.copied.length}`);
  console.log(`Skipped: ${result.skipped.length}`);
}

async function exportRestoreManifest(token) {
  const objects = await listR2Objects(token);
  const targets = targetObjects(objects);
  const manifest = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    accountId: ACCOUNT_ID,
    targetTotals: {
      objects: targets.length,
      bytes: targets.reduce((sum, object) => sum + Number(object.size ?? 0), 0),
    },
    restoreObjectDir: RESTORE_OBJECT_DIR,
    objects: [],
  };

  await ensureOutputDirs();
  await runPool(targets, async (object) => {
    const source = await getObjectBytes(token, object.key);
    const digest = sha256(source.bytes);
    const restoreFile = `${RESTORE_OBJECT_DIR}/${digest}.bin`;
    await fs.writeFile(restoreFile, source.bytes);
    manifest.objects.push({
      key: object.key,
      size: Number(object.size ?? 0),
      etag: object.etag,
      contentType: object.http_metadata?.contentType ?? source.contentType,
      storageClass: object.storage_class,
      restoreFile,
      sha256: digest,
      reason: deletionReason(object.key),
    });
  });

  manifest.objects.sort((a, b) => a.key.localeCompare(b.key));
  manifest.status = manifest.objects.length === targets.length ? "green" : "blocked";
  await writeJson(RESTORE_MANIFEST_JSON, manifest);
  console.log(`Wrote ${RESTORE_MANIFEST_JSON}`);
  console.log(`Exported restore objects: ${manifest.objects.length}`);
}

async function rehearseRollback(token) {
  const manifest = JSON.parse(await fs.readFile(RESTORE_MANIFEST_JSON, "utf8"));
  if (!manifest.objects?.length) {
    throw new Error(`No restore objects found in ${RESTORE_MANIFEST_JSON}`);
  }
  const sample = manifest.objects.find((object) => object.contentType === "application/json") ?? manifest.objects[0];
  const bytes = await fs.readFile(sample.restoreFile);
  const tempKey = `product/__prd99h_restore_rehearsal/${sample.sha256}/${path.basename(sample.key)}`;
  await putObjectBytes(token, tempKey, bytes, sample.contentType);
  const restored = await getObjectBytes(token, tempKey);
  await deleteObject(token, tempKey);
  const result = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    sourceKey: sample.key,
    temporaryKey: tempKey,
    sourceSha256: sample.sha256,
    restoredSha256: sha256(restored.bytes),
    bytes: bytes.length,
  };
  result.status = result.sourceSha256 === result.restoredSha256 ? "green" : "blocked";
  await writeJson(ROLLBACK_REHEARSAL_JSON, result);
  console.log(`Wrote ${ROLLBACK_REHEARSAL_JSON}`);
  console.log(`Status: ${result.status}`);
  if (result.status !== "green") {
    process.exitCode = 1;
  }
}

async function deleteTargets(token) {
  const dryRun = JSON.parse(await fs.readFile(DRY_RUN_JSON, "utf8"));
  const restoreManifest = JSON.parse(await fs.readFile(RESTORE_MANIFEST_JSON, "utf8"));
  const rehearsal = JSON.parse(await fs.readFile(ROLLBACK_REHEARSAL_JSON, "utf8"));
  if (!dryRun.targets?.length) {
    throw new Error(`No dry-run targets found in ${DRY_RUN_JSON}`);
  }
  if (restoreManifest.status !== "green" || restoreManifest.objects.length !== dryRun.targets.length) {
    throw new Error("Restore manifest does not cover the dry-run deletion target set");
  }
  if (rehearsal.status !== "green") {
    throw new Error("Rollback rehearsal is not green");
  }
  const dryRunKeys = dryRun.targets.map((target) => target.key).sort();
  const restoreKeys = restoreManifest.objects.map((object) => object.key).sort();
  if (JSON.stringify(dryRunKeys) !== JSON.stringify(restoreKeys)) {
    throw new Error("Dry-run target keys and restore manifest keys differ");
  }
  const liveKeys = new Set((await listR2Objects(token)).map((object) => object.key));
  const remainingKeys = dryRunKeys.filter((key) => liveKeys.has(key));
  const alreadyMissingKeys = dryRunKeys.filter((key) => !liveKeys.has(key));
  await runPool(remainingKeys, async (key) => {
    if (!isDeletionTarget(key)) {
      throw new Error(`Refusing to delete non-target key: ${key}`);
    }
    await deleteObject(token, key);
  });
  const result = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    deletedObjects: remainingKeys.length,
    alreadyMissingObjects: alreadyMissingKeys.length,
    deletedKeys: remainingKeys,
    alreadyMissingKeys,
    status: "green",
  };
  await writeJson(DELETE_RESULT_JSON, result);
  console.log(`Wrote ${DELETE_RESULT_JSON}`);
  console.log(`Deleted: ${result.deletedObjects}`);
}

function renderFinalReport(inventory) {
  const rootRows = Object.entries(inventory.rootCounts)
    .map(([root, value]) => `| ${root}/ | ${value.objects} | ${value.bytes} |`)
    .join("\n");
  return `# PRD 099H R2 Final Cleanup Report

Generated: ${inventory.generatedAt}

Bucket: \`${BUCKET}\`

Status: **${inventory.status.toUpperCase()}**

## Root Inventory

| root | objects | bytes |
| --- | ---: | ---: |
${rootRows}

Canonical roots: ${CANONICAL_ROOTS.map((root) => `\`${root}/\``).join(", ")}

## Guard Checks

- stale root objects: ${inventory.staleRootObjects}
- private UUID account objects: ${inventory.uuidAccountObjects}
- rollback rehearsal: \`${ROLLBACK_REHEARSAL_JSON}\`
- restore manifest: \`${RESTORE_MANIFEST_JSON}\`
- deletion result: \`${DELETE_RESULT_JSON}\`

Failures:

${inventory.failures.length === 0 ? "- none" : inventory.failures.map((failure) => `- ${failure}`).join("\n")}
`;
}

async function finalInventory(token) {
  const objects = await listR2Objects(token);
  const rootCounts = groupCounts(objects, (key) => key.split("/")[0] || "(empty)");
  const observedRoots = Object.keys(rootCounts).sort();
  const staleRootObjects = objects.filter((object) => STALE_ROOT_RE.test(object.key)).length;
  const uuidAccountObjects = objects.filter((object) => UUID_ACCOUNT_RE.test(object.key)).length;
  const failures = [];
  if (JSON.stringify(observedRoots) !== JSON.stringify(SORTED_CANONICAL_ROOTS)) {
    failures.push(`root inventory is ${observedRoots.join(", ")} not ${SORTED_CANONICAL_ROOTS.join(", ")}`);
  }
  if (staleRootObjects > 0) failures.push(`${staleRootObjects} stale root objects remain`);
  if (uuidAccountObjects > 0) failures.push(`${uuidAccountObjects} private UUID account objects remain`);
  const newModel = verifyNewModel(objects);
  failures.push(...newModel.failures);
  const inventory = {
    generatedAt: new Date().toISOString(),
    bucket: BUCKET,
    accountId: ACCOUNT_ID,
    totals: {
      objects: objects.length,
      bytes: objects.reduce((sum, object) => sum + Number(object.size ?? 0), 0),
    },
    observedRoots,
    rootCounts,
    staleRootObjects,
    uuidAccountObjects,
    newModel,
    failures,
    objects,
    status: failures.length === 0 ? "green" : "blocked",
  };
  await writeJson(FINAL_INVENTORY_JSON, inventory);
  await fs.writeFile(FINAL_REPORT, renderFinalReport(inventory));
  console.log(`Wrote ${FINAL_INVENTORY_JSON}`);
  console.log(`Wrote ${FINAL_REPORT}`);
  console.log(`Status: ${inventory.status}`);
  if (inventory.status !== "green") {
    process.exitCode = 1;
  }
}

async function main() {
  const command = process.argv[2];
  const token = readWranglerOauthToken();
  await ensureOutputDirs();

  switch (command) {
    case "--dry-run":
      await planCleanup(token);
      break;
    case "--migrate-assets":
      await migrateAssets(token);
      break;
    case "--export-restore":
      await exportRestoreManifest(token);
      break;
    case "--rehearse-rollback":
      await rehearseRollback(token);
      break;
    case "--delete":
      await deleteTargets(token);
      break;
    case "--final-inventory":
      await finalInventory(token);
      break;
    default:
      console.error(
        "Usage: node scripts/prd99h-r2-cleanup.mjs --dry-run|--migrate-assets|--export-restore|--rehearse-rollback|--delete|--final-inventory",
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
