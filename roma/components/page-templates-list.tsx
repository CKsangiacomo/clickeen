'use client';

import { parseAccountPageSource } from '../lib/account-page-contract';
import type { AccountPageTemplate } from '@clickeen/ck-contracts/pages';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { useRomaAccountApi } from './account-api';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaAccountContext } from './roma-account-context';

function readTemplates(raw: unknown): AccountPageTemplate[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const templates = (raw as { templates?: unknown }).templates;
  if (!Array.isArray(templates)) throw new Error('coreui.errors.payload.invalid');
  const parsed = templates.map((entry) => parseAccountPageSource(entry));
  if (parsed.some((entry) => !entry?.isTemplate)) throw new Error('coreui.errors.payload.invalid');
  return parsed as AccountPageTemplate[];
}

export function PageTemplatesList() {
  const router = useRouter();
  const accountApi = useRomaAccountApi();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const canUsePages = accountPolicy.limits['pages.max'] !== 0;
  const canMutatePages = accountPolicy.role !== 'viewer' && accountContext.accountPublicId !== 'CLICKEEN';
  const [templates, setTemplates] = useState<AccountPageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState('');
  const [renameTemplate, setRenameTemplate] = useState<AccountPageTemplate | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTemplate, setDeleteTemplate] = useState<AccountPageTemplate | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [menuTemplateId, setMenuTemplateId] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(readTemplates(await accountApi.fetchJson('/api/account/page-templates')));
    } catch {
      setError('Page templates could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountApi]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!menuTemplateId) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuTemplateId('');
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [menuTemplateId]);
  useEffect(() => {
    const renameDialog = renameDialogRef.current;
    const deleteDialog = deleteDialogRef.current;
    if (!renameDialog || !deleteDialog) return;
    const renameLifecycle = createDialogLifecycle({ dialog: renameDialog, initialFocus: 'input', requestDismiss: () => setRenameTemplate(null) });
    const deleteLifecycle = createDialogLifecycle({ dialog: deleteDialog, initialFocus: 'button', requestDismiss: () => setDeleteTemplate(null) });
    if (renameTemplate) renameLifecycle.open();
    if (deleteTemplate) deleteLifecycle.open();
    return () => { renameLifecycle.destroy(); deleteLifecycle.destroy(); };
  }, [deleteTemplate, renameTemplate]);

  const mutate = useCallback(async (key: string, run: () => Promise<unknown>) => {
    setActiveAction(key);
    setError(null);
    try {
      await run();
      await reload();
    } catch {
      setError('The Page template could not be updated. Please try again.');
    } finally {
      setActiveAction('');
    }
  }, [reload]);

  const openDraft = (href: string) => {
    if (!canUsePages) setUpsellOpen(true);
    else router.push(href);
  };

  return (
    <>
      {error ? <section className="rd-canvas-module" role="alert"><p className="body-m">{error}</p></section> : null}
      <div className="diet-table roma-pages-table">
        <table className="diet-table__table">
          <thead><tr><th className="label-s" scope="col">Page template</th><th className="label-s" scope="col">Page ID</th><th className="label-s diet-table__cell--action" scope="col">Actions</th></tr></thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.pageId}>
                <th className="body-s" scope="row"><span>{template.displayName}</span>{' '}<span className="roma-template-badge body-xs">Template</span></th>
                <td className="body-xs roma-widget-instance-id">{template.pageId}</td>
                <td className="diet-table__cell--action"><div className="roma-cell-actions">
                  {canMutatePages ? <button className="diet-btn-txt" data-size="sm" data-variant="line2" type="button" onClick={() => openDraft(`/page-builder/${encodeURIComponent(template.pageId)}`)}><span className="diet-btn-txt__label body-s">Edit</span></button> : null}
                  {canMutatePages ? <div className="diet-popover-host" ref={menuTemplateId === template.pageId ? menuRef : undefined} data-state={menuTemplateId === template.pageId ? 'open' : 'closed'}>
                    <button className="diet-btn-ic" data-size="sm" data-variant="neutral" type="button" aria-label={`More actions for ${template.displayName}`} aria-expanded={menuTemplateId === template.pageId} onClick={() => setMenuTemplateId((current) => current === template.pageId ? '' : template.pageId)}><span className="diet-btn-ic__icon diet-icon-mask" style={{ '--diet-icon-source': 'url("/dieter/icons/svg/ellipsis.svg")' } as CSSProperties} aria-hidden="true" /></button>
                    <div className="diet-popover roma-page-actions-popover" role="menu">
                      <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuTemplateId(''); openDraft(`/page-builder/new?template=${encodeURIComponent(template.pageId)}`); }}><span className="diet-btn-menuactions__label body-s">Use template</span></button>
                      <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuTemplateId(''); if (!canUsePages) { setUpsellOpen(true); return; } setRenameValue(template.displayName); setRenameTemplate(template); }}><span className="diet-btn-menuactions__label body-s">Rename</span></button>
                      <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMenuTemplateId(''); if (!canUsePages) { setUpsellOpen(true); return; } setDeleteTemplate(template); }}><span className="diet-btn-menuactions__label body-s">Delete</span></button>
                    </div>
                  </div> : null}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="body-m roma-pages-state">Loading Page templates…</p> : null}
        {!loading && templates.length === 0 ? <p className="body-m roma-pages-state">No Page templates yet.</p> : null}
      </div>

      <dialog ref={renameDialogRef} className="diet-popup" data-size="medium" aria-label="Rename Page template"><header className="diet-popup__header"><h2 className="heading-4">Rename Page template</h2></header><div className="diet-popup__body"><label className="roma-field"><span className="label-s">Template name</span><input className="diet-textfield__field body-s" value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} /></label></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={Boolean(activeAction)} onClick={() => setRenameTemplate(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={!renameValue.trim() || Boolean(activeAction)} onClick={() => { const template = renameTemplate; if (!template) return; void mutate(`rename:${template.pageId}`, () => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(template.pageId)}/rename`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: renameValue.trim() }) })).then(() => setRenameTemplate(null)); }}><span className="diet-btn-txt__label body-m">Rename</span></button></div></footer></dialog>
      <dialog ref={deleteDialogRef} className="diet-popup" data-size="medium" aria-label="Delete Page template"><header className="diet-popup__header"><h2 className="heading-4">Delete Page template?</h2></header><div className="diet-popup__body"><p className="body-m">This permanently deletes the saved Page template.</p></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={Boolean(activeAction)} onClick={() => setDeleteTemplate(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={Boolean(activeAction)} onClick={() => { const template = deleteTemplate; if (!template) return; void mutate(`delete:${template.pageId}`, () => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(template.pageId)}`, { method: 'DELETE' })).then(() => setDeleteTemplate(null)); }}><span className="diet-btn-txt__label body-m">Delete</span></button></div></footer></dialog>
      <RomaUpsellDialog open={upsellOpen} reason="Upgrade to create and edit Pages." onClose={() => setUpsellOpen(false)} />
    </>
  );
}
