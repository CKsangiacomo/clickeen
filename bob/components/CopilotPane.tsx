import { useMemo, useState } from 'react';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function CopilotPane() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const canApplyOps = Boolean(compiled && compiled.controls.length > 0);

  const defaultOps = useMemo(() => {
    return JSON.stringify(
      [
        { op: 'set', path: 'title', value: 'Frequently Asked Questions' },
        {
          op: 'insert',
          path: 'sections.0.faqs',
          index: 0,
          value: {
            id: 'q-new',
            question: 'What is Clickeen?',
            answer: 'Embeddable widgets with conversions built in.',
            defaultOpen: false,
          },
        },
      ],
      null,
      2
    );
  }, []);

  const [rawOps, setRawOps] = useState(defaultOps);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; summary: string } | null>(null);

  const handleApply = () => {
    setError(null);
    setLastResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawOps);
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setError('Ops payload must be a JSON array');
      return;
    }

    const result = session.applyOps(parsed as any);
    if (result.ok) {
      setLastResult({ ok: true, summary: `Applied ${parsed.length} op(s)` });
    } else {
      setLastResult({ ok: false, summary: `Rejected ${result.errors.length} error(s)` });
      setError(result.errors.map((e) => `[${e.opIndex}] ${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n'));
    }
  };

  return (
    <section style={{ padding: 'var(--space-3)' }} aria-label="Copilot">
      <div className="heading-3">Copilot (Ops Sandbox)</div>
      <div className="label-s label-muted" style={{ marginTop: 'var(--space-1)' }}>
        This is a Milestone 3 debug surface: paste ops JSON to apply fail-closed edits against the widget’s `controls[]` allowlist.
      </div>

      {!compiled ? (
        <div className="label-s" style={{ marginTop: 'var(--space-3)', opacity: 0.7 }}>
          Load an instance to begin.
        </div>
      ) : !canApplyOps ? (
        <div className="label-s" style={{ marginTop: 'var(--space-3)', opacity: 0.7 }}>
          Ops are not enabled for `{compiled.widgetname}` yet.
        </div>
      ) : (
        <>
          <div className="label-s" style={{ marginTop: 'var(--space-3)' }}>
            Ops JSON
          </div>
          <textarea
            className="body-s"
            value={rawOps}
            onChange={(e) => setRawOps(e.target.value)}
            rows={10}
            style={{
              width: '100%',
              marginTop: 'var(--space-1)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--control-radius-md)',
              border: '1px solid var(--color-system-gray-5)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          />

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={handleApply}>
              <span className="diet-btn-txt__label">Apply ops</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="neutral"
              type="button"
              onClick={session.undoLastOps}
              disabled={!session.canUndo}
            >
              <span className="diet-btn-txt__label">Undo</span>
            </button>
          </div>

          {lastResult ? (
            <div className="label-s" style={{ marginTop: 'var(--space-2)', opacity: 0.8 }}>
              {lastResult.summary}
            </div>
          ) : null}

          {error ? (
            <pre
              className="caption"
              style={{
                whiteSpace: 'pre-wrap',
                marginTop: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--control-radius-md)',
                border: '1px solid var(--color-system-gray-5)',
                background: 'var(--color-system-gray-6-step5)',
              }}
            >
              {error}
            </pre>
          ) : null}
        </>
      )}
    </section>
  );
}
