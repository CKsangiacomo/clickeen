'use client';

import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import { parseAccountAssetRef } from '@clickeen/ck-contracts';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRomaAccountApi } from './account-api';
import { resolveTokyoBaseUrl } from '../lib/env/tokyo';
import { DieterTextfield } from './dieter-textfield';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaAccountContext } from './roma-account-context';

type PageCatalogCard = {
  pageId: string;
  displayName: string;
  catalogPresentation: CatalogPresentation;
};

function readCatalog(raw: unknown): PageCatalogCard[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const templates = (raw as { templates?: unknown }).templates;
  if (!Array.isArray(templates)) throw new Error('coreui.errors.payload.invalid');
  return templates.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('coreui.errors.payload.invalid');
    const value = entry as Record<string, unknown>;
    const pageId = typeof value.pageId === 'string' ? value.pageId : '';
    const displayName = typeof value.displayName === 'string' ? value.displayName : '';
    const catalogPresentation = parseCatalogPresentation(value.catalogPresentation);
    const thumbnail = catalogPresentation ? parseAccountAssetRef(catalogPresentation.thumbnailAssetRef) : null;
    if (
      !pageId || pageId !== pageId.trim() ||
      !displayName || displayName !== displayName.trim() ||
      !catalogPresentation || thumbnail?.accountId !== 'CLICKEEN'
    ) throw new Error('coreui.errors.payload.invalid');
    return { pageId, displayName, catalogPresentation };
  });
}

export function PageCatalog() {
  const router = useRouter();
  const accountApi = useRomaAccountApi();
  const { fetchJson } = accountApi;
  const { accountPolicy } = useRomaAccountContext();
  const canUsePages = accountPolicy.limits['pages.max'] !== 0;
  const canMutatePages = accountPolicy.role !== 'viewer';
  const [templates, setTemplates] = useState<PageCatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [upsellOpen, setUpsellOpen] = useState(false);
  const tokyoBaseUrl = useMemo(() => resolveTokyoBaseUrl(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(readCatalog(await fetchJson('/api/account/page-catalog')));
    } catch {
      setError('Page Catalog could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => { void load(); }, [load]);
  const categories = useMemo(() => Array.from(new Set(templates.map((template) => template.catalogPresentation.category))).sort((left, right) => left.localeCompare(right)), [templates]);
  const visibleTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return templates
      .filter((template) => !category || template.catalogPresentation.category === category)
      .filter((template) => !query || template.displayName.toLocaleLowerCase().includes(query) || template.catalogPresentation.description.toLocaleLowerCase().includes(query))
      .slice()
      .sort((left, right) => left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder || left.displayName.localeCompare(right.displayName) || left.pageId.localeCompare(right.pageId));
  }, [category, search, templates]);

  const openTemplateDraft = (pageId: string) => {
    if (!canMutatePages) return;
    if (!canUsePages) setUpsellOpen(true);
    else router.push(`/page-builder/new?catalog=${encodeURIComponent(pageId)}`);
  };

  return (
    <>
      {error ? <section className="rd-canvas-module" role="alert"><p className="body-m">{error}</p></section> : null}
      <div className="roma-page-catalog">
        <aside className="roma-page-catalog__menu" aria-label="Page Catalog categories">
          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" aria-current={!category ? 'page' : undefined} onClick={() => setCategory('')}><span className="diet-btn-menuactions__label body-s">Catalog Home</span></button>
          {categories.map((value) => <button key={value} className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" aria-current={category === value ? 'page' : undefined} onClick={() => setCategory(value)}><span className="diet-btn-menuactions__label body-s">{value}</span></button>)}
        </aside>
        <section className="roma-page-catalog__content">
          <DieterTextfield label="Search Page Catalog" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="roma-grid roma-grid--three">
            {visibleTemplates.map((template) => (
              <article className="roma-card roma-page-catalog__card" key={template.pageId}>
                <Image
                  src={new URL(template.catalogPresentation.thumbnailAssetRef, `${tokyoBaseUrl}/`).toString()}
                  alt=""
                  width={640}
                  height={360}
                  unoptimized
                />
                <p className="body-xs">{template.catalogPresentation.category}</p>
                <h2 className="heading-5">{template.displayName}</h2>
                <p className="body-s">{template.catalogPresentation.description}</p>
                <div className="rd-canvas-module__actions">
                  {canMutatePages ? <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => openTemplateDraft(template.pageId)}><span className="diet-btn-txt__label body-m">Use template</span></button> : null}
                </div>
              </article>
            ))}
          </div>
          {loading ? <p className="body-m roma-pages-state">Loading Page Catalog…</p> : null}
          {!loading && visibleTemplates.length === 0 ? <p className="body-m roma-pages-state">No Page templates match this view.</p> : null}
        </section>
      </div>
      <RomaUpsellDialog open={upsellOpen} reason="Upgrade to create and edit Pages." onClose={() => setUpsellOpen(false)} />
    </>
  );
}
