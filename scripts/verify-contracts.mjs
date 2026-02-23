#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const HEX_64 = /^[a-f0-9]{64}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertIncludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (!contents.includes(token)) {
      throw new Error(`[contracts] ${file} missing required token: ${token}`);
    }
  }
}

function assertExcludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (contents.includes(token)) {
      throw new Error(`[contracts] ${file} contains forbidden token: ${token}`);
    }
  }
}

function assertIncludesAny(files, tokens) {
  const byFile = files.map((file) => ({ file, contents: readFile(file) }));
  for (const token of tokens) {
    const matched = byFile.some((entry) => entry.contents.includes(token));
    if (!matched) {
      throw new Error(`[contracts] files ${files.join(', ')} missing required token: ${token}`);
    }
  }
}

function assertExcludesAll(files, tokens) {
  const byFile = files.map((file) => ({ file, contents: readFile(file) }));
  for (const token of tokens) {
    const found = byFile.find((entry) => entry.contents.includes(token));
    if (found) {
      throw new Error(`[contracts] ${found.file} contains forbidden token: ${token}`);
    }
  }
}

function assertMissing(relPath) {
  const absolute = path.join(repoRoot, relPath);
  if (fs.existsSync(absolute)) {
    throw new Error(`[contracts] ${relPath} must not exist`);
  }
}

function readJson(relPath) {
  const contents = readFile(relPath);
  try {
    return JSON.parse(contents);
  } catch (err) {
    throw new Error(`[contracts] ${relPath} is not valid JSON`);
  }
}

function assertJsonHas(relPath, keys) {
  const json = readJson(relPath);
  for (const key of keys) {
    if (!(key in json)) {
      throw new Error(`[contracts] ${relPath} missing key: ${key}`);
    }
  }
  return json;
}

function assertLayerContract() {
  const layers = assertJsonHas('config/layers.json', [
    'order',
    'selection',
    'multiKeyOrder',
    'userFallbackOrder',
    'geoTargetsSemantics',
  ]);
  const canonical = ['base', 'locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user'];
  if (!Array.isArray(layers.order) || layers.order.join('|') !== canonical.join('|')) {
    throw new Error(`[contracts] config/layers.json order must be ${canonical.join(' -> ')}`);
  }
  if (layers.geoTargetsSemantics !== 'locale-selection-only') {
    throw new Error('[contracts] config/layers.json geoTargetsSemantics must be locale-selection-only');
  }
  const selection = layers.selection || {};
  const expectedSelection = {
    locale: 'single',
    geo: 'single',
    industry: 'single',
    experiment: 'multi',
    account: 'single',
    behavior: 'multi',
    user: 'locale+global',
  };
  for (const [key, value] of Object.entries(expectedSelection)) {
    if (selection[key] !== value) {
      throw new Error(`[contracts] config/layers.json selection.${key} must be ${value}`);
    }
  }
  const order = layers.multiKeyOrder || {};
  const expectedOrder = {
    experiment: 'expId-asc',
    behavior: 'lex',
  };
  for (const [key, value] of Object.entries(expectedOrder)) {
    if (order[key] !== value) {
      throw new Error(`[contracts] config/layers.json multiKeyOrder.${key} must be ${value}`);
    }
  }
  const fallbackOrder = layers.userFallbackOrder || [];
  if (!Array.isArray(fallbackOrder) || fallbackOrder.join('|') !== 'locale|global') {
    throw new Error('[contracts] config/layers.json userFallbackOrder must be ["locale", "global"]');
  }
}

function assertSchemas() {
  const overlay = assertJsonHas('config/overlay.schema.json', ['properties', 'required']);
  const overlayRequired = new Set(Array.isArray(overlay.required) ? overlay.required : []);
  for (const key of ['v', 'baseFingerprint', 'ops']) {
    if (!overlayRequired.has(key)) {
      throw new Error(`[contracts] config/overlay.schema.json required must include ${key}`);
    }
  }
  const index = assertJsonHas('config/index.schema.json', ['properties', 'required']);
  const indexRequired = new Set(Array.isArray(index.required) ? index.required : []);
  for (const key of ['v', 'publicId', 'layers']) {
    if (!indexRequired.has(key)) {
      throw new Error(`[contracts] config/index.schema.json required must include ${key}`);
    }
  }
}

function assertOverlayFixture() {
  const overlay = readJson('config/fixtures/overlay.sample.json');
  if (overlay.v !== 1) {
    throw new Error('[contracts] overlay sample v must be 1');
  }
  if (!HEX_64.test(overlay.baseFingerprint || '')) {
    throw new Error('[contracts] overlay sample baseFingerprint must be 64 hex chars');
  }
  if (!Array.isArray(overlay.ops) || overlay.ops.length === 0) {
    throw new Error('[contracts] overlay sample ops must be a non-empty array');
  }
  overlay.ops.forEach((op, index) => {
    if (!op || typeof op !== 'object') {
      throw new Error(`[contracts] overlay sample ops[${index}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[contracts] overlay sample ops[${index}].op must be "set"`);
    }
    if (typeof op.path !== 'string' || !op.path.trim()) {
      throw new Error(`[contracts] overlay sample ops[${index}].path must be a non-empty string`);
    }
  });
}

function assertIndexFixture() {
  const index = readJson('config/fixtures/index.sample.json');
  if (index.v !== 1) {
    throw new Error('[contracts] index sample v must be 1');
  }
  if (typeof index.publicId !== 'string' || !index.publicId.trim()) {
    throw new Error('[contracts] index sample publicId must be a non-empty string');
  }
  if (!index.layers || typeof index.layers !== 'object') {
    throw new Error('[contracts] index sample layers must be an object');
  }
  for (const [layer, entry] of Object.entries(index.layers)) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`[contracts] index sample layer ${layer} must be an object`);
    }
    if (!Array.isArray(entry.keys) || entry.keys.length === 0) {
      throw new Error(`[contracts] index sample layer ${layer} keys must be a non-empty array`);
    }
    entry.keys.forEach((key, idx) => {
      if (typeof key !== 'string' || !key.trim()) {
        throw new Error(`[contracts] index sample layer ${layer} keys[${idx}] must be a string`);
      }
    });
    if (entry.lastPublishedFingerprint) {
      for (const [key, fingerprint] of Object.entries(entry.lastPublishedFingerprint)) {
        if (!HEX_64.test(fingerprint || '')) {
          throw new Error(`[contracts] index sample layer ${layer} lastPublishedFingerprint.${key} invalid`);
        }
      }
    }
    if (entry.geoTargets) {
      for (const [key, targets] of Object.entries(entry.geoTargets)) {
        if (!Array.isArray(targets) || targets.length === 0) {
          throw new Error(`[contracts] index sample layer ${layer} geoTargets.${key} must be a non-empty array`);
        }
        targets.forEach((target, idx) => {
          if (!ISO_COUNTRY.test(target || '')) {
            throw new Error(
              `[contracts] index sample layer ${layer} geoTargets.${key}[${idx}] must be ISO-3166 alpha-2`,
            );
          }
        });
      }
    }
  }
}

function normalizeLocaleToken(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value) return null;
  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(value)) return null;
  return value;
}

function assertLocaleCanonicalization() {
  const cases = new Map([
    ['fr_FR', 'fr-fr'],
    ['FR-ca', 'fr-ca'],
    ['  en ', 'en'],
    ['zh-TW', 'zh-tw'],
    ['fil', 'fil'],
    ['en--us', null],
    ['', null],
  ]);
  for (const [input, expected] of cases.entries()) {
    const normalized = normalizeLocaleToken(input);
    if (normalized !== expected) {
      throw new Error(`[contracts] normalizeLocaleToken(${JSON.stringify(input)}) expected ${expected}`);
    }
  }
  assertIncludes('tooling/l10n/src/index.ts', ['replace(/_/g, \'-\')', 'toLowerCase()']);
}

function assertAssetLifecycleContracts49B() {
  const tokyoAssetFiles = [
    'tokyo-worker/src/index.ts',
    'tokyo-worker/src/domains/assets.ts',
    'tokyo-worker/src/domains/assets-handlers.ts',
  ];

  assertIncludesAny(tokyoAssetFiles, [
    'replace_account_asset_variant',
    "coreui.errors.asset.inUseConfirmRequired",
    'requiresConfirm: true',
    'confirmInUse',
    "headers.set('cache-control', 'no-store')",
    "headers.set('cdn-cache-control', 'no-store')",
    "headers.set('cloudflare-cdn-cache-control', 'no-store')",
    'ctx.waitUntil(Promise.allSettled(variantKeys.map((key) => env.TOKYO_R2.delete(key))))',
  ]);
  assertExcludesAll(tokyoAssetFiles, ['purge-deleted', 'markAccountAssetDeletedByIdentity']);

  assertIncludes('paris/src/index.ts', [
    'const accountAssetContentMatch = pathname.match(/^\\/api\\/accounts\\/([^/]+)\\/assets\\/([^/]+)\\/content$/);',
  ]);
  assertIncludes('paris/src/domains/accounts/index.ts', [
    'handleAccountAssetReplaceContent',
    "tokyoUrl.searchParams.set('confirmInUse', confirmInUse);",
  ]);

  assertIncludes('venice/lib/tokyo.ts', ["if (isAccountAssetPointer)", "return { cache: 'no-store' };"]);

  assertIncludes('roma/components/assets-domain.tsx', [
    "const search = confirmInUse ? '?confirmInUse=1' : '';",
    "typed.payload.error?.reasonKey === 'coreui.errors.asset.inUseConfirmRequired'",
  ]);

  assertIncludes('dieter/components/dropdown-upload/dropdown-upload.ts', [
    "setMetaValue(state, { name: file.name }, true);",
    "throw new Error('coreui.errors.assets.replaceTargetInvalid');",
    'replaceEditorAsset({',
  ]);
  assertExcludes('dieter/components/dropdown-upload/dropdown-upload.ts', [
    "setMetaValue(state, { name: file.name, mime: file.type || '', source: 'user' }, true)",
  ]);

  assertIncludes('dieter/components/dropdown-fill/dropdown-fill.ts', [
    "throw new Error('coreui.errors.assets.replaceTargetInvalid');",
  ]);
  assertExcludes('tokyo/widgets/shared/fill.js', ['fallbackLayer(']);

  assertIncludes('paris/src/shared/assetUsage.ts', ["parsed.kind !== 'pointer'"]);
  assertIncludes('dieter/components/shared/assetUpload.ts', ["parsed.kind !== 'pointer'"]);
}

function assertBootstrapContracts49C() {
  assertIncludes('paris/src/domains/roma/bootstrap-core.ts', [
    'Promise.allSettled',
    'domainErrors',
    'domainOutcomes',
    'bootstrapFanoutMs',
  ]);

  assertIncludes('paris/src/domains/roma/widgets-bootstrap.ts', [
    'domainErrors',
    'bootstrapFanoutMs',
    'bootstrapDomainOutcomes',
  ]);

  assertIncludes('roma/app/api/bootstrap/route.ts', [
    '/api/roma/bootstrap',
    "cache: 'no-store'",
    "response.headers.set('cache-control', 'no-store')",
    "response.headers.set('cdn-cache-control', 'no-store')",
    "response.headers.set('cloudflare-cdn-cache-control', 'no-store')",
  ]);
  assertMissing('roma/app/api/me/route.ts');

  assertIncludes('roma/components/use-roma-me.ts', [
    'ROMA_ME_DEGRADED_SUCCESS_TTL_MS = 5_000',
    'domainErrors?: Partial<Record<RomaBootstrapDomainKey, RomaBootstrapDomainError>> | null;',
    "fetch(`/api/bootstrap${search}`, { cache: 'no-store' })",
  ]);
  assertIncludes('roma/components/bootstrap-domain-state.ts', [
    'roma.errors.bootstrap.domain_unavailable',
    'roma.errors.bootstrap.domain_contract_violation',
  ]);
}

function main() {
  assertIncludes('venice/lib/tokyo.ts', ["cache: 'force-cache'", "cache: 'no-store'", 'resolveTokyoCache']);
  assertIncludes('venice/lib/l10n.ts', ['/l10n/instances/', 'index.json']);

  assertIncludesAny(['tokyo-worker/src/index.ts', 'tokyo-worker/src/domains/l10n-core.ts', 'tokyo-worker/src/domains/l10n.ts'], [
    'l10n/instances/${publicId}/${layer}/${layerKey}/',
    'l10n/instances/${publicId}/index.json',
  ]);
  assertExcludes('tokyo/dev-server.mjs', ['l10n/manifest.json']);
  assertSchemas();
  assertOverlayFixture();
  assertIndexFixture();
  assertLayerContract();
  assertLocaleCanonicalization();
  assertAssetLifecycleContracts49B();
  assertBootstrapContracts49C();

  console.log('[contracts] OK');
}

main();
