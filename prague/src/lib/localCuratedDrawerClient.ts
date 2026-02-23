import { isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';

type StatusTone = 'muted' | 'ok' | 'warn' | 'error';

type DrawerContext = {
  widget: string;
  page: string;
  blockCount: number;
  slotCount: number;
};

type SlotUpdate = {
  slotEl: HTMLElement;
  publicId: string;
  blockId: string;
  target: string;
  itemIndexRaw: string;
};

function normalizePublicId(value: unknown): string {
  return String(value || '').trim();
}

function parseContext(raw: string): DrawerContext {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { widget: '', page: '', blockCount: 0, slotCount: 0 };
    }
    return {
      widget: String((parsed as { widget?: unknown }).widget || '').trim(),
      page: String((parsed as { page?: unknown }).page || '').trim(),
      blockCount: Number.isInteger((parsed as { blockCount?: unknown }).blockCount)
        ? Number((parsed as { blockCount: number }).blockCount)
        : 0,
      slotCount: Number.isInteger((parsed as { slotCount?: unknown }).slotCount)
        ? Number((parsed as { slotCount: number }).slotCount)
        : 0,
    };
  } catch {
    return { widget: '', page: '', blockCount: 0, slotCount: 0 };
  }
}

function readInput(slotEl: HTMLElement): string {
  const select = slotEl.querySelector('[data-role="select"]');
  if (!(select instanceof HTMLSelectElement)) return '';
  return normalizePublicId(select.value);
}

function setSelectOptions(slotEl: HTMLElement, values: string[]) {
  const select = slotEl.querySelector('[data-role="select"]');
  if (!(select instanceof HTMLSelectElement)) return;

  const existing = normalizePublicId(slotEl.dataset.original || '');
  const current = normalizePublicId(select.value || existing);
  const merged = Array.from(new Set([existing, current, ...values].filter(Boolean))).sort((a, b) => a.localeCompare(b));

  select.innerHTML = '';
  if (merged.length === 0) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No instances available';
    select.appendChild(empty);
    select.value = '';
    return;
  }

  merged.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (current && merged.includes(current)) {
    select.value = current;
  } else if (existing && merged.includes(existing)) {
    select.value = existing;
  } else {
    select.value = merged[0] || '';
  }
}

function coerceSlotUpdates(slotEls: HTMLElement[]): SlotUpdate[] {
  return slotEls
    .map((slotEl) => {
      const publicId = readInput(slotEl);
      const original = normalizePublicId(slotEl.dataset.original || '');
      if (publicId === original) return null;
      return {
        slotEl,
        publicId,
        blockId: normalizePublicId(slotEl.dataset.blockId || ''),
        target: normalizePublicId(slotEl.dataset.target || ''),
        itemIndexRaw: normalizePublicId(slotEl.dataset.itemIndex || ''),
      };
    })
    .filter((update): update is SlotUpdate => Boolean(update));
}

function bindLocalCuratedRoot(root: HTMLElement) {
  const panel = root.querySelector('[data-role="panel"]');
  const backdrop = root.querySelector('.ck-localCurated__backdrop');
  const statusEl = root.querySelector('[data-role="status"]');
  const refreshBtn = root.querySelector('[data-action="refresh-options"]');
  const saveBtn = root.querySelector('[data-action="save"]');
  if (!(panel instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return;
  const panelEl = panel;
  const backdropEl = backdrop;

  const context = parseContext(root.dataset.context || '');
  const slotEls = Array.from(root.querySelectorAll('[data-slot-index]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  const blockEls = Array.from(root.querySelectorAll('.ck-localCurated__block')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  const blockCount = context.blockCount > 0 ? context.blockCount : blockEls.length;
  const slotCount = context.slotCount > 0 ? context.slotCount : slotEls.length;

  function setStatus(message: string, tone: StatusTone) {
    if (!(statusEl instanceof HTMLElement)) return;
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
  }

  function setSaveEnabled() {
    if (!(saveBtn instanceof HTMLButtonElement)) return;
    const changed = slotEls.some((slotEl) => {
      const nextValue = readInput(slotEl);
      const originalValue = normalizePublicId(slotEl.dataset.original || '');
      return nextValue !== originalValue;
    });
    saveBtn.disabled = !changed;
  }

  function setOptionLoading(loading: boolean) {
    if (root.dataset.busy === '1') return;
    if (refreshBtn instanceof HTMLButtonElement) refreshBtn.disabled = loading;
    slotEls.forEach((slotEl) => {
      const select = slotEl.querySelector('[data-role="select"]');
      if (select instanceof HTMLSelectElement) select.disabled = loading;
    });
    if (loading) {
      if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = true;
    } else {
      setSaveEnabled();
    }
  }

  function openPanel() {
    setSaveEnabled();
    setStatus(`Found ${slotCount} editable instance slots across ${blockCount} blocks on this page.`, 'muted');
    panelEl.hidden = false;
    backdropEl.hidden = false;
    requestAnimationFrame(() => {
      root.classList.add('is-open');
    });
  }

  function closePanel() {
    root.classList.remove('is-open');
    window.setTimeout(() => {
      panelEl.hidden = true;
      backdropEl.hidden = true;
    }, 180);
  }

  function setBusy(busy: boolean) {
    root.dataset.busy = busy ? '1' : '0';
    if (refreshBtn instanceof HTMLButtonElement) refreshBtn.disabled = busy;
    slotEls.forEach((slotEl) => {
      const select = slotEl.querySelector('[data-role="select"]');
      if (select instanceof HTMLSelectElement) select.disabled = busy;
    });
    if (saveBtn instanceof HTMLButtonElement) {
      if (busy) {
        saveBtn.disabled = true;
      } else {
        setSaveEnabled();
      }
    }
  }

  async function loadCuratedOptions() {
    const widget = encodeURIComponent(context.widget);
    if (!widget) return;
    setOptionLoading(true);
    setStatus('Loading curated instance IDs…', 'muted');
    try {
      const res = await fetch(`/api/local/curated-blocks?widget=${widget}&_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as {
        instances?: Array<{ publicId?: unknown }>;
        localCount?: unknown;
        parisCount?: unknown;
        warning?: unknown;
      };
      const instances = Array.isArray(payload.instances) ? payload.instances : [];

      const values = new Set<string>();
      slotEls.forEach((slotEl) => {
        const existing = normalizePublicId(slotEl.dataset.original || '');
        if (existing) values.add(existing);
      });
      instances.forEach((instance: { publicId?: unknown }) => {
        const value = normalizePublicId(instance.publicId);
        if (value) values.add(value);
      });

      const sortedValues = Array.from(values).sort((a, b) => a.localeCompare(b));
      slotEls.forEach((slotEl) => setSelectOptions(slotEl, sortedValues));

      const localCount = Number.isInteger(payload.localCount) ? Number(payload.localCount) : 0;
      const parisCount = Number.isInteger(payload.parisCount) ? Number(payload.parisCount) : 0;
      const warning = typeof payload.warning === 'string' && payload.warning.trim() ? payload.warning.trim() : '';

      if (instances.length > 0) {
        const sourceBreakdown = localCount > 0 || parisCount > 0 ? ` (${localCount} local, ${parisCount} Paris)` : '';
        const baseMessage = `Found ${slotCount} editable slots across ${blockCount} blocks. Loaded ${instances.length} available instance IDs${sourceBreakdown}.`;
        setStatus(warning ? `${baseMessage} ${warning}` : baseMessage, warning ? 'warn' : 'ok');
      } else {
        const baseMessage = `Found ${slotCount} editable slots across ${blockCount} blocks. No instance IDs available.`;
        setStatus(warning ? `${baseMessage} ${warning}` : baseMessage, 'warn');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Found ${slotCount} editable slots across ${blockCount} blocks. Could not load IDs (${message}).`, 'warn');
    } finally {
      setOptionLoading(false);
    }
  }

  async function saveChanges() {
    if (!(saveBtn instanceof HTMLButtonElement) || saveBtn.disabled) return;
    const updates = coerceSlotUpdates(slotEls);
    if (updates.length === 0) {
      setStatus('No changes to save.', 'muted');
      return;
    }

    for (const update of updates) {
      if (!isCuratedOrMainWidgetPublicId(update.publicId)) {
        setStatus(`Invalid publicId: ${update.publicId}`, 'error');
        return;
      }
    }

    setBusy(true);
    setStatus(`Saving ${updates.length} change(s)…`, 'muted');

    try {
      for (const update of updates) {
        const body = {
          widget: context.widget,
          page: context.page,
          blockId: update.blockId,
          target: update.target,
          itemIndex: update.itemIndexRaw ? Number.parseInt(update.itemIndexRaw, 10) : null,
          publicId: update.publicId,
        };

        const res = await fetch('/api/local/curated-blocks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message = payload && typeof payload.message === 'string' ? payload.message : 'Request failed';
          throw new Error(message);
        }

        update.slotEl.dataset.original = update.publicId;
      }

      setStatus(`Saved ${updates.length} change(s). Reloading page…`, 'ok');
      setSaveEnabled();
      window.setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Save failed: ${message}`, 'error');
      setBusy(false);
      setSaveEnabled();
    }
  }

  root.querySelector('[data-action="open"]')?.addEventListener('click', openPanel);
  root.querySelectorAll('[data-action="close"]').forEach((el) => {
    el.addEventListener('click', closePanel);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) {
      closePanel();
    }
  });

  slotEls.forEach((slotEl) => {
    const select = slotEl.querySelector('[data-role="select"]');
    if (!(select instanceof HTMLSelectElement)) return;
    select.addEventListener('change', () => {
      setSaveEnabled();
      setStatus('Selection changed. Click "Save changes" to apply.', 'muted');
    });
  });

  refreshBtn?.addEventListener('click', () => {
    void loadCuratedOptions();
  });

  saveBtn?.addEventListener('click', () => {
    void saveChanges();
  });

  if (root.parentElement !== document.body) {
    document.body.appendChild(root);
  }
  setSaveEnabled();
  void loadCuratedOptions();
}

export function initLocalCuratedDrawers() {
  const roots = Array.from(document.querySelectorAll('.ck-localCurated[data-ck-local-curated="true"]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  roots.forEach((root) => {
    if (root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    bindLocalCuratedRoot(root);
  });
}
