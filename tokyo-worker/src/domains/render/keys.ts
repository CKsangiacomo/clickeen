export function accountInstanceRoot(accountId: string, publicId: string): string {
  return `accounts/${accountId}/instances/${publicId}`;
}

export function accountInstanceRenderLivePointerKey(accountId: string, publicId: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/render/live/pointer.json`;
}

export function accountInstanceRenderConfigPackKey(accountId: string, publicId: string, configFp: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/render/config/${configFp}.json`;
}

export function accountInstanceSavedPointerKey(accountId: string, publicId: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/saved/pointer.json`;
}

export function accountInstanceSavedConfigPackKey(accountId: string, publicId: string, configFp: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/saved/config/${configFp}.json`;
}

export function accountInstanceL10nBaseSnapshotKey(accountId: string, publicId: string, baseFingerprint: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/l10n/bases/${baseFingerprint}.snapshot.json`;
}

export function accountInstanceRenderMetaLivePointerKey(accountId: string, publicId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/render/meta/${locale}/live.json`;
}

export function accountInstanceRenderMetaPackKey(accountId: string, publicId: string, locale: string, metaFp: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/render/meta/${locale}/${metaFp}.json`;
}

export function accountInstanceL10nLivePointerKey(accountId: string, publicId: string, locale: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/l10n/live/${locale}.json`;
}

export function accountInstanceL10nTextPackKey(accountId: string, publicId: string, locale: string, textFp: string): string {
  return `${accountInstanceRoot(accountId, publicId)}/l10n/packs/${locale}/${textFp}.json`;
}

export function publicProjectionRoot(publicId: string): string {
  return `public/instances/${publicId}`;
}

export function publicProjectionRenderLivePointerKey(publicId: string): string {
  return `${publicProjectionRoot(publicId)}/live.json`;
}

export function publicProjectionRenderConfigPackKey(publicId: string, configFp: string): string {
  return `${publicProjectionRoot(publicId)}/config/${configFp}.json`;
}

export function publicProjectionRenderMetaLivePointerKey(publicId: string, locale: string): string {
  return `${publicProjectionRoot(publicId)}/meta/live/${locale}.json`;
}

export function publicProjectionRenderMetaPackKey(publicId: string, locale: string, metaFp: string): string {
  return `${publicProjectionRoot(publicId)}/meta/${locale}/${metaFp}.json`;
}

export function publicProjectionL10nLivePointerKey(publicId: string, locale: string): string {
  return `${publicProjectionRoot(publicId)}/l10n/live/${locale}.json`;
}

export function publicProjectionL10nTextPackKey(publicId: string, locale: string, textFp: string): string {
  return `${publicProjectionRoot(publicId)}/l10n/packs/${locale}/${textFp}.json`;
}
