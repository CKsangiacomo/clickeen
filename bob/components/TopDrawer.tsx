'use client';

import { useCallback, useMemo, useState } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { PublishEmbedModal } from './PublishEmbedModal';

function resolveSubject(profile: string | null | undefined): 'workspace' | 'minibob' {
  if (profile === 'minibob') return 'minibob';
  return 'workspace';
}

export function TopDrawer() {
  const session = useWidgetSession();
  const { meta, policy, publish, isPublishing, isDirty, discardChanges, setInstanceLabel, apiFetch } = session;
  const [embedOpen, setEmbedOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const currentPublicId = typeof meta?.publicId === 'string' ? meta.publicId : '';
  const workspaceId = typeof meta?.workspaceId === 'string' ? meta.workspaceId : '';
  const hasInstance = Boolean(currentPublicId);
  const canPublish = hasInstance && Boolean(workspaceId);
  const currentLabel = useMemo(
    () => (typeof meta?.label === 'string' ? meta.label.trim() : ''),
    [meta?.label]
  );
  const subject = useMemo(() => resolveSubject(policy?.profile ?? null), [policy?.profile]);

  const canRename = Boolean(currentPublicId && workspaceId && policy?.role !== 'viewer');

  const startRename = useCallback(() => {
    if (!canRename || renameBusy) return;
    setRenameDraft(currentLabel);
    setRenameError(null);
    setRenaming(true);
  }, [canRename, currentLabel, renameBusy]);

  const cancelRename = useCallback(() => {
    setRenaming(false);
    setRenameDraft(currentLabel);
    setRenameError(null);
  }, [currentLabel]);

  const commitRename = useCallback(async () => {
    if (!canRename || !currentPublicId || !workspaceId || renameBusy) return;
    const nextLabel = renameDraft.trim();
    if (!nextLabel) {
      setRenameError('Instance name cannot be empty.');
      return;
    }
    if (nextLabel === currentLabel.trim()) {
      setRenaming(false);
      setRenameError(null);
      return;
    }

    setRenameBusy(true);
    setRenameError(null);
    try {
      const response = await apiFetch(
        `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(
          currentPublicId,
        )}?subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ displayName: nextLabel }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { displayName?: string; error?: { reasonKey?: string } | string }
        | null;

      if (!response.ok) {
        const reason =
          typeof payload?.error === 'string'
            ? payload.error
            : payload?.error && typeof payload.error === 'object' && typeof payload.error.reasonKey === 'string'
              ? payload.error.reasonKey
              : `Rename failed (HTTP ${response.status})`;
        throw new Error(reason);
      }

      const resolvedLabel =
        typeof payload?.displayName === 'string' && payload.displayName.trim() ? payload.displayName.trim() : '';
      if (!resolvedLabel) {
        throw new Error('Rename response missing displayName');
      }

      setInstanceLabel(resolvedLabel);
      setRenaming(false);
      setRenameDraft(resolvedLabel);

      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'bob:instance-renamed',
            publicId: currentPublicId,
            displayName: resolvedLabel,
          },
          '*',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenameError(message);
    } finally {
      setRenameBusy(false);
    }
  }, [apiFetch, canRename, currentLabel, currentPublicId, renameBusy, renameDraft, setInstanceLabel, subject, workspaceId]);

  const handleRenameBlur = useCallback(() => {
    const nextLabel = renameDraft.trim();
    if (!nextLabel) {
      cancelRename();
      return;
    }
    if (nextLabel === currentLabel.trim()) {
      cancelRename();
      return;
    }
    void commitRename();
  }, [cancelRename, commitRename, currentLabel, renameDraft]);

  return (
    <section className="topdrawer">
      <div className="topdrawer-context-wrap">
        <div className="topdrawer-context">
          {hasInstance ? (
            canRename && renaming ? (
              <input
                className="topdrawer-instance-title-input heading-3"
                type="text"
                value={renameDraft}
                maxLength={120}
                disabled={renameBusy}
                onChange={(event) => setRenameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitRename();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={handleRenameBlur}
                autoFocus
              />
            ) : canRename ? (
              <button
                className="topdrawer-instance-title topdrawer-instance-title--editable heading-3"
                type="button"
                onClick={startRename}
              >
                {currentLabel}
              </button>
            ) : (
              <span className="topdrawer-instance-title topdrawer-instance-title--readonly heading-3">
                {currentLabel}
              </span>
            )
          ) : null}
        </div>

        {renameError ? <div className="instance-rename__error label-s">{renameError}</div> : null}
      </div>

      <div className="topdrawer-actions">
        {isDirty ? (
          <>
            <button
              className="diet-btn-txt"
              data-size="xl"
              data-variant="neutral"
              type="button"
              disabled={!canPublish || isPublishing}
              onClick={() => discardChanges()}
            >
              <span className="diet-btn-txt__label">Discard</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="xl"
              data-variant="primary"
              type="button"
              disabled={!canPublish || isPublishing}
              onClick={() => publish()}
            >
              <span className="diet-btn-txt__label">{isPublishing ? 'Saving…' : 'Save'}</span>
            </button>
          </>
        ) : null}
        <button
          className="diet-btn-txt"
          data-size="xl"
          data-variant="primary"
          type="button"
          disabled={!canPublish}
          onClick={() => setEmbedOpen(true)}
        >
          <span className="diet-btn-txt__label">Publish</span>
        </button>
      </div>
      <PublishEmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} />
    </section>
  );
}
