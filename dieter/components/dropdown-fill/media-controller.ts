import { sameAssetReferenceUrl } from './color-utils';
import type { DropdownFillHeaderUpdate, DropdownFillState } from './dropdown-fill-types';
import type { FillValue } from './fill-types';
import {
  dispatchAccountAssetUpsell,
  type AccountAssetRecord,
} from '../shared/account-assets';
import { resolveSingleAccountAsset } from '../shared/account-asset-resolve';

const VIDEO_PREVIEW_FAILED_MESSAGE = 'Preview failed to load.';

export type SetMediaSrcOptions = {
  commit: boolean;
  updateHeader?: boolean;
  updateRemove?: boolean;
};

export type MediaControllerDeps = {
  setInputValue: (state: DropdownFillState, value: FillValue, emit: boolean) => void;
  updateHeader: (state: DropdownFillState, opts: DropdownFillHeaderUpdate) => void;
  setRemoveFillState: (state: DropdownFillState, isEmpty: boolean) => void;
};

function setFillUploadingState(state: DropdownFillState, uploading: boolean): void {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  if (state.uploadButton) state.uploadButton.disabled = uploading;
  if (state.chooseButton) state.chooseButton.disabled = uploading;
  if (state.removeButton) state.removeButton.disabled = uploading;
  if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
  if (state.videoChooseButton) state.videoChooseButton.disabled = uploading;
  if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
}

function formatSizeBytes(sizeBytes: number): string {
  const size = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
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
    const label = state.imageName || 'Image selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
    return;
  }
  deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
}

function syncVideoHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  if (state.videoSrc) {
    const label = state.videoName || 'Video selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
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
  opts: { updateHeader?: boolean; updateRemove?: boolean },
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
  if (opts.updateRemove !== false) {
    deps.setRemoveFillState(state, !hasImage);
  }
}

function syncVideoMediaState(
  state: DropdownFillState,
  opts: { updateHeader?: boolean; updateRemove?: boolean },
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
  if (opts.updateRemove !== false) {
    deps.setRemoveFillState(state, !hasVideo);
  }
}

export function setImageSrc(
  state: DropdownFillState,
  src: string | null,
  opts: SetMediaSrcOptions,
  deps: MediaControllerDeps,
): void {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const previousSrc = state.imageSrc;
  if (state.imageObjectUrl && previousSrc && previousSrc === state.imageObjectUrl && src !== previousSrc) {
    URL.revokeObjectURL(state.imageObjectUrl);
    state.imageObjectUrl = null;
  }
  state.imageSrc = src;
  if (opts.commit) {
    const assetId = String(state.imageAssetId || '').trim();
    const fill: FillValue = assetId
      ? {
          type: 'image',
          image: {
            assetId,
            ...(state.imageName ? { name: state.imageName } : {}),
            fit: 'cover',
            position: 'center',
            repeat: 'no-repeat',
          },
        }
      : { type: 'none' };
    deps.setInputValue(state, fill, true);
  }
  syncImageMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
}

export function setVideoSrc(
  state: DropdownFillState,
  src: string | null,
  opts: SetMediaSrcOptions,
  deps: MediaControllerDeps,
): void {
  const shouldUpdateHeader = opts.updateHeader !== false;
  const shouldUpdateRemove = opts.updateRemove !== false;
  const previousSrc = state.videoSrc;
  if (state.videoObjectUrl && previousSrc && previousSrc === state.videoObjectUrl && src !== previousSrc) {
    URL.revokeObjectURL(state.videoObjectUrl);
    state.videoObjectUrl = null;
  }
  state.videoSrc = src;
  if (opts.commit) {
    const assetId = String(state.videoAssetId || '').trim();
    const fill: FillValue = assetId
      ? {
          type: 'video',
          video: {
            assetId,
            ...(state.videoName ? { name: state.videoName } : {}),
            ...(state.videoPosterAssetId ? { posterAssetId: state.videoPosterAssetId } : {}),
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
  syncVideoMediaState(state, { updateHeader: shouldUpdateHeader, updateRemove: shouldUpdateRemove }, deps);
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
    empty.className = 'diet-dropdown-fill__asset-browser-empty body-s';
    empty.textContent = 'No assets found.';
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
    subline.textContent = `${asset.assetType} • ${formatSizeBytes(asset.sizeBytes)}`;
    meta.appendChild(subline);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diet-btn-txt diet-dropdown-fill__asset-browser-use';
    button.setAttribute('data-size', 'sm');
    button.setAttribute('data-variant', 'line1');
    button.innerHTML = '<span class="diet-btn-txt__label body-s">Use</span>';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (args.kind === 'image') {
        commitImageAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
        setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
        return;
      }
      commitVideoAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
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
  setFillUploadingState(args.state, true);
  setAssetPanelMessage(browserMessage, 'Loading assets…');
  clearAssetBrowser(browserList);

  try {
    const assets = filterAssetsForKind(await args.state.accountAssets.listAssets(), args.kind);
    setAssetPanelMessage(browserMessage, assets.length ? '' : 'No assets available yet.');
    renderAssetBrowserRows({
      state: args.state,
      kind: args.kind,
      assets,
      deps: args.deps,
    });
  } catch (error) {
    setAssetPanelMessage(
      browserMessage,
      error instanceof Error ? error.message : 'coreui.errors.db.readFailed',
    );
    clearAssetBrowser(browserList);
  } finally {
    setFillUploadingState(args.state, false);
  }
}

async function handleAssetUpload(args: {
  state: DropdownFillState;
  kind: 'image' | 'video';
  file: File;
  deps: MediaControllerDeps;
}): Promise<void> {
  setFillUploadingState(args.state, true);
  setAssetPanelMessage(args.kind === 'image' ? args.state.imageMessage : args.state.videoMessage, '');

  try {
    const asset = await args.state.accountAssets.uploadAsset(args.file, 'api');
    if (args.kind === 'image') {
      commitImageAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
      setBrowserOpen(args.state.imageBrowser, args.state.chooseButton, false);
      return;
    }
    commitVideoAssetSelection(args.state, asset.assetId, asset.filename, true, args.deps);
    setBrowserOpen(args.state.videoBrowser, args.state.videoChooseButton, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'coreui.errors.assets.uploadFailed';
    if (dispatchAccountAssetUpsell(args.state.root, message)) {
      return;
    }
    setAssetPanelMessage(args.kind === 'image' ? args.state.imageMessage : args.state.videoMessage, message);
  } finally {
    setFillUploadingState(args.state, false);
  }
}

function commitImageAssetSelection(
  state: DropdownFillState,
  assetId: string,
  filename: string,
  commit: boolean,
  deps: MediaControllerDeps,
): void {
  state.imageAssetId = assetId;
  state.imageName = filename;
  setAssetPanelMessage(state.imageMessage, '');
  setImageSrc(state, null, { commit }, deps);
  void resolveImageAsset(state, deps);
}

function commitVideoAssetSelection(
  state: DropdownFillState,
  assetId: string,
  filename: string,
  commit: boolean,
  deps: MediaControllerDeps,
): void {
  state.videoAssetId = assetId;
  state.videoName = filename;
  setAssetPanelMessage(state.videoMessage, '');
  setVideoSrc(state, null, { commit }, deps);
  void resolveVideoAsset(state, deps);
}

export async function resolveImageAsset(state: DropdownFillState, deps: MediaControllerDeps): Promise<void> {
  return resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetId: () => String(state.imageAssetId || '').trim(),
    beginRequest: () => {
      state.imageResolveRequestId += 1;
      return state.imageResolveRequestId;
    },
    isCurrent: (requestId, assetId) =>
      state.imageResolveRequestId === requestId && String(state.imageAssetId || '').trim() === assetId,
    onStart: () => setAssetPanelMessage(state.imageMessage, ''),
    onMissing: () => {
      setAssetPanelMessage(state.imageMessage, 'Asset unavailable.');
      setImageSrc(state, null, { commit: false }, deps);
    },
    onResolved: (asset) => {
      setImageSrc(state, asset.url, { commit: false }, deps);
    },
    onError: (message) => {
      setAssetPanelMessage(state.imageMessage, message);
    },
  });
}

export async function resolveVideoAsset(state: DropdownFillState, deps: MediaControllerDeps): Promise<void> {
  return resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetId: () => String(state.videoAssetId || '').trim(),
    beginRequest: () => {
      state.videoResolveRequestId += 1;
      return state.videoResolveRequestId;
    },
    isCurrent: (requestId, assetId) =>
      state.videoResolveRequestId === requestId && String(state.videoAssetId || '').trim() === assetId,
    onStart: () => setAssetPanelMessage(state.videoMessage, ''),
    onMissing: () => {
      setAssetPanelMessage(state.videoMessage, 'Asset unavailable.');
      setVideoSrc(state, null, { commit: false }, deps);
    },
    onResolved: (asset) => {
      setVideoSrc(state, asset.url, { commit: false }, deps);
    },
    onError: (message) => {
      setAssetPanelMessage(state.videoMessage, message);
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
      if (state.imageObjectUrl) {
        URL.revokeObjectURL(state.imageObjectUrl);
        state.imageObjectUrl = null;
      }
      state.imageAssetId = null;
      state.imageName = null;
      setAssetPanelMessage(state.imageMessage, '');
      setBrowserOpen(state.imageBrowser, state.chooseButton, false);
      setImageSrc(state, null, { commit: true }, deps);
    });
  }
}

export function installVideoHandlers(state: DropdownFillState, deps: MediaControllerDeps): void {
  const { videoUploadButton, videoChooseButton, videoRemoveButton, videoFileInput } = state;
  if (state.videoPreview) {
    state.videoPreview.addEventListener('error', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      setAssetPanelMessage(state.videoMessage, VIDEO_PREVIEW_FAILED_MESSAGE);
    });
    state.videoPreview.addEventListener('loadeddata', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      if ((state.videoMessage?.textContent || '').trim() !== VIDEO_PREVIEW_FAILED_MESSAGE) return;
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
      if (state.videoObjectUrl) {
        URL.revokeObjectURL(state.videoObjectUrl);
        state.videoObjectUrl = null;
      }
      state.videoAssetId = null;
      state.videoPosterAssetId = null;
      state.videoName = null;
      setAssetPanelMessage(state.videoMessage, '');
      setBrowserOpen(state.videoBrowser, state.videoChooseButton, false);
      setVideoSrc(state, null, { commit: true }, deps);
    });
  }
}
