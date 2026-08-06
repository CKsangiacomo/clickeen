import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { AccountPageTemplate } from '@clickeen/ck-contracts/pages';
import {
  collectPageCatalogAssetRefs,
  copyCatalogAssetsInPageSource,
  discardCatalogAssetsInPageSource,
  discardConfigMediaAssets,
  parseCatalogAssetMappings,
  rewriteConfigMediaAssetRefs,
} from '../lib/catalog-asset-choice';

async function main(): Promise<void> {
const sourceImage = 'hero.svg';
const sourceVideo = 'intro.mp4';
const destinationImage = 'hero-2.svg';
const destinationVideo = 'intro-2.mp4';
const mappings = parseCatalogAssetMappings({ mappings: [
  { sourceAssetRef: sourceImage, destinationAssetRef: destinationImage },
  { sourceAssetRef: sourceVideo, destinationAssetRef: destinationVideo },
] }, [sourceImage, sourceVideo]);

assert.deepEqual(mappings, [
  { sourceAssetRef: sourceImage, destinationAssetRef: destinationImage },
  { sourceAssetRef: sourceVideo, destinationAssetRef: destinationVideo },
]);
assert.throws(() => parseCatalogAssetMappings({ mappings: [mappings[0]] }, [sourceImage, sourceVideo]));
assert.throws(() => parseCatalogAssetMappings({ mappings: [...mappings, mappings[0]] }, [sourceImage, sourceVideo]));
assert.deepEqual(parseCatalogAssetMappings({ mappings: [
  { sourceAssetRef: sourceImage, destinationAssetRef: sourceImage },
] }, [sourceImage]), [{ sourceAssetRef: sourceImage, destinationAssetRef: sourceImage }]);

const widgetConfig = {
  stage: {
    background: {
      type: 'image',
      image: { assetRef: sourceImage, name: 'Hero', fit: 'cover', position: 'center', repeat: 'no-repeat' },
    },
    foreground: {
      type: 'video',
      video: { assetRef: sourceVideo, fit: 'cover', position: 'center', loop: true, muted: true, autoplay: true },
    },
    exactLookingText: sourceImage,
    color: { type: 'color', color: '#000000' },
  },
};
const rewritten = rewriteConfigMediaAssetRefs(widgetConfig, mappings);
assert.equal(rewritten.stage.background.image.assetRef, destinationImage);
assert.equal(rewritten.stage.foreground.video.assetRef, destinationVideo);
assert.equal(rewritten.stage.exactLookingText, sourceImage, 'non-media strings must not be rewritten');
assert.deepEqual(discardConfigMediaAssets(widgetConfig, [sourceImage, sourceVideo]), {
  stage: {
    background: { type: 'none' },
    foreground: { type: 'none' },
    exactLookingText: sourceImage,
    color: { type: 'color', color: '#000000' },
  },
});

const blankPage: AccountPageTemplate = {
  pageId: 'BLANK12345',
  displayName: 'Blank',
  isTemplate: true,
  values: { title: 'Blank' },
  robots: 'index-follow',
  placements: [],
};
assert.deepEqual(collectPageCatalogAssetRefs(blankPage), []);

const pageSource: AccountPageTemplate = {
  ...blankPage,
  values: { title: 'Landing', socialImageAssetRef: sourceImage },
  catalogPresentation: {
    thumbnailAssetRef: 'catalog-thumbnail.png',
    description: 'Landing page',
    category: 'Marketing',
    displayOrder: 1,
  },
};
assert.deepEqual(
  collectPageCatalogAssetRefs(pageSource),
  [sourceImage],
  'only the direct Page-owned metadata asset must be collected',
);
const copiedPage = copyCatalogAssetsInPageSource(pageSource, mappings);
assert.equal(copiedPage.values.socialImageAssetRef, destinationImage);
const discardedPage = discardCatalogAssetsInPageSource(pageSource, [sourceImage]);
assert.equal('socialImageAssetRef' in discardedPage.values, false);

const [dialog, builder, pageBuilder] = await Promise.all([
  readFile(new URL('../components/catalog-asset-choice-dialog.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/builder-domain.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/page-builder.tsx', import.meta.url), 'utf8'),
]);
assert.match(dialog, /This \{product\} includes assets \(images\/SVGs\/videos\)\./);
assert.match(dialog, /Copy assets in my assets folder/);
assert.match(dialog, /Discard assets/);
assert.match(dialog, /createDialogLifecycle/);
assert.match(builder, /\/api\/account\/catalog-assets\/copy/);
assert.match(builder, /body: JSON\.stringify\(\{ assetRefs: catalogAssetChoice\.assetRefs \}\)/);
assert.match(builder, /await requestCatalogAssetChoice\(prepared\)/);
assert.match(builder, /bobAppliedInstanceIdRef\.current = ''/);
assert.match(pageBuilder, /draft\.kind === 'catalog'/);
assert.match(pageBuilder, /collectPageCatalogAssetRefs\(preparedSource\)/);
assert.doesNotMatch(pageBuilder, /placementConfigs|copyCatalogAssetsInPageDraft|discardCatalogAssetsInPageDraft/);
assert.match(pageBuilder, /if \(assetRefs\.length\)/);
assert.match(pageBuilder, /await requestCatalogAssetChoice\(\{/);

console.log('PASS Catalog asset choice copies or cleanly discards only exposed draft assets');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
