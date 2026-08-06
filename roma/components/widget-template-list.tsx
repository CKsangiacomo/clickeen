'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { buildWidgetTemplateDraftRoute } from '../lib/widget-template-draft';
import { useRomaAccountApi } from './account-api';
import { DieterTextfield } from './dieter-textfield';
import { useRomaAccountContext } from './roma-account-context';
import {
  loadRomaWidgetTemplates,
  type RomaWidgetTemplate,
} from './use-roma-widget-templates';

export function WidgetTemplateList() {
  const accountApi = useRomaAccountApi();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountId = accountContext.accountPublicId;
  const canMutateTemplates = accountPolicy.role !== 'viewer' && accountId !== 'CLICKEEN';
  const [templates, setTemplates] = useState<RomaWidgetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState('');
  const [menuTemplateId, setMenuTemplateId] = useState('');
  const [renameTemplate, setRenameTemplate] = useState<RomaWidgetTemplate | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTemplate, setDeleteTemplate] = useState<RomaWidgetTemplate | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loadRomaWidgetTemplates({ accountId, fetchJson: accountApi.fetchJson });
      setTemplates(response.templates.slice().sort((left, right) =>
        left.templateName.localeCompare(right.templateName) || left.templateId.localeCompare(right.templateId),
      ));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setTemplates([]);
      setError(resolveAccountShellErrorCopy(message, 'Widget templates could not be loaded. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accountApi.fetchJson, accountId]);

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
    const renameLifecycle = createDialogLifecycle({
      dialog: renameDialog,
      initialFocus: 'input',
      requestDismiss: () => setRenameTemplate(null),
    });
    const deleteLifecycle = createDialogLifecycle({
      dialog: deleteDialog,
      initialFocus: 'button',
      requestDismiss: () => setDeleteTemplate(null),
    });
    if (renameTemplate) renameLifecycle.open();
    if (deleteTemplate) deleteLifecycle.open();
    return () => {
      renameLifecycle.destroy();
      deleteLifecycle.destroy();
    };
  }, [deleteTemplate, renameTemplate]);

  const mutate = useCallback(async (key: string, run: () => Promise<unknown>) => {
    if (!canMutateTemplates) return false;
    setActiveAction(key);
    setError(null);
    try {
      await run();
      await reload();
      return true;
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : String(mutationError);
      setError(resolveAccountShellErrorCopy(message, 'The Widget template could not be updated. Please try again.'));
      return false;
    } finally {
      setActiveAction('');
    }
  }, [canMutateTemplates, reload]);

  return (
    <>
      {error ? (
        <section className="rd-canvas-module" role="alert">
          <div className="roma-inline-stack">
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void reload()} disabled={loading}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        </section>
      ) : null}
      <div className="diet-table roma-widget-templates-table">
        <table className="diet-table__table">
          <caption className="sr-only">My Widget templates</caption>
          <thead>
            <tr>
              <th className="label-s" scope="col">Widget</th>
              <th className="label-s" scope="col">Template name</th>
              <th className="label-s" scope="col">Template ID</th>
              <th className="label-s diet-table__cell--action" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.templateId}>
                <td className="body-s">{template.widget}</td>
                <th className="body-s" scope="row">
                  {template.templateName}{' '}
                  <span className="roma-template-badge body-xs">Template</span>
                </th>
                <td className="body-xs roma-widget-instance-id">{template.templateId}</td>
                <td className="diet-table__cell--action">
                  {canMutateTemplates ? (
                    <div className="roma-cell-actions">
                      <Link
                        href={`/builder/${encodeURIComponent(template.templateId)}`}
                        className="diet-btn-txt"
                        data-size="sm"
                        data-variant="line2"
                      >
                        <span className="diet-btn-txt__label body-s">Edit</span>
                      </Link>
                      <div
                        className="diet-popover-host"
                        ref={menuTemplateId === template.templateId ? menuRef : undefined}
                        data-state={menuTemplateId === template.templateId ? 'open' : 'closed'}
                      >
                        <button
                          className="diet-btn-ic"
                          data-size="sm"
                          data-variant="neutral"
                          type="button"
                          aria-label={`More actions for ${template.templateName}`}
                          aria-haspopup="menu"
                          aria-expanded={menuTemplateId === template.templateId}
                          disabled={Boolean(activeAction)}
                          onClick={() => setMenuTemplateId((current) => current === template.templateId ? '' : template.templateId)}
                        >
                          <span
                            className="diet-btn-ic__icon diet-icon-mask"
                            style={{ '--diet-icon-source': 'url("/dieter/icons/svg/ellipsis.svg")' } as CSSProperties}
                            aria-hidden="true"
                          />
                        </button>
                        <div className="diet-popover roma-actions-popover" role="menu">
                          <Link
                            className="diet-btn-menuactions"
                            data-size="md"
                            data-variant="neutral"
                            role="menuitem"
                            href={buildWidgetTemplateDraftRoute({ kind: 'account-template', templateId: template.templateId })}
                            onClick={() => setMenuTemplateId('')}
                          >
                            <span className="diet-btn-menuactions__label body-s">Use template</span>
                          </Link>
                          <button
                            className="diet-btn-menuactions"
                            data-size="md"
                            data-variant="neutral"
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuTemplateId('');
                              setRenameValue(template.templateName);
                              setRenameTemplate(template);
                            }}
                          >
                            <span className="diet-btn-menuactions__label body-s">Rename</span>
                          </button>
                          <button
                            className="diet-btn-menuactions"
                            data-size="md"
                            data-variant="neutral"
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuTemplateId('');
                              setDeleteTemplate(template);
                            }}
                          >
                            <span className="diet-btn-menuactions__label body-s">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="body-s">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="body-m roma-collection-state">Loading Widget templates…</p> : null}
        {!loading && !error && templates.length === 0 ? <p className="body-m roma-collection-state">No Widget templates yet.</p> : null}
      </div>

      <dialog ref={renameDialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-widget-template-rename-title">
        <header className="diet-popup__header">
          <h2 id="roma-widget-template-rename-title" className="heading-4">Rename Widget template</h2>
        </header>
        <div className="diet-popup__body">
          <DieterTextfield label="Template name" value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} />
        </div>
        <footer className="diet-popup__footer">
          <div className="diet-popup__actions">
            <button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={Boolean(activeAction)} onClick={() => setRenameTemplate(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              disabled={!renameValue.trim() || renameValue.trim() === renameTemplate?.templateName || Boolean(activeAction)}
              onClick={() => {
                const template = renameTemplate;
                const displayName = renameValue.trim();
                if (!template || !displayName || displayName === template.templateName) return;
                void mutate(
                  `rename:${template.templateId}`,
                  () => accountApi.fetchJson(`/api/account/instances/${encodeURIComponent(template.templateId)}/rename`, {
                    method: 'POST',
                    headers: accountApi.buildHeaders({ contentType: 'application/json' }),
                    body: JSON.stringify({ displayName }),
                  }),
                ).then((updated) => { if (updated) setRenameTemplate(null); });
              }}
            >
              <span className="diet-btn-txt__label body-m">{activeAction.startsWith('rename:') ? 'Renaming…' : 'Rename'}</span>
            </button>
          </div>
        </footer>
      </dialog>
      <dialog ref={deleteDialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-widget-template-delete-title">
        <header className="diet-popup__header">
          <h2 id="roma-widget-template-delete-title" className="heading-4">Delete Widget template?</h2>
        </header>
        <div className="diet-popup__body"><p className="body-m">This permanently deletes the saved Widget template.</p></div>
        <footer className="diet-popup__footer">
          <div className="diet-popup__actions">
            <button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={Boolean(activeAction)} onClick={() => setDeleteTemplate(null)}><span className="diet-btn-txt__label body-m">Cancel</span></button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              disabled={Boolean(activeAction)}
              onClick={() => {
                const template = deleteTemplate;
                if (!template) return;
                void mutate(
                  `delete:${template.templateId}`,
                  () => accountApi.fetchJson(`/api/account/instances/${encodeURIComponent(template.templateId)}`, { method: 'DELETE' }),
                ).then((updated) => { if (updated) setDeleteTemplate(null); });
              }}
            >
              <span className="diet-btn-txt__label body-m">{activeAction.startsWith('delete:') ? 'Deleting…' : 'Delete'}</span>
            </button>
          </div>
        </footer>
      </dialog>
    </>
  );
}
