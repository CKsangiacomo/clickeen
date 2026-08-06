'use client';

import type { AccountPage, PageLocaleOverlay, PageValues } from '@clickeen/ck-contracts/pages';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterImageUpload } from './dieter-image-upload';
import { DieterTextarea } from './dieter-textarea';
import { DieterTextfield } from './dieter-textfield';

type PageDraftSource = Omit<AccountPage, 'pageId'>;
type TranslatableKey = 'title' | 'description' | 'socialTitle' | 'socialDescription';

function CharacterCount({ value }: { value: string }) {
  return <span className="body-xs roma-page-character-count">{value.length} characters. Search engines may truncate or rewrite the displayed result.</span>;
}

export function PageBuilderSeo({
  source,
  onSourceChange,
  locales,
  activeLocale,
  onActiveLocaleChange,
  overlays,
  onOverlaysChange,
  canTranslate,
  translating,
  onGenerateTranslations,
  onUploadSocialImage,
  onResolveSocialImage,
  onAssetUpsell,
}: {
  source: PageDraftSource;
  onSourceChange: (source: PageDraftSource) => void;
  locales: string[];
  activeLocale: string;
  onActiveLocaleChange: (locale: string) => void;
  overlays: Record<string, PageLocaleOverlay>;
  onOverlaysChange: (overlays: Record<string, PageLocaleOverlay>) => void;
  canTranslate: boolean;
  translating: boolean;
  onGenerateTranslations: () => Promise<void>;
  onUploadSocialImage: (file: File) => Promise<string>;
  onResolveSocialImage: (assetRef: string) => Promise<string>;
  onAssetUpsell: () => void;
}) {
  const base = activeLocale === source.baseLocale;
  const activeValues = base ? source.values : overlays[activeLocale]?.values ?? { title: '' };

  const setValue = (key: TranslatableKey, value: string) => {
    if (base) {
      const values: PageValues = { ...source.values, [key]: value };
      onSourceChange({ ...source, values });
      return;
    }
    onOverlaysChange({
      ...overlays,
      [activeLocale]: { values: { ...(overlays[activeLocale]?.values ?? { title: '' }), [key]: value } },
    });
  };

  const title = activeValues.title ?? '';
  const description = activeValues.description ?? '';
  const socialTitle = activeValues.socialTitle ?? '';
  const socialDescription = activeValues.socialDescription ?? '';

  return (
    <section className="roma-page-panel" aria-labelledby="page-seo-title">
      <div className="roma-page-panel__header">
        <h2 id="page-seo-title" className="heading-4">SEO/GEO/AEO</h2>
        <div className="roma-page-panel__actions">
          <DieterDropdownActions value={activeLocale} options={locales.map((locale) => ({ value: locale, label: locale === source.baseLocale ? `Base · ${locale}` : locale }))} ariaLabel="Metadata language" size="sm" onChange={onActiveLocaleChange} />
          {canTranslate ? <button className="diet-btn-txt" data-size="sm" data-variant="secondary" type="button" disabled={translating} onClick={() => void onGenerateTranslations()}><span className="diet-btn-txt__label body-s">{translating ? 'Generating…' : 'Generate translations'}</span></button> : null}
        </div>
      </div>
      <details className="roma-page-section" open>
        <summary className="label-s">SEO</summary>
        <div className="roma-page-section__body">
          <div><DieterTextfield label="Page title" value={title} onChange={(event) => setValue('title', event.target.value)} /><CharacterCount value={title} /></div>
          <div><DieterTextarea label="Meta description" value={description} placeholder="Optional description" onChange={(value) => setValue('description', value)} /><CharacterCount value={description} /></div>
          {base ? <DieterDropdownActions label="Search visibility" value={source.robots} options={[{ value: 'index-follow', label: 'Index this page' }, { value: 'noindex-follow', label: 'Hide this page' }]} onChange={(robots) => onSourceChange({ ...source, robots: robots as PageDraftSource['robots'] })} /> : null}
        </div>
      </details>
      <details className="roma-page-section">
        <summary className="label-s">Sharing</summary>
        <div className="roma-page-section__body">
          <div><DieterTextfield label="Social title" placeholder="Uses Page title when empty" value={socialTitle} onChange={(event) => setValue('socialTitle', event.target.value)} /><CharacterCount value={socialTitle} /></div>
          <div><DieterTextarea label="Social description" value={socialDescription} placeholder="Uses Meta description when empty" onChange={(value) => setValue('socialDescription', value)} /><CharacterCount value={socialDescription} /></div>
          {base ? <DieterImageUpload value={source.values.socialImageAssetRef ?? ''} onChange={(assetRef) => onSourceChange({ ...source, values: { ...source.values, ...(assetRef ? { socialImageAssetRef: assetRef } : { socialImageAssetRef: undefined }) } })} onUpload={onUploadSocialImage} onResolve={onResolveSocialImage} onUpsell={onAssetUpsell} /> : null}
        </div>
      </details>
    </section>
  );
}
