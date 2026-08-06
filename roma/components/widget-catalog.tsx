'use client';

import { parseAccountAssetRef } from '@clickeen/ck-contracts';
import { parseCatalogPresentation, type CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveTokyoBaseUrl } from '../lib/env/tokyo';
import { buildWidgetTemplateDraftRoute } from '../lib/widget-template-draft';
import { useRomaAccountApi } from './account-api';
import { DieterTextfield } from './dieter-textfield';
import { useRomaAccountContext } from './roma-account-context';

export type RomaWidgetCatalogCard = {
  templateId: string;
  templateName: string;
  widgetType: string;
  updatedAt: string;
  catalogPresentation: CatalogPresentation;
  thumbnailUrl: string;
};

export function normalizeRomaWidgetCatalogResponse(raw: unknown, tokyoBaseUrl: string): RomaWidgetCatalogCard[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const templates = (raw as { templates?: unknown }).templates;
  if (!Array.isArray(templates)) return null;
  const parsed = templates.map((entry): RomaWidgetCatalogCard | null => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const value = entry as Record<string, unknown>;
    const templateId = typeof value.templateId === 'string' ? value.templateId.trim() : '';
    const templateName = typeof value.templateName === 'string' ? value.templateName.trim() : '';
    const widgetType = typeof value.widgetType === 'string' ? value.widgetType.trim() : '';
    const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt.trim() : '';
    const catalogPresentation = parseCatalogPresentation(value.catalogPresentation);
    const thumbnail = catalogPresentation ? parseAccountAssetRef(catalogPresentation.thumbnailAssetRef) : null;
    if (
      !templateId ||
      !templateName ||
      !widgetType ||
      !updatedAt ||
      !catalogPresentation ||
      thumbnail?.accountId !== 'CLICKEEN'
    ) return null;
    return {
      templateId,
      templateName,
      widgetType,
      updatedAt,
      catalogPresentation,
      thumbnailUrl: new URL(catalogPresentation.thumbnailAssetRef, `${tokyoBaseUrl}/`).toString(),
    };
  });
  return parsed.some((template) => !template) ? null : parsed as RomaWidgetCatalogCard[];
}

export function WidgetCatalog() {
  const accountApi = useRomaAccountApi();
  const { fetchJson } = accountApi;
  const { accountPolicy } = useRomaAccountContext();
  const canUseTemplates = accountPolicy.role !== 'viewer';
  const [templates, setTemplates] = useState<RomaWidgetCatalogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const tokyoBaseUrl = useMemo(() => resolveTokyoBaseUrl(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizeRomaWidgetCatalogResponse(
        await fetchJson('/api/account/widget-catalog'),
        tokyoBaseUrl,
      );
      if (!normalized) throw new Error('coreui.errors.payload.invalid');
      setTemplates(normalized);
    } catch {
      setTemplates([]);
      setError('Widget Catalog could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson, tokyoBaseUrl]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const ordered = templates.slice().sort((left, right) =>
      left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder ||
      left.catalogPresentation.category.localeCompare(right.catalogPresentation.category),
    );
    return Array.from(new Set(ordered.map((template) => template.catalogPresentation.category)));
  }, [templates]);

  useEffect(() => {
    if (category && !categories.includes(category)) setCategory('');
  }, [categories, category]);

  const visibleTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return templates
      .filter((template) => !category || template.catalogPresentation.category === category)
      .filter((template) =>
        !query ||
        template.templateName.toLocaleLowerCase().includes(query) ||
        template.catalogPresentation.description.toLocaleLowerCase().includes(query)
      )
      .slice()
      .sort((left, right) =>
        left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder ||
        left.templateName.localeCompare(right.templateName) ||
        left.templateId.localeCompare(right.templateId),
      );
  }, [category, search, templates]);

  return (
    <>
      {error ? (
        <section className="rd-canvas-module" role="alert">
          <div className="roma-inline-stack">
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void load()} disabled={loading}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        </section>
      ) : null}
      <div className="roma-widget-catalog">
        <aside className="roma-widget-catalog__menu" aria-label="Widget Catalog categories">
          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" aria-current={!category ? 'page' : undefined} onClick={() => setCategory('')}>
            <span className="diet-btn-menuactions__label body-s">Catalog Home</span>
          </button>
          {categories.map((value) => (
            <button key={value} className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" aria-current={category === value ? 'page' : undefined} onClick={() => setCategory(value)}>
              <span className="diet-btn-menuactions__label body-s">{value}</span>
            </button>
          ))}
        </aside>
        <section className="roma-widget-catalog__content">
          <DieterTextfield label="Search Widget Catalog" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="roma-grid roma-grid--three roma-widget-catalog__cards">
            {visibleTemplates.map((template) => (
              <article className="roma-card roma-widget-catalog__card" key={template.templateId}>
                <Image
                  className="roma-widget-catalog__thumbnail"
                  src={template.thumbnailUrl}
                  alt=""
                  width={640}
                  height={360}
                  unoptimized
                />
                <p className="body-xs">{template.catalogPresentation.category}</p>
                <h2 className="heading-5">{template.templateName}</h2>
                <p className="body-s">{template.catalogPresentation.description}</p>
                {canUseTemplates ? (
                  <div className="rd-canvas-module__actions">
                    <Link
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="primary"
                      href={buildWidgetTemplateDraftRoute({ kind: 'catalog-template', templateId: template.templateId })}
                    >
                      <span className="diet-btn-txt__label body-m">Use template</span>
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {loading ? <p className="body-m roma-pages-state">Loading Widget Catalog…</p> : null}
          {!loading && !error && visibleTemplates.length === 0 ? <p className="body-m roma-pages-state">No Widget templates match this view.</p> : null}
        </section>
      </div>
    </>
  );
}
