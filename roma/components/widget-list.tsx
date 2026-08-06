'use client';

import Link from 'next/link';
import { WidgetListDialogs } from './widget-list-dialogs';
import { WidgetListTable } from './widget-list-table';
import { useWidgetListController, type WidgetStatusFilter } from './use-widget-list-controller';

export type { WidgetStatusFilter } from './use-widget-list-controller';

export function WidgetList({ statusFilter }: { statusFilter: WidgetStatusFilter }) {
  const controller = useWidgetListController(statusFilter);
  const hasErrors = Boolean(controller.widgetDataError || controller.mutationError || controller.renameError);
  return (
    <>
      {hasErrors || (controller.domainLoading && controller.widgetInstances.length === 0) ? (
        <section className="rd-canvas-module" role={hasErrors ? 'alert' : 'status'}>
          {controller.widgetDataError ? (
            <div className="roma-inline-stack">
              <p className="body-m">{controller.widgetDataError}</p>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="line2"
                type="button"
                onClick={() => void controller.refreshWidgets({ force: true })}
                disabled={controller.domainLoading || controller.domainRefreshing}
              >
                <span className="diet-btn-txt__label body-m">Retry</span>
              </button>
            </div>
          ) : null}
          {controller.mutationError ? <p className="body-m">{controller.mutationError}</p> : null}
          {controller.renameError ? <p className="body-m">{controller.renameError}</p> : null}
          {controller.domainLoading && controller.widgetInstances.length === 0 && !controller.widgetDataError
            ? <p className="body-m">Loading widgets...</p>
            : null}
        </section>
      ) : null}

      {!controller.domainLoading && controller.canRenderWidgetData && controller.widgetInstances.length === 0 ? (
        <section className="rd-canvas-module">
          <p className="body-m">No widgets yet.</p>
          {controller.canMutateWidgets ? (
            <div className="rd-canvas-module__actions">
              <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/widgets/catalog">
                <span className="diet-btn-txt__label body-m">Browse widget catalog</span>
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {!controller.domainLoading &&
      controller.canRenderWidgetData &&
      statusFilter !== 'all' &&
      controller.widgetInstances.length > 0 &&
      controller.displayedInstances.length === 0 ? (
        <section className="rd-canvas-module"><p className="body-m">No {statusFilter} widgets.</p></section>
      ) : null}

      {controller.displayedInstances.length > 0 && controller.canRenderWidgetData
        ? <WidgetListTable controller={controller} />
        : null}
      <WidgetListDialogs controller={controller} />
    </>
  );
}
