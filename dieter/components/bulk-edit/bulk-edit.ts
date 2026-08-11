import { createDialogLifecycle } from '../shared/dialog-lifecycle';

type BulkColumn = {
  label: string;
  path: string;
  control: 'text' | 'checkbox';
  placeholder?: string;
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

function parseColumns(raw: string): BulkColumn[] {
  const decoded = decodeHtmlEntities(raw);
  return JSON.parse(decoded) as BulkColumn[];
}

function readJsonArray(input: HTMLInputElement): unknown[] {
  return JSON.parse(input.value) as unknown[];
}

function buildRows(path: string, rowPath: string, strips: unknown[]): BulkRow[] {
  const rows: BulkRow[] = [];
  strips.forEach((strip, stripIndex) => {
    const record = strip as Record<string, unknown>;
    const nested = record[rowPath] as Array<Record<string, unknown>>;
    nested.forEach((entry, rowIndex) => {
      rows.push({
        pathPrefix: `${path}.${stripIndex}.${rowPath}.${rowIndex}`,
        data: entry,
      });
    });
  });
  return rows;
}

function renderEmpty(tableWrap: HTMLElement, label: string) {
  tableWrap.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'diet-bulk-edit__empty body-s';
  empty.textContent = label;
  tableWrap.appendChild(empty);
}

function renderTable(
  tableWrap: HTMLElement,
  rows: BulkRow[],
  columns: BulkColumn[],
  emptyLabel: string,
) {
  tableWrap.innerHTML = '';
  if (rows.length === 0) {
    renderEmpty(tableWrap, emptyLabel);
    return;
  }

  const table = document.createElement('table');
  table.className = 'diet-table__table diet-bulk-edit__table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.className = 'label-s';
    th.textContent = col.label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      td.className = 'body-s';
      const controlType = col.control;
      const path = col.path;
      const value = row.data[path];

      if (controlType === 'checkbox') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'diet-bulk-edit__checkbox';
        input.checked = value === true;
        input.setAttribute('data-bulk-path', `${row.pathPrefix}.${path}`);
        input.setAttribute('aria-label', col.label);
        td.appendChild(input);
        tr.appendChild(td);
        return;
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'diet-bulk-edit__input body-s';
      input.value = value == null ? '' : String(value);
      if (col.placeholder) input.placeholder = col.placeholder;
      input.setAttribute('data-bulk-path', `${row.pathPrefix}.${path}`);
      input.setAttribute('aria-label', col.label);
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
}

export function hydrateBulkEdit(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-bulk-edit').forEach((root) => {
    if (root.dataset.bulkEditHydrated === 'true') return;
    root.dataset.bulkEditHydrated = 'true';

    const openBtn = root.querySelector<HTMLButtonElement>('[data-bulk-open]');
    const modal = root.querySelector<HTMLDialogElement>('[data-bulk-modal]');
    const tableWrap = root.querySelector<HTMLElement>('[data-bulk-table]');
    const closeBtn = root.querySelector<HTMLButtonElement>('[data-bulk-close]');
    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-bulk-cancel]');
    const saveBtn = root.querySelector<HTMLButtonElement>('[data-bulk-save]');
    const editor = root.querySelector<HTMLElement>('[data-bulk-editor]');
    const discard = root.querySelector<HTMLElement>('[data-bulk-discard]');
    const keepEditingBtn = root.querySelector<HTMLButtonElement>('[data-bulk-keep-editing]');
    const discardBtn = root.querySelector<HTMLButtonElement>('[data-bulk-discard-changes]');
    const hidden = root.querySelector<HTMLInputElement>('.diet-bulk-edit__field');

    if (
      !openBtn ||
      !modal ||
      !tableWrap ||
      !saveBtn ||
      !editor ||
      !discard ||
      !keepEditingBtn ||
      !discardBtn ||
      !hidden
    )
      return;

    const columns = parseColumns(root.dataset.columns!);
    const rowPath = root.dataset.rowPath!;
    const path = root.dataset.bulkPath!;
    const emptyLabel = root.dataset.emptyLabel!;

    const render = () => {
      const strips = readJsonArray(hidden);
      const rows = buildRows(path, rowPath, strips);
      renderTable(tableWrap, rows, columns, emptyLabel);
    };

    const captureWorkingState = () =>
      JSON.stringify(
        Array.from(modal.querySelectorAll<HTMLInputElement>('[data-bulk-path]')).map((input) => [
          input.getAttribute('data-bulk-path'),
          input.type === 'checkbox' ? input.checked : input.value,
        ]),
      );
    let openedState = '';

    const showEditor = () => {
      editor.hidden = false;
      discard.hidden = true;
    };

    const showDiscard = () => {
      editor.hidden = true;
      discard.hidden = false;
      keepEditingBtn.focus();
    };

    const isDirty = () => captureWorkingState() !== openedState;
    const lifecycle = createDialogLifecycle({
      dialog: modal,
      initialFocus: () => modal.querySelector<HTMLElement>('[data-bulk-path]') ?? cancelBtn,
      requestDismiss(reason) {
        if (reason === 'backdrop') return;
        if (isDirty()) showDiscard();
        else lifecycle.close();
      },
    });

    const requestClose = () => {
      if (isDirty()) showDiscard();
      else lifecycle.close();
    };

    const openModal = () => {
      render();
      openedState = captureWorkingState();
      showEditor();
      lifecycle.open(openBtn);
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
          }),
        );
      }
      openedState = captureWorkingState();
      lifecycle.close();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', requestClose);
    cancelBtn?.addEventListener('click', requestClose);
    keepEditingBtn.addEventListener('click', () => {
      showEditor();
      (modal.querySelector<HTMLElement>('[data-bulk-path]') ?? cancelBtn)?.focus();
    });
    discardBtn.addEventListener('click', () => lifecycle.close());
    saveBtn.addEventListener('click', save);
  });
}
