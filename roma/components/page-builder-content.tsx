'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { loadRomaWidgetsForAccount, type WidgetInstance } from './use-roma-widgets';
import type { PagePlacementDraft } from './page-builder-model';

export function PageBuilderContent({
  placements,
  selectedPlacementId,
  onSelect,
  onAdd,
  onChange,
  onEdit,
}: {
  placements: PagePlacementDraft[];
  selectedPlacementId: string;
  onSelect: (placementId: string) => void;
  onAdd: (instance: WidgetInstance) => Promise<void>;
  onChange: (placements: PagePlacementDraft[]) => void;
  onEdit: (instanceId: string) => void;
}) {
  const { accountContext } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const [addOpen, setAddOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderDraft, setOrderDraft] = useState<PagePlacementDraft[]>([]);
  const [instances, setInstances] = useState<WidgetInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'unpublished'>('all');
  const [sort, setSort] = useState<{ key: 'widget' | 'name' | 'published'; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  const placed = useMemo(() => new Set(placements.map((placement) => placement.instanceId)), [placements]);
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const orderDialogRef = useRef<HTMLDialogElement>(null);
  const addLifecycleRef = useRef<DialogLifecycle | null>(null);
  const orderLifecycleRef = useRef<DialogLifecycle | null>(null);
  const visibleInstances = useMemo(() => instances
    .filter((instance) => filter === 'all' || (filter === 'published') === (instance.status === 'published'))
    .sort((left, right) => {
      const compared = sort.key === 'widget'
        ? left.widgetType.localeCompare(right.widgetType)
        : sort.key === 'name'
          ? left.displayName.localeCompare(right.displayName)
          : Number(left.status === 'published') - Number(right.status === 'published');
      return compared * (sort.direction === 'ascending' ? 1 : -1);
    }), [filter, instances, sort]);

  const changeSort = (key: 'widget' | 'name' | 'published') => setSort((current) => current.key === key
    ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
    : { key, direction: 'ascending' });
  const sortIcon = (key: 'widget' | 'name' | 'published') => sort.key !== key
    ? 'arrow.up.arrow.down.svg'
    : sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg';

  useEffect(() => {
    if (!addOpen) return;
    setLoading(true);
    setError(null);
    loadRomaWidgetsForAccount({ accountId: accountContext.accountPublicId, fetchJson: accountApi.fetchJson })
      .then((response) => setInstances(response.instances))
      .catch(() => setError('Widgets could not be loaded. Please try again.'))
      .finally(() => setLoading(false));
  }, [accountApi.fetchJson, accountContext.accountPublicId, addOpen]);
  useEffect(() => {
    const addDialog = addDialogRef.current;
    const orderDialog = orderDialogRef.current;
    if (!addDialog || !orderDialog) return;
    const addLifecycle = createDialogLifecycle({ dialog: addDialog, initialFocus: () => addDialog.querySelector('button'), requestDismiss: () => setAddOpen(false) });
    const orderLifecycle = createDialogLifecycle({ dialog: orderDialog, initialFocus: () => orderDialog.querySelector('button'), requestDismiss: () => setOrderOpen(false) });
    addLifecycleRef.current = addLifecycle;
    orderLifecycleRef.current = orderLifecycle;
    return () => { addLifecycle.destroy(); orderLifecycle.destroy(); };
  }, []);
  useEffect(() => { if (addOpen) addLifecycleRef.current?.open(); else addLifecycleRef.current?.close(); }, [addOpen]);
  useEffect(() => { if (orderOpen) orderLifecycleRef.current?.open(); else orderLifecycleRef.current?.close(); }, [orderOpen]);

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderDraft.length) return;
    const next = [...orderDraft];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrderDraft(next);
  };

  return (
    <section className="roma-page-panel" aria-labelledby="page-content-title">
      <div className="roma-page-panel__header">
        <h2 id="page-content-title" className="heading-4">Content</h2>
        <div className="roma-page-panel__actions">
          <button className="diet-btn-txt" data-size="sm" data-variant="secondary" type="button" onClick={() => setAddOpen(true)}><span className="diet-btn-txt__label body-s">Add widget</span></button>
          {placements.length > 1 ? <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => { setOrderDraft([...placements]); setOrderOpen(true); }}><span className="diet-btn-txt__label body-s">Manage order</span></button> : null}
        </div>
      </div>
      <div className="roma-page-placement-list">
        {placements.map((placement) => (
          <div key={placement.placementId} className="roma-page-placement-row" aria-current={selectedPlacementId === placement.placementId ? 'true' : undefined}>
            <button className="roma-page-placement-row__select" type="button" onClick={() => onSelect(placement.placementId)}>
              <span className="body-s">{placement.displayName}</span>
              <span className="body-xs">{placement.unavailable ? 'Unavailable widget' : placement.widgetType}</span>
            </button>
            {placement.unavailable ? <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => onChange(placements.filter((entry) => entry.placementId !== placement.placementId))}><span className="diet-btn-txt__label body-s">Remove from page</span></button> : <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => onEdit(placement.instanceId)}><span className="diet-btn-txt__label body-s">Edit</span></button>}
          </div>
        ))}
        {!placements.length ? <div className="roma-page-panel__empty"><p className="body-m">This page has no widgets yet.</p><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => setAddOpen(true)}><span className="diet-btn-txt__label body-m">Add widget</span></button></div> : null}
      </div>

      <dialog ref={addDialogRef} className="diet-popup roma-page-widget-picker" data-size="large" aria-labelledby="add-widget-title">
        <header className="diet-popup__header"><h2 id="add-widget-title" className="heading-4">Add widget</h2></header>
        <div className="diet-popup__body">
          {error ? <p className="body-m" role="alert">{error}</p> : null}
          <DieterDropdownActions ariaLabel="Filter widgets by publish status" triggerStyle="button" value={filter} options={[{ value: 'all', label: 'Show all' }, { value: 'published', label: 'Show published' }, { value: 'unpublished', label: 'Show unpublished' }]} onChange={(value) => setFilter(value as typeof filter)} />
          <div className="diet-table"><table className="diet-table__table"><thead><tr>
            <th className="label-s" scope="col" aria-sort={sort.key === 'widget' ? sort.direction : 'none'}><span>Widget</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by widget" onClick={() => changeSort('widget')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('widget')}")` } as CSSProperties} aria-hidden="true" /></button></th>
            <th className="label-s" scope="col" aria-sort={sort.key === 'name' ? sort.direction : 'none'}><span>Instance name</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by instance name" onClick={() => changeSort('name')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('name')}")` } as CSSProperties} aria-hidden="true" /></button></th>
            <th className="label-s" scope="col" aria-sort={sort.key === 'published' ? sort.direction : 'none'}><span>Published</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by published status" onClick={() => changeSort('published')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('published')}")` } as CSSProperties} aria-hidden="true" /></button></th>
            <th className="label-s diet-table__cell--action" scope="col">Action</th>
          </tr></thead><tbody>{visibleInstances.map((instance) => <tr key={instance.instanceId}><td className="body-s">{instance.widgetType}</td><th className="body-s" scope="row">{instance.displayName}</th><td className="body-s">{instance.status === 'published' ? 'Published' : 'Unpublished'}</td><td className="diet-table__cell--action"><button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" disabled={loading || placed.has(instance.instanceId)} onClick={() => { setLoading(true); void onAdd(instance).then(() => setAddOpen(false)).catch(() => setError('This widget could not be added. Please try again.')).finally(() => setLoading(false)); }}><span className="diet-btn-txt__label body-s">{placed.has(instance.instanceId) ? 'On page' : 'Add to page'}</span></button></td></tr>)}</tbody></table></div>
          {loading && !instances.length ? <p className="body-m">Loading widgets…</p> : null}
          {!loading && instances.length > 0 && visibleInstances.length === 0 ? <p className="body-m">No widgets match this filter.</p> : null}
          {!loading && instances.length === 0 && !error ? <p className="body-m">You do not have any saved widgets yet.</p> : null}
        </div>
        <footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setAddOpen(false)}><span className="diet-btn-txt__label body-m">Close</span></button></div></footer>
      </dialog>

      <dialog ref={orderDialogRef} className="diet-popup" data-size="medium" aria-labelledby="manage-order-title">
        <header className="diet-popup__header"><h2 id="manage-order-title" className="heading-4">Manage order</h2></header>
        <div className="diet-popup__body"><div className="diet-object-manager__modal-list">{orderDraft.map((placement, index) => <div className="diet-object-manager__modal-row" key={placement.placementId}><span className="diet-object-manager__modal-label label-m">{placement.displayName}</span><div className="diet-object-manager__modal-controls"><button className="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" aria-label={`Move ${placement.displayName} up`} disabled={index === 0} onClick={() => move(index, -1)}><span className="diet-btn-ic__icon" data-icon="chevron.up" /></button><button className="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" aria-label={`Move ${placement.displayName} down`} disabled={index === orderDraft.length - 1} onClick={() => move(index, 1)}><span className="diet-btn-ic__icon" data-icon="chevron.down" /></button><button className="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" aria-label={`Remove ${placement.displayName}`} onClick={() => setOrderDraft((current) => current.filter((entry) => entry.placementId !== placement.placementId))}><span className="diet-btn-ic__icon" data-icon="trash" /></button></div></div>)}</div></div>
        <footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setOrderOpen(false)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => { onChange(orderDraft); setOrderOpen(false); }}><span className="diet-btn-txt__label body-m">Save</span></button></div></footer>
      </dialog>
    </section>
  );
}
