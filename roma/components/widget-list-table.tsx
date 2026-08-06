'use client';

import type { CSSProperties } from 'react';
import { DieterTextfield } from './dieter-textfield';
import type { WidgetListController, WidgetSortKey } from './use-widget-list-controller';
import { DEFAULT_INSTANCE_DISPLAY_NAME, type WidgetInstance } from './use-roma-widgets';
import { WidgetRowActions } from './widget-row-actions';

function WidgetSortHeader({
  activeKey,
  ariaLabel,
  controller,
  label,
  sortKey,
}: {
  activeKey: WidgetSortKey;
  ariaLabel: string;
  controller: WidgetListController;
  label: string;
  sortKey: WidgetSortKey;
}) {
  const active = activeKey === sortKey;
  const icon = active
    ? controller.sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg'
    : 'arrow.up.arrow.down.svg';
  return (
    <th className="label-s" scope="col" aria-sort={active ? controller.sort.direction : 'none'}>
      <span>{label}</span>{' '}
      <button
        className="diet-btn-ic"
        data-size="xs"
        data-variant="neutral"
        type="button"
        aria-label={ariaLabel}
        onClick={() => controller.changeSort(sortKey)}
      >
        <span
          className="diet-btn-ic__icon diet-icon-mask"
          style={{ '--diet-icon-source': `url("/dieter/icons/svg/${icon}")` } as CSSProperties}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

function WidgetNameCell({ controller, instance }: { controller: WidgetListController; instance: WidgetInstance }) {
  const instanceName = instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
  const isSelected = controller.selectedInstanceId === instance.instanceId;
  const isRenaming = controller.renamingInstanceId === instance.instanceId;
  const renameActionKey = `rename:${instance.instanceId}`;
  return (
    <th className="body-s" scope="row">
      {isRenaming ? (
        <div className="roma-instance-rename">
          <DieterTextfield
            className="roma-instance-rename__input"
            type="text"
            aria-label="Instance name"
            value={controller.renameDraft}
            maxLength={120}
            onChange={(event) => controller.setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void controller.handleRenameInstance(instance);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                controller.cancelRename();
              }
            }}
            autoFocus
          />
          <div className="roma-instance-rename__actions">
            <button className="diet-btn-txt" data-size="md" data-variant="neutral" type="button" onClick={controller.cancelRename} disabled={Boolean(controller.activeActionKey)}>
              <span className="diet-btn-txt__label body-m">Cancel</span>
            </button>
            <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void controller.handleRenameInstance(instance)} disabled={Boolean(controller.activeActionKey)}>
              <span className="diet-btn-txt__label body-m">{controller.activeActionKey === renameActionKey ? 'Renaming...' : 'Rename'}</span>
            </button>
          </div>
        </div>
      ) : <>{instanceName}{isSelected ? ' (selected)' : ''}</>}
    </th>
  );
}

function WidgetStatusCell({ controller, instance }: { controller: WidgetListController; instance: WidgetInstance }) {
  const instanceName = instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
  const statusActionKey = `${instance.status === 'published' ? 'unpublished' : 'published'}:${instance.instanceId}`;
  const statusUpdating = controller.activeActionKey === statusActionKey;
  return (
    <td className="body-s">
      <div className="roma-widget-publish-actions">
        <label className="diet-toggle roma-widget-status-toggle" data-size="sm" aria-busy={statusUpdating || undefined}>
          <span className="diet-toggle__label sr-only">Published: {instanceName}{statusUpdating ? ', updating' : ''}</span>
          <input
            className="diet-toggle__input sr-only"
            type="checkbox"
            role="switch"
            checked={instance.status === 'published'}
            disabled={!controller.canMutateWidgets || Boolean(controller.activeActionKey)}
            onChange={(event) => void controller.handleStatusChange(instance, event.target.checked ? 'published' : 'unpublished')}
          />
          <span className="diet-toggle__switch" aria-hidden="true"><span className="diet-toggle__knob" /></span>
        </label>
        {instance.status === 'published' ? (
          <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => controller.openCopyCode(instance)}>
            <span className="diet-btn-txt__label body-s">Copy code</span>
          </button>
        ) : null}
      </div>
    </td>
  );
}

export function WidgetListTable({ controller }: { controller: WidgetListController }) {
  return (
    <div className="diet-table">
      <table className="diet-table__table">
        <caption className="sr-only">Your widgets</caption>
        <thead>
          <tr>
            <WidgetSortHeader activeKey={controller.sort.key} ariaLabel="Sort by widget" controller={controller} label="Widget" sortKey="widget" />
            <WidgetSortHeader activeKey={controller.sort.key} ariaLabel="Sort by instance name" controller={controller} label="Instance name" sortKey="name" />
            <WidgetSortHeader activeKey={controller.sort.key} ariaLabel="Sort by published status" controller={controller} label="Published" sortKey="status" />
            <th className="label-s" scope="col">Instance ID</th>
            <th className="label-s diet-table__cell--action" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {controller.displayedInstances.map((instance) => {
            const isSelected = controller.selectedInstanceId === instance.instanceId;
            const isRenaming = controller.renamingInstanceId === instance.instanceId;
            return (
              <tr key={instance.instanceId} data-selected={isSelected ? 'true' : undefined} aria-current={isSelected ? 'true' : undefined}>
                <td className="body-s">{instance.widget}</td>
                <WidgetNameCell controller={controller} instance={instance} />
                <WidgetStatusCell controller={controller} instance={instance} />
                <td className="body-s"><span className="body-xs roma-widget-instance-id">{instance.instanceId}</span></td>
                <td className="body-s diet-table__cell--action">
                  {controller.canMutateWidgets ? (
                    <WidgetRowActions
                      activeActionKey={controller.activeActionKey}
                      canSaveAsTemplate={controller.canSaveAsTemplate}
                      instance={instance}
                      isRenaming={isRenaming}
                      onDelete={(target) => void controller.handleDeleteInstance(target)}
                      onDuplicate={controller.handleDuplicateInstance}
                      onRename={controller.startRename}
                      onSaveAsTemplate={controller.openSaveAsTemplate}
                    />
                  ) : <span className="body-s">View only</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
