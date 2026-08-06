'use client';

import { Suspense, useState } from 'react';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { PageList } from './page-list';
import { PageCatalog } from './page-catalog';
import { PageTemplatesList } from './page-templates-list';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';

export type PageListFilter = 'all' | 'published' | 'unpublished' | 'needs-update';
export type PagesView = 'your-pages' | 'templates' | 'catalog';

export function PagesDomain({ view = 'your-pages' }: { view?: PagesView }) {
  const [filter, setFilter] = useState<PageListFilter>('all');
  return (
    <RomaShell
      activeDomain={view === 'templates' ? 'pageTemplates' : view === 'catalog' ? 'pageCatalog' : 'pages'}
      title="Pages"
      headerControls={view === 'your-pages' ? (
        <DieterDropdownActions
          className="roma-header-filter"
          ariaLabel="Filter pages"
          triggerStyle="button"
          value={filter}
          options={[
            { value: 'all', label: 'Show all' },
            { value: 'published', label: 'Published' },
            { value: 'unpublished', label: 'Unpublished' },
            { value: 'needs-update', label: 'Needs update' },
          ]}
          onChange={(value) => setFilter(value as PageListFilter)}
        />
      ) : null}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="rd-canvas-module" aria-label="Loading pages" />}>
        <RomaDomainErrorBoundary domainLabel="Pages" resetKey="pages">
          {view === 'your-pages' ? <PageList filter={filter} /> : view === 'templates' ? <PageTemplatesList /> : <PageCatalog />}
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}
