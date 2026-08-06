'use client';

import { parseAccountLocaleListStrict, parseAccountLocalePolicyStrict } from '@clickeen/ck-contracts';
import type { AccountPage, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import { createCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { parseAccountPageSource } from '../lib/account-page-contract';
import { buildPagePublicActions, type PublicActions } from '../lib/public-actions';
import { useRomaAccountApi } from './account-api';
import { BuilderDomain } from './builder-domain';
import { PageBuilderContent } from './page-builder-content';
import { PageBuilderSeo } from './page-builder-seo';
import { createBlankPageDraft, generatePageDraft, loadPagePlacement, type PageDraftSource, type PagePlacementDraft } from './page-builder-model';
import { PageWorkspace } from './page-workspace';
import { PublicCodeDialog } from './public-code-dialog';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaAccountContext } from './roma-account-context';
import { useRomaShellActions } from './roma-shell';
import type { WidgetInstance } from './use-roma-widgets';

type WebFiles = { indexHtml: string; stylesCss: string; runtimeJs: string };
type PageDetail = {
  source: Extract<AccountPage, { isTemplate: false }>;
  files: WebFiles;
  overlaysJson: Record<string, unknown>;
  serveState: { published: boolean; needsUpdate: boolean };
};

function parseDetail(raw: unknown): PageDetail {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const value = raw as Record<string, unknown>;
  const source = parseAccountPageSource(value.source);
  const files = value.files as WebFiles | null;
  const state = value.serveState as PageDetail['serveState'] | null;
  if (!source || source.isTemplate || !files || typeof files.indexHtml !== 'string' || typeof files.stylesCss !== 'string' || typeof files.runtimeJs !== 'string' || !state || typeof state.published !== 'boolean' || typeof state.needsUpdate !== 'boolean') {
    throw new Error('coreui.errors.payload.invalid');
  }
  return { source, files, overlaysJson: (value.overlaysJson ?? {}) as Record<string, unknown>, serveState: state };
}

async function readPageOverlay(fetchRaw: ReturnType<typeof useRomaAccountApi>['fetchRaw'], pageId: string, locale: string): Promise<PageLocaleOverlay | null> {
  const response = await fetchRaw(`/api/account/pages/${encodeURIComponent(pageId)}/translations/${encodeURIComponent(locale)}`, { method: 'GET' });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null) as { values?: unknown } | null;
  if (!response.ok || !payload?.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) throw new Error('coreui.errors.payload.invalid');
  const values = payload.values as PageLocaleOverlay['values'];
  if (typeof values.title !== 'string') throw new Error('coreui.errors.payload.invalid');
  return { values };
}

function unavailablePlacement(coordinate: AccountPage['placements'][number]): PagePlacementDraft {
  return {
    ...coordinate,
    displayName: coordinate.instanceId,
    widgetType: 'Unavailable',
    source: { widgetType: 'unavailable' },
    files: { indexHtml: '', stylesCss: '', runtimeJs: '' },
    overlays: null,
    fontLibrary: { version: 1, fonts: {} },
    unavailable: true,
  };
}

export function PageBuilder({ pageId = '' }: { pageId?: string }) {
  const router = useRouter();
  const { activeAccount, accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const { openNavigation } = useRomaShellActions();
  const baseLocale = parseAccountLocalePolicyStrict(activeAccount.localePolicy).baseLocale;
  const settingsLocales = useMemo(() => Array.from(new Set([baseLocale, ...parseAccountLocaleListStrict(activeAccount.activeLocales)])), [activeAccount.activeLocales, baseLocale]);
  const canUsePages = accountPolicy.limits['pages.max'] !== 0;
  const [currentPageId, setCurrentPageId] = useState(pageId);
  const [source, setSourceState] = useState<PageDraftSource>(() => createBlankPageDraft(baseLocale));
  const [placements, setPlacementsState] = useState<PagePlacementDraft[]>([]);
  const [pageOverlays, setPageOverlaysState] = useState<Record<string, PageLocaleOverlay>>({});
  const [savedFiles, setSavedFiles] = useState<WebFiles | null>(null);
  const [published, setPublished] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(pageId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState('');
  const [activePanel, setActivePanel] = useState<'content' | 'seo'>('content');
  const [activeLocale, setActiveLocale] = useState(baseLocale);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [bobInstanceId, setBobInstanceId] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(!canUsePages);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const updateDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const updateLifecycleRef = useRef<DialogLifecycle | null>(null);
  const publicActions: PublicActions | null = currentPageId && published ? buildPagePublicActions({ accountPublicId: accountContext.accountPublicId, pageId: currentPageId }) : null;

  const setSource = useCallback((next: PageDraftSource) => { setSourceState(next); setDirty(true); }, []);
  const setPlacements = useCallback((next: PagePlacementDraft[]) => {
    setPlacementsState(next);
    setSourceState((current) => ({ ...current, placements: next.map(({ placementId, instanceId }) => ({ placementId, instanceId })) }));
    setDirty(true);
  }, []);
  const setPageOverlays = useCallback((next: Record<string, PageLocaleOverlay>) => { setPageOverlaysState(next); setDirty(true); }, []);

  const loadSavedPage = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = parseDetail(await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}`));
      const loadedPlacements = await Promise.all(detail.source.placements.map(async (coordinate) => {
        try {
          const placement = await loadPagePlacement({ instanceId: coordinate.instanceId, settingsLocales, fetchJson: accountApi.fetchJson });
          return { ...placement, placementId: coordinate.placementId };
        } catch {
          return unavailablePlacement(coordinate);
        }
      }));
      const overlays = Object.fromEntries((await Promise.all(settingsLocales.filter((locale) => locale !== detail.source.baseLocale).map(async (locale) => [locale, await readPageOverlay(accountApi.fetchRaw, id, locale)] as const))).filter((entry): entry is readonly [string, PageLocaleOverlay] => Boolean(entry[1])));
      const { pageId: ignoredPageId, ...draftSource } = detail.source;
      void ignoredPageId;
      setSourceState(draftSource);
      setPlacementsState(loadedPlacements);
      setPageOverlaysState(overlays);
      setSavedFiles(detail.files);
      setPublished(detail.serveState.published);
      setNeedsUpdate(detail.serveState.needsUpdate);
      setSelectedPlacementId(loadedPlacements[0]?.placementId ?? '');
      setDirty(false);
    } catch {
      setError('This Page could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountApi, settingsLocales]);

  useEffect(() => { if (pageId && canUsePages) void loadSavedPage(pageId); }, [canUsePages, loadSavedPage, pageId]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setMoreOpen(false); };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [moreOpen]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirty || bobInstanceId) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      event.preventDefault();
      pendingLeaveRef.current = () => window.location.assign(anchor.href);
      setLeaveOpen(true);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, [bobInstanceId, dirty]);
  useEffect(() => {
    const dialog = updateDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: () => dialog.querySelector('button'), requestDismiss: () => router.push('/pages') });
    updateLifecycleRef.current = lifecycle;
    return () => lifecycle.destroy();
  }, [router]);
  useEffect(() => {
    if (needsUpdate && currentPageId && !dirty && !bobInstanceId) updateLifecycleRef.current?.open();
    else updateLifecycleRef.current?.close();
  }, [bobInstanceId, currentPageId, dirty, needsUpdate]);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: () => dialog.querySelector('button'), requestDismiss: () => setDeleteOpen(false) });
    if (deleteOpen) lifecycle.open();
    return () => lifecycle.destroy();
  }, [deleteOpen]);

  const persistOverlays = useCallback(async (id: string) => {
    await Promise.all(Object.entries(pageOverlays).map(([locale, overlay]) => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}/translations/${encodeURIComponent(locale)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(overlay) })));
  }, [accountApi, pageOverlays]);

  const save = useCallback(async (forceUpdate = false) => {
    if (!canUsePages) { setUpsellOpen(true); return; }
    if (!source.values.title.trim()) { setError('Page title is required.'); setActivePanel('seo'); return; }
    if (placements.some((placement) => placement.unavailable)) { setError('Remove unavailable widgets before saving this Page.'); return; }
    setSaving(true);
    setError(null);
    try {
      const id = currentPageId || createCompactPageId();
      const generated = await generatePageDraft({ source, settingsLocales, pageOverlays, placements, fetchJson: accountApi.fetchJson });
      setSavedFiles(generated.files);
      const completeSource: AccountPage = { pageId: id, ...source };
      if (currentPageId) {
        await persistOverlays(id);
        await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: completeSource, files: generated.files, overlaysJson: generated.overlaysJson ?? {}, operation: forceUpdate || needsUpdate ? 'update' : 'save' }), timeoutMs: 120_000 });
      } else {
        await accountApi.fetchJson('/api/account/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: completeSource, files: generated.files, overlaysJson: generated.overlaysJson ?? {} }), timeoutMs: 120_000 });
        setCurrentPageId(id);
        router.replace(`/page-builder/${encodeURIComponent(id)}`);
      }
      setNeedsUpdate(false);
      setDirty(false);
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message === 'Page title is required.' ? saveError.message : 'Saving this Page failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [accountApi, canUsePages, currentPageId, needsUpdate, pageOverlays, persistOverlays, placements, router, settingsLocales, source]);

  const addWidget = async (instance: WidgetInstance) => {
    if (placements.some((placement) => placement.instanceId === instance.instanceId)) return;
    const placement = await loadPagePlacement({ instanceId: instance.instanceId, settingsLocales, fetchJson: accountApi.fetchJson });
    setPlacements([...placements, placement]);
    setSelectedPlacementId(placement.placementId);
  };

  const uploadSocialImage = async (file: File): Promise<string> => {
    const response = await accountApi.fetchRaw('/api/account/assets/upload', { method: 'POST', headers: { 'content-type': file.type, 'x-filename': file.name, 'x-source': 'roma-page-social-image' }, body: file });
    const payload = await response.json().catch(() => null) as { assetRef?: unknown } | null;
    if (!response.ok || typeof payload?.assetRef !== 'string') throw new Error('coreui.errors.assets.uploadFailed');
    return payload.assetRef;
  };

  const generateTranslations = async () => {
    if (!currentPageId) return;
    setTranslationBusy(true);
    setError(null);
    try {
      await accountApi.fetchJson('/api/account/translations/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: { kind: 'page', id: currentPageId } }), timeoutMs: 120_000 });
      const overlays = Object.fromEntries((await Promise.all(settingsLocales.filter((locale) => locale !== baseLocale).map(async (locale) => [locale, await readPageOverlay(accountApi.fetchRaw, currentPageId, locale)] as const))).filter((entry): entry is readonly [string, PageLocaleOverlay] => Boolean(entry[1])));
      setPageOverlaysState(overlays);
      setDirty(true);
    } catch {
      setError('Translations could not be generated. Please try again.');
    } finally {
      setTranslationBusy(false);
    }
  };

  const changePublished = async (next: boolean) => {
    if (!currentPageId) return;
    setSaving(true);
    setError(null);
    try {
      await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(currentPageId)}/${next ? 'publish' : 'unpublish'}`, { method: 'POST' });
      setPublished(next);
    } catch {
      setError(`${next ? 'Publishing' : 'Unpublishing'} this Page failed. Please try again.`);
    } finally { setSaving(false); }
  };

  if (!canUsePages) {
    return <><section className="roma-page-upgrade"><h1 className="heading-2">Pages</h1><p className="body-m">Upgrade to create, edit and publish Pages.</p><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => setUpsellOpen(true)}><span className="diet-btn-txt__label body-m">Upgrade</span></button></section><RomaUpsellDialog open={upsellOpen} reason="Pages are available on Tier 2 and above." onClose={() => setUpsellOpen(false)} /></>;
  }

  if (loading) return <section className="roma-account-loading" aria-label="Loading Page"><span /><span /><span /></section>;

  return (
    <>
      <div className="builder-app roma-page-builder">
        <section className="topdrawer">
          <div className="topdrawer-leading"><button className="host-navigation-open diet-btn-ic" data-size="xl" data-variant="neutral" type="button" aria-label="Open Clickeen navigation" onClick={() => openNavigation()}><span className="diet-btn-ic__icon" data-icon="rectangle.portrait.and.arrow.right" /></button></div>
          <div className="topdrawer-context-wrap"><div className="topdrawer-context"><input className="roma-page-name heading-3" value={source.displayName} aria-label="Page name" onChange={(event) => setSource({ ...source, displayName: event.target.value })} /><span className="body-xs topdrawer-publish-status">{needsUpdate ? 'Needs update' : published ? 'Published' : currentPageId ? 'Unpublished' : 'Unsaved'}</span></div></div>
          <div className="topdrawer-actions">
            {(dirty || !currentPageId || needsUpdate) ? <button className="diet-btn-txt" data-size="xl" data-variant="primary" type="button" disabled={saving} onClick={() => void save(needsUpdate)}><span className="diet-btn-txt__label">{saving ? 'Saving…' : needsUpdate ? 'Update page' : 'Save'}</span></button> : null}
            {currentPageId && !needsUpdate && !published ? <button className="diet-btn-txt" data-size="lg" data-variant="secondary" type="button" disabled={saving || dirty} onClick={() => void changePublished(true)}><span className="diet-btn-txt__label body-s">Publish</span></button> : null}
            {publicActions ? <a className="diet-btn-txt" data-size="lg" data-variant="line2" href={publicActions.publicUrl} target="_blank" rel="noreferrer"><span className="diet-btn-txt__label body-s">Open public page</span></a> : null}
            {currentPageId ? <div ref={moreRef} className="topdrawer-more diet-popover-host" data-state={moreOpen ? 'open' : 'closed'}><button className="diet-btn-txt" data-size="lg" data-variant="line2" type="button" onClick={() => setMoreOpen((open) => !open)}><span className="diet-btn-txt__label body-s">More</span></button><div className="topdrawer-more__menu diet-popover" role="menu">{published ? <><button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); setCopyOpen(true); }}><span className="diet-btn-menuactions__label body-s">Copy URL / code</span></button><button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); void changePublished(false); }}><span className="diet-btn-menuactions__label body-s">Unpublish</span></button></> : <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); setDeleteOpen(true); }}><span className="diet-btn-menuactions__label body-s">Delete</span></button>}</div></div> : null}
          </div>
        </section>
        {error ? <div className="roma-page-builder__error body-s" role="alert">{error}</div> : null}
        <div className="editor-content">
          <aside className="tooldrawer" id="page-builder-tool-drawer">
            <div className="roma-page-panel-tabs" role="tablist"><button className="diet-btn-txt" data-size="sm" data-variant={activePanel === 'content' ? 'primary' : 'neutral'} type="button" role="tab" aria-selected={activePanel === 'content'} onClick={() => setActivePanel('content')}><span className="diet-btn-txt__label body-s">Content</span></button><button className="diet-btn-txt" data-size="sm" data-variant={activePanel === 'seo' ? 'primary' : 'neutral'} type="button" role="tab" aria-selected={activePanel === 'seo'} onClick={() => setActivePanel('seo')}><span className="diet-btn-txt__label body-s">SEO/GEO/AEO</span></button></div>
            <div className="roma-page-tooldrawer-body">{activePanel === 'content' ? <PageBuilderContent placements={placements} selectedPlacementId={selectedPlacementId} onSelect={setSelectedPlacementId} onAdd={addWidget} onChange={setPlacements} onEdit={setBobInstanceId} /> : <PageBuilderSeo source={source} onSourceChange={setSource} locales={currentPageId ? settingsLocales : [baseLocale]} activeLocale={activeLocale} onActiveLocaleChange={setActiveLocale} overlays={pageOverlays} onOverlaysChange={setPageOverlays} canTranslate={Boolean(currentPageId)} translating={translationBusy} onGenerateTranslations={generateTranslations} onUploadSocialImage={uploadSocialImage} />}</div>
          </aside>
          <PageWorkspace placements={placements} selectedPlacementId={selectedPlacementId} savedFiles={savedFiles} showSaved={Boolean(currentPageId && !dirty && !needsUpdate)} onSelect={setSelectedPlacementId} />
        </div>
      </div>

      {bobInstanceId ? <div className="roma-page-bob-slide" role="dialog" aria-label="Edit widget in Bob"><BuilderDomain initialInstanceId={bobInstanceId} embedded returnLabel="Done, go back to the page" contextMessage="You are editing a saved widget. Other Pages using it will need updating after Save." onReturn={() => setBobInstanceId('')} onInstanceSaved={() => { void loadPagePlacement({ instanceId: bobInstanceId, settingsLocales, fetchJson: accountApi.fetchJson }).then((updated) => { setPlacementsState((current) => current.map((placement) => placement.instanceId === bobInstanceId ? { ...updated, placementId: placement.placementId } : placement)); setNeedsUpdate(true); }); }} /></div> : null}
      <dialog ref={updateDialogRef} className="diet-popup" data-size="medium" aria-labelledby="page-needs-update-title"><header className="diet-popup__header"><h2 id="page-needs-update-title" className="heading-4">Update this page to edit</h2></header><div className="diet-popup__body"><p className="body-m">One or more widgets in this page has changed. Update the page to edit.</p></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => router.push('/pages')}><span className="diet-btn-txt__label body-m">Back to pages</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={saving} onClick={() => void save(true)}><span className="diet-btn-txt__label body-m">{saving ? 'Updating…' : 'Update page'}</span></button></div></footer></dialog>
      <dialog ref={deleteDialogRef} className="diet-popup" data-size="medium" aria-label="Delete page"><header className="diet-popup__header"><h2 className="heading-4">Delete page?</h2></header><div className="diet-popup__body"><p className="body-m">This permanently deletes the saved Page.</p></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setDeleteOpen(false)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={saving} onClick={() => { if (!currentPageId) return; setSaving(true); void accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(currentPageId)}`, { method: 'DELETE' }).then(() => router.push('/pages')).catch(() => { setError('Deleting this Page failed. Please try again.'); setDeleteOpen(false); }).finally(() => setSaving(false)); }}><span className="diet-btn-txt__label body-m">Delete</span></button></div></footer></dialog>
      <PublicCodeDialog open={copyOpen} productName={source.displayName} actions={publicActions} onClose={() => setCopyOpen(false)} />
      <RomaUnsavedChangesDialog open={leaveOpen} message="This Page has unsaved changes." onKeepEditing={() => { pendingLeaveRef.current = null; setLeaveOpen(false); }} onDiscard={() => { const leave = pendingLeaveRef.current; pendingLeaveRef.current = null; setDirty(false); setLeaveOpen(false); leave?.(); }} />
    </>
  );
}
