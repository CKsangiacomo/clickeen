'use client';

import { Suspense, useState } from 'react';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { PageList } from './page-list';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';

export type PageListFilter = 'all' | 'published' | 'unpublished' | 'needs-update';

export function PagesDomain() {
  const [filter, setFilter] = useState<PageListFilter>('all');
  return (
    <RomaShell
      activeDomain="pages"
      title="Pages"
      headerControls={(
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
      )}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="rd-canvas-module" aria-label="Loading pages" />}>
        <RomaDomainErrorBoundary domainLabel="Pages" resetKey="pages">
          <PageList filter={filter} />
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}
