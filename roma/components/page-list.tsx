'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { buildPagePublicActions, type PublicActions } from '../lib/public-actions';
import { useRomaAccountApi } from './account-api';
import type { PageListFilter } from './pages-domain';
import { PublicCodeDialog } from './public-code-dialog';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaAccountContext } from './roma-account-context';
import { clearRomaPagesCache, loadRomaPages, type RomaPageInventoryItem } from './use-roma-pages';

type SortKey = 'name' | 'published' | 'status';
type Sort = { key: SortKey; direction: 'ascending' | 'descending' };

function comparePage(left: RomaPageInventoryItem, right: RomaPageInventoryItem, key: SortKey): number {
  if (key === 'name') return left.source.displayName.localeCompare(right.source.displayName);
  if (key === 'published') return Number(left.serveState.published) - Number(right.serveState.published);
  return Number(left.serveState.needsUpdate) - Number(right.serveState.needsUpdate);
}

export function PageList({ filter }: { filter: PageListFilter }) {
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const { fetchJson } = accountApi;
  const [pages, setPages] = useState<RomaPageInventoryItem[]>([]);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 'ascending' });
  const [menuPageId, setMenuPageId] = useState('');
  const [renamePage, setRenamePage] = useState<RomaPageInventoryItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletePage, setDeletePage] = useState<RomaPageInventoryItem | null>(null);
  const [saveTemplatePage, setSaveTemplatePage] = useState<RomaPageInventoryItem | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [createdTemplate, setCreatedTemplate] = useState<{ templateId: string; templateName: string } | null>(null);
  const [publicContext, setPublicContext] = useState<{ name: string; actions: PublicActions } | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const saveTemplateDialogRef = useRef<HTMLDialogElement>(null);
  const renameLifecycleRef = useRef<DialogLifecycle | null>(null);
  const deleteLifecycleRef = useRef<DialogLifecycle | null>(null);
  const canUsePages = accountPolicy.limits['pages.max'] !== 0;
  const canMutatePages = accountPolicy.role !== 'viewer';
  const pageLimit = accountPolicy.limits['pages.max'];
  const hasTemplateCapacity = accountContext.accountPublicId !== 'CLICKEEN' && templateCount !== null && (
    pageLimit === null ||
    (typeof pageLimit === 'number' && pages.length + templateCount < pageLimit)
  );

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loadRomaPages({ accountId: accountContext.accountPublicId, fetchJson, force });
      setPages(response.pages);
    } catch {
      setError('Pages could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountContext.accountPublicId, fetchJson]);

  const reloadTemplateCount = useCallback(async () => {
    try {
      const payload = await fetchJson('/api/account/page-templates');
      setTemplateCount(payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray((payload as { templates?: unknown }).templates)
        ? (payload as { templates: unknown[] }).templates.length
        : null);
    } catch {
      setTemplateCount(null);
    }
  }, [fetchJson]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void reloadTemplateCount(); }, [reloadTemplateCount]);
  useEffect(() => {
    if (!menuPageId) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuPageId('');
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [menuPageId]);
  useEffect(() => {
    const renameDialog = renameDialogRef.current;
    const deleteDialog = deleteDialogRef.current;
    if (!renameDialog || !deleteDialog) return;
    const renameLifecycle = createDialogLifecycle({ dialog: renameDialog, initialFocus: () => renameDialog.querySelector('button'), requestDismiss: () => setRenamePage(null) });
    const deleteLifecycle = createDialogLifecycle({ dialog: deleteDialog, initialFocus: () => deleteDialog.querySelector('button'), requestDismiss: () => setDeletePage(null) });
    renameLifecycleRef.current = renameLifecycle;
    deleteLifecycleRef.current = deleteLifecycle;
    return () => { renameLifecycle.destroy(); deleteLifecycle.destroy(); };
  }, []);
  useEffect(() => { if (renamePage) renameLifecycleRef.current?.open(); else renameLifecycleRef.current?.close(); }, [renamePage]);
  useEffect(() => { if (deletePage) deleteLifecycleRef.current?.open(); else deleteLifecycleRef.current?.close(); }, [deletePage]);
  useEffect(() => {
    const dialog = saveTemplateDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: 'input', requestDismiss: () => setSaveTemplatePage(null) });
    if (saveTemplatePage) lifecycle.open();
    return () => lifecycle.destroy();
  }, [saveTemplatePage]);

  const visiblePages = useMemo(() => pages
    .filter((page) => filter === 'all'
      || (filter === 'published' && page.serveState.published)
      || (filter === 'unpublished' && !page.serveState.published)
      || (filter === 'needs-update' && page.serveState.needsUpdate))
    .sort((left, right) => comparePage(left, right, sort.key) * (sort.direction === 'ascending' ? 1 : -1)), [filter, pages, sort]);

  const changeSort = (key: SortKey) => setSort((current) => current.key === key
    ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
    : { key, direction: 'ascending' });
  const sortIcon = (key: SortKey) => sort.key !== key
    ? 'arrow.up.arrow.down.svg'
    : sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg';

  const mutate = useCallback(async (key: string, run: () => Promise<unknown>) => {
    setActiveAction(key);
    setError(null);
    try {
      await run();
      clearRomaPagesCache(accountContext.accountPublicId);
      await Promise.all([reload(true), reloadTemplateCount()]);
    } catch {
      setError('The Page could not be updated. Please try again.');
    } finally {
      setActiveAction('');
    }
  }, [accountContext.accountPublicId, reload, reloadTemplateCount]);

  const saveAsTemplate = useCallback(async () => {
    const page = saveTemplatePage;
    const name = templateName.trim();
    if (!page || !name || name === page.source.displayName.trim() || !hasTemplateCapacity) return;
    setActiveAction(`template:${page.source.pageId}`);
    setError(null);
    try {
      const payload = await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(page.source.pageId)}/save-as-template`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateName: name }),
      });
      const record = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as { templateId?: unknown; templateName?: unknown }
        : null;
      const templateId = typeof record?.templateId === 'string' ? record.templateId.trim() : '';
      const savedName = typeof record?.templateName === 'string' ? record.templateName.trim() : '';
      if (!templateId || !savedName) throw new Error('coreui.errors.payload.invalid');
      setCreatedTemplate({ templateId, templateName: savedName });
      clearRomaPagesCache(accountContext.accountPublicId);
      await Promise.all([reload(true), reloadTemplateCount()]);
    } catch {
      setError('The Page template could not be created. Please try again.');
    } finally {
      setActiveAction('');
    }
  }, [accountApi, accountContext.accountPublicId, hasTemplateCapacity, reload, reloadTemplateCount, saveTemplatePage, templateName]);

  return (
    <>
      <div className="roma-pages-toolbar">
        <span className="body-s roma-toolbar-count">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
        {canMutatePages ? <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => {
          if (!canUsePages) setUpsellOpen(true);
          else window.location.assign('/page-builder/new');
        }}>
          <span className="diet-btn-txt__label body-m">Create page</span>
        </button> : null}
      </div>
      {error ? <section className="rd-canvas-module" role="alert"><p className="body-m">{error}</p></section> : null}
      <div className="diet-table roma-pages-table">
        <table className="diet-table__table">
          <thead>
            <tr>
              <th className="label-s" scope="col" aria-sort={sort.key === 'name' ? sort.direction : 'none'}><span>Page</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by page" onClick={() => changeSort('name')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('name')}")` } as CSSProperties} aria-hidden="true" /></button></th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'published' ? sort.direction : 'none'}><span>Published</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by published status" onClick={() => changeSort('published')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('published')}")` } as CSSProperties} aria-hidden="true" /></button></th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'status' ? sort.direction : 'none'}><span>Status</span>{' '}<button className="diet-btn-ic" data-size="xs" data-variant="neutral" type="button" aria-label="Sort by page status" onClick={() => changeSort('status')}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': `url("/dieter/icons/svg/${sortIcon('status')}")` } as CSSProperties} aria-hidden="true" /></button></th>
              <th className="label-s" scope="col">Languages</th>
              <th className="label-s" scope="col">Page ID</th>
              <th className="label-s diet-table__cell--action" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visiblePages.map((page) => {
              const id = page.source.pageId;
              const statusKey = `${page.serveState.published ? 'unpublish' : 'publish'}:${id}`;
              const actions = page.serveState.published ? buildPagePublicActions({ accountPublicId: accountContext.accountPublicId, pageId: id }) : null;
              return (
                <tr key={id}>
                  <th className="body-s" scope="row">{page.source.displayName}</th>
                  <td>
                    <label className="diet-toggle roma-widget-status-toggle" data-size="sm">
                      <input type="checkbox" checked={page.serveState.published} disabled={!canMutatePages || Boolean(activeAction) || (!page.serveState.published && page.serveState.needsUpdate)} onChange={() => { if (!canUsePages) { setUpsellOpen(true); return; } void mutate(statusKey, () => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}/${page.serveState.published ? 'unpublish' : 'publish'}`, { method: 'POST' })); }} />
                      <span className="diet-toggle__track" aria-hidden="true"><span className="diet-toggle__thumb" /></span>
                    </label>
                  </td>
                  <td className="body-s">{page.serveState.needsUpdate ? 'Needs update' : 'Current'}</td>
                  <td className="body-s">{page.savedLocales.join(', ') || page.source.baseLocale}</td>
                  <td className="body-xs roma-widget-instance-id">{id}</td>
                  <td className="diet-table__cell--action">
                    <div className="roma-cell-actions">
                      {actions ? <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => setPublicContext({ name: page.source.displayName, actions })}><span className="diet-btn-txt__label body-s">Copy code</span></button> : null}
                      {canMutatePages ? (canUsePages ? <Link className="diet-btn-txt" data-size="sm" data-variant="line2" href={`/page-builder/${encodeURIComponent(id)}`}><span className="diet-btn-txt__label body-s">{page.serveState.needsUpdate ? 'Update page' : 'Edit'}</span></Link> : <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => setUpsellOpen(true)}><span className="diet-btn-txt__label body-s">Edit</span></button>) : null}
                      {canMutatePages ? <div className="diet-popover-host" ref={menuPageId === id ? menuRef : undefined} data-state={menuPageId === id ? 'open' : 'closed'}>
                        <button className="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" aria-label={`More actions for ${page.source.displayName}`} aria-expanded={menuPageId === id} onClick={() => setMenuPageId((current) => current === id ? '' : id)}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': 'url("/dieter/icons/svg/ellipsis.svg")' } as CSSProperties} aria-hidden="true" /></button>
                        <div className="diet-popover roma-page-actions-popover" role="menu">
                          <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuPageId(''); if (!canUsePages) { setUpsellOpen(true); return; } setRenamePage(page); setRenameValue(page.source.displayName); }}><span className="diet-btn-menuactions__label body-s">Rename</span></button>
                          {hasTemplateCapacity ? <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuPageId(''); setTemplateName(''); setCreatedTemplate(null); setSaveTemplatePage(page); }}><span className="diet-btn-menuactions__label body-s">Save as template</span></button> : null}
                          {!page.serveState.published ? <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuPageId(''); if (!canUsePages) { setUpsellOpen(true); return; } setDeletePage(page); }}><span className="diet-btn-menuactions__label body-s">Delete</span></button> : null}
                        </div>
                      </div> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading ? <p className="body-m roma-pages-state">Loading pages…</p> : null}
        {!loading && visiblePages.length === 0 ? <p className="body-m roma-pages-state">{pages.length ? 'No pages match this filter.' : 'Create your first page.'}</p> : null}
      </div>

      <dialog ref={renameDialogRef} className="diet-popup" data-size="medium" aria-label="Rename page">
        <header className="diet-popup__header"><h2 className="heading-4">Rename page</h2></header>
        <div className="diet-popup__body"><label className="roma-field"><span className="label-s">Page name</span><input className="diet-textfield__field body-s" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label></div>
        <footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setRenamePage(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={!renameValue.trim() || Boolean(activeAction)} onClick={() => { const page = renamePage; if (!page) return; void mutate(`rename:${page.source.pageId}`, () => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(page.source.pageId)}/rename`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: renameValue }) })).then(() => setRenamePage(null)); }}><span className="diet-btn-txt__label body-m">Rename</span></button></div></footer>
      </dialog>
      <dialog ref={deleteDialogRef} className="diet-popup" data-size="medium" aria-label="Delete page">
        <header className="diet-popup__header"><h2 className="heading-4">Delete page?</h2></header>
        <div className="diet-popup__body"><p className="body-m">This permanently deletes the saved Page.</p></div>
        <footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setDeletePage(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={Boolean(activeAction)} onClick={() => { const page = deletePage; if (!page) return; void mutate(`delete:${page.source.pageId}`, () => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(page.source.pageId)}`, { method: 'DELETE' })).then(() => setDeletePage(null)); }}><span className="diet-btn-txt__label body-m">Delete</span></button></div></footer>
      </dialog>
      <dialog ref={saveTemplateDialogRef} className="diet-popup" data-size="medium" aria-label="Save Page as template">
        <header className="diet-popup__header"><h2 className="heading-4">Save as template</h2></header>
        <div className="diet-popup__body">{createdTemplate ? <p className="body-m">{createdTemplate.templateName} was saved as a template.</p> : <><label className="roma-field"><span className="label-s">Template name</span><input className="diet-textfield__field body-s" value={templateName} maxLength={120} onChange={(event) => setTemplateName(event.target.value)} /></label><p className="body-s">Your current changes will be saved first.</p></>}</div>
        <footer className="diet-popup__footer"><div className="diet-popup__actions">{createdTemplate ? <><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => { setSaveTemplatePage(null); setCreatedTemplate(null); }}><span className="diet-btn-txt__label body-m">Stay here</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => window.location.assign(`/page-builder/${encodeURIComponent(createdTemplate.templateId)}`)}><span className="diet-btn-txt__label body-m">Open template</span></button></> : <><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={Boolean(activeAction)} onClick={() => setSaveTemplatePage(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={Boolean(activeAction) || !templateName.trim() || templateName.trim() === saveTemplatePage?.source.displayName.trim()} onClick={() => void saveAsTemplate()}><span className="diet-btn-txt__label body-m">Save as template</span></button></>}</div></footer>
      </dialog>
      <PublicCodeDialog open={Boolean(publicContext)} productName={publicContext?.name ?? ''} actions={publicContext?.actions ?? null} onClose={() => setPublicContext(null)} />
      <RomaUpsellDialog open={upsellOpen} reason="Upgrade to create and edit Pages." onClose={() => setUpsellOpen(false)} />
    </>
  );
}
