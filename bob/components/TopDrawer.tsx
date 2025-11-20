'use client';

import { useEffect, useMemo, useState } from 'react';
import { InstanceRename } from '../bob_native_ui/instance_rename/InstanceRename';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function TopDrawer() {
  const session = useWidgetSession();
  const { meta, compiled, renameInstance } = session;

  const hasInstance = Boolean(meta?.publicId);
  const displayName = useMemo(
    () =>
      meta?.label || meta?.publicId || compiled?.displayName || compiled?.widgetname || 'No instance loaded',
    [meta?.label, meta?.publicId, compiled?.displayName, compiled?.widgetname]
  );

  const [mode, setMode] = useState<'view' | 'editing'>('view');
  const [draftName, setDraftName] = useState(displayName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(displayName);
    setMode('view');
  }, [displayName]);

  const handleCommit = async (nextValue: string) => {
    if (!hasInstance) {
      setMode('view');
      return;
    }

    const trimmed = nextValue.trim();
    if (!trimmed) {
      setDraftName(displayName);
      setMode('view');
      setError('Instance name cannot be empty');
      return;
    }

    if (trimmed === displayName) {
      setDraftName(displayName);
      setMode('view');
      setError(null);
      return;
    }

    try {
      await renameInstance(trimmed);
      setDraftName(trimmed);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename instance';
      setError(message);
      setDraftName(displayName);
      // eslint-disable-next-line no-console
      console.error('[TopDrawer] renameInstance failed', err);
    } finally {
      setMode('view');
    }
  };

  const handleCancel = () => {
    setDraftName(displayName);
    setMode('view');
    setError(null);
  };

  return (
    <section className="topdrawer">
      {hasInstance ? (
        <div>
          <InstanceRename
            state={mode}
            value={draftName}
            onStartEditing={() => {
              setError(null);
              setMode('editing');
            }}
            onChange={setDraftName}
            onCommit={handleCommit}
            onCancel={handleCancel}
          />
          {error ? (
            <div className="label-s label-muted instance-rename__error">
              {error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="heading-3">{displayName}</div>
      )}
      <div className="topdrawer-actions">
        <button className="diet-btn-txt" data-size="xl" data-variant="primary" type="button">
          <span className="diet-btn-txt__label">Publish</span>
        </button>
      </div>
    </section>
  );
}
