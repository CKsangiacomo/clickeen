import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type LocalizationAllowlist = {
  v: number;
  paths: Array<{ path: string; type: string }>;
};

type CuratedIndex = {
  v?: unknown;
  publicId?: unknown;
  layers?: {
    locale?: {
      keys?: unknown;
    };
  };
};

type BaseSnapshotFile = {
  v?: unknown;
  publicId?: unknown;
  snapshot?: Record<string, unknown>;
};

type LocaleOpsFile = {
  ops?: Array<{ op?: unknown; path?: unknown; value?: unknown }>;
};

const REPO_ROOT = process.cwd();
const FAQ_PAGES_DIR = path.join(REPO_ROOT, 'tokyo/widgets/faq/pages');
const FAQ_L10N_DIR = path.join(REPO_ROOT, 'tokyo/l10n/instances');
const FAQ_LOCALIZATION_PATH = path.join(REPO_ROOT, 'tokyo/widgets/faq/localization.json');

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileAllowlistMatchers(patterns: string[]): RegExp[] {
  return patterns.map((pattern) => {
    const parts = pattern.split('.').map((segment) => {
      if (segment === '*') return '[^.]+';
      return escapeRegex(segment);
    });
    return new RegExp(`^${parts.join('\\.')}$`);
  });
}

function pathIsAllowlisted(value: string, matchers: RegExp[]): boolean {
  return matchers.some((matcher) => matcher.test(value));
}

function collectCuratedRefs(value: unknown, refs: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCuratedRefs(entry, refs));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const curatedRef = record.curatedRef;
  if (curatedRef && typeof curatedRef === 'object' && !Array.isArray(curatedRef)) {
    const publicId = String((curatedRef as { publicId?: unknown }).publicId || '').trim();
    if (publicId) refs.add(publicId);
  }

  Object.values(record).forEach((entry) => collectCuratedRefs(entry, refs));
}

function hasEditorLeak(value: string): boolean {
  return value.includes('diet-dropdown-edit-link');
}

describe('FAQ curated proof lane', () => {
  it('keeps active FAQ curated refs backed by local FAQ l10n artifacts', () => {
    const localization = loadJson<LocalizationAllowlist>(FAQ_LOCALIZATION_PATH);
    expect(localization.v).toBe(1);
    const allowlistMatchers = compileAllowlistMatchers(localization.paths.map((entry) => entry.path));

    const pageFiles = fs
      .readdirSync(FAQ_PAGES_DIR)
      .filter((file) => file.endsWith('.json'))
      .sort();
    expect(pageFiles.length).toBeGreaterThan(0);

    const activeRefs = new Set<string>();
    for (const file of pageFiles) {
      const payload = loadJson<unknown>(path.join(FAQ_PAGES_DIR, file));
      collectCuratedRefs(payload, activeRefs);
    }

    expect(activeRefs.size).toBeGreaterThan(0);

    for (const publicId of activeRefs) {
      const instanceDir = path.join(FAQ_L10N_DIR, publicId);
      expect(fs.existsSync(instanceDir), `${publicId} must exist in local FAQ l10n truth`).toBe(true);

      const index = loadJson<CuratedIndex>(path.join(instanceDir, 'index.json'));
      expect(index.v).toBe(1);
      expect(index.publicId).toBe(publicId);
      expect(Array.isArray(index.layers?.locale?.keys)).toBe(true);
      expect((index.layers?.locale?.keys as unknown[]).length).toBeGreaterThan(0);

      const basesDir = path.join(instanceDir, 'bases');
      const baseFiles = fs
        .readdirSync(basesDir)
        .filter((file) => file.endsWith('.snapshot.json'))
        .sort();
      expect(baseFiles.length, `${publicId} must have at least one base snapshot`).toBeGreaterThan(0);

      for (const file of baseFiles) {
        const baseSnapshot = loadJson<BaseSnapshotFile>(path.join(basesDir, file));
        expect(baseSnapshot.v).toBe(1);
        expect(baseSnapshot.publicId).toBe(publicId);
        expect(baseSnapshot.snapshot && typeof baseSnapshot.snapshot === 'object').toBe(true);

        for (const [snapshotPath, snapshotValue] of Object.entries(baseSnapshot.snapshot || {})) {
          expect(
            pathIsAllowlisted(snapshotPath, allowlistMatchers),
            `${publicId} snapshot path must stay on FAQ localization allowlist: ${snapshotPath}`,
          ).toBe(true);
          if (typeof snapshotValue === 'string') {
            expect(
              hasEditorLeak(snapshotValue),
              `${publicId} base snapshot must not contain editor-only richtext leakage at ${snapshotPath}`,
            ).toBe(false);
          }
        }
      }

      const localeDir = path.join(instanceDir, 'locale');
      const localeEntries = fs.readdirSync(localeDir, { withFileTypes: true });
      const opsFiles: string[] = [];
      for (const entry of localeEntries) {
        if (!entry.isDirectory()) continue;
        const nestedDir = path.join(localeDir, entry.name);
        for (const file of fs.readdirSync(nestedDir)) {
          if (file.endsWith('.ops.json')) {
            opsFiles.push(path.join(nestedDir, file));
          }
        }
      }
      expect(opsFiles.length, `${publicId} must have locale ops for active proof-lane localization`).toBeGreaterThan(0);

      for (const file of opsFiles) {
        const localeOps = loadJson<LocaleOpsFile>(file);
        expect(Array.isArray(localeOps.ops)).toBe(true);
        for (const op of localeOps.ops || []) {
          expect(op.op).toBe('set');
          expect(typeof op.path).toBe('string');
          expect(
            pathIsAllowlisted(String(op.path), allowlistMatchers),
            `${publicId} locale op path must stay on FAQ localization allowlist: ${String(op.path)}`,
          ).toBe(true);
          expect(typeof op.value).toBe('string');
          expect(
            hasEditorLeak(String(op.value)),
            `${publicId} locale ops must not contain editor-only richtext leakage`,
          ).toBe(false);
        }
      }
    }
  });
});
