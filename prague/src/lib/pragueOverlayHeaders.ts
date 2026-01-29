import type { PragueOverlayMeta } from './pragueL10n';

export function setPragueOverlayHeaders(headers: Headers, meta: PragueOverlayMeta) {
  headers.set('X-Prague-Overlay-Status', meta.overlayStatus);
  headers.set('X-Prague-Overlay-Locale', meta.overlayLocale);
}

