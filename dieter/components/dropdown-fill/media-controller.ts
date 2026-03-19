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
    uploadButton.disabled = true;
    uploadButton.hidden = true;
    fileInput.disabled = true;
  }
  if (chooseButton) {
    chooseButton.disabled = true;
    chooseButton.hidden = true;
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
    videoUploadButton.disabled = true;
    videoUploadButton.hidden = true;
    videoFileInput.disabled = true;
  }
  if (videoChooseButton) {
    videoChooseButton.disabled = true;
    videoChooseButton.hidden = true;
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
      setVideoSrc(state, null, { commit: true }, deps);
    });
  }
}
