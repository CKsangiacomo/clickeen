import { createDropdownHydrator } from '../shared/dropdownToggle';
import {
  dispatchAccountAssetUpsell,
  type AccountAssetsClient,
  type ResolvedAccountAsset,
} from '../shared/account-assets';
import { resolveSingleAccountAsset } from '../shared/account-asset-resolve';

type UploadValue = {
  assetRef: string;
  name: string;
};

type PreviewKind = 'empty' | 'loading' | 'image' | 'video' | 'doc';

type DropdownUploadState = {
  root: HTMLElement;
  accountAssets: AccountAssetsClient;
  input: HTMLInputElement;
  headerValue: HTMLElement;
  headerValueLabel: HTMLElement;
  panel: HTMLElement;
  previewImg: HTMLImageElement;
  previewVideo: HTMLVideoElement;
  previewExt: HTMLElement;
  previewName: HTMLElement;
  previewError: HTMLElement;
  selected: HTMLElement;
  uploadButton: HTMLButtonElement;
  replaceButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  fileActions: HTMLElement;
  fileInput: HTMLInputElement;
  uploadErrorCopy: string;
  previewErrorCopy: string;
  value: UploadValue | null;
  resolveRequestId: number;
  destroyed: boolean;
  internalWrite: boolean;
  nativeValue: { get: () => string; set: (next: string) => void };
};

const states = new Map<HTMLElement, DropdownUploadState>();

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-upload',
  triggerSelector: '.diet-dropdown-upload__control',
  onOpen: (root) => syncFromValue(states.get(root)!),
});

export function hydrateDropdownUpload(
  scope: Element | DocumentFragment,
  options: { accountAssets: AccountAssetsClient },
): void {
  scope.querySelectorAll<HTMLElement>('.diet-dropdown-upload').forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root, options.accountAssets);
    states.set(root, state);
    installHandlers(state);
    syncFromValue(state);
  });
  hydrateHost(scope);
}

export function destroyDropdownUpload(root: HTMLElement): void {
  const state = states.get(root);
  if (state) {
    state.destroyed = true;
    state.resolveRequestId += 1;
    state.previewVideo.pause();
    state.previewVideo.removeAttribute('src');
    state.previewImg.removeAttribute('src');
    states.delete(root);
  }
  hydrateHost.destroy(root);
}

function createState(root: HTMLElement, accountAssets: AccountAssetsClient): DropdownUploadState {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-upload__value-field')!;
  return {
    root,
    accountAssets,
    input,
    headerValue: root.querySelector<HTMLElement>('.diet-dropdown-header-value')!,
    headerValueLabel: root.querySelector<HTMLElement>('.diet-dropdown-upload__label')!,
    panel: root.querySelector<HTMLElement>('.diet-dropdown-upload__panel')!,
    previewImg: root.querySelector<HTMLImageElement>('.diet-dropdown-upload__preview-img')!,
    previewVideo: root.querySelector<HTMLVideoElement>('.diet-dropdown-upload__preview-video')!,
    previewExt: root.querySelector<HTMLElement>('.diet-dropdown-upload__preview-ext')!,
    previewName: root.querySelector<HTMLElement>('.diet-dropdown-upload__preview-name')!,
    previewError: root.querySelector<HTMLElement>('.diet-dropdown-upload__preview-error')!,
    selected: root.querySelector<HTMLElement>('.diet-dropdown-upload__selected')!,
    uploadButton: root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__upload-btn')!,
    replaceButton: root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__replace-btn')!,
    removeButton: root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__remove-btn')!,
    fileActions: root.querySelector<HTMLElement>('.diet-dropdown-upload__file-actions')!,
    fileInput: root.querySelector<HTMLInputElement>('.diet-dropdown-upload__file-input')!,
    uploadErrorCopy: root.dataset.copyUploadAssetError!,
    previewErrorCopy: root.dataset.copyPreviewAssetError!,
    value: null,
    resolveRequestId: 0,
    destroyed: false,
    internalWrite: false,
    nativeValue: captureNativeValue(input),
  };
}

function installHandlers(state: DropdownUploadState): void {
  Object.defineProperty(state.input, 'value', {
    configurable: true,
    get: () => state.nativeValue.get(),
    set: (next: string) => {
      state.nativeValue.set(next);
      if (!state.internalWrite) syncFromValue(state);
    },
  });

  state.input.addEventListener('external-sync', () => syncFromValue(state));
  state.input.addEventListener('input', () => syncFromValue(state));

  const pickFile = (event: Event) => {
    event.preventDefault();
    state.fileInput.value = '';
    state.fileInput.click();
  };
  state.uploadButton.addEventListener('click', pickFile);
  state.replaceButton.addEventListener('click', pickFile);
  state.removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    writeValue(state, null);
  });
  state.fileInput.addEventListener('change', () => {
    const file = state.fileInput.files?.[0];
    if (file) void uploadSelectedFile(state, file);
  });

  state.previewImg.addEventListener('error', () => {
    if (state.panel.dataset.kind === 'image') setError(state, state.previewErrorCopy);
  });
  state.previewVideo.addEventListener('error', () => {
    if (state.panel.dataset.kind === 'video') setError(state, state.previewErrorCopy);
  });
}

async function uploadSelectedFile(state: DropdownUploadState, file: File): Promise<void> {
  setUploading(state, true);
  clearError(state);
  try {
    const asset = await state.accountAssets.uploadAsset(file, 'api');
    if (state.destroyed) return;
    writeValue(state, { assetRef: asset.assetRef, name: asset.filename });
  } catch (error) {
    if (state.destroyed) return;
    const upsellReason = state.accountAssets.resolveUploadUpsellReason(error);
    if (upsellReason) {
      dispatchAccountAssetUpsell(state.root, upsellReason);
      return;
    }
    setError(state, state.uploadErrorCopy);
  } finally {
    if (!state.destroyed) setUploading(state, false);
  }
}

function writeValue(state: DropdownUploadState, value: UploadValue | null): void {
  state.internalWrite = true;
  state.input.value = JSON.stringify(value);
  state.internalWrite = false;
  state.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function syncFromValue(state: DropdownUploadState): void {
  const value = parseValue(state.input.value);
  state.value = value;
  state.resolveRequestId += 1;
  clearError(state);

  if (value === null) {
    renderEmpty(state);
    return;
  }

  renderSelected(state, value, 'loading');
  void resolveStoredAsset(state, value);
}

async function resolveStoredAsset(state: DropdownUploadState, value: UploadValue): Promise<void> {
  await resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetRef: () => value.assetRef,
    beginRequest: () => {
      state.resolveRequestId += 1;
      return state.resolveRequestId;
    },
    isCurrent: (requestId, assetRef) =>
      !state.destroyed &&
      state.resolveRequestId === requestId &&
      state.value?.assetRef === assetRef,
    onResolved: (asset) => renderResolvedAsset(state, value, asset),
    onError: () => setError(state, state.previewErrorCopy),
  });
}

function renderResolvedAsset(
  state: DropdownUploadState,
  value: UploadValue,
  asset: ResolvedAccountAsset,
): void {
  const kind = classifyPreview(asset.contentType);
  renderSelected(state, value, kind);
  if (kind === 'image') {
    state.previewImg.src = asset.url;
  } else if (kind === 'video') {
    state.previewVideo.src = asset.url;
    state.previewVideo.load();
  } else {
    state.previewExt.textContent = contentTypeLabel(asset.contentType);
  }
}

function renderEmpty(state: DropdownUploadState): void {
  state.root.dataset.hasFile = 'false';
  state.panel.dataset.hasFile = 'false';
  state.panel.dataset.kind = 'empty';
  state.headerValue.dataset.muted = 'true';
  state.headerValueLabel.textContent = state.headerValueLabel.dataset.placeholder!;
  state.previewName.textContent = '';
  state.previewExt.textContent = '';
  state.selected.hidden = true;
  state.fileActions.hidden = true;
  clearMedia(state);
}

function renderSelected(state: DropdownUploadState, value: UploadValue, kind: PreviewKind): void {
  state.root.dataset.hasFile = 'true';
  state.panel.dataset.hasFile = 'true';
  state.panel.dataset.kind = kind;
  state.headerValue.dataset.muted = 'false';
  state.headerValueLabel.textContent = value.name;
  state.previewName.textContent = value.name;
  state.previewExt.textContent = '';
  state.selected.hidden = false;
  state.fileActions.hidden = false;
  clearMedia(state);
}

function clearMedia(state: DropdownUploadState): void {
  state.previewImg.removeAttribute('src');
  state.previewVideo.pause();
  state.previewVideo.removeAttribute('src');
}

function setUploading(state: DropdownUploadState, uploading: boolean): void {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  state.uploadButton.disabled = uploading;
  state.replaceButton.disabled = uploading;
  state.removeButton.disabled = uploading;
}

function setError(state: DropdownUploadState, copy: string): void {
  state.previewError.textContent = copy;
  state.previewError.hidden = false;
}

function clearError(state: DropdownUploadState): void {
  state.previewError.textContent = '';
  state.previewError.hidden = true;
}

function parseValue(raw: string): UploadValue | null {
  const value = JSON.parse(raw) as unknown;
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('dropdown_upload_value_invalid');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'assetRef' || keys[1] !== 'name') {
    throw new Error('dropdown_upload_value_invalid');
  }
  if (
    typeof record.assetRef !== 'string' ||
    !record.assetRef ||
    record.assetRef !== record.assetRef.trim() ||
    typeof record.name !== 'string' ||
    !record.name ||
    record.name !== record.name.trim()
  ) {
    throw new Error('dropdown_upload_value_invalid');
  }
  return { assetRef: record.assetRef, name: record.name };
}

function classifyPreview(contentType: string): PreviewKind {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.startsWith('image/')) return 'image';
  if (normalizedContentType.startsWith('video/')) return 'video';
  return 'doc';
}

function contentTypeLabel(contentType: string): string {
  const normalizedContentType = contentType.toLowerCase();
  return normalizedContentType.split('/')[1]!.split(/[;+]/)[0]!.toUpperCase();
}

function captureNativeValue(input: HTMLInputElement): DropdownUploadState['nativeValue'] {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
  return {
    get: () => String(descriptor.get!.call(input)),
    set: (next: string) => descriptor.set!.call(input, next),
  };
}
