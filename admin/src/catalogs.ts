import {
  destroyDropdownActions,
  hydrateDropdownActions,
  hydrateTextfield,
} from '@dieter/components';
import type { CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import {
  decodeCatalogCollection,
  decodeCatalogDetail,
  readCatalogPresentation,
  type CatalogKind,
  type DevStudioCatalogCollection,
  type DevStudioCatalogSource,
  type DevStudioCatalogTemplate,
} from './data/catalogs';

const ROMA_ORIGIN = 'https://roma.dev.clickeen.com';

type CatalogDialog = {
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  status: HTMLElement;
  save: HTMLButtonElement;
};

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body
      ? { 'content-type': 'application/json', ...init.headers }
      : init?.headers,
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) throw new Error('catalog_request_failed');
  return payload;
}

function textfield(name: string, label: string, args?: { type?: string; maxLength?: number }): string {
  return `
    <div class="diet-textfield" data-size="md">
      <label class="diet-textfield__control">
        <span class="diet-textfield__display-label label-s">${label}</span>
        <input class="diet-textfield__field body-s" name="${name}" type="${args?.type ?? 'text'}"${args?.maxLength ? ` maxlength="${args.maxLength}"` : ''} autocomplete="off" required />
      </label>
    </div>
  `;
}

function presentationFields(): string {
  return `
    ${textfield('thumbnailAssetRef', 'Thumbnail asset ref', { maxLength: 500 })}
    ${textfield('description', 'Description', { maxLength: 500 })}
    ${textfield('category', 'Category', { maxLength: 120 })}
    ${textfield('displayOrder', 'Display order', { type: 'number' })}
  `;
}

function createDialog(args: {
  id: string;
  title: string;
  body: string;
  saveLabel: string;
}): CatalogDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'diet-popup devstudio-catalog-dialog';
  dialog.dataset.size = 'medium';
  dialog.setAttribute('aria-labelledby', `${args.id}-title`);
  dialog.innerHTML = `
    <form class="devstudio-catalog-dialog__form">
      <header class="diet-popup__header">
        <h2 class="heading-4" id="${args.id}-title">${args.title}</h2>
      </header>
      <div class="diet-popup__body devstudio-catalog-dialog__body">
        ${args.body}
        <p class="body-xs devstudio-catalog-dialog__status" aria-live="polite"></p>
      </div>
      <footer class="diet-popup__footer">
        <div class="diet-popup__actions">
          <button class="diet-btn-txt" data-size="md" data-variant="secondary" type="button" data-dialog-cancel>
            <span class="diet-btn-txt__label">Cancel</span>
          </button>
          <button class="diet-btn-txt" data-size="md" data-variant="primary" type="submit">
            <span class="diet-btn-txt__label">${args.saveLabel}</span>
          </button>
        </div>
      </footer>
    </form>
  `;
  const form = dialog.querySelector<HTMLFormElement>('form');
  const status = dialog.querySelector<HTMLElement>('.devstudio-catalog-dialog__status');
  const save = dialog.querySelector<HTMLButtonElement>('button[type="submit"]');
  const cancel = dialog.querySelector<HTMLButtonElement>('[data-dialog-cancel]');
  if (!form || !status || !save || !cancel) throw new Error('catalog_dialog_invalid');
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    if (form.getAttribute('aria-busy') === 'true') event.preventDefault();
  });
  hydrateTextfield(dialog);
  return { dialog, form, status, save };
}

function setDialogBusy(view: CatalogDialog, busy: boolean): void {
  view.form.setAttribute('aria-busy', busy ? 'true' : 'false');
  view.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
    control.disabled = busy;
  });
}

function setDialogStatus(view: CatalogDialog, copy: string, error = false): void {
  view.status.textContent = copy;
  view.status.dataset.state = error ? 'error' : '';
}

function setPresentation(form: HTMLFormElement, presentation: CatalogPresentation): void {
  const values: Record<string, string> = {
    thumbnailAssetRef: presentation.thumbnailAssetRef,
    description: presentation.description,
    category: presentation.category,
    displayOrder: String(presentation.displayOrder),
  };
  Object.entries(values).forEach(([name, value]) => {
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.value = value;
  });
}

function readPresentation(form: HTMLFormElement): CatalogPresentation | null {
  const value = (name: string) => {
    const input = form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? input.value : '';
  };
  return readCatalogPresentation({
    thumbnailAssetRef: value('thumbnailAssetRef'),
    description: value('description'),
    category: value('category'),
    displayOrder: value('displayOrder'),
  });
}

function createDropdown(args: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}): HTMLElement {
  const root = document.createElement('div');
  root.className = 'diet-dropdown-actions diet-popover-host';
  root.dataset.size = 'md';
  root.dataset.state = 'closed';

  const input = document.createElement('input');
  input.className = 'diet-dropdown-actions__value-field';
  input.name = args.name;
  input.type = 'hidden';
  input.value = args.options[0]?.value ?? '';
  input.dataset.placeholder = args.options.length ? `Choose ${args.label.toLocaleLowerCase()}` : `No ${args.label.toLocaleLowerCase()} available`;

  const trigger = document.createElement('button');
  trigger.className = 'diet-dropdown-header diet-dropdown-actions__control';
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.disabled = args.options.length === 0;
  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'diet-dropdown-header-label label-s';
  triggerLabel.textContent = args.label;
  const triggerValue = document.createElement('span');
  triggerValue.className = 'diet-dropdown-header-value body-s';
  triggerValue.dataset.muted = 'true';
  trigger.append(triggerLabel, triggerValue);

  const popover = document.createElement('div');
  popover.className = 'diet-popover diet-dropdown-actions__popover';
  popover.dataset.state = 'closed';
  popover.setAttribute('role', 'listbox');
  popover.setAttribute('aria-label', args.label);
  const menu = document.createElement('div');
  menu.className = 'diet-popover__body diet-dropdown-actions__menu';
  args.options.forEach((option) => {
    const action = document.createElement('button');
    action.className = 'diet-btn-menuactions diet-dropdown-actions__menuaction';
    action.dataset.size = 'md';
    action.dataset.variant = 'neutral';
    action.dataset.value = option.value;
    action.dataset.label = option.label;
    action.type = 'button';
    action.setAttribute('role', 'option');
    const label = document.createElement('span');
    label.className = 'diet-btn-menuactions__label body-s';
    label.textContent = option.label;
    action.append(label);
    menu.append(action);
  });
  popover.append(menu);
  root.append(input, trigger, popover);
  hydrateDropdownActions(root);
  return root;
}

function editorUrl(kind: CatalogKind, id: string): string {
  return kind === 'widgets'
    ? `${ROMA_ORIGIN}/builder/${encodeURIComponent(id)}`
    : `${ROMA_ORIGIN}/page-builder/${encodeURIComponent(id)}`;
}

function apiPath(kind: CatalogKind, id?: string): string {
  return `/api/catalog/${kind}${id ? `/${encodeURIComponent(id)}` : ''}`;
}

function sourceOptions(kind: CatalogKind, sources: DevStudioCatalogSource[]): Array<{ value: string; label: string }> {
  return sources.map((source) => ({
    value: source.sourceId,
    label: kind === 'widgets' ? `${source.displayName} — ${source.widgetType}` : source.displayName,
  }));
}

function readExactFormText(form: HTMLFormElement, name: string): string {
  const input = form.elements.namedItem(name);
  if (!(input instanceof HTMLInputElement)) return '';
  return input.value && input.value === input.value.trim() ? input.value : '';
}

export function renderCatalogView(kind: CatalogKind): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const label = kind === 'widgets' ? 'Widget' : 'Page';
  const actions = document.createElement('div');
  actions.dataset.pageActions = '';
  actions.className = 'devstudio-catalog-actions';
  actions.innerHTML = `
    <div data-widget-type-choice></div>
    <a class="diet-btn-txt" data-size="md" data-variant="secondary" data-create-source>
      <span class="diet-btn-txt__label">Create ${label} source</span>
    </a>
    <button class="diet-btn-txt" data-size="md" data-variant="primary" type="button" data-create-catalog disabled>
      <span class="diet-btn-txt__label">Create Catalog item</span>
    </button>
  `;

  const root = document.createElement('section');
  root.className = 'devstudio-catalog stack';
  root.innerHTML = `
    <div class="devstudio-catalog__status-row">
      <p class="body-s devstudio-catalog__status" role="status" aria-live="polite">Loading ${label} catalog…</p>
      <button class="diet-btn-txt" data-size="md" data-variant="secondary" type="button" data-catalog-retry hidden>
        <span class="diet-btn-txt__label">Retry</span>
      </button>
    </div>
    <div class="diet-table devstudio-catalog__table" hidden>
      <table class="diet-table__table">
        <caption class="visually-hidden">CLICKEEN ${label} catalog templates</caption>
        <thead>
          <tr>
            <th class="label-s" scope="col">Template</th>
            <th class="label-s" scope="col">Category</th>
            <th class="label-s" scope="col">Order</th>
            <th class="label-s" scope="col">Thumbnail asset ref</th>
            <th class="label-s diet-table__cell--action" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const createView = createDialog({
    id: `devstudio-${kind}-catalog-create`,
    title: `Create ${label} Catalog item`,
    body: `<div data-create-source-choice></div>${textfield('templateName', 'Template name', { maxLength: 120 })}${presentationFields()}`,
    saveLabel: 'Save',
  });
  const editView = createDialog({
    id: `devstudio-${kind}-catalog-edit`,
    title: `Edit ${label} Catalog presentation`,
    body: presentationFields(),
    saveLabel: 'Save',
  });
  const renameView = createDialog({
    id: `devstudio-${kind}-catalog-rename`,
    title: `Rename ${label} Catalog template`,
    body: textfield('displayName', 'Template name', { maxLength: 120 }),
    saveLabel: 'Rename',
  });
  const deleteView = createDialog({
    id: `devstudio-${kind}-catalog-delete`,
    title: `Delete ${label} Catalog item?`,
    body: '<p class="body-s">This permanently deletes the CLICKEEN Catalog template. The ordinary source is not deleted.</p>',
    saveLabel: 'Delete',
  });
  root.append(createView.dialog, editView.dialog, renameView.dialog, deleteView.dialog);
  fragment.append(actions, root);

  const status = root.querySelector<HTMLElement>('.devstudio-catalog__status');
  const tableFrame = root.querySelector<HTMLElement>('.devstudio-catalog__table');
  const tableBody = root.querySelector<HTMLTableSectionElement>('tbody');
  const retryButton = root.querySelector<HTMLButtonElement>('[data-catalog-retry]');
  const createButton = actions.querySelector<HTMLButtonElement>('[data-create-catalog]');
  const createSourceLink = actions.querySelector<HTMLAnchorElement>('[data-create-source]');
  const widgetTypeChoice = actions.querySelector<HTMLElement>('[data-widget-type-choice]');
  const createSourceChoice = createView.form.querySelector<HTMLElement>('[data-create-source-choice]');
  if (!status || !tableFrame || !tableBody || !retryButton || !createButton || !createSourceLink || !widgetTypeChoice || !createSourceChoice) {
    throw new Error('catalog_view_invalid');
  }

  let collection: DevStudioCatalogCollection = { templates: [], sources: [], widgetTypes: [] };
  let activeTemplate: DevStudioCatalogTemplate | null = null;
  let sourceDropdown: HTMLElement | null = null;
  let widgetTypeDropdown: HTMLElement | null = null;

  const setStatus = (copy: string, state: 'loading' | 'error' | 'ready' = 'ready') => {
    status.textContent = copy;
    status.dataset.state = state;
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    retryButton.hidden = state !== 'error';
  };

  const configureSourceActions = () => {
    if (sourceDropdown) destroyDropdownActions(sourceDropdown);
    sourceDropdown = createDropdown({
      label: `${label} source`,
      name: 'sourceId',
      options: sourceOptions(kind, collection.sources),
    });
    createSourceChoice.replaceChildren(sourceDropdown);

    if (widgetTypeDropdown) destroyDropdownActions(widgetTypeDropdown);
    widgetTypeChoice.replaceChildren();
    if (kind === 'pages') {
      createSourceLink.href = `${ROMA_ORIGIN}/page-builder/new`;
      createSourceLink.hidden = false;
      return;
    }
    const widgetTypes = Array.from(new Set([
      ...collection.widgetTypes,
      ...collection.sources.map((source) => source.widgetType ?? ''),
      ...collection.templates.map((template) => template.widgetType ?? ''),
    ].filter(Boolean))).sort((left, right) => left.localeCompare(right));
    if (!widgetTypes.length) {
      createSourceLink.hidden = true;
      return;
    }
    widgetTypeDropdown = createDropdown({
      label: 'Widget type',
      name: 'widgetType',
      options: widgetTypes.map((widgetType) => ({ value: widgetType, label: widgetType })),
    });
    const input = widgetTypeDropdown.querySelector<HTMLInputElement>('.diet-dropdown-actions__value-field');
    const updateLink = () => {
      createSourceLink.href = `${ROMA_ORIGIN}/builder?new=${encodeURIComponent(input?.value ?? '')}`;
    };
    input?.addEventListener('input', updateLink);
    updateLink();
    widgetTypeChoice.append(widgetTypeDropdown);
    createSourceLink.hidden = false;
  };

  const openEdit = async (template: DevStudioCatalogTemplate, opener: HTMLButtonElement) => {
    opener.disabled = true;
    setStatus(`Loading ${template.templateName}…`, 'loading');
    try {
      const current = decodeCatalogDetail(kind, await requestJson(apiPath(kind, template.templateId)));
      if (!current || current.templateId !== template.templateId) throw new Error('catalog_payload_invalid');
      if (!root.isConnected) return;
      activeTemplate = current;
      setPresentation(editView.form, current.catalogPresentation);
      setDialogStatus(editView, '');
      editView.dialog.showModal();
      setStatus('');
    } catch {
      if (root.isConnected) setStatus(`${label} Catalog item could not be opened. Please try again.`, 'error');
    } finally {
      opener.disabled = false;
    }
  };

  const renderRows = () => {
    tableBody.replaceChildren();
    const templates = collection.templates.slice().sort((left, right) =>
      left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder ||
      left.templateName.localeCompare(right.templateName) ||
      left.templateId.localeCompare(right.templateId),
    );
    templates.forEach((template) => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.className = 'body-s';
      name.scope = 'row';
      name.textContent = template.templateName;
      const category = document.createElement('td');
      category.className = 'body-s';
      category.textContent = template.catalogPresentation.category;
      const order = document.createElement('td');
      order.className = 'body-s';
      order.textContent = String(template.catalogPresentation.displayOrder);
      const thumbnail = document.createElement('td');
      thumbnail.className = 'body-s devstudio-catalog__asset-ref';
      thumbnail.textContent = template.catalogPresentation.thumbnailAssetRef;
      const actionCell = document.createElement('td');
      actionCell.className = 'body-s diet-table__cell--action';
      const actionList = document.createElement('div');
      actionList.className = 'devstudio-catalog__row-actions';
      const open = document.createElement('a');
      open.className = 'diet-btn-txt';
      open.dataset.size = 'sm';
      open.dataset.variant = 'secondary';
      open.href = editorUrl(kind, template.templateId);
      open.target = '_blank';
      open.rel = 'noopener';
      open.innerHTML = '<span class="diet-btn-txt__label">Open source</span>';
      const edit = document.createElement('button');
      edit.className = 'diet-btn-txt';
      edit.dataset.size = 'sm';
      edit.dataset.variant = 'secondary';
      edit.type = 'button';
      edit.innerHTML = '<span class="diet-btn-txt__label">Edit presentation</span>';
      edit.addEventListener('click', () => void openEdit(template, edit));
      const rename = document.createElement('button');
      rename.className = 'diet-btn-txt';
      rename.dataset.size = 'sm';
      rename.dataset.variant = 'secondary';
      rename.type = 'button';
      rename.innerHTML = '<span class="diet-btn-txt__label">Rename</span>';
      rename.addEventListener('click', () => {
        activeTemplate = template;
        const input = renameView.form.elements.namedItem('displayName');
        if (input instanceof HTMLInputElement) input.value = template.templateName;
        setDialogStatus(renameView, '');
        renameView.dialog.showModal();
      });
      const remove = document.createElement('button');
      remove.className = 'diet-btn-txt';
      remove.dataset.size = 'sm';
      remove.dataset.variant = 'secondary';
      remove.type = 'button';
      remove.innerHTML = '<span class="diet-btn-txt__label">Delete</span>';
      remove.addEventListener('click', () => {
        activeTemplate = template;
        setDialogStatus(deleteView, '');
        deleteView.dialog.showModal();
      });
      actionList.append(open, edit, rename, remove);
      actionCell.append(actionList);
      row.append(name, category, order, thumbnail, actionCell);
      tableBody.append(row);
    });
    tableFrame.hidden = false;
    setStatus(templates.length ? '' : `No ${label} Catalog items yet.`);
  };

  const load = async (afterMutationCopy = '') => {
    try {
      const decoded = decodeCatalogCollection(kind, await requestJson(apiPath(kind)));
      if (!decoded) throw new Error('catalog_payload_invalid');
      if (!root.isConnected) return;
      collection = decoded;
      configureSourceActions();
      renderRows();
      createButton.disabled = false;
      if (afterMutationCopy) setStatus(afterMutationCopy);
    } catch {
      if (!root.isConnected) return;
      if (afterMutationCopy) {
        createButton.disabled = true;
        tableBody.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = true; });
        setStatus(`${afterMutationCopy} The current list could not be refreshed; reload DevStudio before another change.`, 'error');
      } else {
        tableFrame.hidden = true;
        createButton.disabled = true;
        setStatus(`${label} Catalog could not be loaded. Please try again.`, 'error');
      }
    }
  };

  const refreshAfterMutation = async (copy: string) => {
    renderRows();
    await load(copy);
  };

  createButton.addEventListener('click', () => {
    createView.form.reset();
    configureSourceActions();
    setDialogStatus(createView, collection.sources.length ? '' : `Create an ordinary ${label} source first.`, collection.sources.length === 0);
    createView.save.disabled = collection.sources.length === 0;
    createView.dialog.showModal();
  });
  retryButton.addEventListener('click', () => {
    retryButton.disabled = true;
    setStatus(`Loading ${label} catalog…`, 'loading');
    void load().finally(() => { retryButton.disabled = false; });
  });

  createView.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const sourceId = readExactFormText(createView.form, 'sourceId');
    const templateName = readExactFormText(createView.form, 'templateName');
    const catalogPresentation = readPresentation(createView.form);
    if (!sourceId || !templateName || !catalogPresentation) {
      setDialogStatus(createView, 'Choose a source and enter a valid template name and all four presentation fields.', true);
      return;
    }
    setDialogBusy(createView, true);
    setDialogStatus(createView, 'Saving…');
    void requestJson(apiPath(kind), {
      method: 'POST',
      body: JSON.stringify({ sourceId, templateName, catalogPresentation }),
    }).then(async () => {
      createView.dialog.close();
      await load('Catalog item saved.');
    }).catch(() => {
      setDialogStatus(createView, 'Catalog item could not be saved. Please try again.', true);
    }).finally(() => setDialogBusy(createView, false));
  });

  editView.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const template = activeTemplate;
    const catalogPresentation = readPresentation(editView.form);
    if (!template || !catalogPresentation) {
      setDialogStatus(editView, 'Enter all four valid presentation fields.', true);
      return;
    }
    setDialogBusy(editView, true);
    setDialogStatus(editView, 'Saving…');
    void requestJson(apiPath(kind, template.templateId), {
      method: 'PATCH',
      body: JSON.stringify({ catalogPresentation }),
    }).then(async () => {
      collection.templates = collection.templates.map((entry) => entry.templateId === template.templateId ? { ...entry, catalogPresentation } : entry);
      editView.dialog.close();
      await refreshAfterMutation('Catalog presentation saved.');
    }).catch(() => {
      setDialogStatus(editView, 'Catalog presentation could not be saved. Please try again.', true);
    }).finally(() => setDialogBusy(editView, false));
  });

  renameView.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const template = activeTemplate;
    const displayName = readExactFormText(renameView.form, 'displayName');
    if (!template || !displayName || displayName === template.templateName) {
      setDialogStatus(renameView, 'Enter a different template name.', true);
      return;
    }
    setDialogBusy(renameView, true);
    setDialogStatus(renameView, 'Renaming…');
    void requestJson(`${apiPath(kind, template.templateId)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    }).then(async () => {
      collection.templates = collection.templates.map((entry) => entry.templateId === template.templateId ? { ...entry, templateName: displayName } : entry);
      renameView.dialog.close();
      await refreshAfterMutation('Catalog template renamed.');
    }).catch(() => {
      setDialogStatus(renameView, 'Catalog template could not be renamed. Please try again.', true);
    }).finally(() => setDialogBusy(renameView, false));
  });

  deleteView.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const template = activeTemplate;
    if (!template) return;
    setDialogBusy(deleteView, true);
    setDialogStatus(deleteView, 'Deleting…');
    void requestJson(apiPath(kind, template.templateId), { method: 'DELETE' }).then(async () => {
      collection.templates = collection.templates.filter((entry) => entry.templateId !== template.templateId);
      deleteView.dialog.close();
      await refreshAfterMutation('Catalog item deleted.');
    }).catch(() => {
      setDialogStatus(deleteView, 'Catalog item could not be deleted. Please try again.', true);
    }).finally(() => setDialogBusy(deleteView, false));
  });

  void load();
  return fragment;
}
