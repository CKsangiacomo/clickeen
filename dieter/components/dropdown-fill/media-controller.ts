import { uploadEditorAsset } from '../shared/assetUpload';
import { fetchImageAssetChoices, fetchVideoAssetChoices, toAssetPickerOverlayItems } from './asset-picker-data';
import { normalizeAssetReferenceUrl, sameAssetReferenceUrl } from './color-utils';
import type { DropdownFillHeaderUpdate, DropdownFillState } from './dropdown-fill-types';
import type { FillValue } from './fill-types';

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

const ASSET_ENTITLEMENT_REASON_KEYS = new Set([
  'coreui.upsell.reason.budgetExceeded',
  'coreui.upsell.reason.capReached',
]);

function isAssetEntitlementReasonKey(value: string): boolean {
  const reasonKey = String(value || '').trim();
  return ASSET_ENTITLEMENT_REASON_KEYS.has(reasonKey);
}

function dispatchAssetEntitlementGate(root: HTMLElement, reasonKey: string): void {
  root.dispatchEvent(
    new CustomEvent('bob-upsell', {
      bubbles: true,
      detail: { reasonKey },
    }),
  );
  if (typeof window === 'undefined') return;
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ type: 'bob:asset-entitlement-denied', reasonKey }, '*');
}

function setFillUploadingState(state: DropdownFillState, uploading: boolean): void {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  if (state.uploadButton) state.uploadButton.disabled = uploading;
  if (state.chooseButton) state.chooseButton.disabled = uploading;
  if (state.removeButton) state.removeButton.disabled = uploading;
  if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
  if (state.videoChooseButton) state.videoChooseButton.disabled = uploading;
  if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
}

function syncImageHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  if (state.imageSrc && !state.imageUnavailable) {
    const label = state.imageName || 'Image selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
    return;
  }
  deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
}

function syncVideoHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  if (state.videoSrc && !state.videoUnavailable) {
    const label = state.videoName || 'Video selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
    return;
  }
  deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
}

function hasAvailableImage(state: DropdownFillState): boolean {
  return Boolean(state.imageSrc && !state.imageUnavailable);
}

function hasAvailableVideo(state: DropdownFillState): boolean {
  return Boolean(state.videoSrc && !state.videoUnavailable);
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

function verifyImageAvailability(state: DropdownFillState, src: string, deps: MediaControllerDeps): void {
  const normalizedSrc = normalizeAssetReferenceUrl(src);
  if (!normalizedSrc) {
    state.imageUnavailable = true;
    if (state.mode === 'image') syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
    return;
  }

  state.imageAvailabilityRequestId += 1;
  const requestId = state.imageAvailabilityRequestId;
  const probe = new Image();
  const finalize = (available: boolean) => {
    if (state.imageAvailabilityRequestId !== requestId) return;
    if (!sameAssetReferenceUrl(state.imageSrc || '', normalizedSrc)) return;
    const nextUnavailable = !available;
    if (state.imageUnavailable === nextUnavailable) return;
    state.imageUnavailable = nextUnavailable;
    if (state.mode === 'image') syncImageMediaState(state, { updateHeader: true, updateRemove: true }, deps);
  };

  probe.addEventListener('load', () => finalize(true), { once: true });
  probe.addEventListener('error', () => finalize(false), { once: true });
  probe.src = normalizedSrc;
}

async function openAssetPicker(state: DropdownFillState, kind: 'image' | 'video'): Promise<void> {
  if (!state.assetPickerOverlay) return;
  state.assetPickerKind = kind;
  const anchorButton = kind === 'video' ? state.videoChooseButton : state.chooseButton;
  if (!anchorButton) return;
  state.assetPickerOverlay.open(anchorButton);
  state.assetPickerOverlay.setMessage('Loading assets...');
  state.assetPickerOverlay.setRows([]);
  state.imageAssetPickerLoading = true;

  try {
    const assets = kind === 'video' ? await fetchVideoAssetChoices() : await fetchImageAssetChoices();
    const rows = toAssetPickerOverlayItems(assets);
    state.assetPickerOverlay.setRows(rows);
    if (assets.length === 0) {
      state.assetPickerOverlay.setMessage(kind === 'video' ? 'No video assets available.' : 'No image assets available.');
    } else {
      const mediaLabel = kind === 'video' ? 'video asset' : 'image asset';
      state.assetPickerOverlay.setMessage(`Select from ${assets.length} ${mediaLabel}${assets.length === 1 ? '' : 's'}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load assets.';
    state.assetPickerOverlay.setMessage(message || 'Failed to load assets.');
    state.assetPickerOverlay.setRows([]);
  } finally {
    state.imageAssetPickerLoading = false;
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
  if (!src) {
    state.imageUnavailable = false;
    state.imageAvailabilityRequestId += 1;
  } else if (!sameAssetReferenceUrl(src, previousSrc ?? '')) {
    state.imageUnavailable = false;
  }
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
  if (src) {
    verifyImageAvailability(state, src, deps);
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
  if (!src) {
    state.videoUnavailable = false;
  } else if (!sameAssetReferenceUrl(src, previousSrc ?? '')) {
    state.videoUnavailable = false;
  }
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

export function installImageHandlers(state: DropdownFillState, deps: MediaControllerDeps): void {
  const { uploadButton, chooseButton, removeButton, fileInput } = state;
  if (uploadButton && fileInput) {
    uploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });
  }
  if (chooseButton) {
    chooseButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!state.assetPickerOverlay) return;
      if (state.assetPickerOverlay.isOpen()) {
        state.assetPickerOverlay.close();
        return;
      }
      void openAssetPicker(state, 'image');
    });
  }
  if (removeButton) {
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.imageObjectUrl) {
        URL.revokeObjectURL(state.imageObjectUrl);
        state.imageObjectUrl = null;
      }
      state.assetPickerOverlay?.close();
      state.imageAssetId = null;
      state.imageName = null;
      setImageSrc(state, null, { commit: true }, deps);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const previousSrc = state.imageSrc;
      const previousAssetId = state.imageAssetId;
      const previousName = state.imageName;
      state.imageName = file.name || null;
      setFillUploadingState(state, true);
      state.assetPickerOverlay?.close();
      deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      const localPreviewUrl = URL.createObjectURL(file);
      state.imageObjectUrl = localPreviewUrl;
      setImageSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
      try {
        const uploaded = await uploadEditorAsset({
          file,
          source: 'api',
        });
        state.imageAssetId = uploaded.assetId;
        setImageSrc(state, uploaded.url, { commit: true }, deps);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isAssetEntitlementReasonKey(message)) {
          dispatchAssetEntitlementGate(state.root, message);
        }
        state.imageAssetId = previousAssetId;
        state.imageName = previousName;
        setImageSrc(state, previousSrc, { commit: false, updateHeader: true, updateRemove: true }, deps);
        if (!previousSrc) {
          deps.updateHeader(state, { text: 'Upload failed', muted: true, chipColor: null, noneChip: true });
        }
      } finally {
        setFillUploadingState(state, false);
        fileInput.value = '';
      }
    });
  }
}

export function installVideoHandlers(state: DropdownFillState, deps: MediaControllerDeps): void {
  const { videoUploadButton, videoChooseButton, videoRemoveButton, videoFileInput } = state;
  if (state.videoPreview) {
    state.videoPreview.addEventListener('error', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      if (state.videoUnavailable) return;
      state.videoUnavailable = true;
      if (state.mode === 'video') syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
    });
    state.videoPreview.addEventListener('loadeddata', () => {
      const currentSrc = state.videoPreview?.currentSrc || state.videoPreview?.src || '';
      if (!state.videoSrc || !sameAssetReferenceUrl(currentSrc, state.videoSrc)) return;
      if (!state.videoUnavailable) return;
      state.videoUnavailable = false;
      if (state.mode === 'video') syncVideoMediaState(state, { updateHeader: true, updateRemove: true }, deps);
    });
  }
  if (videoUploadButton && videoFileInput) {
    videoUploadButton.addEventListener('click', (event) => {
      event.preventDefault();
      videoFileInput.value = '';
      videoFileInput.click();
    });
  }
  if (videoChooseButton) {
    videoChooseButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (!state.assetPickerOverlay) return;
      if (state.assetPickerOverlay.isOpen()) {
        state.assetPickerOverlay.close();
        return;
      }
      void openAssetPicker(state, 'video');
    });
  }
  if (videoRemoveButton) {
    videoRemoveButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.videoObjectUrl) {
        URL.revokeObjectURL(state.videoObjectUrl);
        state.videoObjectUrl = null;
      }
      state.assetPickerOverlay?.close();
      state.videoAssetId = null;
      state.videoPosterAssetId = null;
      state.videoName = null;
      setVideoSrc(state, null, { commit: true }, deps);
    });
  }
  if (videoFileInput) {
    videoFileInput.addEventListener('change', async () => {
      const file = videoFileInput.files && videoFileInput.files[0];
      if (!file) return;
      const previousSrc = state.videoSrc;
      const previousAssetId = state.videoAssetId;
      const previousPosterAssetId = state.videoPosterAssetId;
      const previousName = state.videoName;
      state.videoName = file.name || null;
      setFillUploadingState(state, true);
      state.assetPickerOverlay?.close();
      deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      const localPreviewUrl = URL.createObjectURL(file);
      state.videoObjectUrl = localPreviewUrl;
      setVideoSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
      try {
        const uploaded = await uploadEditorAsset({
          file,
          source: 'api',
        });
        state.videoAssetId = uploaded.assetId;
        state.videoPosterAssetId = null;
        setVideoSrc(state, uploaded.url, { commit: true }, deps);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (isAssetEntitlementReasonKey(message)) {
          dispatchAssetEntitlementGate(state.root, message);
        }
        state.videoAssetId = previousAssetId;
        state.videoPosterAssetId = previousPosterAssetId;
        state.videoName = previousName;
        setVideoSrc(state, previousSrc, { commit: false, updateHeader: true, updateRemove: true }, deps);
        if (!previousSrc) {
          deps.updateHeader(state, { text: 'Upload failed', muted: true, chipColor: null, noneChip: true });
        }
      } finally {
        setFillUploadingState(state, false);
        videoFileInput.value = '';
      }
    });
  }
}
