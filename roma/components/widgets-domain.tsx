'use client';

import { Suspense, useState } from 'react';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';
import { WidgetCatalog } from './widget-catalog';
import { WidgetList, type WidgetStatusFilter } from './widget-list';
import { WidgetTemplateList } from './widget-template-list';

export type WidgetsView = 'your-widgets' | 'templates' | 'catalog';

export function WidgetsPage({ view }: { view: WidgetsView }) {
  const [statusFilter, setStatusFilter] = useState<WidgetStatusFilter>('all');

  return (
    <RomaShell
      activeDomain={view === 'templates' ? 'widgetTemplates' : view === 'catalog' ? 'widgetCatalog' : 'widgets'}
      title="Widgets"
      headerControls={view === 'your-widgets' ? (
        <DieterDropdownActions
          className="roma-header-filter"
          ariaLabel="Filter your widgets by publish status"
          triggerStyle="button"
          value={statusFilter}
          options={[
            { value: 'all', label: 'Show all' },
            { value: 'published', label: 'Show published' },
            { value: 'unpublished', label: 'Show unpublished' },
          ]}
          onChange={(value) => setStatusFilter(value as WidgetStatusFilter)}
        />
      ) : null}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="rd-canvas-module" aria-label="Loading widgets" />}>
        <RomaDomainErrorBoundary domainLabel="Widgets" resetKey={`widgets:${view}`}>
          {view === 'your-widgets' ? (
            <WidgetList statusFilter={statusFilter} />
          ) : view === 'templates' ? (
            <WidgetTemplateList />
          ) : (
            <WidgetCatalog />
          )}
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}
