import { uploadEditorAsset } from '../shared/assetUpload';
import { fetchImageAssetChoices, toAssetPickerOverlayItems } from './asset-picker-data';
import { normalizeAssetReferenceUrl, sameAssetReferenceUrl } from './color-utils';
import type { DropdownFillHeaderUpdate, DropdownFillState } from './dropdown-fill';
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

function setFillUploadingState(state: DropdownFillState, uploading: boolean): void {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  if (state.uploadButton) state.uploadButton.disabled = uploading;
  if (state.chooseButton) state.chooseButton.disabled = uploading;
  if (state.removeButton) state.removeButton.disabled = uploading;
  if (state.videoUploadButton) state.videoUploadButton.disabled = uploading;
  if (state.videoReplaceButton) state.videoReplaceButton.disabled = uploading;
  if (state.videoRemoveButton) state.videoRemoveButton.disabled = uploading;
}

function syncImageHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  const placeholder = state.headerValue?.dataset.placeholder ?? '';
  if (state.imageSrc && !state.imageUnavailable) {
    const label = state.imageName || 'Image selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
    return;
  }
  if (state.imageSrc && state.imageUnavailable) {
    deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
    return;
  }
  deps.updateHeader(state, { text: placeholder, muted: true, chipColor: null });
}

function syncVideoHeader(state: DropdownFillState, deps: MediaControllerDeps): void {
  const placeholder = state.headerValue?.dataset.placeholder ?? '';
  if (state.videoSrc && !state.videoUnavailable) {
    const label = state.videoName || 'Video selected';
    deps.updateHeader(state, { text: label, muted: false, chipColor: null });
    return;
  }
  if (state.videoSrc && state.videoUnavailable) {
    deps.updateHeader(state, { text: '', muted: true, chipColor: null, noneChip: true });
    return;
  }
  deps.updateHeader(state, { text: placeholder, muted: true, chipColor: null });
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

async function openImageAssetPicker(state: DropdownFillState): Promise<void> {
  if (!state.assetPickerOverlay || !state.chooseButton) return;
  state.assetPickerOverlay.open(state.chooseButton);
  state.assetPickerOverlay.setMessage('Loading assets...');
  state.assetPickerOverlay.setRows([]);
  state.imageAssetPickerLoading = true;

  try {
    const assets = await fetchImageAssetChoices();
    const rows = toAssetPickerOverlayItems(assets);
    state.assetPickerOverlay.setRows(rows);
    if (assets.length === 0) {
      state.assetPickerOverlay.setMessage('No assets available.');
    } else {
      state.assetPickerOverlay.setMessage(`Select from ${assets.length} image asset${assets.length === 1 ? '' : 's'}.`);
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
    state.imageName = null;
    state.imageUnavailable = false;
    state.imageAvailabilityRequestId += 1;
  } else if (!sameAssetReferenceUrl(src, previousSrc ?? '')) {
    state.imageUnavailable = false;
  }
  if (opts.commit) {
    const fill: FillValue = src
      ? {
          type: 'image',
          image: {
            src,
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
    state.videoName = null;
    state.videoUnavailable = false;
  } else if (!sameAssetReferenceUrl(src, previousSrc ?? '')) {
    state.videoUnavailable = false;
  }
  if (opts.commit) {
    const fill: FillValue = src
      ? {
          type: 'video',
          video: {
            src,
            ...(state.videoName ? { name: state.videoName } : {}),
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
      state.assetPickerOverlay.open(chooseButton);
      void openImageAssetPicker(state);
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
      setImageSrc(state, null, { commit: true }, deps);
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const previousSrc = state.imageSrc;
      const previousName = state.imageName;
      state.imageName = file.name || null;
      setFillUploadingState(state, true);
      state.assetPickerOverlay?.close();
      deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      const localPreviewUrl = URL.createObjectURL(file);
      state.imageObjectUrl = localPreviewUrl;
      setImageSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
      try {
        const uploadedUrl = await uploadEditorAsset({
          file,
          variant: 'original',
          source: 'api',
        });
        setImageSrc(state, uploadedUrl, { commit: true }, deps);
      } catch {
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
  const { videoUploadButton, videoReplaceButton, videoRemoveButton, videoFileInput } = state;
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
  if (videoReplaceButton && videoFileInput) {
    videoReplaceButton.addEventListener('click', (event) => {
      event.preventDefault();
      videoFileInput.value = '';
      videoFileInput.click();
    });
  }
  if (videoRemoveButton) {
    videoRemoveButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.videoObjectUrl) {
        URL.revokeObjectURL(state.videoObjectUrl);
        state.videoObjectUrl = null;
      }
      setVideoSrc(state, null, { commit: true }, deps);
    });
  }
  if (videoFileInput) {
    videoFileInput.addEventListener('change', async () => {
      const file = videoFileInput.files && videoFileInput.files[0];
      if (!file) return;
      const previousSrc = state.videoSrc;
      const previousName = state.videoName;
      state.videoName = file.name || null;
      setFillUploadingState(state, true);
      deps.updateHeader(state, { text: `Uploading ${file.name}...`, muted: true, chipColor: null });
      const localPreviewUrl = URL.createObjectURL(file);
      state.videoObjectUrl = localPreviewUrl;
      setVideoSrc(state, localPreviewUrl, { commit: false, updateHeader: true, updateRemove: true }, deps);
      try {
        const uploadedUrl = await uploadEditorAsset({
          file,
          variant: 'original',
          source: 'api',
        });
        setVideoSrc(state, uploadedUrl, { commit: true }, deps);
      } catch {
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
