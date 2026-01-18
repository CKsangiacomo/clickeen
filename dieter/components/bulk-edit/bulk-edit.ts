type BulkColumn = {
  label?: string;
  path?: string;
  metaPath?: string;
  autoNamePath?: string;
  control?: string;
  flag?: string;
  placeholder?: string;
  labelPath?: string;
  accept?: string;
};

type BulkRow = {
  pathPrefix: string;
  data: Record<string, unknown>;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseMetaValue(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFileNameFromValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  const candidate = urlMatch?.[2] || trimmed;
  const base = candidate.split('?')[0].split('#')[0];
  const parts = base.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function stripFileExtension(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) return trimmed;
  return trimmed.slice(0, lastDot);
}

function findBulkInput(scope: HTMLElement, path: string): HTMLInputElement | null {
  if (!path) return null;
  const inputs = Array.from(scope.querySelectorAll<HTMLInputElement>('[data-bulk-path]'));
  return inputs.find((input) => input.getAttribute('data-bulk-path') === path) || null;
}

function wireAutoNameSync(uploadRoot: HTMLElement, row: HTMLElement, namePath: string) {
  const metaInput = uploadRoot.querySelector<HTMLInputElement>('.diet-dropdown-upload__meta-field');
  const valueInput = uploadRoot.querySelector<HTMLInputElement>('.diet-dropdown-upload__value-field');
  if (!metaInput || !namePath) return;

  const deriveName = () => {
    const meta = parseMetaValue(metaInput.value || '');
    const metaName = typeof meta?.name === 'string' ? meta.name.trim() : '';
    if (metaName) return stripFileExtension(metaName);
    const rawValue = valueInput?.value || valueInput?.getAttribute('value') || '';
    const fileName = extractFileNameFromValue(rawValue);
    return stripFileExtension(fileName);
  };

  const sync = () => {
    const nameInput = findBulkInput(row, namePath);
    if (!nameInput) return;
    const nextName = deriveName();
    if (!nextName) return;

    const current = nameInput.value.trim();
    const prevAuto = nameInput.dataset.autoName || '';
    if (!prevAuto && current && current === nextName) {
      nameInput.dataset.autoName = current;
    }
    const effectivePrev = nameInput.dataset.autoName || '';
    if (!current || current === effectivePrev) {
      if (current !== nextName) {
        nameInput.value = nextName;
        nameInput.dataset.autoName = nextName;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (!effectivePrev) {
        nameInput.dataset.autoName = nextName;
      }
    }
  };

  const prime = () => {
    const nameInput = findBulkInput(row, namePath);
    if (!nameInput) return;
    const nextName = deriveName();
    if (!nextName) return;
    const current = nameInput.value.trim();
    if (!current || current === nextName) {
      nameInput.dataset.autoName = nextName;
    }
  };

  metaInput.addEventListener('input', sync);
  metaInput.addEventListener('external-sync', sync as EventListener);
  prime();
  sync();
}

function parseColumns(raw: string | null): BulkColumn[] {
  if (!raw) return [];
  const decoded = decodeHtmlEntities(raw);
  try {
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is BulkColumn => Boolean(entry && typeof entry === 'object'));
  } catch {
    return [];
  }
}

function readPolicyFlags(root: HTMLElement): Record<string, boolean> | null {
  const container = root.closest<HTMLElement>('[data-ck-policy-flags]');
  if (!container) return null;
  const raw = container.getAttribute('data-ck-policy-flags');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, boolean>;
  } catch {
    return null;
  }
}

function isFlagEnabled(flags: Record<string, boolean> | null, key: string): boolean {
  if (!flags) return true;
  return flags[key] === true;
}

function readJsonArray(input: HTMLInputElement): unknown[] {
  const raw = input.value || input.getAttribute('data-bob-json') || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildRows(path: string, rowPath: string, strips: unknown[]): BulkRow[] {
  const rows: BulkRow[] = [];
  if (!Array.isArray(strips)) return rows;
  strips.forEach((strip, stripIndex) => {
    if (!strip || typeof strip !== 'object') return;
    const record = strip as Record<string, unknown>;
    const nested = record[rowPath];
    if (!Array.isArray(nested)) return;
    nested.forEach((entry, rowIndex) => {
      if (!entry || typeof entry !== 'object') return;
      rows.push({
        pathPrefix: `${path}.${stripIndex}.${rowPath}.${rowIndex}`,
        data: entry as Record<string, unknown>,
      });
    });
  });
  return rows;
}

function renderEmpty(tableWrap: HTMLElement, label: string | null) {
  tableWrap.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'diet-bulk-edit__empty';
  empty.textContent = label || 'No rows available';
  tableWrap.appendChild(empty);
}

function renderTable(
  tableWrap: HTMLElement,
  rows: BulkRow[],
  columns: BulkColumn[],
  flags: Record<string, boolean> | null,
  emptyLabel: string | null
) {
  tableWrap.innerHTML = '';
  if (rows.length === 0) {
    renderEmpty(tableWrap, emptyLabel);
    return;
  }

  const visibleColumns = columns.filter((col) => {
    if (!col.flag) return true;
    return isFlagEnabled(flags, col.flag);
  });

  if (visibleColumns.length === 0) {
    renderEmpty(tableWrap, 'No editable fields available');
    return;
  }

  const table = document.createElement('table');
  table.className = 'diet-bulk-edit__table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  visibleColumns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label || '';
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    visibleColumns.forEach((col, colIndex) => {
      const td = document.createElement('td');
      const controlType = (col.control || 'text').toLowerCase();
      const path = col.path || '';
      const value = path ? row.data[path] : undefined;

      if (controlType === 'logo') {
        const wrap = document.createElement('div');
        wrap.className = 'diet-bulk-edit__logo';
        const preview = document.createElement('div');
        preview.className = 'diet-bulk-edit__logo-preview';
        if (typeof value === 'string' && value.trim()) {
          preview.style.background = value;
        }
        const name = document.createElement('div');
        name.className = 'diet-bulk-edit__logo-name';
        const labelPath = col.labelPath || 'name';
        const nameValue = row.data[labelPath];
        name.textContent = typeof nameValue === 'string' ? nameValue : '';
        wrap.appendChild(preview);
        wrap.appendChild(name);
        td.appendChild(wrap);
        tr.appendChild(td);
        return;
      }

      if (controlType === 'upload') {
        const upload = buildUploadControl({
          id: `bulk-upload-${rowIndex}-${colIndex}`,
          label: col.label || 'Logo',
          placeholder: col.placeholder || 'Upload logo',
          path: path ? `${row.pathPrefix}.${path}` : '',
          metaPath: col.metaPath ? `${row.pathPrefix}.${col.metaPath}` : '',
          accept: col.accept || 'image/*,.svg',
          value: typeof value === 'string' ? value : '',
          meta: col.metaPath ? (row.data[col.metaPath] as Record<string, unknown>) : null,
        });
        const wrap = document.createElement('div');
        wrap.className = 'diet-bulk-edit__upload';
        wrap.appendChild(upload);
        td.appendChild(wrap);
        tr.appendChild(td);
        if (col.autoNamePath) {
          wireAutoNameSync(upload, tr, `${row.pathPrefix}.${col.autoNamePath}`);
        }
        return;
      }

      if (controlType === 'checkbox' || controlType === 'toggle') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'diet-bulk-edit__checkbox';
        input.checked = value === true;
        if (path) input.setAttribute('data-bulk-path', `${row.pathPrefix}.${path}`);
        input.setAttribute('aria-label', col.label || path);
        td.appendChild(input);
        tr.appendChild(td);
        return;
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'diet-bulk-edit__input';
      input.value = value == null ? '' : String(value);
      if (col.placeholder) input.placeholder = col.placeholder;
      if (path) input.setAttribute('data-bulk-path', `${row.pathPrefix}.${path}`);
      input.setAttribute('aria-label', col.label || path);
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  hydrateUploadControls(tableWrap);
}

function dispatchUpsell(root: HTMLElement, reasonKey: string) {
  root.dispatchEvent(
    new CustomEvent('bob-upsell', {
      detail: { reasonKey },
      bubbles: true,
    })
  );
}

export function hydrateBulkEdit(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-bulk-edit').forEach((root) => {
    if (root.dataset.bulkEditHydrated === 'true') return;
    root.dataset.bulkEditHydrated = 'true';

    const openBtn = root.querySelector<HTMLButtonElement>('[data-bulk-open]');
    const modal = root.querySelector<HTMLElement>('[data-bulk-modal]');
    const tableWrap = root.querySelector<HTMLElement>('[data-bulk-table]');
    const closeBtn = root.querySelector<HTMLButtonElement>('[data-bulk-close]');
    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-bulk-cancel]');
    const saveBtn = root.querySelector<HTMLButtonElement>('[data-bulk-save]');
    const hidden = root.querySelector<HTMLInputElement>('.diet-bulk-edit__field');

    if (!openBtn || !modal || !tableWrap || !saveBtn || !hidden) return;

    const columns = parseColumns(root.getAttribute('data-columns'));
    const rowPath = root.getAttribute('data-row-path') || '';
    const path = root.getAttribute('data-bulk-path') || root.getAttribute('data-path') || '';

    const render = () => {
    const strips = readJsonArray(hidden);
    const rows = buildRows(path, rowPath, strips);
    const flags = readPolicyFlags(root);
    const emptyLabel = root.getAttribute('data-empty-label');
    renderTable(tableWrap, rows, columns, flags, emptyLabel);
  };

    const openModal = () => {
      const flags = readPolicyFlags(root);
      const allowLinks = isFlagEnabled(flags, 'links.enabled');
      const allowMeta = isFlagEnabled(flags, 'media.meta.enabled');
      if (!allowLinks && !allowMeta) {
        dispatchUpsell(root, 'coreui.upsell.reason.flagBlocked');
        return;
      }
      render();
      modal.hidden = false;
      const firstInput = modal.querySelector<HTMLInputElement>('input');
      if (firstInput) firstInput.focus({ preventScroll: true });
      document.addEventListener('keydown', handleKeydown);
    };

    const closeModal = () => {
      modal.hidden = true;
      document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeModal();
    };

    const save = () => {
      const inputs = Array.from(modal.querySelectorAll<HTMLInputElement>('[data-bulk-path]'));
      const ops = inputs
        .map((input) => {
          const targetPath = input.getAttribute('data-bulk-path');
          if (!targetPath) return null;
          const value = input.type === 'checkbox' ? input.checked : input.value;
          return { op: 'set', path: targetPath, value };
        })
        .filter(Boolean) as Array<{ op: 'set'; path: string; value: unknown }>;

      if (ops.length > 0) {
        root.dispatchEvent(
          new CustomEvent('bob-ops', {
            detail: { ops },
            bubbles: true,
          })
        );
      }
      closeModal();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    saveBtn.addEventListener('click', save);
  });
}

function hydrateUploadControls(scope: HTMLElement) {
  const anyWindow = window as unknown as { Dieter?: { hydrateDropdownUpload?: (scope: Element) => void } };
  const hydrate = anyWindow?.Dieter?.hydrateDropdownUpload;
  if (typeof hydrate === 'function') {
    hydrate(scope);
  }
}

function buildUploadControl(args: {
  id: string;
  label: string;
  placeholder: string;
  path: string;
  metaPath: string;
  accept: string;
  value: string;
  meta: Record<string, unknown> | null;
}): HTMLElement {
  const root = document.createElement('div');
  root.className = 'diet-dropdown-upload diet-popover-host';
  root.dataset.size = 'md';
  root.dataset.state = 'closed';

  const label = escapeAttr(args.label || 'Logo');
  const placeholder = escapeAttr(args.placeholder || 'Upload');
  const id = escapeAttr(args.id);
  const path = escapeAttr(args.path || '');
  const metaPath = escapeAttr(args.metaPath || '');
  const accept = escapeAttr(args.accept || 'image/*');
  const value = escapeAttr(args.value || '');
  const metaValue = args.meta ? escapeAttr(JSON.stringify(args.meta)) : '';
  const metaAttr = metaPath ? ` data-bob-path="${metaPath}"` : '';

  root.innerHTML = `
    <input
      id="${id}"
      type="hidden"
      class="diet-dropdown-upload__value-field"
      value="${value}"
      data-bob-path="${path}"
      data-placeholder="${placeholder}"
      data-accept="${accept}"
    />
    <input
      type="hidden"
      class="diet-dropdown-upload__meta-field"
      value="${metaValue}"
      ${metaAttr}
      data-bob-json
    />
    <div
      class="diet-dropdown-header diet-dropdown-upload__control"
      role="button"
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-labelledby="${id}-label"
    >
      <span class="diet-dropdown-header-label label-s" id="${id}-label">${label}</span>
      <span class="diet-dropdown-header-value body-s" data-muted="true" data-placeholder="${placeholder}">
        <span class="diet-dropdown-upload__label">${placeholder}</span>
      </span>
    </div>
    <div class="diet-popover diet-dropdown-upload__popover" role="dialog" aria-label="${label}" data-state="closed">
      <div class="diet-popover__header">
        <span class="diet-popover__header-label label-s">${label}</span>
        <button
          type="button"
          class="diet-btn-ic diet-popover__header-trigger"
          data-size="sm"
          data-variant="neutral"
          aria-hidden="true"
          tabindex="-1"
        >
          <span class="diet-btn-ic__icon" data-icon="paintbrush"></span>
        </button>
      </div>
      <div class="diet-popover__body">
        <div class="diet-dropdown-upload__panel body-xs" data-has-file="false" data-kind="empty">
          <div class="diet-dropdown-upload__preview" aria-hidden="true">
            <div class="diet-dropdown-upload__preview-frame">
              <img class="diet-dropdown-upload__preview-img" data-role="img" alt="" />
              <div class="diet-dropdown-upload__preview-video" data-role="video">
                <video
                  class="diet-dropdown-upload__preview-video-el"
                  data-role="videoEl"
                  muted
                  playsinline
                  preload="metadata"
                ></video>
                <div class="diet-dropdown-upload__preview-video-badge label-s">Video</div>
              </div>
              <div class="diet-dropdown-upload__preview-doc" data-role="doc">
                <button
                  type="button"
                  class="diet-btn-ic diet-dropdown-upload__preview-doc-icon"
                  data-size="xl"
                  data-variant="neutral"
                  aria-hidden="true"
                  tabindex="-1"
                >
                  <span class="diet-btn-ic__icon" data-icon="document"></span>
                </button>
                <div class="diet-dropdown-upload__preview-doc-ext label-s" data-role="ext"></div>
              </div>
              <div class="diet-dropdown-upload__preview-empty" data-role="empty">
                <button
                  type="button"
                  class="diet-btn-ic diet-dropdown-upload__preview-empty-icon"
                  data-size="xl"
                  data-variant="neutral"
                  aria-hidden="true"
                  tabindex="-1"
                >
                  <span class="diet-btn-ic__icon" data-icon="square.dashed"></span>
                </button>
              </div>
            </div>
            <div class="diet-dropdown-upload__preview-meta">
              <div class="diet-dropdown-upload__preview-name label-s" data-role="name"></div>
              <div class="diet-dropdown-upload__preview-error label-xs" data-role="error"></div>
            </div>
          </div>
          <div class="diet-dropdown-upload__actions">
            <button type="button" class="diet-btn-txt diet-dropdown-upload__upload-btn" data-size="lg" data-variant="line1">
              <span class="diet-btn-txt__label">Upload</span>
            </button>
            <div class="diet-dropdown-upload__file-controls">
              <button type="button" class="diet-btn-txt diet-dropdown-upload__replace-btn" data-size="lg" data-variant="line1">
                <span class="diet-btn-txt__label">Replace</span>
              </button>
              <button type="button" class="diet-btn-txt diet-dropdown-upload__remove-btn" data-size="lg" data-variant="neutral">
                <span class="diet-btn-txt__label">Remove</span>
              </button>
            </div>
          </div>
          <input type="file" class="diet-dropdown-upload__file-input" accept="${accept}" aria-hidden="true" tabindex="-1" />
        </div>
      </div>
    </div>
  `;

  return root;
}
