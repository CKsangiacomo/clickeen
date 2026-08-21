import { sameAssetReferenceUrl } from './color-utils';
import type { DropdownFillHeaderUpdate, DropdownFillState } from './dropdown-fill-types';
import type { FillValue } from './fill-types';
import {
  dispatchAccountAssetUpsell,
  type AccountAssetRecord,
} from '../shared/account-assets';
import { resolveSingleAccountAsset } from '../shared/account-asset-resolve';

export type SetMediaSrcOptions = {
  commit: boolean;
  updateHeader?: boolean;
};

export type MediaControllerDeps = {
  setInputValue: (state: DropdownFillState, value: FillValue, emit: boolean) => void;
  updateHeader: (state: DropdownFillState, opts: DropdownFillHeaderUpdate) => void;
};

function setFillCommandPending(
  state: DropdownFillState,
  commandButton: HTMLButtonElement,
  pending: boolean,
): void {
  state.root.dataset.uploading = pending ? 'true' : 'false';
  [
    state.uploadButton,
    state.chooseButton,
    state.removeButton,
    state.videoUploadButton,
    state.videoChooseButton,
    state.videoRemoveButton,
  ].forEach((button) => {
    if (button) button.disabled = pending;
  });

  if (pending) {
    commandButton.dataset.loading = 'true';
    commandButton.setAttribute('aria-busy', 'true');
  } else {
    delete commandButton.dataset.loading;
    commandButton.removeAttribute('aria-busy');
  }

  const icon = commandButton.querySelector<HTMLElement>(':scope > .diet-icon');
  const spinner = commandButton.querySelector<HTMLElement>(':scope > .diet-spinner');
  if (icon) icon.hidden = pending;
  if (spinner) spinner.hidden = !pending;
}

function setStoredAssetResolving(
  state: DropdownFillState,
  kind: 'image' | 'video',
  resolving: boolean,
): void {
  const panel = kind === 'image' ? state.imagePanel : state.videoPanel;
  const preview = kind === 'image' ? state.imagePreview : state.videoPreview?.parentElement;
  const loadingState = kind === 'image' ? state.imagePreviewLoading : state.videoPreviewLoading;
  if (panel) panel.dataset.resolving = resolving ? 'true' : 'false';
  if (preview) preview.setAttribute('aria-busy', resolving ? 'true' : 'false');
  if (loadingState) loadingState.hidden = !resolving;
}

function formatSizeBytes(sizeBytes: number): string {
  const size = Math.trunc(sizeBytes);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${size} B`;
}

function setBrowserOpen(browser: HTMLElement | null, button: HTMLButtonElement | null, open: boolean): void {
  if (browser) browser.hidden = !open;
  if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function setAssetPanelMessage(target: HTMLElement | null, message: string): void {
  if (!target) return;
  target.textContent = message;
  target.hidden = !message;
}

function clearAssetBrowser(browserList: HTMLElement | null): void {
  if (!browserList) return;
  browserList.innerHTML = '';
}

function filterAssetsForKind(assets: AccountAssetRecord[], kind: 'image' | 'video'): AccountAssetRecord[] {
  if (kind === 'image') {
    return assets.filter((asset) => asset.assetType === 'image' || asset.assetType === 'vector');
  }
  return assets.filter((asset) => asset.assetType === 'video');
}

function syncImageHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  if (state.imageSrc) {
    deps.updateHeader(state, { text: state.imageName ?? '', muted: false, chipColor: null });
    return;
  }
  deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
}

function syncVideoHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  if (state.videoSrc) {
    deps.updateHeader(state, { text: state.videoName ?? '', muted: false, chipColor: null });
    return;
  }
  deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
}

function hasAvailableImage(state: DropdownFillState): boolean {
  return Boolean(state.imageSrc);
}

function hasAvailableVideo(state: DropdownFillState): boolean {
  return Boolean(state.videoSrc);
}

function syncImageMediaState(
  state: DropdownFillState,
  opts: { updateHeader?: boolean },
  deps: MediaControllerDeps,
): void {
  const hasImage = hasAvailableImage(state);
  if (state.imagePanel) {
    state.imagePanel.dataset.hasImage = hasImage ? 'true' : 'false';
  }
  if (state.removeButton) {
    state.removeButton.hidden = !hasImage;
    state.removeButton.disabled = !hasImage;
  }
  if (state.imagePreview) {
    state.imagePreview.style.backgroundImage = hasImage ? `url("${state.imageSrc}")` : 'none';
  }
  if (opts.updateHeader !== false) {
    syncImageHeader(state, deps);
  }
}

function syncVideoMediaState(
  state: DropdownFillState,
  opts: { updateHeader?: boolean },
  deps: MediaControllerDeps,
): void {
  const hasVideo = hasAvailableVideo(state);
  if (state.videoPanel) {
    state.videoPanel.dataset.hasVideo = hasVideo ? 'true' : 'false';
  }
  if (state.videoRemoveButton) {
    state.videoRemoveButton.hidden = !hasVideo;
    state.videoRemoveButton.disabled = !hasVideo;
  }
  if (opts.updateHeader !== false) {
    syncVideoHeader(state, deps);
  }
}

export function setImageSrc(
  state: DropdownFillState,
  src: string | null,
  opts: SetMediaSrcOptions,
  deps: MediaControllerDeps,
): void {
  setStoredAssetResolving(state, 'image', false);
  const shouldUpdateHeader = opts.updateHeader !== false;
  state.imageSrc = src;
  if (opts.commit) {
    const assetRef = state.imageAssetRef;
    const fill: FillValue = assetRef
      ? {
          type: 'image',
          image: {
            assetRef,
            ...(state.imageName ? { name: state.imageName } : {}),
            fit: 'cover',
            position: 'center',
            repeat: 'no-repeat',
          },
        }
      : { type: 'none' };
    deps.setInputValue(state, fill, true);
  }
  syncImageMediaState(state, { updateHeader: shouldUpdateHeader }, deps);
}

export function setVideoSrc(
  state: DropdownFillState,
  src: string | null,
  opts: SetMediaSrcOptions,
  deps: MediaControllerDeps,
): void {
  setStoredAssetResolving(state, 'video', false);
  const shouldUpdateHeader = opts.updateHeader !== false;
  state.videoSrc = src;
  if (opts.commit) {
    const assetRef = state.videoAssetRef;
    const fill: FillValue = assetRef
      ? {
          type: 'video',
          video: {
            assetRef,
            ...(state.videoName ? { name: state.videoName } : {}),
            ...(state.videoPosterAssetRef ? { posterAssetRef: state.videoPosterAssetRef } : {}),
            fit: 'cover',
            position: 'center',
            loop: true,
            muted: true,
            autoplay: true,
          },
        }
      : { type: 'none' };
    deps.setInputValue(state, fill, true);
  }
  if (state.videoPreview) {
    state.videoPreview.src = src || '';
    if (src) state.videoPreview.load();
  }
  syncVideoMediaState(state, { updateHeader: shouldUpdateHeader }, deps);
}

function renderAssetBrowserRows(args: {
  state: DropdownFillState;
  kind: 'image' | 'video';
  assets: AccountAssetRecord[];
  deps: MediaControllerDeps;
}): void {
  const browserList = args.kind === 'image' ? args.state.imageBrowserList : args.state.videoBrowserList;
  if (!browserList) return;
  browserList.innerHTML = '';

  if (!args.assets.length) {
    const empty = document.createElement('div');
    empty.className = 'diet-empty-state';
    const icon = document.createElement('span');
    icon.className = 'diet-empty-state__icon diet-icon diet-icon-mask';
    icon.dataset.icon = 'ellipsis';
    icon.style.setProperty('--diet-icon-source', "url('/dieter/icons/svg/ellipsis.svg')");
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'diet-empty-state__label body-s';
    label.textContent = args.state.copy.noAssets;
    empty.append(icon, label);
    browserList.appendChild(empty);
    return;
  }

  args.assets.forEach((asset) => {
    const row = document.createElement('div');
    row.className = 'diet-dropdown-fill__asset-browser-row';

    const meta = document.createElement('div');
    meta.className = 'diet-dropdown-fill__asset-browser-meta';

    const name = document.createElement('div');
    name.className = 'diet-dropdown-fill__asset-browser-name label-s';
    name.textContent = asset.filename;
    meta.appendChild(name);

    const subline = document.createElement('div');
    subline.className = 'diet-dropdown-fill__asset-browser-subline body-xs';
    subline.textContent = formatSizeBytes(asset.sizeBytes);
    meta.appendChild(subline);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diet-button diet-dropdown-fill__asset-browser-use';
    button.setAttribute('data-size', 'small');
    button.setAttribute('data-type', 'secondary');
    const label = document.createElement('span');
    label.className = 'diet-button__label';
    label.textContent = args.state.copy.useAsset;
    button.appendChild(label);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (args.kind === 'image') {
        commitImageAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
        setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
        return;
      }
      commitVideoAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
      setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
    });

    row.appendChild(meta);
    row.appendChild(button);
    browserList.appendChild(row);
  });
}

async function openAssetBrowser(args: {
  state: DropdownFillState;
  kind: 'image' | 'video';
  deps: MediaControllerDeps;
}): Promise<void> {
  const browser = args.kind === 'image' ? args.state.imageBrowser : args.state.videoBrowser;
  const browserMessage = args.kind === 'image' ? args.state.imageBrowserMessage : args.state.videoBrowserMessage;
  const browserList = args.kind === 'image' ? args.state.imageBrowserList : args.state.videoBrowserList;
  const button = args.kind === 'image' ? args.state.chooseButton : args.state.videoChooseButton;
  const oppositeBrowser = args.kind === 'image' ? args.state.videoBrowser : args.state.imageBrowser;
  const oppositeButton = args.kind === 'image' ? args.state.videoChooseButton : args.state.chooseButton;

  if (!browser || !button) return;

  if (!browser.hidden) {
    setBrowserOpen(browser, button, false);
    return;
  }

  setBrowserOpen(oppositeBrowser, oppositeButton, false);
  setBrowserOpen(browser, button, true);
  setFillCommandPending(args.state, button, true);
  setAssetPanelMessage(browserMessage, '');
  clearAssetBrowser(browserList);

  try {
    const assets = filterAssetsForKind(await args.state.accountAssets.listAssets(), args.kind);
    renderAssetBrowserRows({
      state: args.state,
      kind: args.kind,
      assets,
      deps: args.deps,
    });
  } catch {
    setAssetPanelMessage(browserMessage, args.state.copy.loadAssetsError);
    clearAssetBrowser(browserList);
  } finally {
    setFillCommandPending(args.state, button, false);
  }
}

async function handleAssetUpload(args: {
  state: DropdownFillState;
  kind: 'image' | 'video';
  file: File;
  deps: MediaControllerDeps;
}): Promise<void> {
  const button = args.kind === 'image' ? args.state.uploadButton : args.state.videoUploadButton;
  if (!button) return;
  setFillCommandPending(args.state, button, true);
  setAssetPanelMessage(args.kind === 'image' ? args.state.imageMessage : args.state.videoMessage, '');

  try {
    const asset = await args.state.accountAssets.uploadAsset(args.file, 'api');
    if (args.kind === 'image') {
      commitImageAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
      setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
      return;
    }
    commitVideoAssetSelection(args.state, asset.assetRef, asset.filename, true, args.deps);
    setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
  } catch (error) {
    const upsellReason = args.state.accountAssets.resolveUploadUpsellReason(error);
    if (upsellReason) {
      dispatchAccountAssetUpsell(args.state.root, upsellReason);
      return;
    }
    setAssetPanelMessage(
      args.kind === 'image' ? args.state.imageMessage : args.state.videoMessage,
      args.state.copy.uploadAssetError,
    );
  } finally {
    setFillCommandPending(args.state, button, false);
  }
}

function commitImageAssetSelection(
  state: DropdownFillState,
  assetRef: string,
  filename: string,
  commit: boolean,
  deps: MediaControllerDeps,
): void {
  state.imageAssetRef = assetRef;
  state.imageName = filename;
  setAssetPanelMessage(state.imageMessage, '');
  setImageSrc(state, null, { commit }, deps);
  void resolveImageAsset(state, deps);
}

function commitVideoAssetSelection(
  state: DropdownFillState,
  assetRef: string,
  filename: string,
  commit: boolean,
  deps: MediaControllerDeps,
): void {
  state.videoAssetRef = assetRef;
  state.videoName = filename;
  setAssetPanelMessage(state.videoMessage, '');
  setVideoSrc(state, null, { commit }, deps);
  void resolveVideoAsset(state, deps);
}

export async function resolveImageAsset(state: DropdownFillState, deps: MediaControllerDeps): Promise<void> {
  return resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetRef: () => state.imageAssetRef!,
    beginRequest: () => {
      state.imageResolveRequestId += 1;
      return state.imageResolveRequestId;
    },
    isCurrent: (requestId, assetRef) =>
      state.imageResolveRequestId === requestId && state.imageAssetRef === assetRef,
    onStart: () => {
      setAssetPanelMessage(state.imageMessage, '');
      setStoredAssetResolving(state, 'image', true);
    },
    onResolved: (asset) => {
      setImageSrc(state, asset.url, { commit: false }, deps);
    },
    onError: () => {
      setStoredAssetResolving(state, 'image', false);
      setAssetPanelMessage(state.imageMessage, state.copy.previewAssetError);
    },
  });
}

export async function resolveVideoAsset(state: DropdownFillState, deps: MediaControllerDeps): Promise<void> {
  return resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetRef: () => state.videoAssetRef!,
    beginRequest: () => {
      state.videoResolveRequestId += 1;
      return state.videoResolveRequestId;
    },
    isCurrent: (requestId, assetRef) =>
      state.videoResolveRequestId === requestId && state.videoAssetRef === assetRef,
    onStart: () => {
      setAssetPanelMessage(state.videoMessage, '');
      setStoredAssetResolving(state, 'video', true);
    },
    onResolved: (asset) => {
      setVideoSrc(state, asset.url, { commit: false }, deps);
    },
    onError: () => {
      setStoredAssetResolving(state, 'video', false);
      setAssetPanelMessage(state.videoMessage, state.copy.previewAssetError);
    },
  });
}

export function installImageHandlers(state: DropdownFillState, deps: MediaControllerDeps): void {
  const { uploadButton, chooseButton, removeButton, fileInput } = state;
  if (uploadButton && fileInput) {
    uploadButton.disabled = false;
    uploadButton.hidden = false;
    fileInput.disabled = false;
    uploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void handleAssetUpload({ state, kind: 'image', file, deps });
    });
  }
  if (chooseButton) {
    chooseButton.disabled = false;
    chooseButton.hidden = false;
    chooseButton.addEventListener('click', (event) => {
      event.preventDefault();
      void openAssetBrowser({ state, kind: 'image', deps });
    });
  }
  if (removeButton) {
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      state.imageAssetRef = null;
      state.imageName = null;
      setAssetPanelMessage(state.imageMessage, '');
      setBrowserOpen(state.imageBrowser, state.chooseButton, false);
      setImageSrc(state, null, { commit: true }, deps);
      state.lastEnabledValue = null;
    });
  }
}

export function installVideoHandlers(state: DropdownFillState, deps: MediaControllerDeps): void {
  const { videoUploadButton, videoChooseButton, videoRemoveButton, videoFileInput } = state;
  if (state.videoPreview) {
    state.videoPreview.addEventListener('error', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      setAssetPanelMessage(state.videoMessage, state.copy.previewAssetError);
    });
    state.videoPreview.addEventListener('loadeddata', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      if (state.videoMessage?.textContent !== state.copy.previewAssetError) return;
      setAssetPanelMessage(state.videoMessage, '');
    });
  }
  if (videoUploadButton && videoFileInput) {
    videoUploadButton.disabled = false;
    videoUploadButton.hidden = false;
    videoFileInput.disabled = false;
    videoUploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      videoFileInput.value = '';
      videoFileInput.click();
    });
    videoFileInput.addEventListener('change', () => {
      const file = videoFileInput.files?.[0];
      if (!file) return;
      void handleAssetUpload({ state, kind: 'video', file, deps });
    });
  }
  if (videoChooseButton) {
    videoChooseButton.disabled = false;
    videoChooseButton.hidden = false;
    videoChooseButton.addEventListener('click', (event) => {
      event.preventDefault();
      void openAssetBrowser({ state, kind: 'video', deps });
    });
  }
  if (videoRemoveButton) {
    videoRemoveButton.addEventListener('click', (event) => {
      event.preventDefault();
      state.videoAssetRef = null;
      state.videoPosterAssetRef = null;
      state.videoName = null;
      setAssetPanelMessage(state.videoMessage, '');
      setBrowserOpen(state.videoBrowser, state.videoChooseButton, false);
      setVideoSrc(state, null, { commit: true }, deps);
      state.lastEnabledValue = null;
    });
  }
}
